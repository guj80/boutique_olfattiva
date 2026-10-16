import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  callGeminiWithFallback,
  callOpenRouterFree,
  extractJsonFromAiText,
  GeminiPart,
} from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

const PURE_FAMILIES = [
  'Agrumata',
  'Aromatica',
  'Marina',
  'Floreale',
  'Fruttata',
  'Verde',
  'Speziata',
  'Legnosa',
  'Ambrata',
  'Gourmand',
  'Cuoiata',
  'Muschiata',
] as const;

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

// Pulisce gli URL dai parametri di tracking (gclid, gad_source, utm, ecc.) e ancore (#)
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

// Converte qualsiasi URL immagine (anche relativo o //cdn...) in un URL https:// assoluto e pulito
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

// Estrae l'immagine principale del prodotto dall'HTML (og:image, twitter:image, JSON-LD Product, PrestaShop/Shopify)
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

  // Cerca nei blocchi JSON-LD (usati da Shopify, PrestaShop, Magento, Fragrantica)
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
    return `Dominio: ${u.hostname} | Brand e Nome estratti dall'URL: ${pathSegments.join(' - ')}`;
  } catch {
    return `URL: ${rawUrl}`;
  }
}

async function fetchWebMetadataWithBypass(rawUrl: string): Promise<{
  textSnippet: string;
  ogImage: string | null;
}> {
  const url = sanitizeProductUrl(rawUrl);
  let foundOgImage: string | null = null;

  // Se l'utente ha incollato direttamente il link di un file immagine (.jpg, .png, .webp)
  if (/\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(url)) {
    return {
      textSnippet: `Link immagine diretto fornito: ${url}`,
      ogImage: url,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
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
        .slice(0, 5000);

      if (strippedBody.length > 200 && !strippedBody.includes('Just a moment...')) {
        return {
          textSnippet: `Titolo Pagina: ${titleMatch?.[1]?.trim() || ''}\nMeta Description: ${descMatch?.[1]?.trim() || ''}\nTesto Reale Pagina Ufficiale: ${strippedBody}`,
          ogImage: foundOgImage,
        };
      }
    }
  } catch {
    // Passa a Jina Reader
  }

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 5500);
    const readerUrl = `https://r.jina.ai/${url}`;
    const readerRes = await fetch(readerUrl, {
      signal: controller2.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(timer2);

    if (readerRes.ok) {
      const readerText = (await readerRes.text()).slice(0, 6000);

      // Se il fetch diretto non aveva trovato l'immagine, la estrae dal Markdown di Jina Reader!
      if (!foundOgImage) {
        const mdImages = Array.from(
          readerText.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg\vert{}jpeg\vert{}png\vert{}webp)[^\s)]*)\)/gi)
        );
        const goodImg = mdImages
          .map((m) => m[1])
          .find((imgUrl) => !/logo|icon|flag|avatar|payment|banner|sprite/i.test(imgUrl));
        if (goodImg) {
          foundOgImage = resolveImageUrl(goodImg, url);
        }
      }

      if (readerText.length > 150 && !readerText.includes('Enable JavaScript and cookies')) {
        return {
          textSnippet: `Testo pagina estratto tramite Reader:\n${readerText}`,
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

async function searchLiveWebForPerfume(targetQuery: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const q = encodeURIComponent(`${targetQuery} perfume notes top middle base perfumer fragrantica`);
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${q}`;

    const res = await fetch(ddgUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const snippets = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4500);

      if (snippets.length > 250) {
        return `\nRISULTATI WEB IN TEMPO REALE PER "${targetQuery}":\n${snippets}`;
      }
    }
  } catch {
    // Continua senza bloccare
  }
  return '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    const supabase = getSupabaseServer();
    let dbVerifiedRecord: any = null;
    let contextSource = '';
    let discoveredImage: string | null = null;
    let needsGoogleSearchGrounding = false;
    const parts: GeminiPart[] = [];

    const searchTarget = (queryName || `${brand || ''} ${nome || ''}`).trim();

    // LIVELLO 1: Cerca nei 59.325+ profumi su Supabase (solo quando non viene passato un URL specifico)
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

            if (dbVerifiedRecord.cached_ai_data) {
              return NextResponse.json({
                ...dbVerifiedRecord.cached_ai_data,
                _modelUsed: 'supabase-verified-cache',
              });
            }
          }
        }
      } catch {
        // Passa al Livello 2
      }
    }

    // LIVELLO 2: Costruzione Contesto
    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      const cleanUrl = sanitizeProductUrl(url);
      const slugInfo = parseUrlSlugInfo(cleanUrl);
      const webData = await fetchWebMetadataWithBypass(cleanUrl);
      discoveredImage = webData.ogImage;
      contextSource = `MODALITA: Estrazione da Link Ufficiale/Web.\nURL: ${cleanUrl}\n${slugInfo}\n${webData.textSnippet}`;
      if (!webData.textSnippet) needsGoogleSearchGrounding = true;
    } else if (dbVerifiedRecord) {
      contextSource = `MODALITA: SCHEDA CERTIFICATA DAL DATABASE SUPABASE (TOLLERANZA ZERO).
Ecco i dati UFFICIALI CERTIFICATI estratti dal database per questo profumo:
- Brand Ufficiale: ${dbVerifiedRecord.brand || brand || ''}
- Nome Ufficiale: ${dbVerifiedRecord.name || nome || ''}
- Concentrazione: ${dbVerifiedRecord.concentration || 'Eau de Parfum'}
- Anno di uscita: ${dbVerifiedRecord.release_year || 'Non specificato'}
- Profumiere (Naso): ${dbVerifiedRecord.perfumers || 'Non specificato'}
- Accordi Principali (Main Accords): ${dbVerifiedRecord.main_accords || ''}
- Note di Testa Ufficiali (Top Notes): ${dbVerifiedRecord.top_notes || 'Non dichiarate'}
- Note di Cuore Ufficiali (Middle Notes): ${dbVerifiedRecord.middle_notes || 'Non dichiarate'}
- Note di Fondo Ufficiali (Base Notes): ${dbVerifiedRecord.base_notes || 'Non dichiarate'}

ORDINE TASSATIVO: Traduci fedelmente in italiano le note di testa, cuore e fondo qui sopra SENZA AGGIUNGERE NESSUNA NOTA NON PRESENTE NELLA SCHEDA CERTIFICATA.`;
    } else if (searchTarget) {
      const liveWebSnippet = await searchLiveWebForPerfume(searchTarget);
      needsGoogleSearchGrounding = true;
      contextSource = `MODALITA: Profumo di Nicchia / Nuova Uscita ("${searchTarget}").
${liveWebSnippet}
Estrai la piramide olfattiva UFFICIALE reale di "${searchTarget}" basandoti sui risultati web qui sopra e sulla tua conoscenza verificata del catalogo ufficiale del brand.`;
    } else if (imageBase64) {
      contextSource = `MODALITA: Analisi Visiva Flacone / Campioncino. Leggi brand e nome dall'immagine allegata e restituisci la piramide olfattiva ufficiale esatta.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un catalogatore tecnico di profumeria artistica e di nicchia con obbligo di precisione assoluta (Zero-Hallucination).
VIETATO INVENTARE NOTE OLFATTIVE O NASI PROFUMIERI. Non usare toni poetici: sii oggettivo, tecnico e rigoroso.

${contextSource}

REGOLA TASSATIVA PER "famiglia_olfattiva":
Devi scegliere ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12 Famiglie Olfattive Pure Ufficiali:
"Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".

REGOLA TASSATIVA PER "naso":
Inserisci il nome del Maître Parfumeur (Naso) SOLO SE è ufficialmente dichiarato e verificato al 100%. Se non è noto con certezza assoluta, restituisci stringa vuota "".

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "nome": "Nome ufficiale esatto del profumo (senza brand)",
  "brand": "Nome ufficiale del Brand",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Eau de Toilette",
  "famiglia_olfattiva": "Una sola tra: Agrumata, Aromatica, Marina, Floreale, Fruttata, Verde, Speziata, Legnosa, Ambrata, Gourmand, Cuoiata, Muschiata",
  "note_testa": "Note di testa ufficiali in italiano separate da virgola",
  "note_cuore": "Note di cuore ufficiali in italiano separate da virgola",
  "note_fondo": "Note di fondo ufficiali in italiano separate da virgola",
  "note_olfattive": "Elenco completo delle note in italiano separate da virgola",
  "descrizione_ai": "Analisi tecnica e oggettiva del profilo olfattivo basata SOLO sulle note reali presenti (max 2 frasi)",
  "prezzo_stimato_euro": "Prezzo di listino in Euro nel formato €XXX",
  "formato_ml": 100,
  "stagione_ideale": "Es. Primavera / Estate, oppure Autunno / Inverno",
  "occasione_ideale": "Es. Ufficio, Aperitivo, Cena, Serata, Evento",
  "naso": "Nome del Naso profumiere ufficiale oppure stringa vuota",
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

    let { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.0,
      jsonMode: true,
      useGoogleSearch: needsGoogleSearchGrounding,
    });

    let parsed: Record<string, any>;
    try {
      parsed = extractJsonFromAiText<Record<string, any>>(text);
    } catch {
      const retry = await callGeminiWithFallback(
        [{ text: `${systemPrompt}\n\nConverti in JSON valido:\n${text}` }],
        { temperature: 0.0, jsonMode: true, useGoogleSearch: false }
      );
      parsed = extractJsonFromAiText<Record<string, any>>(retry.text);
      modelUsed = retry.modelUsed;
    }

    // LIVELLO 3: Giudice Anti-Allucinazione Groq Llama 3.3 70B
    if (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY) {
      const judgePrompt = dbVerifiedRecord
        ? `Confronta DATI_ORIGINALI_DB con JSON_ITALIANO. Assicurati che non sia stata aggiunta nessuna nota olfattiva inesistente nei DATI_ORIGINALI_DB. Se trovi una nota inventata, rimuovila. Restituisci SOLO il JSON completo.\nDATI_ORIGINALI_DB: Top: ${dbVerifiedRecord.top_notes || 'N/A'} | Middle: ${dbVerifiedRecord.middle_notes || 'N/A'} | Base: ${dbVerifiedRecord.base_notes || 'N/A'}\nJSON_ITALIANO: ${JSON.stringify(parsed)}`
        : `Sei un revisore esperto di profumeria di nicchia e artistica. Verifica la scheda JSON generata per il profumo "${searchTarget}". Controlla che brand, nome e piramide olfattiva siano reali e privi di allucinazioni. Restituisci SOLO l'oggetto JSON completo con le stesse identiche chiavi.\nJSON_DA_VERIFICARE: ${JSON.stringify(parsed)}`;

      const judgeRes = await callOpenRouterFree(judgePrompt);
      if (judgeRes) {
        try {
          const verifiedParsed = extractJsonFromAiText<Record<string, any>>(judgeRes.text);
          if (verifiedParsed.nome && (verifiedParsed.note_testa || verifiedParsed.note_olfattive)) {
            parsed = verifiedParsed;
            modelUsed = `${modelUsed}+verified_by_${judgeRes.modelUsed}`;
          }
        } catch {
          // Mantiene il risultato di Gemini
        }
      }
    }

    const pureFamily = (PURE_FAMILIES as readonly string[]).includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(dbVerifiedRecord?.main_accords || parsed.famiglia_olfattiva);

    const unifiedNotes =
      parsed.note_olfattive ||
      [parsed.note_testa, parsed.note_cuore, parsed.note_fondo]
        .filter(Boolean)
        .join(', ');

    const finalImageUrl =
      discoveredImage ||
      (parsed.url_foto_vetrina && String(parsed.url_foto_vetrina).startsWith('http')
        ? String(parsed.url_foto_vetrina).trim()
        : null);

    const finalNaso =
      (dbVerifiedRecord?.perfumers && dbVerifiedRecord.perfumers !== 'Non specificato'
        ? dbVerifiedRecord.perfumers
        : parsed.naso) || null;

    const finalPayload = {
      nome: dbVerifiedRecord?.name || parsed.nome || nome || 'Fragranza',
      brand: dbVerifiedRecord?.brand || parsed.brand || brand || 'Brand',
      concentrazione: dbVerifiedRecord?.concentration || parsed.concentrazione || 'Eau de Parfum',
      famiglia_olfattiva: pureFamily,
      note_testa: parsed.note_testa || '',
      note_cuore: parsed.note_cuore || '',
      note_fondo: parsed.note_fondo || '',
      note_olfattive: unifiedNotes,
      descrizione_ai: parsed.descrizione_ai || '',
      prezzo_stimato_euro: parsed.prezzo_stimato_euro || '€150',
      formato_ml: Number(parsed.formato_ml) || 100,
      stagione_ideale: parsed.stagione_ideale || '',
      occasione_ideale: parsed.occasione_ideale || 'Serata',
      naso: finalNaso,
      voto_longevita: Number(parsed.voto_longevita) || 8,
      voto_scia: Number(parsed.voto_scia) || 8,
      voto_proiezione: Number(parsed.voto_proiezione) || 8,
      voto_complessita: Number(parsed.voto_complessita) || 8,
      url_foto_vetrina: finalImageUrl,
      _modelUsed: dbVerifiedRecord ? `supabase_db+${modelUsed}` : `web_niche+${modelUsed}`,
    };

    // AUTO-APPRENDIMENTO DEL DATABASE
    if (supabase && !imageBase64) {
      if (dbVerifiedRecord?.id) {
        supabase
          .from('perfumes')
          .update({ cached_ai_data: finalPayload })
          .eq('id', dbVerifiedRecord.id)
          .then();
      } else if (finalPayload.nome && finalPayload.brand && finalPayload.note_olfattive) {
        supabase
          .from('perfumes')
          .insert({
            name: finalPayload.nome,
            brand: finalPayload.brand,
            concentration: finalPayload.concentrazione,
            main_accords: finalPayload.famiglia_olfattiva,
            top_notes: finalPayload.note_testa,
            middle_notes: finalPayload.note_cuore,
            base_notes: finalPayload.note_fondo,
            perfumers: finalPayload.naso,
            cached_ai_data: finalPayload,
          })
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
