import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt || body.text || body.query || '';

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    const { text, modelUsed } = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.4,
    });

    return NextResponse.json({ result: text, text, modelUsed });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Errore chiamata Gemini.' },
      { status: 500 }
    );
  }
}
