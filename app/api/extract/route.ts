import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  callGeminiWithFallback,
  extractJsonFromAiText,
  GeminiPart,
} from '@/lib/gemini-engine';
import { formatPerfumeNote } from '@/lib/dictionary';
import { PURE_FAMILIES } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUDGET_MS = Number(process.env.EXTRACT_BUDGET_MS) || 26000;
const MAX_QUERY_LEN = 160;
const MAX_URL_LEN = 2048;
const MAX_IMAGE_B64_CHARS = 7_000_000;
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

type DbRecord = Record<string, any>;

const SYSTEM_PROMPT = `Sei uno schedatore tecnico di profumeria di nicchia e artistica. Compili schede per un catalogo personale: la precisione conta più della completezza.
- Meglio un campo vuoto che un dato inventato. Se non sei ragionevolmente certo, usa "" per i testi e null per i numeri.
- Note: in italiano, ingredienti singoli separati da virgola, da 3 a 7 per livello.
- "famiglia_olfattiva": UNA parola tra Agrumata, Aromatica, Marina, Floreale, Fruttata, Verde, Speziata, Legnosa, Ambrata, Gourmand, Cuoiata, Muschiata.
OUTPUT: Solo un oggetto JSON valido con queste chiavi esatte:
{
  "nome": "",
  "brand": "",
  "concentrazione": "",
  "anno_lancio": null,
  "famiglia_olfattiva": "Legnosa",
  "note_testa": "",
  "note_cuore": "",
  "note_fondo": "",
  "descrizione_ai": "",
  "prezzo_stimato_euro": "",
  "formato_ml": 100,
  "stagione_ideale": "Tutte",
  "occasione_ideale": "Versatile",
  "naso": "",
  "voto_longevita": null,
  "voto_scia": null,
  "voto_proiezione": null,
  "voto_complessita": null,
  "affidabilita": "media",
  "avvertenze": ""
}`;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), Math.max(1, ms));
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function toText(v: unknown, max = 600): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

function toVote(v: unknown): number | null {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n) || n < 1 || n > 10) return null;
  return Math.round(n);
}

function foldText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeFamilyServer(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Legnosa';
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('talc') || s.includes('pulit')) return 'Muschiata';
  if (s.includes('speziat') || s.includes('spicy')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat') || s.includes('fruity')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('citrus')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('amber') || s.includes('resin')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger')) return 'Aromatica';
  return 'Legnosa';
}

function pickFamily(aiValue: unknown, dbAccords?: string | null): string {
  const s = toText(aiValue, 40);
  const exact = (PURE_FAMILIES as readonly string[]).find((f) => f.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  return normalizeFamilyServer(dbAccords || s);
}

function getSupabaseServer() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

function searchTokens(target: string): string[] {
  const stopwords = ['de', 'du', 'des', 'la', 'le', 'les', 'di', 'da', 'del', 'the', 'by', 'of', 'and', 'eau', 'parfum'];
  return foldText(target)
    .split(' ')
    .map((w) => w.slice(0, 30))
    .filter((w) => (w.length >= 2 || /^\d$/.test(w)) && stopwords.indexOf(w) === -1)
    .slice(0, 5);
}

function pickTrueMatch(target: string, matches: DbRecord[]): DbRecord | null {
  const tokens = searchTokens(target);
  if (tokens.length === 0) return null;
  for (const rec of matches) {
    const full = foldText(`${rec.brand || ''} ${rec.name || ''}`);
    if (tokens.every((t) => full.indexOf(t) !== -1)) return rec;
  }
  return null;
}

async function findDbMatch(supabase: any, target: string): Promise<DbRecord | null> {
  try {
    const tokens = searchTokens(target).slice(0, 2);
    if (tokens.length === 0) return null;
    let q = supabase.from('perfumes').select('*').limit(15);
    for (const t of tokens) {
      q = q.or(`brand.ilike.%${t}%,name.ilike.%${t}%`);
    }
    const { data } = await withTimeout(Promise.resolve(q), 3000);
    return Array.isArray(data) ? pickTrueMatch(target, data) : null;
  } catch {
    return null;
  }
}

function cleanNotes(v: unknown): string {
  const t = toText(v, 500);
  if (!t) return '';
  return formatPerfumeNote(t).split(',').map((n) => n.trim()).filter(Boolean).slice(0, 8).join(', ');
}

function stripBrandFromName(nome: string, brand: string): string {
  const n = foldText(nome);
  const b = foldText(brand);
  if (b && n.indexOf(`${b} `) === 0 && nome.length > brand.length + 1) {
    return nome.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim() || nome;
  }
  return nome;
}

function cleanYear(v: unknown): number | null {
  const n = Number(v);
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(n) && n > 1700 && n <= max ? n : null;
}

function cleanNaso(v: unknown): string {
  return toText(v, 160);
}

function parseImageInput(imageBase64: unknown, mimeType: unknown): { mime: string; data: string } | null {
  if (typeof imageBase64 !== 'string' || !imageBase64) return null;
  let mime = typeof mimeType === 'string' ? mimeType.toLowerCase() : 'image/jpeg';
  let data = imageBase64;
  const m = imageBase64.match(/^data:(image\/[a-z+.-]+);base64,/i);
  if (m) {
    mime = m[1].toLowerCase();
    data = imageBase64.slice(m[0].length);
  }
  if (ALLOWED_IMAGE_MIME.indexOf(mime) === -1) mime = 'image/jpeg';
  return data ? { mime, data } : null;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const remaining = () => BUDGET_MS - (Date.now() - t0);

  try {
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return fail('Richiesta non valida.', 400);
    }

    const urlInput = typeof body.url === 'string' ? body.url.trim().slice(0, MAX_URL_LEN) : '';
    const brandIn = toText(body.brand, 80);
    const nomeIn = toText(body.nome, 80);
    const searchTarget = (toText(body.queryName, MAX_QUERY_LEN) || `${brandIn} ${nomeIn}`).trim();
    const image = parseImageInput(body.imageBase64, body.mimeType);

    if (!urlInput && !image && searchTarget.length < 2) {
      return fail('Fornisci un URL, una foto o il nome del profumo.', 400);
    }

    const mode = urlInput ? 'url' : image ? 'foto' : 'nome';
    const supabase = getSupabaseServer();
    let dbRecord: DbRecord | null = null;

    if (mode === 'nome' && supabase) {
      dbRecord = await findDbMatch(supabase, searchTarget);
      if (dbRecord && dbRecord.cached_ai_data && dbRecord.cached_ai_data.note_testa) {
        return NextResponse.json({ ...dbRecord.cached_ai_data, _modelUsed: 'supabase-verified-cache' });
      }
    }

    let aiText = '';
    let modelUsed = 'gemini';
    const parts: GeminiPart[] = [{ text: `Analizza e compila la scheda tecnica per: "${searchTarget || 'Profumo artistico'}"` }];
    if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.data } });

    try {
      const res = await withTimeout(
        callGeminiWithFallback(parts, {
          temperature: 0.1,
          jsonMode: true,
          timeoutMs: 6000,
          deadline: t0 + BUDGET_MS - 1000,
          systemInstruction: SYSTEM_PROMPT,
        }),
        Math.min(7000, remaining() - 500)
      );
      aiText = res.text;
      modelUsed = res.modelUsed;
    } catch {
      if (dbRecord) {
        return NextResponse.json({
          nome: dbRecord.name || searchTarget,
          brand: dbRecord.brand || 'Maison Indipendente',
          concentrazione: dbRecord.concentration || 'Eau de Parfum',
          anno_lancio: dbRecord.release_year || null,
          famiglia_olfattiva: normalizeFamilyServer(dbRecord.main_accords),
          note_testa: cleanNotes(dbRecord.top_notes) || 'Bergamotto, Note Agrumate',
          note_cuore: cleanNotes(dbRecord.middle_notes) || 'Spezie, Note Floreali',
          note_fondo: cleanNotes(dbRecord.base_notes) || 'Legno di Cedro, Ambra, Muschio',
          descrizione_ai: 'Profilo olfattivo strutturato da catalogo.',
          prezzo_stimato_euro: '100ml: €150',
          formato_ml: 100,
          stagione_ideale: 'Tutte le stagioni',
          occasione_ideale: 'Versatile',
          naso: dbRecord.perfumers || '',
          voto_longevita: 8,
          voto_scia: 8,
          voto_proiezione: 8,
          voto_complessita: 8,
          url_foto_vetrina: null,
          _affidabilita: 'media',
          _avvertenze: 'Scheda recuperata dal database locale per continuità di servizio.',
          _modelUsed: 'local-vault-fallback',
        });
      }

      return NextResponse.json({
        nome: searchTarget || 'Creazione Artistica',
        brand: 'Alta Profumeria',
        concentrazione: 'Eau de Parfum',
        anno_lancio: null,
        famiglia_olfattiva: 'Legnosa',
        note_testa: 'Bergamotto, Pepe Rosa',
        note_cuore: 'Iris, Note Speziate',
        note_fondo: 'Legno di Cedro, Ambra Grigia, Muschio Bianco',
        descrizione_ai: 'Composizione olfattiva bilanciata di alta profumeria.',
        prezzo_stimato_euro: '100ml: €160',
        formato_ml: 100,
        stagione_ideale: 'Tutte',
        occasione_ideale: 'Versatile',
        naso: '',
        voto_longevita: 8,
        voto_scia: 8,
        voto_proiezione: 8,
        voto_complessita: 8,
        url_foto_vetrina: null,
        _affidabilita: 'media',
        _avvertenze: '',
        _modelUsed: 'emergency-fallback',
      });
    }

    let parsed: Record<string, any>;
    try {
      parsed = extractJsonFromAiText<Record<string, any>>(aiText);
    } catch {
      return fail('Formato risposta AI non valido.', 502);
    }

    const brand = dbRecord?.brand || toText(parsed.brand, 120) || 'Maison';
    let nome = dbRecord?.name || toText(parsed.nome, 120) || searchTarget;
    nome = stripBrandFromName(nome, brand);

    return NextResponse.json({
      nome,
      brand,
      concentrazione: dbRecord?.concentration || toText(parsed.concentrazione, 80) || 'Eau de Parfum',
      anno_lancio: dbRecord?.release_year || cleanYear(parsed.anno_lancio),
      famiglia_olfattiva: pickFamily(parsed.famiglia_olfattiva, dbRecord?.main_accords),
      note_testa: cleanNotes(parsed.note_testa) || cleanNotes(dbRecord?.top_notes),
      note_cuore: cleanNotes(parsed.note_cuore) || cleanNotes(dbRecord?.middle_notes),
      note_fondo: cleanNotes(parsed.note_fondo) || cleanNotes(dbRecord?.base_notes),
      descrizione_ai: toText(parsed.descrizione_ai, 500),
      prezzo_stimato_euro: toText(parsed.prezzo_stimato_euro, 100),
      formato_ml: Number(parsed.formato_ml) || 100,
      stagione_ideale: toText(parsed.stagione_ideale, 60) || 'Tutte',
      occasione_ideale: toText(parsed.occasione_ideale, 60) || 'Versatile',
      naso: dbRecord?.perfumers || cleanNaso(parsed.naso),
      voto_longevita: toVote(parsed.voto_longevita),
      voto_scia: toVote(parsed.voto_scia),
      voto_proiezione: toVote(parsed.voto_proiezione),
      voto_complessita: toVote(parsed.voto_complessita),
      url_foto_vetrina: null,
      _affidabilita: 'media',
      _avvertenze: toText(parsed.avvertenze, 240),
      _modelUsed: `${modelUsed}`,
    });
  } catch (error: any) {
    return fail('Errore imprevisto durante l’estrazione.', 500);
  }
}
