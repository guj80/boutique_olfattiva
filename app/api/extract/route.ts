import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  callGeminiWithFallback,
  extractJsonFromAiText,
  GeminiPart,
} from '@/lib/gemini-engine';
import { formatPerfumeNote } from '@/lib/dictionary';
import { PURE_FAMILIES } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function normalizeFamilyServer(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Legnosa';
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon') || s.includes('aquat')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce') || s.includes('sweet')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('pulit') || s.includes('talc') || s.includes('powdery') || s.includes('musk')) return 'Muschiata';
  if (s.includes('speziat') || s.includes('spicy')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat') || s.includes('fruity')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('esperid') || s.includes('citrus')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('oriental') || s.includes('incens') || s.includes('resin') || s.includes('amber')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit') || s.includes('floral')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger') || s.includes('fougèr')) return 'Aromatica';
  if (s.includes('legnos') || s.includes('bois') || s.includes('chypre') || s.includes('oud') || s.includes('woody')) return 'Legnosa';
  return 'Legnosa';
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

function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeProductUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    const trackingParams = [
      'gad_source', 'gad_campaignid', 'gbraid', 'gclid', 'fbclid',
      '_gl', '_ga', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    ];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

function resolveImageUrl(candidate: string | null | undefined, pageUrl: string): string | null {
  if (!candidate) return null;
  const cleaned = candidate.replace(/&amp;/g, '&').replace(/^['"]|['"]$/g, '').trim();
  if (!cleaned || cleaned.startsWith('data:')) return null;
  try {
    if (cleaned.startsWith('//')) return `https:${cleaned}`;
    const resolved = new URL(cleaned, pageUrl);
    if (resolved.protocol === 'http:') resolved.protocol = 'https:';
    return resolved.toString();
  } catch {
    return cleaned.startsWith('http') ? cleaned : null;
  }
}

function extractProductImageFromHtml(html: string, pageUrl: string): string | null {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const regex of metaPatterns) {
    const m = html.match(regex);
    if (m?.[1]) {
      const resolved = resolveImageUrl(m[1], pageUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

async function fetchWebMetadataWithBypass(rawUrl: string): Promise<{
  textSnippet: string;
  ogImage: string | null;
}> {
  const url = sanitizeProductUrl(rawUrl);
  if (!isSafePublicUrl(url)) return { textSnippet: '', ogImage: null };

  let foundOgImage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      foundOgImage = extractProductImageFromHtml(html, url);
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4200);

      if (stripped.length > 200 && !stripped.includes('Just a moment...')) {
        return {
          textSnippet: `Titolo: ${titleMatch?.[1]?.trim() || ''}\nContenuto: ${stripped}`,
          ogImage: foundOgImage,
        };
      }
    }
  } catch {
    // Passa a Jina Reader
  }

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 5000);
    const jinaReaderBase = ['https:', '', 'r.jina.ai'].join('/');
    const readerRes = await fetch(`${jinaReaderBase}/${url}`, {
      signal: controller2.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(timer2);

    if (readerRes.ok) {
      const readerText = (await readerRes.text()).slice(0, 4800);
      return { textSnippet: readerText, ogImage: foundOgImage };
    }
  } catch {
    // Ignora
  }

  return { textSnippet: '', ogImage: foundOgImage };
}

async function searchLivePerfumeEncyclopedia(query: string): Promise<{
  webSnippet: string;
  foundImage: string | null;
}> {
  let webSnippet = '';
  let foundImage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const jinaSearchBase = ['https:', '', 's.jina.ai'].join('/');
    const searchUrl = `${jinaSearchBase}/${encodeURIComponent(
      `${query} perfume top middle base notes perfumer release year parfumo fragrantica`
    )}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain', 'X-Retain-Images': 'none' },
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      webSnippet = text.slice(0, 4500);
      const urlMatch = text.match(
        /https?:\/\/(?:www\.)?(?:parfumo\.com|fragrantica\.[a-z.]+)\/[^\s)\]"']+/i
      );
      if (urlMatch?.[0]) {
        const meta = await fetchWebMetadataWithBypass(urlMatch[0]);
        if (meta.ogImage) foundImage = meta.ogImage;
      }
    }
  } catch {
    // Continua
  }

  return { webSnippet, foundImage };
}

function clampVote(val: any, fallback: number = 8): number {
  const n = Number(val);
  if (isNaN(n) || n < 1 || n > 10) return fallback;
  return Math.round(n);
}

export async function GET() {
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const supabase = getSupabaseServer();

  let geminiCheck: any = { configured: Boolean(geminiKey), prefix: geminiKey.slice(0, 5) };
  if (geminiKey) {
    try {
      const gUrl = ['https:', '', 'generativelanguage.googleapis.com', 'v1beta', `models?key=${geminiKey}`].join('/');
      const r = await fetch(gUrl);
      const d = await r.json();
      geminiCheck.status = r.status;
      geminiCheck.ok = r.ok;
      geminiCheck.error = d?.error?.message || null;
    } catch (e: any) {
      geminiCheck.error = e?.message;
    }
  }

  let dbCheck: any = { connected: Boolean(supabase) };
  if (supabase) {
    const { data, count, error } = await supabase
      .from('perfumes')
      .select('id, name, brand, release_year, concentration', { count: 'exact' })
      .limit(3);
    dbCheck = { ok: !error, totalRows: count, sample: data, error: error?.message || null };
  }

  return NextResponse.json({
    diagnostica: 'OK - Endpoint /api/extract attivo',
    geminiCheck,
    groqConfigured: Boolean(groqKey),
    supabasePerfumesTable: dbCheck,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    const searchTarget = (queryName || `${brand || ''} ${nome || ''}`).trim();
    if (!searchTarget && !url && !imageBase64) {
      return NextResponse.json(
        { error: 'Inserisci il nome di un profumo, un link o carica una foto.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    let dbVerifiedRecord: any = null;
    let discoveredImage: string | null = null;
    let contextSource = '';

    if (supabase && searchTarget.length >= 2 && !imageBase64 && !url) {
      try {
        const cleanName = (nome || searchTarget).trim();
        let query = supabase
          .from('perfumes')
          .select('*')
          .ilike('name', `%${cleanName}%`)
          .limit(3);

        if (brand && brand.trim().length > 1) {
          query = query.ilike('brand', `%${brand.trim()}%`);
        }

        const { data: matches } = await query;
        if (matches && matches.length > 0) {
          dbVerifiedRecord = matches[0];
          if (
            dbVerifiedRecord.cached_ai_data &&
            dbVerifiedRecord.cached_ai_data.note_testa &&
            dbVerifiedRecord.cached_ai_data.prezzo_stimato_euro
          ) {
            return NextResponse.json({
              ...dbVerifiedRecord.cached_ai_data,
              _modelUsed: 'supabase-verified-cache',
            });
          }
        }
      } catch {
        // Continua su Live Encyclopedia
      }
    }

    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      const webData = await fetchWebMetadataWithBypass(url);
      discoveredImage = webData.ogImage;
      contextSource = `SCHEDA UFFICIALE ESTRATTA DA URL (${url}):\n${webData.textSnippet}`;
    } else if (searchTarget) {
      const liveEncyclopedia = await searchLivePerfumeEncyclopedia(searchTarget);
      if (liveEncyclopedia.foundImage) discoveredImage = liveEncyclopedia.foundImage;

      const dbFacts = dbVerifiedRecord
        ? `DATI BASE NEL DB: Nome="${dbVerifiedRecord.name || ''}", Brand="${dbVerifiedRecord.brand || ''}", Anno="${dbVerifiedRecord.release_year || ''}", Concentrazione="${dbVerifiedRecord.concentration || ''}".\n`
        : '';

      contextSource = `${dbFacts}${
        liveEncyclopedia.webSnippet
          ? `SCHEDA ENCICLOPEDICA LIVE (PARFUMO / FRAGRANTICA):\n${liveEncyclopedia.webSnippet}`
          : ''
      }`;
    } else {
      contextSource = 'Analisi visiva del flacone dalla foto allegata.';
    }

    const systemPrompt = `Sei l'enciclopedia tecnica dell'alta profumeria artistica, di nicchia e storica.
Compila la scheda tecnica rigorosa per: "${searchTarget || url || 'Flacone in foto'}".

${contextSource}

REGOLE TASSATIVE ANTI-ALLUCINAZIONE:
1. Usa ESCLUSIVAMENTE le note olfattive reali, il vero Naso creatore e l'anno di lancio riportati nella SCHEDA ENCICLOPEDICA LIVE qui sopra o nei dati ufficiali della Maison. VIETATO inventare note.
2. "famiglia_olfattiva": Scegli ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12:
   "Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
3. "prezzo_stimato_euro": Prezzi di listino ufficiali per formato >= 30ml (es. "50ml: €165 • 100ml: €230").

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "nome": "Nome ufficiale esatto del profumo (senza brand)",
  "brand": "Nome ufficiale della Maison",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Eau de Toilette",
  "anno_lancio": 2021,
  "famiglia_olfattiva": "Una sola delle 12 famiglie pure",
  "note_testa": "Note di testa in italiano separate da virgola",
  "note_cuore": "Note di cuore in italiano separate da virgola",
  "note_fondo": "Note di fondo in italiano separate da virgola",
  "note_olfattive": "Elenco completo delle note in italiano separate da virgola",
  "descrizione_ai": "Analisi tecnica oggettiva in 2 frasi del profilo olfattivo",
  "prezzo_stimato_euro": "Es. 50ml: €165 • 100ml: €230",
  "formato_ml": 100,
  "stagione_ideale": "Es. Autunno / Inverno",
  "occasione_ideale": "Es. Serata, Formale",
  "naso": "Nome del Maître Parfumeur ufficiale",
  "voto_longevita": 8,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 8,
  "url_foto_vetrina": "${discoveredImage || ''}"
}`;

    const parts: GeminiPart[] = [{ text: systemPrompt }];

    if (imageBase64 && typeof imageBase64 === 'string') {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
      useGoogleSearch: !imageBase64,
      timeoutMs: 18000,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const pureFamily = (PURE_FAMILIES as readonly string[]).includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(parsed.famiglia_olfattiva);

    const normTesta = parsed.note_testa ? formatPerfumeNote(parsed.note_testa) : '';
    const normCuore = parsed.note_cuore ? formatPerfumeNote(parsed.note_cuore) : '';
    const normFondo = parsed.note_fondo ? formatPerfumeNote(parsed.note_fondo) : '';

    const unifiedNotes =
      [normTesta, normCuore, normFondo].filter(Boolean).join(', ') ||
      (parsed.note_olfattive ? formatPerfumeNote(parsed.note_olfattive) : '');

    const rawYear = dbVerifiedRecord?.release_year || parsed.anno_lancio;
    const finalYear =
      rawYear && !isNaN(Number(rawYear)) && Number(rawYear) > 1700 && Number(rawYear) <= 2030
        ? Number(rawYear)
        : null;

    const finalImageUrl =
      discoveredImage ||
      (parsed.url_foto_vetrina && String(parsed.url_foto_vetrina).startsWith('http')
        ? String(parsed.url_foto_vetrina).trim()
        : null);

    const finalPayload = {
      nome: (dbVerifiedRecord?.name || parsed.nome || nome || searchTarget || 'Creazione').trim(),
      brand: (dbVerifiedRecord?.brand || parsed.brand || brand || 'Maison').trim(),
      concentrazione: (dbVerifiedRecord?.concentration || parsed.concentrazione || 'Eau de Parfum').trim(),
      anno_lancio: finalYear,
      famiglia_olfattiva: pureFamily,
      note_testa: normTesta,
      note_cuore: normCuore,
      note_fondo: normFondo,
      note_olfattive: unifiedNotes,
      descrizione_ai: (parsed.descrizione_ai || '').trim(),
      prezzo_stimato_euro: (parsed.prezzo_stimato_euro || '').trim(),
      formato_ml: Number(parsed.formato_ml) >= 30 ? Number(parsed.formato_ml) : 100,
      stagione_ideale: (parsed.stagione_ideale || 'Tutte le stagioni').trim(),
      occasione_ideale: (parsed.occasione_ideale || 'Versatile').trim(),
      naso: parsed.naso && String(parsed.naso).toLowerCase() !== 'non specificato' ? String(parsed.naso).trim() : null,
      voto_longevita: clampVote(parsed.voto_longevita, 8),
      voto_scia: clampVote(parsed.voto_scia, 8),
      voto_proiezione: clampVote(parsed.voto_proiezione, 8),
      voto_complessita: clampVote(parsed.voto_complessita, 8),
      url_foto_vetrina: finalImageUrl,
      _modelUsed: dbVerifiedRecord ? `soluzione_C_db+${modelUsed}` : `soluzione_A_live+${modelUsed}`,
    };

    if (supabase && !imageBase64 && finalPayload.note_olfattive) {
      try {
        if (dbVerifiedRecord?.id) {
          await supabase
            .from('perfumes')
            .update({
              concentration: finalPayload.concentrazione,
              release_year: finalPayload.anno_lancio,
              cached_ai_data: finalPayload,
            })
            .eq('id', dbVerifiedRecord.id);
        } else {
          await supabase.from('perfumes').insert([
            {
              name: finalPayload.nome,
              brand: finalPayload.brand,
              concentration: finalPayload.concentrazione,
              release_year: finalPayload.anno_lancio,
              cached_ai_data: finalPayload,
            },
          ]);
        }
      } catch {
        // Non blocca la risposta
      }
    }

    return NextResponse.json(finalPayload);
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json(
      { error: error?.message || "Errore durante l'estrazione dei dati." },
      { status: 500 }
    );
  }
}
