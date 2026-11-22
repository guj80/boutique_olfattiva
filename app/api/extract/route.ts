import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { normalizeFamily } from '@/lib/families';
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

interface ExtractedPerfumeResult {
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

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

function cleanNote(raw?: string | null): string {
  if (!raw || !raw.trim()) return '';
  return formatPerfumeNote(raw).trim();
}

function buildUnifiedNotes(testa: string, cuore: string, fondo: string, fallback = ''): string {
  const joined = [testa, cuore, fondo].filter(Boolean).join(', ');
  return joined || cleanNote(fallback);
}

/**
 * Cerca prima nei database interni Supabase (ultranicchia_import e perfumes)
 * per restituire dati immediati e verificati senza latenza AI.
 */
async function lookupInInternalDatabases(
  supabase: ReturnType<typeof getSupabaseServer>,
  params: { brand?: string; nome?: string; queryText?: string; concentration?: string }
): Promise<ExtractedPerfumeResult | null> {
  if (!supabase) return null;

  const rawBrand = (params.brand || '').trim();
  const rawNome = (params.nome || '').trim();
  const rawQuery = (params.queryText || `${rawBrand} ${rawNome}`).trim();
  const normQuery = normalizeStr(rawQuery);
  if (!normQuery) return null;

  const tokens = normQuery.split(' ').filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;

  // 1. Ricerca su ultranicchia_import
  try {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const orClauses = [
      `nome.ilike.%${firstToken}%`,
      `brand.ilike.%${firstToken}%`,
      `nome.ilike.%${lastToken}%`,
    ].join(',');

    const { data: ultraRows } = await supabase
      .from('ultranicchia_import')
      .select('*')
      .or(orClauses)
      .limit(60);

    if (ultraRows && ultraRows.length > 0) {
      let bestRow: any = null;
      let bestScore = 0;

      for (const row of ultraRows) {
        const b = String(row.brand || '').trim();
        const n = String(row.nome || '').trim();
        const fullNorm = normalizeStr(`${b} ${n}`);
        if (!fullNorm) continue;

        let matchedTokens = 0;
        for (const t of tokens) {
          if (fullNorm.includes(t)) matchedTokens++;
        }

        const ratio = matchedTokens / tokens.length;
        if (ratio < 0.75) continue;

        let score = ratio * 100;
        if (fullNorm === normQuery) score += 40;
        if (rawBrand && normalizeStr(b) === normalizeStr(rawBrand)) score += 20;
        if (rawNome && normalizeStr(n) === normalizeStr(rawNome)) score += 25;
        if (
          params.concentration &&
          row.concentrazione &&
          normalizeStr(row.concentrazione).includes(normalizeStr(params.concentration))
        ) {
          score += 15;
        }
        if (row.note_testa || row.note_cuore || row.note_fondo) score += 10;

        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
        }
      }

      if (bestRow && bestScore >= 75) {
        const testa = cleanNote(bestRow.note_testa);
        const cuore = cleanNote(bestRow.note_cuore);
        const fondo = cleanNote(bestRow.note_fondo);
        const fam =
          normalizeFamily(bestRow.famiglia_tags) ||
          normalizeFamily(bestRow.famiglia_originale) ||
          'Legnosa';

        return {
          brand: String(bestRow.brand || '').trim(),
          nome: String(bestRow.nome || '').trim(),
          concentrazione: String(bestRow.concentrazione || 'Extrait de Parfum').trim(),
          famiglia_olfattiva: fam,
          anno_lancio: bestRow.anno_lancio ? Number(bestRow.anno_lancio) || null : null,
          naso: String(bestRow.naso || '').trim(),
          note_testa: testa,
          note_cuore: cuore,
          note_fondo: fondo,
          note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
          prezzo_stimato_euro: bestRow.prezzo ? String(bestRow.prezzo).trim() : '',
          formato_ml: Number(bestRow.formato_ml) || 50,
          stagione_ideale: 'Tutte le stagioni',
          occasione_ideale: 'Versatile',
          url_foto_vetrina: bestRow.immagine_url ? String(bestRow.immagine_url).trim() : null,
          varianti_rilevate: [],
          _modelUsed: 'archivio-ultranicchia',
          _affidabilita: testa || cuore || fondo ? 'alta' : 'media',
        };
      }
    }
  } catch {
    // continua con catalogo generale
  }

  // 2. Ricerca su perfumes (catalogo 24k)
  try {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const orClauses = [
      `name.ilike.%${lastToken}%`,
      `name.ilike.%${firstToken}%`,
    ].join(',');

    const { data: catRows } = await supabase
      .from('perfumes')
      .select(
        'brand, name, concentration, release_year, main_accords, top_notes, middle_notes, base_notes, perfumers, url'
      )
      .or(orClauses)
      .limit(120);

    if (catRows && catRows.length > 0) {
      let bestRow: any = null;
      let bestScore = 0;
      const variantsSet = new Set<string>();

      for (const row of catRows) {
        const b = String(row.brand || '').trim();
        const n = String(row.name || '').trim();
        const fullNorm = normalizeStr(`${b} ${n}`);
        if (!fullNorm) continue;

        let matchedTokens = 0;
        for (const t of tokens) {
          if (fullNorm.includes(t)) matchedTokens++;
        }

        const ratio = matchedTokens / tokens.length;
        if (ratio < 0.75) continue;

        if (row.concentration && normalizeStr(n).includes(normalizeStr(rawNome || lastToken))) {
          variantsSet.add(String(row.concentration).trim());
        }

        let score = ratio * 100;
        if (fullNorm === normQuery) score += 45;
        if (rawBrand && normalizeStr(b) === normalizeStr(rawBrand)) score += 20;
        if (rawNome && normalizeStr(n) === normalizeStr(rawNome)) score += 25;
        if (
          params.concentration &&
          row.concentration &&
          normalizeStr(row.concentration).includes(normalizeStr(params.concentration))
        ) {
          score += 20;
        }
        if (row.top_notes || row.middle_notes || row.base_notes) score += 10;

        if (score > bestScore) {
          bestScore = score;
          bestRow = row;
        }
      }

      if (bestRow && bestScore >= 75) {
        const testa = cleanNote(bestRow.top_notes);
        const cuore = cleanNote(bestRow.middle_notes);
        const fondo = cleanNote(bestRow.base_notes);
        const fam = normalizeFamily(bestRow.main_accords) || 'Legnosa';
        const currentConc = String(bestRow.concentration || 'Eau de Parfum').trim();
        variantsSet.delete(currentConc);

        return {
          brand: String(bestRow.brand || '').trim(),
          nome: String(bestRow.name || '').trim(),
          concentrazione: currentConc,
          famiglia_olfattiva: fam,
          anno_lancio: bestRow.release_year ? Number(bestRow.release_year) || null : null,
          naso: String(bestRow.perfumers || '').trim(),
          note_testa: testa,
          note_cuore: cuore,
          note_fondo: fondo,
          note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
          prezzo_stimato_euro: '',
          formato_ml: 100,
          stagione_ideale: 'Tutte le stagioni',
          occasione_ideale: 'Versatile',
          url_foto_vetrina: null,
          varianti_rilevate: Array.from(variantsSet).slice(0, 4),
          _modelUsed: 'catalogo-verificato',
          _affidabilita: testa || cuore || fondo ? 'alta' : 'media',
        };
      }
    }
  } catch {
    // continua con AI
  }

  return null;
}

async function fetchPageSnippet(targetUrl: string): Promise<{ text: string; ogImage: string | null }> {
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

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 9000);

    return { text: stripped, ogImage };
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
    // 1. Ricerca rapida su database interni (se non è foto o URL diretto)
    if (!imageBase64 && !url) {
      const dbHit = await lookupInInternalDatabases(supabase, {
        brand: explicitBrand,
        nome: explicitNome,
        queryText: queryName || `${explicitBrand} ${explicitNome}`,
        concentration: explicitConc,
      });

      if (dbHit) {
        return NextResponse.json(dbHit);
      }
    }

    // 2. Estrazione AI (da URL, da Immagine oppure da Ricerca Web/Conoscenza)
    let pageSnippet = '';
    let ogImage: string | null = null;
    if (url) {
      const fetched = await fetchPageSnippet(url);
      pageSnippet = fetched.text;
      ogImage = fetched.ogImage;
    }

    const parts: any[] = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const subjectDesc = url
      ? `URL fornito: ${url}\nContenuto estratto dalla pagina:\n${pageSnippet || '(pagina protetta, deduci dal link e dalle fonti ufficiali)'}`
      : imageBase64
      ? 'Analizza il flacone/etichetta nell’immagine allegata e identifica brand e creazione esatta.'
      : `Creazione richiesta: "${queryName || `${explicitBrand} ${explicitNome}`}"${
          explicitConc ? ` (concentrazione: ${explicitConc})` : ''
        }`;

    const prompt = `Sei l'archivista capo di Atelier LG, esperto di profumeria artistica, nicchia e designer.
Estrai la scheda tecnica VERIFICATA in lingua ITALIANA per la fragranza seguente:

${subjectDesc}

REGOLE RIGIDE ANTI-ALLUCINAZIONE:
- Non inventare mai note olfattive, nasi o anni se non sei certo: lascia stringa vuota "" o null.
- Traduci tutte le note olfattive in italiano corretto (es. "Bergamotto, Pepe Rosa, Iris, Sandalo, Vaniglia").
- "famiglia_olfattiva" DEVE essere UNA sola tra queste 12:
  Agrumata, Aromatica, Marina, Floreale, Fruttata, Verde, Speziata, Legnosa, Ambrata, Gourmand, Cuoiata, Muschiata.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "brand": "Nome Maison",
  "nome": "Nome Creazione",
  "concentrazione": "Extrait de Parfum / Eau de Parfum / Eau de Toilette",
  "famiglia_olfattiva": "Una delle 12 famiglie",
  "anno_lancio": 2023,
  "naso": "Nome Profumiere o stringa vuota",
  "note_testa": "Note di testa separate da virgola",
  "note_cuore": "Note di cuore separate da virgola",
  "note_fondo": "Note di fondo separate da virgola",
  "prezzo_stimato_euro": "Es. 50ml: €150 oppure stringa vuota",
  "formato_ml": 50,
  "varianti_rilevate": []
}`;

    parts.push({ text: prompt });

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      jsonMode: true,
      temperature: 0.15,
      timeoutMs: 12000,
      deadline: Date.now() + 24000,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const brand = String(parsed?.brand || explicitBrand || '').trim();
    const nome = String(parsed?.nome || explicitNome || '').trim();

    if (!brand && !nome) {
      return NextResponse.json(
        { error: 'Impossibile identificare con certezza la fragranza richiesta.' },
        { status: 404 }
      );
    }

    const testa = cleanNote(parsed?.note_testa);
    const cuore = cleanNote(parsed?.note_cuore);
    const fondo = cleanNote(parsed?.note_fondo);
    const famiglia = normalizeFamily(parsed?.famiglia_olfattiva) || 'Legnosa';

    const result: ExtractedPerfumeResult = {
      brand,
      nome,
      concentrazione: String(parsed?.concentrazione || explicitConc || 'Eau de Parfum').trim(),
      famiglia_olfattiva: famiglia,
      anno_lancio: parsed?.anno_lancio ? Number(parsed.anno_lancio) || null : null,
      naso: String(parsed?.naso || '').trim(),
      note_testa: testa,
      note_cuore: cuore,
      note_fondo: fondo,
      note_olfattive: buildUnifiedNotes(testa, cuore, fondo),
      prezzo_stimato_euro: String(parsed?.prezzo_stimato_euro || '').trim(),
      formato_ml: Number(parsed?.formato_ml) || 50,
      stagione_ideale: 'Tutte le stagioni',
      occasione_ideale: 'Versatile',
      url_foto_vetrina: ogImage,
      varianti_rilevate: Array.isArray(parsed?.varianti_rilevate)
        ? parsed.varianti_rilevate.map(String)
        : [],
      _modelUsed: modelUsed || 'ai-verified',
      _affidabilita: testa || cuore || fondo ? 'alta' : 'bassa',
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Errore durante l’estrazione della scheda.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
