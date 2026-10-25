import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Ricava "50ml: €190 • 100ml: €265" da una risposta libera; scarta formati < 30 ml. */
function sanitizePrezzi(raw: string): string {
  const byMl: Record<number, string> = {};
  for (const seg of raw.split(/[•|;\n]+/)) {
    const ml = seg.match(/(\d{2,4})\s*ml/i);
    const pr = seg.match(/(?:€|eur(?:o)?)\s*(\d[\d.,]*)|(\d[\d.,]*)\s*(?:€|eur(?:o)?)/i);
    if (!ml || !pr) continue;
    const size = Number(ml[1]);
    const amountRaw = (pr[1] || pr[2] || '').replace(/[.,]+$/, '');
    const amount = parseAmount(amountRaw);
    if (size < 30 || size > 1000 || amount === null || amount < 15 || amount > 6000) continue;
    byMl[size] = amountRaw.replace(/[.,]00$/, '');
  }
  return Object.keys(byMl)
    .map(Number)
    .sort((a, b) => a - b)
    .map((s) => `${s}ml: €${byMl[s]}`)
    .join(' • ');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || body.text || body.query || '').slice(0, 8000);

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    const wantsSearch = Boolean(body.search);
    const { text, modelUsed } = await callGeminiWithFallback([{ text: prompt }], {
      temperature: wantsSearch ? 0.1 : 0.4,
      jsonMode: Boolean(body.json),
      useGoogleSearch: wantsSearch,
      timeoutMs: 9000,
      deadline: Date.now() + 24000,
    });

    if (body.format === 'prezzi') {
      const prezzi = sanitizePrezzi(text);
      if (!prezzi) {
        return NextResponse.json(
          { error: 'Listino ufficiale non trovato per questo profumo.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ result: prezzi, text: prezzi, modelUsed });
    }

    return NextResponse.json({ result: text, text, modelUsed });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore chiamata Gemini.' },
      { status: 503 }
    );
  }
}
