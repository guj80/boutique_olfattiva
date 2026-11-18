import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import {
  SCENT_AXES,
  isScentArchetype,
  isScentAxisValues,
  type ScentArchetype,
} from '@/lib/scent-dna';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_LIST_ITEMS = 8;
const MAX_ITEM_LENGTH = 40;

function sanitizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>{}[\]`"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ITEM_LENGTH);
  return clean.length >= 2 ? clean : null;
}

function sanitizeList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value.slice(0, MAX_LIST_ITEMS)) {
    const clean = sanitizeToken(item);
    if (clean) out.push(clean);
  }
  return out;
}

function stripFences(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const axes = payload.axes;
  const dominantFamilies = sanitizeList(payload.dominantFamilies);
  const topNotes = sanitizeList(payload.topNotes);

  if (!isScentAxisValues(axes) || !dominantFamilies || !topNotes) {
    return NextResponse.json(
      { error: 'Dati del profilo olfattivo incompleti o non validi.' },
      { status: 400 }
    );
  }

  const axesLines = SCENT_AXES.map((axis) => `- ${axis.label}: ${axes[axis.key]}%`).join('\n');

  const prompt = `Sei un naso e narratore di profumeria di lusso. Analizza il profilo olfattivo REALE di una persona e descrivilo.

DATI (percentuali reali sulla sua collezione, pesate sugli indossi recenti):
${axesLines}

Famiglie dominanti: ${dominantFamilies.length ? dominantFamilies.join(', ') : 'nessuna'}
Note più ricorrenti: ${topNotes.length ? topNotes.join(', ') : 'nessuna'}

COMPITO:
Restituisci SOLO un oggetto JSON valido, senza testo prima o dopo e senza markdown, con esattamente queste chiavi:
{
  "archetipo": "nome evocativo in italiano, 2-5 parole (es. \\"L'Esploratore delle Ombre\\", \\"La Custode dei Fiori Segreti\\", \\"Il Nomade degli Agrumi\\", \\"L'Alchimista Gourmand\\")",
  "descrizione": "2-3 frasi poetiche sul carattere olfattivo di questa persona",
  "consiglio": "1 sola frase di consiglio pratico"
}

REGOLE:
- Usa solo i dati sopra: non inventare profumi, brand o note che non compaiono.
- Italiano, tono elegante e caldo, mai generico.
- L'archetipo deve riflettere gli assi più alti.`;

  try {
    const { text } = await callGeminiWithFallback([{ text: prompt }], {
      jsonMode: true,
      temperature: 0.7,
      deadline: Date.now() + 20000,
    });

    let parsed: unknown;
    const cleaned = stripFences(text);
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = extractJsonFromAiText<unknown>(cleaned);
    }

    if (!isScentArchetype(parsed)) {
      return NextResponse.json(
        { error: 'La risposta AI non aveva il formato atteso. Riprova.' },
        { status: 502 }
      );
    }

    const archetype: ScentArchetype = {
      archetipo: clip(parsed.archetipo, 60),
      descrizione: clip(parsed.descrizione, 520),
      consiglio: clip(parsed.consiglio, 240),
    };

    return NextResponse.json(archetype);
  } catch {
    return NextResponse.json(
      { error: 'Il motore AI non è raggiungibile in questo momento. Riprova tra poco.' },
      { status: 502 }
    );
  }
}
