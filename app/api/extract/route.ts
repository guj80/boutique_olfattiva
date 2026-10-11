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
  // Tentativo 1: Fetch diretto (perfetto per siti ufficiali come lorenzopazzaglia.com, xerjoff.com, ecc.)
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
      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      const strippedBody = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4500);

      if (strippedBody.length > 200 && !strippedBody.includes('Just a moment...')) {
        return {
          textSnippet: `Titolo: ${titleMatch?.[1]?.trim() || ''}\nDescrizione: ${descMatch?.[1]?.trim() || ''}\nContenuto Pagina Reale: ${strippedBody}`,
          ogImage: ogImgMatch?.[1] || null,
        };
      }
    }
  } catch {
    // Passa al tentativo 2
  }

  // Tentativo 2: Bypass Reader per pagine con Cloudflare (es. Fragrantica)
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
      const readerText = (await readerRes.text()).slice(0, 4500);
      if (readerText.length > 150 && !readerText.includes('Enable JavaScript and cookies')) {
        return {
          textSnippet: `Contenuto estratto tramite Reader:\n${readerText}`,
          ogImage: null,
        };
      }
    }
  } catch {
    // Continua
  }

  return {
    textSnippet: `ATTENZIONE: Il sito web ha bloccato la lettura automatica (Cloudflare). NON INVENTARE NOTE A CASO: usa solo le note ufficiali reali che conosci con certezza per questa fragranza.`,
    ogImage: null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    let contextSource = '';
    let discoveredImage: string | null = null;
    const parts: GeminiPart[] = [];

    if (url && typeof url === 'string') {
      const slugInfo = parseUrlSlugInfo(url.trim());
      const webData = await fetchWebMetadataWithBypass(url.trim());
      discoveredImage = webData.ogImage;
      contextSource = `MODALITÀ: Estrazione da Link Web.\nURL: ${url}\n${slugInfo}\n${webData.textSnippet}`;
    } else if (brand || nome || queryName) {
      const target = queryName || `${brand || ''} ${nome || ''}`.trim();
      contextSource = `MODALITÀ: Scheda Tecnica Enciclopedica per la fragranza: "${target}".`;
    } else if (imageBase64) {
      contextSource = `MODALITÀ: Analisi Visiva Flacone / Campioncino. Leggi brand e nome dall'immagine allegata e compila la piramide olfattiva ufficiale.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un esperto catalogatore tecnico di profumeria artistica e di nicchia.
${contextSource}

Se nel testo sopra sono presenti le note della pagina web (es. Note di testa, Note di cuore, Note di base), COPIALE FEDELMENTE senza inventare nulla.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "nome": "Nome esatto del profumo (senza brand)",
  "brand": "Nome ufficiale del Brand",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum",
  "famiglia_olfattiva": "Es. Agrumato Marino, Ambrato Legnoso, Gourmand Speziato",
  "note_testa": "Note di testa reali separate da virgola",
  "note_cuore": "Note di cuore reali separate da virgola",
  "note_fondo": "Note di fondo reali separate da virgola",
  "note_olfattive": "Tutte le note principali separate da virgola",
  "descrizione_ai": "Descrizione tecnica ed essenziale del profilo olfattivo (max 2 frasi sobrie)",
  "prezzo_stimato_euro": "Prezzo di listino in Euro nel formato €XXX",
  "formato_ml": 50,
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

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
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
      concentrazione: parsed.concentrazione || 'Extrait de Parfum',
      famiglia_olfattiva: parsed.famiglia_olfattiva || '',
      note_testa: parsed.note_testa || '',
      note_cuore: parsed.note_cuore || '',
      note_fondo: parsed.note_fondo || '',
      note_olfattive: unifiedNotes,
      descrizione_ai: parsed.descrizione_ai || '',
      prezzo_stimato_euro: parsed.prezzo_stimato_euro || '€160',
      formato_ml: Number(parsed.formato_ml) || 50,
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
