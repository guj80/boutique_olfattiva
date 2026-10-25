export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiCallOptions {
  temperature?: number;
  /** true = risposta JSON (responseMimeType su Gemini, json_object su Groq). */
  jsonMode?: boolean;
  systemInstruction?: string;
  /** Tetto in ms per il singolo tentativo (default 9000). */
  timeoutMs?: number;
  /** Ricerca Google (grounding): ignorata se nella richiesta c'è un'immagine. */
  useGoogleSearch?: boolean;
  /** Istante (epoch ms) entro cui l'intera chiamata deve finire. Default: ora + 25s. */
  deadline?: number;
  maxOutputTokens?: number;
}

export interface AiResult {
  text: string;
  modelUsed: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Sovrascrivibile da env: GEMINI_MODELS="gemini-2.5-flash,gemini-2.0-flash"
const DEFAULT_MODELS = ['gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'];

const DEAD_MODEL_TTL_MS = 6 * 60 * 60 * 1000;
const DEAD_KEY_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_TTL_MS = 6 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Stato del processo (vale per l'istanza serverless "calda")          */
/* ------------------------------------------------------------------ */

let lastWorkingModel: string | null = null;
let keyDeadUntil = 0;
const deadModels: Record<string, number> = {};
const noThinkingModels: Record<string, boolean> = {};
let discovered: { at: number; models: string[] } | null = null;

/** Solo per i test. */
export function __resetEngineState() {
  lastWorkingModel = null;
  keyDeadUntil = 0;
  discovered = null;
  Object.keys(deadModels).forEach((k) => delete deadModels[k]);
  Object.keys(noThinkingModels).forEach((k) => delete noThinkingModels[k]);
}

/* ------------------------------------------------------------------ */
/* Utilità                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Gemini: singola richiesta                                           */
/* ------------------------------------------------------------------ */

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
  // Il "ragionamento" interno di 2.5-flash può mangiarsi tutto il timeout: per
  // schede e listini non serve.
  if (withThinkingCfg && /2\.5-flash/.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

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
      } catch {
        // corpo non leggibile
      }
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

/* ------------------------------------------------------------------ */
/* Gemini: scoperta automatica dei modelli (anti-404 definitivo)       */
/* ------------------------------------------------------------------ */

function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

async function discoverModels(apiKey: string, timeoutMs: number): Promise<string[]> {
  if (discovered && Date.now() - discovered.at < DISCOVERY_TTL_MS) return discovered.models;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.indexOf('generateContent') !== -1
      )
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter(
        (n: string) =>
          /^gemini-[\d.]+-flash$/.test(n) ||
          /^gemini-flash-latest$/.test(n)
      )
      .sort((a: string, b: string) => versionOf(b) - versionOf(a));
    discovered = { at: Date.now(), models };
    return models;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Fallback testuali: Groq e OpenRouter                                */
/* ------------------------------------------------------------------ */

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
  /** Istante (epoch ms) oltre il quale non si avviano nuovi tentativi. */
  deadline?: number;
  /** Default false: risposta in testo libero. */
  json?: boolean;
}

/** Solo Groq (Llama). */
export async function callGroqDirect(
  prompt: string,
  systemInstruction?: string,
  opts?: FallbackOptions
): Promise<AiResult | null> {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key || key === 'undefined') return null;
  const deadline = opts?.deadline ?? Date.now() + 15000;

  for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
    const left = deadline - Date.now();
    if (left < 1500) return null;
    const text = await chatCompletion(
      'https://api.groq.com/openai/v1/chat/completions',
      key,
      model,
      buildMessages(prompt, systemInstruction, Boolean(opts?.json)),
      Boolean(opts?.json),
      Math.min(7500, left - 300)
    );
    if (text) return { text, modelUsed: `groq:${model}` };
  }
  return null;
}

export const callGroqFallback = callGroqDirect;

/** Groq, poi OpenRouter (modelli gratuiti). Solo testo. */
export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string,
  opts?: FallbackOptions
): Promise<AiResult | null> {
  const deadline = opts?.deadline ?? Date.now() + 15000;

  const groq = await callGroqDirect(prompt, systemInstruction, { ...opts, deadline });
  if (groq) return groq;

  const key = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!key || key === 'undefined') return null;

  for (const model of [
    'openrouter/free',
    'deepseek/deepseek-chat:free',
    'qwen/qwen-2.5-72b-instruct:free',
  ]) {
    const left = deadline - Date.now();
    if (left < 1500) return null;
    const text = await chatCompletion(
      'https://openrouter.ai/api/v1/chat/completions',
      key,
      model,
      buildMessages(prompt, systemInstruction, false),
      false,
      Math.min(8000, left - 300)
    );
    if (text) return { text, modelUsed: `openrouter:${model}` };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<AiResult> {
  const deadline = options?.deadline ?? Date.now() + 25000;
  const left = () => deadline - Date.now();
  const perAttemptCap = options?.timeoutMs ?? 9000;
  const errors: string[] = [];

  const normalized = normalizeParts(parts);
  const hasImage = normalized.some((p) => p.inlineData);
  const apiKey = getGeminiKey();

  const jsonMode = options?.jsonMode ?? false;
  const modes: Array<{ search: boolean; strict: boolean }> =
    options?.useGoogleSearch && !hasImage
      ? [
          { search: true, strict: false },
          { search: false, strict: jsonMode },
        ]
      : [{ search: false, strict: jsonMode }];

  const tried: Record<string, boolean> = {};
  let triedCount = 0;
  let notFoundCount = 0;
  let keyBroken = false;

  async function runModels(models: string[]): Promise<AiResult | null> {
    for (const model of models) {
      if (tried[model]) continue;
      if ((deadModels[model] || 0) > Date.now()) continue;
      tried[model] = true;
      triedCount++;
      let modelNotFound = false;

      for (const mode of modes) {
        if (left() < 1500) return null;
        let useThinkingCfg = !noThinkingModels[model];
        let attempt: GeminiAttempt | null = null;

        for (let retry = 0; retry < 2; retry++) {
          const timeoutMs = Math.max(1200, Math.min(perAttemptCap, left() - 300));
          attempt = await geminiRequest(
            model,
            apiKey,
            normalized,
            options,
            mode,
            useThinkingCfg,
            timeoutMs
          );
          if (attempt.ok) {
            lastWorkingModel = model;
            return {
              text: attempt.text,
              modelUsed: mode.search ? `${model}+google_search` : model,
            };
          }
          // Modello senza supporto a thinkingConfig: riprovo subito senza.
          if (attempt.status === 400 && useThinkingCfg && /thinking/i.test(attempt.detail)) {
            noThinkingModels[model] = true;
            useThinkingCfg = false;
            continue;
          }
          break;
        }

        if (!attempt || attempt.ok) continue;
        errors.push(`${model}${mode.search ? '+search' : ''}:${attempt.status}`);

        if (attempt.status === 404) {
          deadModels[model] = Date.now() + DEAD_MODEL_TTL_MS;
          if (lastWorkingModel === model) lastWorkingModel = null;
          modelNotFound = true;
          break;
        }
        if (attempt.status === 401 || (attempt.status === 403 && /api key|PERMISSION_DENIED|not valid|disabled/i.test(attempt.detail))) {
          keyDeadUntil = Date.now() + DEAD_KEY_TTL_MS;
          keyBroken = true;
          return null;
        }
        if (attempt.status === 403) {
          deadModels[model] = Date.now() + 30 * 60 * 1000;
          break;
        }
        // 429, 5xx, timeout, risposta vuota o bloccata: passo alla modalità/modello successivo.
      }
      if (modelNotFound) notFoundCount++;
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

    // Tutti i modelli configurati sono spariti (404): chiedo a Google quali esistono.
    if (!keyBroken && notFoundCount >= triedCount && left() > 3000) {
      const found = await discoverModels(apiKey, Math.min(4000, left() - 500));
      const second = await runModels(found.slice(0, 3));
      if (second) return second;
    }
  } else if (apiKey) {
    errors.push('gemini:chiave_non_valida');
  } else {
    errors.push('gemini:chiave_mancante');
  }

  // Fallback testuali (niente immagini).
  if (!hasImage && left() > 1500) {
    const promptText = normalized
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n');
    const fb = await callOpenRouterFree(promptText, options?.systemInstruction, {
      deadline,
      json: jsonMode,
    });
    if (fb) return fb;
    errors.push('fallback:nessuno');
  }

  throw new Error(`Nessun motore AI ha risposto (${errors.join(', ') || 'nessun tentativo'}).`);
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
  } catch {
    // provo con l'estrazione degli oggetti
  }

  // Più oggetti nel testo (es. prosa con citazioni): scelgo il più lungo che si legge.
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
      } catch {
        // prossima variante
      }
    }
  }
  if (best) return best as T;

  throw new Error('Formato JSON non riconosciuto.');
}
