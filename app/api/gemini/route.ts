import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-flash',
];

async function callSingleGeminiModel(
  model: string,
  prompt: string,
  apiKey: string,
  useSearch: boolean,
  timeoutMs: number = 4500
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500,
      },
    };

    if (useSearch) {
      payload.tools = [{ googleSearch: {} }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Model ${model} HTTP ${res.status}: ${errText.slice(0, 120)}`);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      throw new Error(`Model ${model} returned empty text`);
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function callGroqFallback(prompt: string, groqKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.35,
        max_tokens: 1400,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('Groq empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '').trim();
    const useSearch = Boolean(body?.search);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      '';

    const groqKey = process.env.GROQ_API_KEY || '';

    const errors: string[] = [];

    // 1. Prova i modelli Gemini in catena rapida (con o senza search)
    if (apiKey) {
      for (const model of GEMINI_MODELS) {
        try {
          // Se il primo tentativo con search fallisce, i modelli successivi provano senza search per garantire la risposta
          const shouldUseSearch = useSearch && model === GEMINI_MODELS[0];
          const timeout = shouldUseSearch ? 6000 : 4000;

          const text = await callSingleGeminiModel(
            model,
            prompt,
            apiKey,
            shouldUseSearch,
            timeout
          );
          return NextResponse.json({ text, modelUsed: model });
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    // 2. Paracadute automatico su Groq (se configurato nelle variabili d'ambiente)
    if (groqKey) {
      try {
        const text = await callGroqFallback(prompt, groqKey);
        return NextResponse.json({ text, modelUsed: 'groq-llama-3.3' });
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    console.error('Tutti i modelli AI hanno fallito:', errors);
    return NextResponse.json(
      {
        error: 'Servizio AI temporaneamente sovraccarico. Riprova tra pochi istanti.',
        details: errors,
      },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore interno API Gemini.' },
      { status: 500 }
    );
  }
}
