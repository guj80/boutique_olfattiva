import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText, GeminiPart } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export const PURE_FAMILIES = [
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
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('pulit') || s.includes('talc') || s.includes('mineral')) return 'Muschiata';
  if (s.includes('speziat')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('esperid')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('oriental') || s.includes('incens') || s.includes('resin')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger') || s.includes('fougèr')) return 'Aromatica';
  if (s.includes('legnos') || s.includes('bois') || s.includes('chypre') || s.includes('oud')) return 'Legnosa';
  return 'Legnosa';
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
    // Continua
  }

  return {
    textSnippet: `Riporta esclusivamente la piramide olfattiva UFFICIALE esatta di questo profumo.`,
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
      contextSource = `MODALITA: Estrazione da Link Ufficiale/Web.\nURL: ${url}\n${slugInfo}\n${webData.textSnippet}`;
    } else if (brand || nome || queryName) {
      const target = queryName || `${brand || ''} ${nome || ''}`.trim();
      contextSource = `MODALITA: Verifica da Catalogo Ufficiale per: "${target}". Se il nome contiene un refuso, correggi il campo "nome" e "brand" con il vero nome ufficiale.`;
    } else if (imageBase64) {
      contextSource = `MODALITA: Analisi Visiva Flacone / Campioncino. Leggi brand e nome dall'immagine allegata e restituisci la piramide olfattiva ufficiale.`;
    } else {
      return NextResponse.json(
        { error: 'Fornisci un URL, una foto o il nome del profumo.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Sei un catalogatore tecnico di profumeria artistica.
VIETATO INVENTARE NOTE OLFATTIVE.

${contextSource}

REGOLA TASSATIVA PER "famiglia_olfattiva":
Devi scegliere ESCLUSIVAMENTE UNA SOLA PARola tra queste 12 Famiglie Olfattive Pure Ufficiali:
"Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
(Vietato usare doppie parole come "Agrumato Aromatico" o "Ambrato Floreale": scegli solo la famiglia pura dominante!).

Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "nome": "Nome ufficiale esatto del profumo (senza brand)",
  "brand": "Nome ufficiale del Brand",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum, Eau de Toilette",
  "famiglia_olfattiva": "Una sola tra: Agrumata, Aromatica, Marina, Floreale, Fruttata, Verde, Speziata, Legnosa, Ambrata, Gourmand, Cuoiata, Muschiata",
  "note_testa": "Note di testa ufficiali separate da virgola",
  "note_cuore": "Note di cuore ufficiali separate da virgola",
  "note_fondo": "Note di fondo ufficiali separate da virgola",
  "note_olfattive": "Elenco completo delle note separate da virgola",
  "descrizione_ai": "Sintesi tecnica sobria del profilo olfattivo (max 2 frasi)",
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

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const pureFamily = PURE_FAMILIES.includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(parsed.famiglia_olfattiva);

    const unifiedNotes =
      parsed.note_olfattive ||
      [parsed.note_testa, parsed.note_cuore, parsed.note_fondo]
        .filter(Boolean)
        .join(', ');

    return NextResponse.json({
      nome: parsed.nome || nome || 'Fragranza',
      brand: parsed.brand || brand || 'Brand',
      concentrazione: parsed.concentrazione || 'Eau de Parfum',
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
      _modelUsed: modelUsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore durante estrazione.' },
      { status: 500 }
    );
  }
}
