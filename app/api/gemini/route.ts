import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
];

function getGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  ];
  return Array.from(new Set(candidates.map((k) => (k || '').trim()).filter(Boolean)));
}

async function callSingleGeminiModel(
  model: string,
  prompt: string,
  apiKey: string,
  useSearch: boolean,
  timeoutMs: number = 6500
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1800,
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
      throw new Error(`[${model} -> HTTP ${res.status}] ${errText.slice(0, 140)}`);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      throw new Error(`[${model}] Risposta vuota`);
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function callGroqFallback(prompt: string, groqKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.35,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[Groq HTTP ${res.status}] ${errText.slice(0, 100)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('[Groq] Risposta vuota');
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

    const geminiKeys = getGeminiKeys();
    const groqKey = (process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '').trim();

    const errors: string[] = [];

    if (geminiKeys.length === 0 && !groqKey) {
      return NextResponse.json(
        { error: 'Nessuna API Key valida configurata nelle variabili di Vercel.' },
        { status: 500 }
      );
    }

    // 1. Prova le chiavi Gemini sui modelli standard stabili
    for (const key of geminiKeys) {
      for (const model of GEMINI_MODELS) {
        try {
          const shouldSearch = useSearch && model === 'gemini-1.5-flash';
          const text = await callSingleGeminiModel(model, prompt, key, shouldSearch, 6000);
          return NextResponse.json({ text, modelUsed: model });
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    // 2. Fallback su Groq
    if (groqKey) {
      try {
        const text = await callGroqFallback(prompt, groqKey);
        return NextResponse.json({ text, modelUsed: 'groq-llama-3.1-70b' });
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    console.error('Dettaglio errori AI:', errors);
    return NextResponse.json(
      {
        error: errors[0] || 'Errore di connessione ai servizi AI.',
        details: errors,
      },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore interno API.' },
      { status: 500 }
    );
  }
}
