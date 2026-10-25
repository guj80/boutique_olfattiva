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

// Modelli stabili e super affidabili in prima linea
const DEFAULT_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

const DEAD_MODEL_TTL_MS = 6 * 60 * 60 * 1000;
const DEAD_KEY_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_TTL_MS = 6 * 60 * 60 * 1000;

let lastWorkingModel: string | null = null;
let keyDeadUntil = 0;
const deadModels: Record<string, number> = {};
const noThinkingModels: Record<string, boolean> = {};
let discovered: { at: number; models: string[] } | null = null;

export function __resetEngineState() {
  lastWorkingModel = null;
  keyDeadUntil = 0;
  discovered = null;
  Object.keys(deadModels).forEach((k) => delete deadModels[k]);
  Object.keys(noThinkingModels).forEach((k) => delete noThinkingModels[k]);
}

function getGeminiKey(): string {
  const k = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  return k && k !== 'undefined' ? k : '';
}

function configuredModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map((s) => s.trim().replace(/^models\//, ''))
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
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

type GeminiAttempt =
  | { ok: true; text: string }
  | { ok: false; status: number | 'timeout' | 'network' | 'empty' | 'blocked'; detail: string };

async function geminiRequest(
  model: string,
  apiKey: string,
  parts: any[],
  options: GeminiCallOptions | undefined,
  mode: { search: boolean; strict: boolean },
  withThinkingCfg: boolean,
  timeoutMs: number
): Promise<GeminiAttempt> {
  const generationConfig: Record<string, any> = {
    temperature: options?.temperature ?? 0.1,
    maxOutputTokens: options?.maxOutputTokens ?? 4096,
  };
  if (mode.strict) generationConfig.responseMimeType = 'application/json';

  const payload: Record<string, any> = {
    contents: [{ role: 'user', parts }],
    generationConfig,
    safetySettings: SAFETY_SETTINGS,
  };
  if (options?.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (mode.search) payload.tools = [{ googleSearch: {} }];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 400);
      } catch {}
      return { ok: false, status: res.status, detail };
    }

    const data = await res.json();
    const rawParts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const text = rawParts
      .filter((p) => !p?.thought)
      .map((p) => p?.text || '')
      .join('')
      .trim();

    if (text.length > 2) return { ok: true, text };
    if (data?.promptFeedback?.blockReason) {
      return { ok: false, status: 'blocked', detail: String(data.promptFeedback.blockReason) };
    }
    return { ok: false, status: 'empty', detail: String(data?.candidates?.[0]?.finishReason || '') };
  } catch (err: any) {
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 'timeout' : 'network',
      detail: String(err?.message || ''),
    };
  } finally {
    clearTimeout(timer);
  }
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

export interface FallbackOptions {
  deadline?: number;
  json?: boolean;
}

export async function callGroqDirect(
  prompt: string,
  systemInstruction?: string,
  opts?: FallbackOptions
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
  opts?: FallbackOptions
): Promise<AiResult | null> {
  const deadline = opts?.deadline ?? Date.now() + 15000;
  const groq = await callGroqDirect(prompt, systemInstruction, { ...opts, deadline });
  if (groq) return groq;
  return null;
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<AiResult> {
  const deadline = options?.deadline ?? Date.now() + 25000;
  const left = () => deadline - Date.now();
  const perAttemptCap = options?.timeoutMs ?? 5000;
  const errors: string[] = [];

  const normalized = normalizeParts(parts);
  const hasImage = normalized.some((p) => p.inlineData);
  const apiKey = getGeminiKey();

  const jsonMode = options?.jsonMode ?? false;
  const modes: Array<{ search: boolean; strict: boolean }> = [{ search: false, strict: jsonMode }];

  const tried: Record<string, boolean> = {};

  async function runModels(models: string[]): Promise<AiResult | null> {
    for (const model of models) {
      if (tried[model]) continue;
      if ((deadModels[model] || 0) > Date.now()) continue;
      tried[model] = true;

      for (const mode of modes) {
        if (left() < 1500) return null;
        let attempt: GeminiAttempt | null = null;

        for (let retry = 0; retry < 1; retry++) {
          const timeoutMs = Math.max(1200, Math.min(perAttemptCap, left() - 300));
          attempt = await geminiRequest(
            model,
            apiKey,
            normalized,
            options,
            mode,
            false,
            timeoutMs
          );
          if (attempt.ok) {
            lastWorkingModel = model;
            return { text: attempt.text, modelUsed: model };
          }
          break;
        }

        if (!attempt || attempt.ok) continue;
        errors.push(`${model}:${attempt.status}`);

        if (attempt.status === 404) {
          deadModels[model] = Date.now() + DEAD_MODEL_TTL_MS;
          break;
        }
      }
    }
    return null;
  }

  if (apiKey && keyDeadUntil <= Date.now()) {
    const queue: string[] = [];
    const base = (lastWorkingModel ? [lastWorkingModel] : []).concat(configuredModels());
    base.forEach((m) => {
      if (queue.indexOf(m) === -1) queue.push(m);
    });

    const first = await runModels(queue);
    if (first) return first;
  }

  if (!hasImage && left() > 1500) {
    const promptText = normalized.map((p) => p.text || '').filter(Boolean).join('\n');
    const fb = await callGroqDirect(promptText, options?.systemInstruction, {
      deadline,
      json: jsonMode,
    });
    if (fb) return fb;
  }

  throw new Error(`Nessun motore AI ha risposto (${errors.join(', ') || 'nessun tentativo'}).`);
}

/* ------------------------------------------------------------------ */
/* Estrazione JSON tollerante (Esportata per /api/extract)            */
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
