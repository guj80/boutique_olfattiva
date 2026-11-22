import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import {
  callAIWithFallback,
  extractJsonFromAiText,
  AIPart,
} from '@/lib/gemini-engine';
import { normalizeFamily, PURE_FAMILIES } from '@/lib/families';
import { formatPerfumeNote } from '@/lib/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ExtractRequestPayload {
  url?: string;
  queryName?: string;
  query?: string;
  brand?: string;
  nome?: string;
  concentration?: string;
  fromCatalogPick?: boolean;
  imageBase64?: string;
  mimeType?: string;
}

interface ExtractedPerfumeAI {
  brand: string;
  nome: string;
  concentrazione: string;
  famiglia_olfattiva: string;
  anno_lancio?: number | null;
  naso?: string;
  note_testa: string;
  note_cuore: string;
  note_fondo: string;
  prezzo_stimato_euro?: string;
  formato_ml?: number;
  varianti_rilevate?: string[];
}

interface ExtractedPerfumeResponse {
  brand: string;
  nome: string;
  concentrazione: string;
  famiglia_olfattiva: string;
  anno_lancio: number | null;
  naso: string;
  note_testa: string;
  note_cuore: string;
  note_fondo: string;
  note_olfattive: string;
  prezzo_stimato_euro: string;
  formato_ml: number;
  stagione_ideale: string;
  occasione_ideale: string;
  url_foto_vetrina: string | null;
  varianti_rilevate: string[];
  _modelUsed: string;
  _affidabilita: 'alta' | 'media' | 'bassa';
}

const EXTRACT_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    brand: { type: 'STRING' },
    nome: { type: 'STRING' },
    concentrazione: { type: 'STRING' },
    famiglia_olfattiva: { type: 'STRING' },
    anno_lancio: { type: 'INTEGER' },
    naso: { type: 'STRING' },
    note_testa: { type: 'STRING' },
    note_cuore: { type: 'STRING' },
    note_fondo: { type: 'STRING' },
    prezzo_stimato_euro: { type: 'STRING' },
    formato_ml: { type: 'INTEGER' },
    varianti_rilevate: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: [
    'brand',
    'nome',
    'concentrazione',
    'famiglia_olfattiva',
    'note_testa',
    'note_cuore',
    'note_fondo',
  ],
};

function isExtractedPerfumeAI(data: unknown): data is ExtractedPerfumeAI {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  const hasBrand = typeof obj.brand === 'string' && obj.brand.trim().length > 0;
  const hasNome = typeof obj.nome === 'string' && obj.nome.trim().length > 0;
  return hasBrand && hasNome;
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeStr(val?: string | null): string {
  return (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sanitizeLike(val: string): string {
  return val.replace(/[%_,()]/g, '').trim();
}

function cleanNote(raw?: string | null): string {
  if (!raw || !raw.trim()) return '';
  return formatPerfumeNote(raw).trim();
}

function buildUnifiedNotes(testa: string, cuore: string, fondo: string): string {
  return [testa, cuore, fondo].filter(Boolean).join(', ');
}

/**
 * Ricerca prioritaria su Supabase (`ultranicchia_import` e `perfumes`).
 * Restituisce dati verificati istantanei quando la fragranza e' in archivio.
 */
async function lookupInDatabase(
  supabase: ReturnType<typeof getSupabaseServer>,
  params: {
    brand?: string;
    nome?: string;
    queryText?: string;
    concentration?: string;
  }
): Promise<ExtractedPerfumeResponse | null> {
  if (!supabase) return null;

  const rawBrand = (params.brand || '').trim();
  const rawNome = (params.nome || '').trim();
  const rawQuery = (params.queryText || `${rawBrand} ${rawNome}`).trim();
  const normQuery = normalizeStr(rawQuery);
  if (!normQuery) return null;

  const tokens = normQuery.split(' ').filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;

  const firstToken = sanitizeLike(tokens[0]);
  const lastToken = sanitizeLike(tokens[tokens.length - 1]);

  // 1. Archivio Ultra-Nicchia (`ultranicchia_import`)
  try {
    const orFilter = [
      `nome.ilike.%${lastToken}%`,
      `nome.ilike.%${firstToken}%`,
      `brand.ilike.%${firstToken}%`,
    ].join(',');

    const { data: ultraRows } = await supabase
      .from('ultranicchia_import')
      .select('*')
      .or(orFilter)
      .limit(80);

    if (ultraRows && ultraRows.length > 0) {
      let best: any = null;
      let bestScore = 0;

      for (const row of ultraRows) {
        const b = String(row.brand || '').trim();
        const n = String(row.nome || '').trim();
        const fullNorm = normalizeStr(`${b} ${n}`);
        if (!fullNorm) continue;

        let hits = 0;
        for (const t of tokens) {
          if (fullNorm.includes(t)) hits++;
        }

        const ratio = hits / tokens.length;
        if (ratio < 0.75) continue;

        let score = ratio * 100;
        if (fullNorm === normQuery) score += 50;
        if (rawBrand && normalizeStr(b) === normalizeStr(rawBrand)) score += 20;
        if (rawNome && normalizeStr(n) === normalizeStr(rawNome)) score += 30;
        if (
          params.concentration &&
          row.concentrazione &&
          normalizeStr(row.concentrazione).includes(normalizeStr(params.concentration))
        ) {
          score += 20;
        }
        if (row.note_testa || row.note_cuore || row.note_fondo) score += 15;

        if (score > bestScore) {
          bestScore = score;
          best = row;
        }
      }

      if (best && bestScore >= 75) {
        const testa = cleanNote(best.note_testa);
        const cuore = cleanNote(best.note_cuore);
        const fondo = cleanNote(best.note_fondo);
        const fam =
          normalizeFamily(best.famiglia_tags) ||
          normalizeFamily(best.famiglia_originale) ||
          'Legnosa';

        return {
          brand: String(best.brand || '').trim(),
          nome: String(best.nome || '').trim(),
          concentrazione: String(best.concentrazione || 'Extrait de Parfum').trim(),
          famiglia_olfattiva: fam,
          anno_lancio: best.anno_lancio ? Number(best.anno_lancio) || null : null,
          naso: String(best.naso || '').trim(),
          note_testa: testa,
          note_cuore: cuore,
          note_fondo: fondo,
          note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
          prezzo_stimato_euro: best.prezzo ? String(best.prezzo).trim() : '',
          formato_ml: Number(best.formato_ml) || 50,
          stagione_ideale: 'Tutte le stagioni',
          occasione_ideale: 'Versatile',
          url_foto_vetrina: best.immagine_url ? String(best.immagine_url).trim() : null,
          varianti_rilevate: [],
          _modelUsed: 'archivio-ultranicchia',
          _affidabilita: testa || cuore || fondo ? 'alta' : 'media',
        };
      }
    }
  } catch {
    // passa al catalogo generale
  }

  // 2. Catalogo Generale (`perfumes`)
  try {
    const orFilter = [
      `name.ilike.%${lastToken}%`,
      `name.ilike.%${firstToken}%`,
    ].join(',');

    const { data: catRows } = await supabase
      .from('perfumes')
      .select(
        'brand, name, concentration, release_year, main_accords, top_notes, middle_notes, base_notes, perfumers'
      )
      .or(orFilter)
      .limit(120);

    if (catRows && catRows.length > 0) {
      let best: any = null;
      let bestScore = 0;
      const variants = new Set<string>();

      for (const row of catRows) {
        const b = String(row.brand || '').trim();
        const n = String(row.name || '').trim();
        const fullNorm = normalizeStr(`${b} ${n}`);
        if (!fullNorm) continue;

        let hits = 0;
        for (const t of tokens) {
          if (fullNorm.includes(t)) hits++;
        }

        const ratio = hits / tokens.length;
        if (ratio < 0.75) continue;

        if (row.concentration && normalizeStr(n).includes(normalizeStr(rawNome || lastToken))) {
          variants.add(String(row.concentration).trim());
        }

        let score = ratio * 100;
        if (fullNorm === normQuery) score += 50;
        if (rawBrand && normalizeStr(b) === normalizeStr(rawBrand)) score += 20;
        if (rawNome && normalizeStr(n) === normalizeStr(rawNome)) score += 30;
        if (
          params.concentration &&
          row.concentration &&
          normalizeStr(row.concentration).includes(normalizeStr(params.concentration))
        ) {
          score += 20;
        }
        if (row.top_notes || row.middle_notes || row.base_notes) score += 15;

        if (score > bestScore) {
          bestScore = score;
          best = row;
        }
      }

      if (best && bestScore >= 75) {
        const testa = cleanNote(best.top_notes);
        const cuore = cleanNote(best.middle_notes);
        const fondo = cleanNote(best.base_notes);
        const fam = normalizeFamily(best.main_accords) || 'Legnosa';
        const currentConc = String(best.concentration || 'Eau de Parfum').trim();
        variants.delete(currentConc);

        return {
          brand: String(best.brand || '').trim(),
          nome: String(best.name || '').trim(),
          concentrazione: currentConc,
          famiglia_olfattiva: fam,
          anno_lancio: best.release_year ? Number(best.release_year) || null : null,
          naso: String(best.perfumers || '').trim(),
          note_testa: testa,
          note_cuore: cuore,
          note_fondo: fondo,
          note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
          prezzo_stimato_euro: '',
          formato_ml: 100,
          stagione_ideale: 'Tutte le stagioni',
          occasione_ideale: 'Versatile',
          url_foto_vetrina: null,
          varianti_rilevate: Array.from(variants).slice(0, 4),
          _modelUsed: 'catalogo-verificato',
          _affidabilita: testa || cuore || fondo ? 'alta' : 'media',
        };
      }
    }
  } catch {
    // passa all'AI
  }

  return null;
}

async function fetchPageContext(
  targetUrl: string
): Promise<{ text: string; ogImage: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    if (!res.ok) return { text: '', ogImage: null };
    const html = await res.text();

    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogMatch?.[1]?.trim() || null;

    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 9500);

    return { text: cleanText, ogImage };
  } catch {
    return { text: '', ogImage: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: ExtractRequestPayload;
  try {
    body = (await req.json()) as ExtractRequestPayload;
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const url = (body.url || '').trim();
  const queryName = (body.queryName || body.query || '').trim();
  const explicitBrand = (body.brand || '').trim();
  const explicitNome = (body.nome || '').trim();
  const explicitConc = (body.concentration || '').trim();
  const imageBase64 = (body.imageBase64 || '').trim();
  const mimeType = (body.mimeType || 'image/jpeg').trim();

  if (!url && !queryName && !explicitBrand && !explicitNome && !imageBase64) {
    return NextResponse.json(
      { error: 'Inserisci un nome, un link oppure carica una foto.' },
      { status: 400 }
    );
  }

  try {
    // 1. Ricerca immediata negli archivi interni Supabase (per ricerca testuale / selezione)
    if (!imageBase64 && !url) {
      const dbResult = await lookupInDatabase(supabase, {
        brand: explicitBrand,
        nome: explicitNome,
        queryText: queryName || `${explicitBrand} ${explicitNome}`,
        concentration: explicitConc,
      });

      if (dbResult) {
        return NextResponse.json(dbResult);
      }
    }

    // 2. Estrazione tramite motore multi-provider (Gemini -> Groq -> OpenRouter)
    let pageText = '';
    let ogImage: string | null = null;
    if (url) {
      const page = await fetchPageContext(url);
      pageText = page.text;
      ogImage = page.ogImage;
    }

    const parts: AIPart[] = [];

    if (imageBase64) {
      const rawBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      parts.push({
        inlineData: {
          mimeType,
          data: rawBase64,
        },
      });
    }

    const targetPrompt = url
      ? `Analizza questo link ufficiale/scheda tecnica: ${url}\nTesto estratto:\n${
          pageText || '(pagina non accessibile direttamente: usa i dati noti dell’URL e della maison)'
        }`
      : imageBase64
      ? 'Identifica con esattezza la Maison e il nome del profumo mostrato in questa etichetta/flacone ed estrai la sua piramide olfattiva reale.'
      : `Estrai la scheda tecnica completa della seguente fragranza reale: "${
          queryName || `${explicitBrand} ${explicitNome}`
        }"${explicitConc ? ` (concentrazione: ${explicitConc})` : ''}`;

    const systemInstruction = `Sei l'archivista capo di Atelier LG, specializzato in profumeria artistica, ultra-nicchia e designer.
Regole obbligatorie:
- Restituisci SOLO dati reali e verificati. Se un campo opzionale (naso, anno_lancio, prezzo_stimato_euro) non è noto con certezza, usa "" o 0.
- Non inventare mai note olfattive: se non conosci la piramide reale della fragranza, lascia note_testa, note_cuore e note_fondo come stringa vuota "".
- Tutte le note olfattive devono essere in italiano corretto, separate da virgola (es. "Bergamotto, Arancia Rossa, Lampone, Pesca, Rosa Turca, Vaniglia, Muschio").
- famiglia_olfattiva deve essere ESATTAMENTE una tra: ${PURE_FAMILIES.join(', ')}.`;

    parts.push({ text: targetPrompt });

    const aiResponse = await callAIWithFallback<ExtractedPerfumeAI>(parts, {
      temperature: 0.15,
      timeoutMs: 11000,
      maxRetries: 1,
      deadline: Date.now() + 24000,
      jsonMode: true,
      responseSchema: EXTRACT_SCHEMA,
      validator: isExtractedPerfumeAI,
      systemInstruction,
    });

    const parsed =
      aiResponse.data ?? extractJsonFromAiText<ExtractedPerfumeAI>(aiResponse.text);

    const brand = String(parsed.brand || explicitBrand || '').trim();
    const nome = String(parsed.nome || explicitNome || '').trim();

    if (!brand && !nome) {
      return NextResponse.json(
        { error: 'Creazione non identificata con certezza.' },
        { status: 404 }
      );
    }

    const testa = cleanNote(parsed.note_testa);
    const cuore = cleanNote(parsed.note_cuore);
    const fondo = cleanNote(parsed.note_fondo);
    const famiglia = normalizeFamily(parsed.famiglia_olfattiva) || 'Legnosa';

    const responsePayload: ExtractedPerfumeResponse = {
      brand,
      nome,
      concentrazione: String(
        parsed.concentrazione || explicitConc || 'Eau de Parfum'
      ).trim(),
      famiglia_olfattiva: famiglia,
      anno_lancio:
        parsed.anno_lancio && Number(parsed.anno_lancio) > 1800
          ? Number(parsed.anno_lancio)
          : null,
      naso: String(parsed.naso || '').trim(),
      note_testa: testa,
      note_cuore: cuore,
      note_fondo: fondo,
      note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
      prezzo_stimato_euro: String(parsed.prezzo_stimato_euro || '').trim(),
      formato_ml:
        parsed.formato_ml && Number(parsed.formato_ml) > 0
          ? Number(parsed.formato_ml)
          : 50,
      stagione_ideale: 'Tutte le stagioni',
      occasione_ideale: 'Versatile',
      url_foto_vetrina: ogImage,
      varianti_rilevate: Array.isArray(parsed.varianti_rilevate)
        ? parsed.varianti_rilevate.map(String).filter(Boolean)
        : [],
      _modelUsed: `${aiResponse.providerUsed}/${aiResponse.modelUsed}`,
      _affidabilita: testa || cuore || fondo ? 'alta' : 'bassa',
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Errore durante l’estrazione della scheda.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
