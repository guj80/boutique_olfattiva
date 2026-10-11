import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText, GeminiPart } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

function parseUrlSlugInfo(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const pathSegments = u.pathname
      .split('/')
      .filter(Boolean)
      .map((s) => decodeURIComponent(s).replace(/[-_]/g, ' ').replace(/\.html?$/i, ''));
    return `Host: ${u.hostname} | Percorso decodificato (contiene Brand e Nome profumo): ${pathSegments.join(' -> ')}`;
  } catch {
    return `Stringa URL: ${rawUrl}`;
  }
}

async function fetchWebMetadataWithTimeout(url: string, timeoutMs = 4000): Promise<{
  textSnippet: string;
  ogImage: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        textSnippet: `Fetch HTTP status ${res.status} (possibile protezione anti-bot Cloudflare). Usa le informazioni dello slug URL e la tua conoscenza enciclopedica.`,
        ogImage: null,
      };
    }

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
      .slice(0, 3500);

    return {
      textSnippet: `Titolo Pagina: ${titleMatch?.[1]?.trim() || 'N/D'}\nMeta Description: ${descMatch?.[1]?.trim() || 'N/D'}\nTesto estratto: ${strippedBody}`,
      ogImage: ogImgMatch?.[1] || null,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      textSnippet: `Fetch diretto scaduto o bloccato (${err?.message || 'timeout'}). Affidati allo slug URL e alla tua enciclopedia di profumeria artistica.`,
      ogImage: null,
    };
  }
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
      const webData = await fetchWebMetadataWithTimeout(url.trim());
      discoveredImage = webData.ogImage;
      contextSource = `MODALITÀ: Estrazione da Link Web.\nURL Originale: ${url}\n${slugInfo}\n${webData.textSnippet}`;
    } else if (brand || nome || queryName) {
      const target = queryName || `${brand || ''} ${nome || ''}`.trim();
      contextSource = `MODALITÀ: Ricerca Enciclopedica Alta Profumeria per la fragranza: "${target}".`;
    } else if (imageBase64) {
      contextSource = `MODALITÀ: Analisi Visiva Flacone / Scatola / Campioncino (Mouche/Vial). Leggi attentamente brand, nome del profumo e concentrazione dall'immagine allegata e completa tutta la piramide olfattiva reale.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo da analizzare.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei il Master Sommelier Olfattivo della "Boutique Olfattiva di Luca", massimo esperto mondiale di profumeria artistica, di nicchia e d'autore (es. Lorenzo Pazzaglia, Orto Parisi, Nasomatto, Xerjoff, Amouage, Maison Crivelli, Nishane, Serge Lutens, Tom Ford, Creed, Parfums de Marly, Byredo, ecc.).

${contextSource}

Il tuo compito è identificare con precisione chirurgica il profumo richiesto e restituire ESCLUSIVAMENTE un oggetto JSON valido (senza commenti e senza markdown) con questa esatta struttura:
{
  "nome": "Nome esatto del profumo (senza ripetere il brand)",
  "brand": "Nome ufficiale della Maison / Brand",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Parfum, Eau de Toilette",
  "famiglia_olfattiva": "Es. Ambrato Legnoso, Gourmand Speziato, Marino Aromatizzato, Cuoiato Affumicato",
  "note_testa": "Elenco note di testa separate da virgola (in italiano)",
  "note_cuore": "Elenco note di cuore separate da virgola (in italiano)",
  "note_fondo": "Elenco note di fondo separate da virgola (in italiano)",
  "note_olfattive": "Sintesi completa di tutte le note principali separate da virgola",
  "descrizione_ai": "Descrizione poetica, sensoriale e tecnica di 2-3 frasi in stile Sommelier di alta profumeria a Milano/Parigi",
  "prezzo_stimato_euro": "Prezzo di listino medio in Euro nel formato €XXX (es. €165, €240)",
  "formato_ml": 50,
  "stagione_ideale": "Es. Autunno / Inverno, oppure Estate / Primavera",
  "occasione_ideale": "Es. Serata Elegante, Signature Scent, Incontro Intimo, Evento Esclusivo",
  "voto_longevita": 9,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 9,
  "url_foto_vetrina": "${discoveredImage || ''}"
}

REGOLE TASSATIVE:
- Compila TUTTI i campi in italiano con dati reali e accurati per quel profumo specifico.
- I voti (voto_longevita, voto_scia, voto_proiezione, voto_complessita) devono essere numeri interi da 1 a 10 coerenti con la reale potenza della fragranza (es. un Extrait di Lorenzo Pazzaglia o Orto Parisi avrà 9 o 10).
- Restituisci SOLO il JSON puro.`;

    parts.push({ text: systemPrompt });

    if (imageBase64 && typeof imageBase64 === 'string') {
      const cleanBase64 = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.2,
      jsonMode: true,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    // Garantiamo che note_olfattive sia sempre valorizzato per retrocompatibilità coi 40 profumi
    const unifiedNotes =
      parsed.note_olfattive ||
      [parsed.note_testa, parsed.note_cuore, parsed.note_fondo]
        .filter(Boolean)
        .join(', ');

    const result = {
      nome: parsed.nome || nome || 'Fragranza Artistica',
      brand: parsed.brand || brand || 'Maison di Nicchia',
      concentrazione: parsed.concentrazione || 'Extrait de Parfum',
      famiglia_olfattiva: parsed.famiglia_olfattiva || 'Artistico / Nicchia',
      note_testa: parsed.note_testa || '',
      note_cuore: parsed.note_cuore || '',
      note_fondo: parsed.note_fondo || '',
      note_olfattive: unifiedNotes,
      descrizione_ai: parsed.descrizione_ai || '',
      prezzo_stimato_euro: parsed.prezzo_stimato_euro || '€180',
      formato_ml: Number(parsed.formato_ml) || 50,
      stagione_ideale: parsed.stagione_ideale || 'Quattro Stagioni',
      occasione_ideale: parsed.occasione_ideale || 'Signature / Serata',
      voto_longevita: Number(parsed.voto_longevita) || 8,
      voto_scia: Number(parsed.voto_scia) || 8,
      voto_proiezione: Number(parsed.voto_proiezione) || 8,
      voto_complessita: Number(parsed.voto_complessita) || 8,
      url_foto_vetrina: parsed.url_foto_vetrina || discoveredImage || null,
      _modelUsed: modelUsed,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/extract Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore durante l\'estrazione neurale del profumo.' },
      { status: 500 }
    );
  }
}
