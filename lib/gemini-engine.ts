export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

export type ProviderOrder = 'groq-first' | 'gemini-first' | 'gemini-only' | 'groq-only';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeminiCallOptions {
  temperature?: number;
  jsonMode?: boolean;
  responseSchema?: Record<string, any>;
  systemInstruction?: string;
  timeoutMs?: number;
  useGoogleSearch?: boolean;
  strictGoogleSearch?: boolean;
  providerOrder?: ProviderOrder;
  deadline?: number;
  maxOutputTokens?: number;
}

export interface AiResult {
  text: string;
  modelUsed: string;
  sources?: GroundingSource[];
  grounded?: boolean;
}

export interface FallbackOptions {
  deadline?: number;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora

let cachedGeminiModels: { at: number; list: string[] } | null = null;
let cachedGroqModels: { at: number; list: string[] } | null = null;
let lastWorkingGemini: string | null = null;
let lastWorkingGroq: string | null = null;

export function __resetEngineState(): void {
  cachedGeminiModels = null;
  cachedGroqModels = null;
  lastWorkingGemini = null;
  lastWorkingGroq = null;
}

/**
 * Legge la chiave Gemini esclusivamente da variabili server-side.
 * B6 FIX: Rimosso NEXT_PUBLIC_GEMINI_API_KEY per impedire l'esposizione nel bundle client.
 */
function getGeminiKey(): string {
  const k = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
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

/**
 * Modelli di paracadute statici nel caso la chiamata di listing /models fallisca o vada in timeout.
 */
const DEFAULT_GEMINI_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const DEFAULT_GROQ_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
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
    if (!res.ok) return DEFAULT_GEMINI_FALLBACKS;
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
          !lower.includes('aqa') &&
          // Evitiamo i modelli -pro su free tier che restituiscono quota limit: 0
          !lower.includes('3.1-pro') &&
          !lower.includes('2.5-pro')
        );
      })
      .sort((a: string, b: string) => {
        const score = (s: string) => {
          const l = s.toLowerCase();
          if (l.includes('2.5-flash') && !l.includes('lite') && !l.includes('preview')) return 6;
          if (l.includes('flash') && !l.includes('preview') && !l.includes('exp') && !l.includes('lite')) return 5;
          if (l.includes('flash') && l.includes('lite')) return 4;
          if (l.includes('flash')) return 3;
          if (l.includes('pro') && !l.includes('preview')) return 2;
          return 1;
        };
        return score(b) - score(a);
      });

    const finalList = list.length > 0 ? list : DEFAULT_GEMINI_FALLBACKS;
    cachedGeminiModels = { at: Date.now(), list: finalList };
    return finalList;
  } catch {
    return DEFAULT_GEMINI_FALLBACKS;
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
    if (!res.ok) return DEFAULT_GROQ_FALLBACKS;
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

    const finalList = list.length > 0 ? list : DEFAULT_GROQ_FALLBACKS;
    cachedGroqModels = { at: Date.now(), list: finalList };
    return finalList;
  } catch {
    return DEFAULT_GROQ_FALLBACKS;
  }
}

async function tryGroqChat(
  model: string,
  apiKey: string,
  prompt: string,
  systemInstruction: string | undefined,
  jsonMode: boolean,
  timeoutMs: number,
  temperature = 0.15,
  maxTokens = 2500
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: jsonMode
          ? `${systemInstruction}\nRispondi ESCLUSIVAMENTE con un JSON valido.`
          : systemInstruction,
      });
    }
    messages.push({
      role: 'user',
      content: jsonMode
        ? `${prompt}\n\nRispondi ESCLUSIVAMENTE con JSON valido, senza blocchi markdown e senza testo aggiuntivo.`
        : prompt,
    });

    const basePayload: Record<string, any> = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    };

    // Tentativo 1: con response_format json_object nativo quando jsonMode è true
    // Nota: il json_object di OpenAI/Groq richiede che l'output radice sia un oggetto JSON.
    // Se il modello o il prompt restituisce un array radice e Groq rifiuta con 400, ripieghiamo senza response_format.
    if (jsonMode) {
      basePayload.response_format = { type: 'json_object' };
    }

    let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basePayload),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok && jsonMode && res.status === 400) {
      delete basePayload.response_format;
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(basePayload),
        signal: controller.signal,
        cache: 'no-store',
      });
    }

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

interface GeminiRawResponse {
  text: string;
  sources: GroundingSource[];
  grounded: boolean;
}

function extractGroundingSources(candidate: any): GroundingSource[] {
  const chunks: any[] = candidate?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const out: GroundingSource[] = [];

  for (const chunk of chunks) {
    const uri = String(chunk?.web?.uri || '').trim();
    const title = String(chunk?.web?.title || uri).trim();
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      out.push({ title, uri });
    }
  }
  return out;
}

async function tryGeminiGenerate(
  model: string,
  apiKey: string,
  parts: any[],
  options: GeminiCallOptions | undefined,
  timeoutMs: number
): Promise<GeminiRawResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const useSearch = Boolean(options?.useGoogleSearch);
    const jsonMode = Boolean(options?.jsonMode);

    const generationConfig: Record<string, any> = {
      temperature: options?.temperature ?? 0.15,
      maxOutputTokens: options?.maxOutputTokens ?? 3072,
    };

    // Nota API Gemini: google_search grounding e responseMimeType='application/json'
    // sono incompatibili su diversi modelli v1beta (restituiscono HTTP 400).
    // Applichiamo responseMimeType e responseSchema quando useGoogleSearch non è attivo.
    if (jsonMode && !useSearch) {
      generationConfig.responseMimeType = 'application/json';
      if (options?.responseSchema) {
        generationConfig.responseSchema = options.responseSchema;
      }
    }

    const payload: Record<string, any> = {
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings: SAFETY_SETTINGS,
    };

    if (options?.systemInstruction) {
      const sysText =
        jsonMode && useSearch
          ? `${options.systemInstruction}\nRispondi ESCLUSIVAMENTE con JSON valido, senza commenti o markdown.`
          : options.systemInstruction;
      payload.systemInstruction = { parts: [{ text: sysText }] };
    } else if (jsonMode && useSearch) {
      payload.systemInstruction = {
        parts: [{ text: 'Rispondi ESCLUSIVAMENTE con JSON valido, senza testo aggiuntivo.' }],
      };
    }

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
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
    const candidate = data?.candidates?.[0];
    const rawParts: any[] = candidate?.content?.parts || [];
    const text = rawParts
      .filter((p) => !p?.thought)
      .map((p) => p?.text || '')
      .join('')
      .trim();

    if (!text || text.length < 2) return null;

    const sources = extractGroundingSources(candidate);
    const hasSearchQueries =
      Array.isArray(candidate?.groundingMetadata?.webSearchQueries) &&
      candidate.groundingMetadata.webSearchQueries.length > 0;

    return {
      text,
      sources,
      grounded: useSearch && (sources.length > 0 || hasSearchQueries),
    };
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
      Math.min(5500, left - 200),
      opts?.temperature ?? 0.15,
      opts?.maxOutputTokens ?? 2500
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

async function runGeminiQueue(
  normalizedParts: any[],
  options: GeminiCallOptions | undefined,
  deadline: number,
  perAttemptCap: number
): Promise<AiResult | null> {
  const geminiKey = getGeminiKey();
  if (!geminiKey) return null;

  const left = () => deadline - Date.now();
  if (left() <= 1500) return null;

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
    const res = await tryGeminiGenerate(model, geminiKey, normalizedParts, options, timeoutMs);
    if (res) {
      if (options?.useGoogleSearch && options?.strictGoogleSearch && !res.grounded) {
        continue;
      }
      lastWorkingGemini = model;
      return {
        text: res.text,
        modelUsed: `gemini:${model}`,
        sources: res.sources,
        grounded: res.grounded,
      };
    }
  }

  return null;
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
  const useSearch = Boolean(options?.useGoogleSearch);
  const promptText = normalized.map((p) => p.text || '').filter(Boolean).join('\n');
  const jsonMode = Boolean(options?.jsonMode);

  // Se c'è un'immagine o è richiesto Google Search grounding, solo Gemini è compatibile
  const effectiveOrder: ProviderOrder =
    hasImage || useSearch
      ? 'gemini-only'
      : options?.providerOrder ?? 'groq-first';

  if (effectiveOrder === 'gemini-only') {
    const gemRes = await runGeminiQueue(normalized, options, deadline, perAttemptCap);
    if (gemRes) return gemRes;
    if (useSearch) {
      throw new Error(
        'Ricerca web verificata (Google Search Grounding) non disponibile in questo momento sulla chiave Gemini configurata.'
      );
    }
    throw new Error('Nessun modello Gemini disponibile in questo istante.');
  }

  if (effectiveOrder === 'groq-only') {
    const groqRes = await callGroqDirect(promptText, options?.systemInstruction, {
      deadline,
      json: jsonMode,
      temperature: options?.temperature,
      maxOutputTokens: options?.maxOutputTokens,
    });
    if (groqRes) return groqRes;
    throw new Error('Nessun modello Groq disponibile in questo istante.');
  }

  if (effectiveOrder === 'gemini-first') {
    const gemRes = await runGeminiQueue(
      normalized,
      options,
      Math.min(deadline, Date.now() + 13000),
      perAttemptCap
    );
    if (gemRes) return gemRes;

    if (left() > 1800) {
      const groqRes = await callGroqDirect(promptText, options?.systemInstruction, {
        deadline,
        json: jsonMode,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      });
      if (groqRes) return groqRes;
    }

    throw new Error('Nessun motore AI disponibile in questo istante.');
  }

  // Default: 'groq-first'
  if (left() > 2000) {
    const groqRes = await callGroqDirect(promptText, options?.systemInstruction, {
      deadline: Math.min(deadline, Date.now() + 9000),
      json: jsonMode,
      temperature: options?.temperature,
      maxOutputTokens: options?.maxOutputTokens,
    });
    if (groqRes) return groqRes;
  }

  if (left() > 2000) {
    const gemRes = await runGeminiQueue(normalized, options, deadline, perAttemptCap);
    if (gemRes) return gemRes;
  }

  throw new Error('Nessun motore AI disponibile in questo istante.');
}

/* ------------------------------------------------------------------ */
/* Estrazione JSON tollerante (oggetti e array)                        */
/* ------------------------------------------------------------------ */

function repairJson(s: string): string {
  return s
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function balancedStructures(text: string, openChar: '{' | '[', closeChar: '}' | ']'): string[] {
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
    } else if (c === openChar) {
      if (depth === 0) start = i;
      depth++;
    } else if (c === closeChar && depth > 0) {
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

  for (const attempt of [cleaned, repairJson(cleaned)]) {
    try {
      const direct = JSON.parse(attempt);
      if (direct && typeof direct === 'object') return direct as T;
    } catch {}
  }

  let best: any = null;
  let bestLen = -1;

  const candidates = [
    ...balancedStructures(cleaned, '{', '}'),
    ...balancedStructures(cleaned, '[', ']'),
  ];

  for (const candidate of candidates) {
    for (const variant of [candidate, repairJson(candidate)]) {
      try {
        const parsed = JSON.parse(variant);
        if (parsed && typeof parsed === 'object' && candidate.length > bestLen) {
          best = parsed;
          bestLen = candidate.length;
        }
        break;
      } catch {}
    }
  }

  if (best !== null) return best as T;

  throw new Error('Formato JSON non riconosciuto.');
}
