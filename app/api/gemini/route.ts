import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '').trim();
    const useSearch = Boolean(body?.search);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    // Sfruttiamo il motore centralizzato che gestisce modelli, chiavi e fallback
    const result = await callGeminiWithFallback(
      [{ text: prompt }],
      {
        useGoogleSearch: useSearch,
        jsonMode: prompt.toLowerCase().includes('json'),
        timeoutMs: 12000,
      }
    );

    return NextResponse.json({
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.error('Errore API Gemini:', err);
    return NextResponse.json(
      { error: err?.message || 'Errore interno durante la generazione AI.' },
      { status: 503 }
    );
  }
}
