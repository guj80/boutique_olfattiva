import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { buildScoutPrompt, parseScoutArray } from '@/lib/scout-logic';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filters, ownedNames } = body;

    if (!filters) {
      return NextResponse.json({ error: 'Filtri mancanti.' }, { status: 400 });
    }

    const prompt = buildScoutPrompt(filters, ownedNames || []);

    const result = await callGeminiWithFallback(
      [{ text: prompt }],
      {
        jsonMode: true,
        temperature: 0.3,
        deadline: Date.now() + 10000,
      }
    );

    const parsed = parseScoutArray(result.text);

    return NextResponse.json({
      ok: true,
      proposals: parsed,
      modello: result.modelUsed,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Errore interno scout.' }, { status: 500 });
  }
}
