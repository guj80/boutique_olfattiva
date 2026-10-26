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

export interface FallbackOptions {
  deadline?: number;
  json?: boolean;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora

let cachedGeminiModels: { at: number; list: string[] } | null = null;
let cachedGroqModels: { at: number; list: string[] } | null = null;
let lastWorkingGemini: string | null = null;
let lastWorkingGroq: string | null = null;

export function __resetEngineState() {
  cachedGeminiModels = null;
  cachedGroqModels = null;
  lastWorkingGemini = null;
  lastWorkingGroq = null;
}

function getGeminiKey(): string {
  const k = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  return k && k !== 'undefined' ? k : '';
}

function getGroqKey(): string {
  const k = (process.env.GROQ_API_KEY || '').trim();
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

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  if (cachedGeminiModels && Date.now() - cachedGeminiModels.at < CACHE_TTL_MS) {
    return cachedGeminiModels.list;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=100&key=${apiKey}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
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
          !lower.includes('audio') &&
          !lower.includes('aqa')
        );
      })
      .sort((a: string, b: string) => {
        const score = (s: string) => {
          const l = s.toLowerCase();
          if (l.includes('flash') && !l.includes('preview') && !l.includes('exp')) return 5;
          if (l.includes('flash') && l.includes('lite')) return 4;
          if (l.includes('flash')) return 3;
          if (l.includes('pro') && !l.includes('preview')) return 2;
          return 1;
        };
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

async function discoverGroqModels(apiKey: string): Promise<string[]> {
  if (cachedGroqModels && Date.now() - cachedGroqModels.at < CACHE_TTL_MS) {
    return cachedGroqModels.list;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const list: string[] = (data?.data || [])
      .map((m: any) => String(m.id || ''))
      .filter((id: string) => {
        const lower = id.toLowerCase();
        return (
          Boolean(id) &&
          !lower.includes('whisper') &&
          !lower.includes('guard') &&
          !lower.includes('tts') &&
          !lower.includes('playai') &&
          !lower.includes('embed') &&
          !lower.includes('allam')
        );
      })
      .sort((a: string, b: string) => {
        const score = (s: string) => {
          const l = s.toLowerCase();
          if (l.includes('llama') && (l.includes('70b') || l.includes('versatile'))) return 5;
          if (l.includes('llama')) return 4;
          if (l.includes('qwen') || l.includes('deepseek')) return 3;
          if (l.includes('gemma') || l.includes('mixtral')) return 2;
          return 1;
        };
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

async function tryGroqChat(
  model: string,
  apiKey: string,
  prompt: string,
  systemInstruction: string | undefined,
  jsonMode: boolean,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({
      role: 'user',
      content: jsonMode
        ? `${prompt}\n\nRispondi ESCLUSIVAMENTE con JSON valido, senza testo aggiuntivo.`
        : prompt,
    });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 2500,
        messages,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 5 ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryGeminiGenerate(
  model: string,
  apiKey: string,
  parts: any[],
  options: GeminiCallOptions | undefined,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const generationConfig: Record<string, any> = {
      temperature: options?.temperature ?? 0.15,
      maxOutputTokens: options?.maxOutputTokens ?? 3072,
    };

    const payload: Record<string, any> = {
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings: SAFETY_SETTINGS,
    };

    if (options?.systemInstruction) {
      payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
    }

    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawParts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const text = rawParts
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

export async function callGroqDirect(
  prompt: string,
  systemInstruction?: string,
  opts?: FallbackOptions
): Promise<AiResult | null> {
  const groqKey = getGroqKey();
  if (!groqKey) return null;

  const deadline = opts?.deadline ?? Date.now() + 14000;
  const discovered = await discoverGroqModels(groqKey);
  const queue: string[] = [];
  if (lastWorkingGroq && discovered.includes(lastWorkingGroq)) {
    queue.push(lastWorkingGroq);
  }
  for (const m of discovered) {
    if (!queue.includes(m)) queue.push(m);
  }

  for (const model of queue.slice(0, 4)) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const text = await tryGroqChat(
      model,
      groqKey,
      prompt,
      systemInstruction,
      Boolean(opts?.json),
      Math.min(5500, left - 200)
    );
    if (text) {
      lastWorkingGroq = model;
      return { text, modelUsed: `groq:${model}` };
    }
  }
  return null;
}

export const callGroqFallback = callGroqDirect;

export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string,
  opts?: FallbackOptions
): Promise<AiResult | null> {
  return callGroqDirect(prompt, systemInstruction, opts);
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<AiResult> {
  const deadline = options?.deadline ?? Date.now() + 22000;
  const left = () => deadline - Date.now();
  const perAttemptCap = options?.timeoutMs ?? 6500;

  const normalized = normalizeParts(parts);
  const hasImage = normalized.some((p) => p.inlineData);
  const promptText = normalized.map((p) => p.text || '').filter(Boolean).join('\n');
  const jsonMode = Boolean(options?.jsonMode);

  // 1. Se è una richiesta solo testuale, proviamo prima Groq (ultra-veloce, zero 429 di Google)
  if (!hasImage && left() > 2000) {
    const groqRes = await callGroqDirect(promptText, options?.systemInstruction, {
      deadline: Math.min(deadline, Date.now() + 9000),
      json: jsonMode,
    });
    if (groqRes) return groqRes;
  }

  // 2. Auto-Discovery sui modelli Gemini realmente attivi sull'account
  const geminiKey = getGeminiKey();
  if (geminiKey && left() > 2000) {
    const discovered = await discoverGeminiModels(geminiKey);
    const queue: string[] = [];
    if (lastWorkingGemini && discovered.includes(lastWorkingGemini)) {
      queue.push(lastWorkingGemini);
    }
    for (const m of discovered) {
      if (!queue.includes(m)) queue.push(m);
    }

    for (const model of queue.slice(0, 4)) {
      if (left() < 1500) break;
      const timeoutMs = Math.max(1800, Math.min(perAttemptCap, left() - 300));
      const text = await tryGeminiGenerate(model, geminiKey, normalized, options, timeoutMs);
      if (text) {
        lastWorkingGemini = model;
        return { text, modelUsed: `gemini:${model}` };
      }
    }
  }

  throw new Error('Nessun motore AI disponibile in questo istante.');
}

/* ------------------------------------------------------------------ */
/* Estrazione JSON tollerante                                          */
/* ------------------------------------------------------------------ */

function repairJson(s: string): string {
  return s
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
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

  let best: any = null;
  let bestLen = -1;
  for (const candidate of balancedObjects(cleaned)) {
    for (const variant of [candidate, repairJson(candidate)]) {
      try {
        const obj = JSON.parse(variant);
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && candidate.length > bestLen) {
          best = obj;
          bestLen = candidate.length;
        }
        break;
      } catch {}
    }
  }
  if (best) return best as T;

  throw new Error('Formato JSON non riconosciuto.');
}
