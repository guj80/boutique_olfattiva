export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiCallOptions {
  temperature?: number;
  jsonMode?: boolean;
  systemInstruction?: string;
  timeoutMs?: number;
  useGoogleSearch?: boolean;
  deadline?: number;
  maxOutputTokens?: number;
}

export interface AiResult {
  text: string;
  modelUsed: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// UNICO modello stabile e super collaudato
const DEFAULT_MODELS = ['gemini-1.5-flash'];

export function __resetEngineState() {}

function getGeminiKey(): string {
  const k = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  return k && k !== 'undefined' ? k : '';
}

function normalizeParts(parts: GeminiPart[]): any[] {
  return parts.map((p) => {
    if (p.text !== undefined) return { text: p.text };
    const imgData = p.inlineData?.data || p.inline_data?.data;
    const imgMime = p.inlineData?.mimeType || p.inline_data?.mime_type;
    if (imgData && imgMime) {
      const cleanBase64 = imgData.indexOf(',') !== -1 ? imgData.split(',')[1] : imgData;
      return { inlineData: { mimeType: imgMime, data: cleanBase64 } };
    }
    return p;
  });
}

async function chatCompletion(
  url: string,
  key: string,
  model: string,
  messages: any[],
  json: boolean,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, any> = { model, temperature: 0.1, messages };
    if (json && url.indexOf('groq.com') !== -1) body.response_format = { type: 'json_object' };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 2 ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildMessages(prompt: string, systemInstruction: string | undefined, json: boolean) {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({
    role: 'user',
    content: json ? `${prompt}\n\nRispondi ESCLUSIVAMENTE con un oggetto JSON valido.` : prompt,
  });
  return messages;
}

export async function callGroqDirect(
  prompt: string,
  systemInstruction?: string,
  opts?: { deadline?: number; json?: boolean }
): Promise<AiResult | null> {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key || key === 'undefined') return null;
  const deadline = opts?.deadline ?? Date.now() + 15000;

  for (const model of ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']) {
    const left = deadline - Date.now();
    if (left < 1500) return null;
    const text = await chatCompletion(
      'https://api.groq.com/openai/v1/chat/completions',
      key,
      model,
      buildMessages(prompt, systemInstruction, Boolean(opts?.json)),
      Boolean(opts?.json),
      Math.min(6000, left - 300)
    );
    if (text) return { text, modelUsed: `groq:${model}` };
  }
  return null;
}

export const callGroqFallback = callGroqDirect;

export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string,
  opts?: { deadline?: number; json?: boolean }
): Promise<AiResult | null> {
  return callGroqDirect(prompt, systemInstruction, opts);
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<AiResult> {
  const deadline = options?.deadline ?? Date.now() + 25000;
  const apiKey = getGeminiKey();
  const normalized = normalizeParts(parts);
  const promptText = normalized.map((p) => p.text || '').filter(Boolean).join('\n');
  const jsonMode = options?.jsonMode ?? false;

  // PROVA SUBITO GROQ SE È DISPONIBILE (è fulmineo e azzera i 429/503 di Gemini)
  const groqResult = await callGroqDirect(promptText, options?.systemInstruction, {
    deadline,
    json: jsonMode,
  });
  if (groqResult) return groqResult;

  // SE GROQ NON C'È, USA GEMINI 1.5 FLASH
  if (apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${GEMINI_BASE}/models/gemini-1.5-flash:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: normalized }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim();
        if (text && text.length > 2) {
          return { text, modelUsed: 'gemini-1.5-flash' };
        }
      }
    } catch {} finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Nessun motore AI ha risposto.');
}

export function extractJsonFromAiText<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Risposta AI vuota.');
  }

  const cleaned = rawText
    .replace(/^\uFEFF/, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') return direct as T;
  } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1));
      if (obj && typeof obj === 'object') return obj as T;
    } catch {}
  }

  throw new Error('Formato JSON non riconosciuto.');
}
