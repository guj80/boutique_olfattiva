import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  callGeminiWithFallback,
  callOpenRouterFree,
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
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
      'gad_source',
      'gad_campaignid',
      'gbraid',
      'gclid',
      'fbclid',
      '_gl',
      '_ga',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

function resolveImageUrl(candidate: string | null | undefined, pageUrl: string): string | null {
  if (!candidate) return null;
  const cleaned = candidate
    .replace(/&amp;/g, '&')
    .replace(/^['"]|['"]$/g, '')
    .trim();
  if (!cleaned || cleaned.startsWith('data:')) return null;

  try {
    if (cleaned.startsWith('//')) {
      return `https:${cleaned}`;
    }
    const resolved = new URL(cleaned, pageUrl);
    if (resolved.protocol === 'http:') {
      resolved.protocol = 'https:';
    }
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
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const regex of metaPatterns) {
    const m = html.match(regex);
    if (m?.[1]) {
      const resolved = resolveImageUrl(m[1], pageUrl);
      if (resolved) return resolved;
    }
  }

  const ldJsonMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldJsonMatches) {
    for (const block of ldJsonMatches) {
      const inner = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
      const imgMatch = inner.match(/"image"\s*:\s*(?:\[\s*)?"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
      if (imgMatch?.[1]) {
        const resolved = resolveImageUrl(imgMatch[1], pageUrl);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}

function parseUrlSlugInfo(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const pathSegments = u.pathname
      .split('/')
      .filter(Boolean)
      .map((s) =>
        decodeURIComponent(s)
          .replace(/[-_]/g, ' ')
          .replace(/\.html?$/i, '')
          .replace(/\b\d{4,8}\b/g, '')
          .trim()
      );
    return `Dominio: ${u.hostname} | Brand e Nome dall'URL: ${pathSegments.join(' - ')}`;
  } catch {
    return `URL: ${rawUrl}`;
  }
}

async function fetchWebMetadataWithBypass(rawUrl: string): Promise<{
  textSnippet: string;
  ogImage: string | null;
}> {
  const url = sanitizeProductUrl(rawUrl);
  if (!isSafePublicUrl(url)) {
    return { textSnippet: '', ogImage: null };
  }

  let foundOgImage: string | null = null;

  if (/\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(url)) {
    return {
      textSnippet: `Link immagine diretto fornito: ${url}`,
      ogImage: url,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      foundOgImage = extractProductImageFromHtml(html, url);

      const strippedBody = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4500);

      if (strippedBody.length > 200 && !strippedBody.includes('Just a moment...')) {
        return {
          textSnippet: `Titolo Pagina: ${titleMatch?.[1]?.trim() || ''}\nMeta Description: ${descMatch?.[1]?.trim() || ''}\nTesto Pagina: ${strippedBody}`,
          ogImage: foundOgImage,
        };
      }
    }
  } catch {
    // Passa a Jina Reader
  }

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 4500);
    const readerUrl = `https://r.jina.ai/${url}`;
    const readerRes = await fetch(readerUrl, {
      signal: controller2.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(timer2);

    if (readerRes.ok) {
      const readerText = (await readerRes.text()).slice(0, 5000);

      if (!foundOgImage) {
        const mdImages = Array.from(
          readerText.matchAll(
            /!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg\vert{}jpeg\vert{}png\vert{}webp)[^\s)]*)\)/gi
          )
        );
        const goodImg = mdImages
          .map((m) => m[1])
          .find((imgUrl) => !/logo|icon|flag|avatar|payment|banner|sprite|box/i.test(imgUrl));
        if (goodImg) {
          foundOgImage = resolveImageUrl(goodImg, url);
        }
      }

      if (readerText.length > 150 && !readerText.includes('Enable JavaScript and cookies')) {
        return {
          textSnippet: `Testo pagina estratto:\n${readerText}`,
          ogImage: foundOgImage,
        };
      }
    }
  } catch {
    // Continua
  }

  return {
    textSnippet: '',
    ogImage: foundOgImage,
  };
}

function clampVote(val: any, fallback: number = 8): number {
  const n = Number(val);
  if (isNaN(n) || n < 1 || n > 10) return fallback;
  return Math.round(n);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    if (url && typeof url === 'string' && !isSafePublicUrl(url)) {
      return NextResponse.json(
        { error: 'URL non valido o non consentito.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    let dbVerifiedRecord: any = null;
    let contextSource = '';
    let discoveredImage: string | null = null;
    const parts: GeminiPart[] = [];

    const searchTarget = (queryName || `${brand || ''} ${nome || ''}`).trim();

    // LIVELLO 1: Cerca nel catalogo Supabase (59.325+ profumi) come base, ma arricchisce SEMPRE i campi mancanti tramite AI
    if (supabase && searchTarget.length >= 2 && !imageBase64 && !url) {
      try {
        const { data: matches } = await supabase.rpc('search_perfume_exact', {
          search_query: searchTarget,
        });

        if (matches && matches.length > 0) {
          const topMatch = matches[0];
          const fullDbName = `${topMatch.brand || ''} ${topMatch.name || ''}`.toLowerCase();
          const targetWords = searchTarget
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 2);

          const isTrueMatch =
            targetWords.length === 0 ||
            targetWords.every((w: string) => fullDbName.includes(w)) ||
            fullDbName.includes((nome || searchTarget).toLowerCase().trim());

          if (isTrueMatch) {
            dbVerifiedRecord = topMatch;

            // Ritorna la cache solo se è davvero completa (ha note E prezzo formati >=30ml)
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
        }
      } catch {
        // Continua su AI
      }
    }

    // LIVELLO 2: Costruzione Contesto per la Doppia AI (Gemini + Groq)
    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      const cleanUrl = sanitizeProductUrl(url);
      const slugInfo = parseUrlSlugInfo(cleanUrl);
      const webData = await fetchWebMetadataWithBypass(cleanUrl);
      discoveredImage = webData.ogImage;
      contextSource = `MODALITA: Estrazione da Link Ufficiale/Web.\nURL: ${cleanUrl}\n${slugInfo}\n${webData.textSnippet}`;
    } else if (dbVerifiedRecord) {
      contextSource = `MODALITA: INTEGRAZIONE SCHEDA DATABASE + CONOSCENZA AI.
Dati di base presenti nel database per questo profumo:
- Brand: ${dbVerifiedRecord.brand || brand || ''}
- Nome: ${dbVerifiedRecord.name || nome || ''}
- Concentrazione: ${dbVerifiedRecord.concentration || ''}
- Anno di lancio: ${dbVerifiedRecord.release_year || ''}
- Profumiere (Naso): ${dbVerifiedRecord.perfumers || ''}
- Accordi Principali: ${dbVerifiedRecord.main_accords || ''}
- Note di Testa: ${dbVerifiedRecord.top_notes || ''}
- Note di Cuore: ${dbVerifiedRecord.middle_notes || ''}
- Note di Fondo: ${dbVerifiedRecord.base_notes || ''}

COMPITO: Traduci fedelmente in italiano le note presenti e COMPLETA OBBLIGATORIAMENTE tutti i dati mancanti nel DB (come il Naso se mancante, l'anno di lancio, i voti tecnici, la descrizione tecnica e i prezzi di listino per formato >= 30ml) usando la tua conoscenza enciclopedica della profumeria.`;
    } else if (searchTarget) {
      contextSource = `MODALITA: RICERCA ENCICLOPEDICA PROFUMERIA DI NICCHIA E ARTISTICA ("${searchTarget}").
Il profumo "${searchTarget}" non è ancora nel database locale o richiede l'estrazione completa.
Usa la tua conoscenza enciclopedica del catalogo ufficiale del brand per compilare TUTTI i campi della scheda tecnica (Brand esatto, Nome esatto, Concentrazione, Anno di lancio, Naso profumiere, Piramide olfattiva completa Testa/Cuore/Fondo, Prezzi ufficiali per formato da 30ml in su, e Voti tecnici).`;
    } else if (imageBase64) {
      contextSource = `MODALITA: Analisi Visiva Flacone / Campioncino. Riconosci brand e nome del profumo dall'immagine allegata e restituisci la scheda tecnica e la piramide olfattiva ufficiale completa.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei l'enciclopedia tecnica definitiva dell'alta profumeria artistica, di nicchia e di lusso.
Il tuo compito è restituire una scheda tecnica COMPLETA e PRECISA per il profumo richiesto.

${contextSource}

REGOLE TASSATIVE:
1. "famiglia_olfattiva": Scegli ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12:
   "Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
2. "prezzo_stimato_euro": Indica SEMPRE i prezzi di listino ufficiali (Maison o concessionari autorizzati) DISTINTI PER FORMATO a partire da 30ml in su (es. "50ml: €195 • 100ml: €280" oppure "100ml: €220"). VIETATO inserire prezzi di campioncini da 2ml/5ml/10ml.
3. Compila SEMPRE note_testa, note_cuore, note_fondo in italiano tecnico.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "nome": "Nome ufficiale esatto del profumo (senza brand)",
  "brand": "Nome ufficiale della Maison",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Eau de Toilette",
  "anno_lancio": 2023,
  "famiglia_olfattiva": "Una sola delle 12 famiglie pure",
  "note_testa": "Note di testa in italiano separate da virgola",
  "note_cuore": "Note di cuore in italiano separate da virgola",
  "note_fondo": "Note di fondo in italiano separate da virgola",
  "note_olfattive": "Elenco completo delle note in italiano separate da virgola",
  "descrizione_ai": "Analisi tecnica oggettiva in 2 frasi del profilo olfattivo e dell'evoluzione",
  "prezzo_stimato_euro": "Es. 50ml: €195 • 100ml: €280",
  "formato_ml": 100,
  "stagione_ideale": "Es. Primavera / Estate, oppure Autunno / Inverno",
  "occasione_ideale": "Es. Giorno, Serata, Evento Formale",
  "naso": "Nome del Maître Parfumeur (Naso) ufficiale",
  "voto_longevita": 8,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 8,
  "url_foto_vetrina": "${discoveredImage || ''}"
}`;

    parts.push({ text: systemPrompt });

    if (imageBase64 && typeof imageBase64 === 'string') {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    // CHIAMATA VELOCE DUAL-AI (Gemini JSON nativo -> fallback immediato Groq Llama 3.3 70B)
    let { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
      useGoogleSearch: false,
    });

    let parsed = extractJsonFromAiText<Record<string, any>>(text);

    // SECONDA AI (Groq Llama 3.3 70B): se Gemini ha lasciato vuoto il Naso, le Note o i Prezzi per formato >=30ml, Groq completa e verifica la scheda!
    const isMissingCriticalInfo =
      !parsed.note_testa || !parsed.prezzo_stimato_euro || !parsed.naso;

    if (
      isMissingCriticalInfo &&
      (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY)
    ) {
      const enrichPrompt = `Completa e verifica questa scheda tecnica per il profumo "${
        parsed.brand || brand || ''
      } ${parsed.nome || nome || searchTarget}".
Assicurati che:
1. "note_testa", "note_cuore", "note_fondo" siano compilate in italiano.
2. "naso" contenga il vero profumiere creatore (se noto).
3. "prezzo_stimato_euro" contenga i prezzi di listino ufficiali per formato da 30ml in su (es. "50ml: €190 • 100ml: €260", esclusi campioncini).
Restituisci SOLO il JSON completo con le stesse chiavi:
${JSON.stringify(parsed)}`;

      const groqRes = await callOpenRouterFree(enrichPrompt);
      if (groqRes) {
        try {
          const enriched = extractJsonFromAiText<Record<string, any>>(groqRes.text);
          if (enriched.nome && (enriched.note_testa || enriched.note_olfattive)) {
            parsed = {
              ...parsed,
              ...enriched,
              note_testa: enriched.note_testa || parsed.note_testa,
              note_cuore: enriched.note_cuore || parsed.note_cuore,
              note_fondo: enriched.note_fondo || parsed.note_fondo,
              naso: enriched.naso || parsed.naso,
              prezzo_stimato_euro:
                enriched.prezzo_stimato_euro || parsed.prezzo_stimato_euro,
            };
            modelUsed = `${modelUsed}+groq_enriched`;
          }
        } catch {
          // Mantiene il risultato di Gemini
        }
      }
    }

    const pureFamily = (PURE_FAMILIES as readonly string[]).includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(dbVerifiedRecord?.main_accords || parsed.famiglia_olfattiva);

    const normTesta = parsed.note_testa ? formatPerfumeNote(parsed.note_testa) : '';
    const normCuore = parsed.note_cuore ? formatPerfumeNote(parsed.note_cuore) : '';
    const normFondo = parsed.note_fondo ? formatPerfumeNote(parsed.note_fondo) : '';

    const unifiedNotes =
      [normTesta, normCuore, normFondo].filter(Boolean).join(', ') ||
      (parsed.note_olfattive ? formatPerfumeNote(parsed.note_olfattive) : '');

    const finalImageUrl =
      discoveredImage ||
      (parsed.url_foto_vetrina && String(parsed.url_foto_vetrina).startsWith('http')
        ? String(parsed.url_foto_vetrina).trim()
        : null);

    const rawNaso =
      parsed.naso ||
      (dbVerifiedRecord?.perfumers && dbVerifiedRecord.perfumers !== 'Non specificato'
        ? dbVerifiedRecord.perfumers
        : '');
    const finalNaso =
      rawNaso && String(rawNaso).trim() && String(rawNaso).toLowerCase() !== 'non specificato'
        ? String(rawNaso).trim()
        : null;

    const rawYear = dbVerifiedRecord?.release_year || parsed.anno_lancio;
    const finalYear =
      rawYear && !isNaN(Number(rawYear)) && Number(rawYear) > 1700 && Number(rawYear) <= 2030
        ? Number(rawYear)
        : null;

    const finalFormato =
      parsed.formato_ml && !isNaN(Number(parsed.formato_ml)) && Number(parsed.formato_ml) >= 30
        ? Number(parsed.formato_ml)
        : 100;

    const finalPayload = {
      nome: (dbVerifiedRecord?.name || parsed.nome || nome || searchTarget || 'Creazione').trim(),
      brand: (dbVerifiedRecord?.brand || parsed.brand || brand || 'Maison').trim(),
      concentrazione:
        (dbVerifiedRecord?.concentration || parsed.concentrazione || 'Eau de Parfum').trim(),
      anno_lancio: finalYear,
      famiglia_olfattiva: pureFamily,
      note_testa: normTesta,
      note_cuore: normCuore,
      note_fondo: normFondo,
      note_olfattive: unifiedNotes,
      descrizione_ai: (parsed.descrizione_ai || '').trim(),
      prezzo_stimato_euro: (parsed.prezzo_stimato_euro || '').trim(),
      formato_ml: finalFormato,
      stagione_ideale: (parsed.stagione_ideale || 'Tutte le stagioni').trim(),
      occasione_ideale: (parsed.occasione_ideale || 'Versatile').trim(),
      naso: finalNaso,
      voto_longevita: clampVote(parsed.voto_longevita, 8),
      voto_scia: clampVote(parsed.voto_scia, 8),
      voto_proiezione: clampVote(parsed.voto_proiezione, 8),
      voto_complessita: clampVote(parsed.voto_complessita, 8),
      url_foto_vetrina: finalImageUrl,
      _modelUsed: dbVerifiedRecord ? `db+${modelUsed}` : `dual_ai+${modelUsed}`,
    };

    // AUTO-APPRENDIMENTO: se il profumo era nel DB, aggiorna la cache; se NON c'era nel DB, lo salva per le prossime ricerche!
    if (supabase && !imageBase64 && finalPayload.note_olfattive) {
      if (dbVerifiedRecord?.id) {
        supabase
          .from('perfumes')
          .update({ cached_ai_data: finalPayload })
          .eq('id', dbVerifiedRecord.id)
          .then();
      }
    }

    return NextResponse.json(finalPayload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore durante estrazione.' },
      { status: 500 }
    );
  }
}
