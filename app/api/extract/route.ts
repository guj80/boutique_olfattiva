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

async function fetchWebMetadataWithBypass(url: string): Promise<{
  textSnippet: string;
  ogImage: string | null;
}> {
  let foundOgImage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
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
      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      foundOgImage = ogImgMatch?.[1] || null;

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
      const readerText = (await readerRes.text()).slice(0, 5000);
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

// Ricerca Web live automatica per profumi non ancora presenti nel DB locale
async function searchLiveWebForPerfume(targetQuery: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const searchUrl = `https://s.jina.ai/${encodeURIComponent(
      `${targetQuery} perfume fragrantica parfumo notes pyramid top middle base`
    )}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(timer);
    if (res.ok) {
      const txt = (await res.text()).slice(0, 4500);
      if (txt.length > 200) {
        return `\nDATI REALI ESTRATTI DAL WEB PER "${targetQuery}":\n${txt}`;
      }
    }
  } catch {
    // Fallback su Google Search Grounding di Gemini
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

    // LIVELLO 1: Cerca prima nei 59.325 profumi certificati su Supabase
    if (supabase && searchTarget.length >= 2 && !imageBase64) {
      try {
        const { data: matches } = await supabase.rpc('search_perfume_exact', {
          search_query: searchTarget,
        });

        if (matches && matches.length > 0) {
          dbVerifiedRecord = matches[0];

          // Se abbiamo già la risposta verificata in cache su Supabase, restituiscila in 0.02 secondi!
          if (dbVerifiedRecord.cached_ai_data && !url) {
            return NextResponse.json({
              ...dbVerifiedRecord.cached_ai_data,
              _modelUsed: 'supabase-verified-cache',
            });
          }
        }
      } catch {
        // Continua se la funzione RPC o il seed non sono ancora stati completati
      }
    }

    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      const slugInfo = parseUrlSlugInfo(url.trim());
      const webData = await fetchWebMetadataWithBypass(url.trim());
      discoveredImage = webData.ogImage;
      contextSource = `MODALITA: Estrazione da Link Ufficiale/Web.\nURL: ${url}\n${slugInfo}\n${webData.textSnippet}`;
      if (!webData.textSnippet) needsGoogleSearchGrounding = true;
    } else if (dbVerifiedRecord) {
      contextSource = `MODALITA: SCHEDA CERTIFICATA DAL DATABASE SUPABASE (TOLLERANZA ZERO).
Ecco i dati UFFICIALI CERTIFICATI estratti dal database per questo profumo:
- Brand Ufficiale: ${dbVerifiedRecord.brand || brand || ''}
- Nome Ufficiale: ${dbVerifiedRecord.name || nome || ''}
- Concentrazione: ${dbVerifiedRecord.concentration || 'Eau de Parfum'}
- Anno di uscita: ${dbVerifiedRecord.release_year || 'Non specificato'}
- Profumiere: ${dbVerifiedRecord.perfumers || 'Non specificato'}
- Accordi Principali (Main Accords): ${dbVerifiedRecord.main_accords || ''}
- Note di Testa Ufficiali (Top Notes): ${dbVerifiedRecord.top_notes || 'Non dichiarate'}
- Note di Cuore Ufficiali (Middle Notes): ${dbVerifiedRecord.middle_notes || 'Non dichiarate'}
- Note di Fondo Ufficiali (Base Notes): ${dbVerifiedRecord.base_notes || 'Non dichiarate'}

ORDINE TASSATIVO: Traduci fedelmente in italiano le note di testa, cuore e fondo qui sopra SENZA AGGIUNGERE NESSUNA NOTA NON PRESENTE NELLA SCHEDA CERTIFICATA. Se la scheda ha solo un elenco unico in Top Notes e vuoto in Middle/Base, mantieni esattamente quelle note senza inventarne altre.`;
    } else if (searchTarget) {
      const liveWebSnippet = await searchLiveWebForPerfume(searchTarget);
      if (!liveWebSnippet) needsGoogleSearchGrounding = true;
      contextSource = `MODALITA: Verifica rigorosa da Catalogo Ufficiale per: "${searchTarget}".
${liveWebSnippet}
Riporta ESCLUSIVAMENTE la piramide olfattiva UFFICIALE reale di "${searchTarget}". È severamente vietato indovinare o aggiungere note verosimili non presenti nella scheda tecnica ufficiale del brand.`;
    } else if (imageBase64) {
      contextSource = `MODALITA: Analisi Visiva Flacone / Campioncino. Leggi brand e nome dall'immagine allegata e restituisci la piramide olfattiva ufficiale esatta.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un catalogatore tecnico di profumeria artistica con obbligo di precisione assoluta (0% allucinazioni).
VIETATO INVENTARE NOTE OLFATTIVE. Non usare toni poetici o da sommelier: sii oggettivo, tecnico e rigoroso.

${contextSource}

REGOLA TASSATIVA PER "famiglia_olfattiva":
Devi scegliere ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12 Famiglie Olfattive Pure Ufficiali:
"Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".

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
      jsonMode: !needsGoogleSearchGrounding,
      useGoogleSearch: needsGoogleSearchGrounding,
    });

    let parsed: Record<string, any>;
    try {
      parsed = extractJsonFromAiText<Record<string, any>>(text);
    } catch {
      // Se Google Search Grounding ha restituito testo non JSON, forziamo la conversione JSON a Temperatura 0
      const retry = await callGeminiWithFallback(
        [{ text: `${systemPrompt}\n\nDATI RACCOLTI:\n${text}` }],
        { temperature: 0.0, jsonMode: true }
      );
      parsed = extractJsonFromAiText<Record<string, any>>(retry.text);
      modelUsed = retry.modelUsed;
    }

    // LIVELLO 3: Giudice Anti-Allucinazione OpenRouter (se configurato) quando c'è un record certificato
   if (dbVerifiedRecord && (process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY)) {
      const judgePrompt = `Confronta i DATI_ORIGINALI_DB (in inglese) con il JSON_ITALIANO.
Assicurati che in note_testa, note_cuore, note_fondo e note_olfattive del JSON_ITALIANO non sia stata inventata nessuna nota assente nei DATI_ORIGINALI_DB.
Se trovi una nota inventata, rimuovila subito. Restituisci SOLO l'oggetto JSON corretto completo.

DATI_ORIGINALI_DB:
Top: ${dbVerifiedRecord.top_notes || 'N/A'} | Middle: ${dbVerifiedRecord.middle_notes || 'N/A'} | Base: ${dbVerifiedRecord.base_notes || 'N/A'} | Accords: ${dbVerifiedRecord.main_accords || 'N/A'}

JSON_ITALIANO:
${JSON.stringify(parsed)}`;

      const judgeRes = await callOpenRouterFree(judgePrompt);
      if (judgeRes) {
        try {
          const verifiedParsed = extractJsonFromAiText<Record<string, any>>(judgeRes.text);
          if (verifiedParsed.nome && (verifiedParsed.note_testa || verifiedParsed.note_olfattive)) {
            parsed = verifiedParsed;
            modelUsed = `${modelUsed}+verified_by_${judgeRes.modelUsed}`;
          }
        } catch {
          // Mantiene il risultato di Gemini a temperatura 0.0
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

    // Sovrascrittura deterministica di Nome, Brand e Concentrazione se presenti nel DB Supabase
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
      voto_longevita: Number(parsed.voto_longevita) || 8,
      voto_scia: Number(parsed.voto_scia) || 8,
      voto_proiezione: Number(parsed.voto_proiezione) || 8,
      voto_complessita: Number(parsed.voto_complessita) || 8,
      url_foto_vetrina: parsed.url_foto_vetrina || discoveredImage || null,
      _modelUsed: dbVerifiedRecord ? `supabase_db+${modelUsed}` : modelUsed,
    };

    // Salva nella cache di Supabase per risposte future istantanee (0.02s)
    if (supabase && dbVerifiedRecord?.id && !url && !imageBase64) {
      supabase
        .from('perfumes')
        .update({ cached_ai_data: finalPayload })
        .eq('id', dbVerifiedRecord.id)
        .then();
    }

    return NextResponse.json(finalPayload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore durante estrazione.' },
      { status: 500 }
    );
  }
}
