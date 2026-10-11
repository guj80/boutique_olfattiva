import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    const { text, modelUsed } = await callGeminiWithFallback(
      [
        {
          text: 'Rispondi SOLO con questo JSON esatto: {"status": "online", "sommelier": "pronto"}',
        },
      ],
      { temperature: 0.1, jsonMode: true }
    );

    const parsed = extractJsonFromAiText(text);

    return NextResponse.json({
      ok: true,
      modelUsed,
      latencyMs: Date.now() - startTime,
      response: parsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
