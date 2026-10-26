import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Cache in memoria dei modelli realmente esistenti sugli account
let cachedGroqModels: { at: number; list: string[] } | null = null;
let cachedGeminiModels: { at: number; list: string[] } | null = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 ora

async function discoverGroqModels(apiKey: string): Promise<string[]> {
  if (cachedGroqModels && Date.now() - cachedGroqModels.at < CACHE_TTL) {
    return cachedGroqModels.list;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list: string[] = (data?.data || [])
      .map((m: any) => String(m.id || ''))
      .filter((id: string) => {
        const lower = id.toLowerCase();
        // Escludiamo modelli audio/whisper/guard/vision-only
        return (
          !lower.includes('whisper') &&
          !lower.includes('guard') &&
          !lower.includes('tts') &&
          !lower.includes('playai') &&
          !lower.includes('embed')
        );
      })
      // Preferiamo i modelli llama / qwen / deepseek / mixtral testuali
      .sort((a: string, b: string) => {
        const score = (s: string) =>
          s.includes('llama') ? 3 : s.includes('qwen') || s.includes('gemma') ? 2 : 1;
        return score(b) - score(a);
      });

    if (list.length > 0) {
      cachedGroqModels = { at: Date.now(), list };
    }
    return list;
  } catch {
    return [];
  }
}

async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  if (cachedGeminiModels && Date.now() - cachedGeminiModels.at < CACHE_TTL) {
    return cachedGeminiModels.list;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((name: string) => {
        const lower = name.toLowerCase();
        return (
          lower.includes('gemini') &&
          !lower.includes('embedding') &&
          !lower.includes('imagen') &&
          !lower.includes('veo') &&
          !lower.includes('tts') &&
          !lower.includes('audio')
        );
      })
      // Mettiamo in cima i modelli flash (più rapidi e con più quota)
      .sort((a: string, b: string) => {
        const score = (s: string) =>
          s.includes('flash') && !s.includes('preview')
            ? 4
            : s.includes('flash')
            ? 3
            : 1;
        return score(b) - score(a);
      });

    if (list.length > 0) {
      cachedGeminiModels = { at: Date.now(), list };
    }
    return list;
  } catch {
    return [];
  }
}

async function tryGroqModel(
  model: string,
  prompt: string,
  apiKey: string,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,
        max_tokens: 1800,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 5 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryGeminiModel(
  model: string,
  prompt: string,
  apiKey: string,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const generationConfig: Record<string, any> = {
      temperature: 0.25,
      maxOutputTokens: 2048,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p) => !p?.thought)
      .map((p) => p?.text || '')
      .join('')
      .trim();
    return text && text.length > 5 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ''
    ).trim();

    // 1. PRIORITÀ A GROQ CON AUTO-DISCOVERY (Risponde in < 1 secondo, zero timeout)
    if (groqKey) {
      const groqModels = await discoverGroqModels(groqKey);
      for (const model of groqModels.slice(0, 3)) {
        const text = await tryGroqModel(model, prompt, groqKey, 4500);
        if (text) {
          return NextResponse.json({ text, modelUsed: `groq:${model}` });
        }
      }
    }

    // 2. AUTO-DISCOVERY SU GEMINI (Prova i primi 3 modelli realmente attivi sulla chiave)
    if (geminiKey) {
      const geminiModels = await discoverGeminiModels(geminiKey);
      for (const model of geminiModels.slice(0, 3)) {
        const text = await tryGeminiModel(model, prompt, geminiKey, 5500);
        if (text) {
          return NextResponse.json({ text, modelUsed: `gemini:${model}` });
        }
      }
    }

    return NextResponse.json(
      { error: 'Tutti i provider AI esterni sono in rate-limit.' },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore interno API.' },
      { status: 500 }
    );
  }
}
