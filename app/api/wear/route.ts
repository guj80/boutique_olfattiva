import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { buildWearPrompt, validateAiPicks } from '@/lib/wear-suggester';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidates, ctx } = body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Candidati mancanti.' }, { status: 400 });
    }

    const { system, user } = buildWearPrompt(candidates, ctx);

    const result = await callGeminiWithFallback(
      [{ text: user }],
      {
        systemInstruction: system,
        jsonMode: true,
        temperature: 0.5,
        deadline: Date.now() + 8000,
      }
    );

    const parsed = extractJsonFromAiText(result.text);
    const picks = validateAiPicks(parsed, candidates);

    if (!picks) {
      return NextResponse.json({ ok: false, error: 'Validazione AI fallita.' }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      picks,
      modello: result.modelUsed,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Errore interno.' }, { status: 500 });
  }
}
