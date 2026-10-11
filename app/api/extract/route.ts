import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText, GeminiPart } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

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
    // Passa al reader
  }

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 5000);
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
    // Continua col Grounding Google
  }

  return {
    textSnippet: `La pagina web diretta ha protezione anti-bot. Usa la Ricerca Google (Google Search Grounding) per verificare la piramide olfattiva UFFICIALE esatta di questo profumo.`,
    ogImage: foundOgImage,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    let contextSource = '';
    let discoveredImage: string | null = null;
    const parts: GeminiPart[] = [];

    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      const slugInfo = parseUrlSlugInfo(url.trim());
      const webData = await fetchWebMetadataWithBypass(url.trim());
      discoveredImage = webData.ogImage;
      contextSource = `MODALITÀ: Estrazione da Link Ufficiale/Web.\nURL: ${url}\n${slugInfo}\n${webData.textSnippet}`;
    } else if (brand || nome || queryName) {
      const target = queryName || `${brand || ''} ${nome || ''}`.trim();
      contextSource = `MODALITÀ: Verifica e Correzione da Catalogo Ufficiale / Google per: "${target}".
ATTENZIONE CRITICA: Se il nome "${target}" contiene un refuso o errore di battitura nel database (es. "Artisano" di "Botanicae" che in realtà nel catalogo reale di Botanicae si chiama "Tremonte"), CORREGGI il campo "nome" e "brand" con il vero nome ufficiale del profumo esistente e riporta le sue VERE note olfattive ufficiali senza MAI inventare nulla!`;
    } else if (imageBase64) {
      contextSource = `MODALITÀ: Analisi Visiva Flacone / Campioncino. Leggi con attenzione brand e nome dall'immagine allegata, cerca la piramide olfattiva ufficiale reale e restituisci i dati verificati.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un rigoroso catalogatore tecnico di profumeria artistica e selettiva.
VIETATO INVENTARE O ALLUCINARE NOTE OLFATTIVE.

${contextSource}

Istruzioni Tassative:
1. Verifica la piramide olfattiva reale (Note di Testa, Note di Cuore, Note di Fondo) dal testo della pagina fornito oppure tramite la ricerca web ufficiale del brand.
2. Se il nome del profumo fornito dall'utente aveva un errore di battitura (es. "Artisano" anziché "Tremonte"), restituisci nel campo "nome" il NOME UFFICIALE CORRETTO.
3. Se conosci o trovi l'URL diretto di un'immagine pubblica del flacone (e non è già presente in url_foto_vetrina), inseriscilo in "url_foto_vetrina", altrimenti lascia quello trovato.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido (nessun testo fuori dal JSON):
{
  "nome": "Nome ufficiale esatto e corretto del profumo (senza brand)",
  "brand": "Nome ufficiale del Brand",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Eau de Toilette",
  "famiglia_olfattiva": "Es. Agrumato Marino, Ambrato Legnoso, Speziato Orientale",
  "note_testa": "Note di testa ufficiali separate da virgola (in italiano)",
  "note_cuore": "Note di cuore ufficiali separate da virgola (in italiano)",
  "note_fondo": "Note di fondo ufficiali separate da virgola (in italiano)",
  "note_olfattive": "Elenco completo delle note separate da virgola",
  "descrizione_ai": "Sintesi tecnica sobria del carattere olfattivo (max 2 frasi)",
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

    // Attiviamo useGoogleSearch (se non c'è un'immagine Base64) per interrogare Google in tempo reale!
    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
      useGoogleSearch: !imageBase64,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const unifiedNotes =
      parsed.note_olfattive ||
      [parsed.note_testa, parsed.note_cuore, parsed.note_fondo]
        .filter(Boolean)
        .join(', ');

    return NextResponse.json({
      nome: parsed.nome || nome || 'Fragranza',
      brand: parsed.brand || brand || 'Brand',
      concentrazione: parsed.concentrazione || 'Eau de Parfum',
      famiglia_olfattiva: parsed.famiglia_olfattiva || '',
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
      _modelUsed: modelUsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore durante l\'estrazione.' },
      { status: 500 }
    );
  }
}
