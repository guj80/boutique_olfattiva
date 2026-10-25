import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

function getGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_BACKUP,
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
      payload.tools = [{ google_search: {} }];
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
        model: 'llama-3.3-70b-versatile',
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

async function callXaiFallback(prompt: string, xaiKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.35,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`[xAI HTTP ${res.status}]`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('[xAI] Risposta vuota');
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
    const xaiKey = (process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();

    const errors: string[] = [];

    if (geminiKeys.length === 0 && !groqKey && !xaiKey) {
      return NextResponse.json(
        {
          error:
            'Nessuna API Key trovata nelle variabili di Vercel (controlla GEMINI_API_KEY / GOOGLE_API_KEY / GROQ_API_KEY).',
        },
        { status: 500 }
      );
    }

    // 1. Prova tutte le chiavi Gemini disponibili sui modelli ufficiali
    for (const key of geminiKeys) {
      for (const model of GEMINI_MODELS) {
        try {
          const shouldSearch = useSearch && model === 'gemini-2.5-flash';
          const timeout = shouldSearch ? 7500 : 5500;
          const text = await callSingleGeminiModel(model, prompt, key, shouldSearch, timeout);
          return NextResponse.json({ text, modelUsed: model });
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }
    }

    // 2. Fallback automatico su Groq (Llama 3.3 70B)
    if (groqKey) {
      try {
        const text = await callGroqFallback(prompt, groqKey);
        return NextResponse.json({ text, modelUsed: 'groq-llama-3.3-70b' });
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    // 3. Fallback automatico su Grok / xAI
    if (xaiKey) {
      try {
        const text = await callXaiFallback(prompt, xaiKey);
        return NextResponse.json({ text, modelUsed: 'xai-grok' });
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    console.error('Dettaglio errori AI:', errors);
    const firstReason = errors[0] || 'Nessun modello disponibile';
    return NextResponse.json(
      {
        error: `Errore AI: ${firstReason}`,
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
