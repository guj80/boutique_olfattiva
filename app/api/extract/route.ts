import { NextResponse } from 'next/server';
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

function clampVote(val: any, fallback: number = 8): number {
  const n = Number(val);
  if (isNaN(n) || n < 1 || n > 10) return fallback;
  return Math.round(n);
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

    const systemPrompt = `Sei l'enciclopedia tecnica definitiva dell'alta profumeria artistica e di nicchia.
Il tuo compito è restituire una scheda tecnica RIGOROSA e VERITIERA per: "${searchTarget || url || 'profumo'}".

REGOLE TASSATIVE ANTIALLUCINAZIONE:
1. "famiglia_olfattiva": Scegli ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12:
   "Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
2. "prezzo_stimato_euro": Indica i prezzi di listino ufficiali stimati in euro per formato (es. "50ml: €195 • 100ml: €280").
3. Sii estremamente fedele alla piramide olfattiva ufficiale del profumo richiesto.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:
{
  "nome": "Nome ufficiale esatto",
  "brand": "Nome Maison",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum",
  "anno_lancio": 2023,
  "famiglia_olfattiva": "Una sola delle 12 famiglie pure",
  "note_testa": "Note di testa separate da virgola",
  "note_cuore": "Note di cuore separate da virgola",
  "note_fondo": "Note di fondo separate da virgola",
  "note_olfattive": "Elenco completo note separate da virgola",
  "descrizione_ai": "Analisi tecnica oggettiva in 2 frasi",
  "prezzo_stimato_euro": "Es. 50ml: €195 • 100ml: €280",
  "formato_ml": 100,
  "stagione_ideale": "Es. Primavera / Estate",
  "occasione_ideale": "Es. Serata, Evento Formale",
  "naso": "Nome del Maître Parfumeur",
  "voto_longevita": 8,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 8,
  "url_foto_vetrina": ""
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
      timeoutMs: 22000,
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

    const finalPayload = {
      nome: (parsed.nome || nome || searchTarget || 'Creazione').trim(),
      brand: (parsed.brand || brand || 'Maison').trim(),
      concentrazione: (parsed.concentrazione || 'Eau de Parfum').trim(),
      anno_lancio: Number(parsed.anno_lancio) || 2023,
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
      naso: parsed.naso ? String(parsed.naso).trim() : null,
      voto_longevita: clampVote(parsed.voto_longevita, 8),
      voto_scia: clampVote(parsed.voto_scia, 8),
      voto_proiezione: clampVote(parsed.voto_proiezione, 8),
      voto_complessita: clampVote(parsed.voto_complessita, 8),
      url_foto_vetrina: parsed.url_foto_vetrina || null,
      _modelUsed: modelUsed,
    };

    return NextResponse.json(finalPayload);
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore durante l\'estrazione dei dati.' },
      { status: 500 }
    );
  }
}
