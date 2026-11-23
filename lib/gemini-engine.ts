// lib/gemini-engine.ts
// Motore AI multi-provider a cascata (Gemini -> Groq -> OpenRouter free router)
// con structured output, Google Search Grounding opzionale, blocco anti-allucinazione (onlyGemini),
// header x-goog-api-key, deadline globale, join delle parts e logging [AtelierLG:AI].

export type ProviderName = 'gemini' | 'groq' | 'openrouter';

export interface AIPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface AICallOptions<T = unknown> {
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  deadline?: number;
  jsonMode?: boolean;
  responseSchema?: Record<string, unknown>;
  validator?: (data: unknown) => data is T;
  systemInstruction?: string;
  /** Attiva Google Search Grounding nativo su Gemini */
  useGoogleSearch?: boolean;
  /** Se true, esegue SOLO i modelli Gemini (blocca il fallback cieco su Groq/OpenRouter) */
  onlyGemini?: boolean;
}

export interface AIResult<T = unknown> {
  text: string;
  data?: T;
  providerUsed: ProviderName;
  modelUsed: string;
  latencyMs: number;
}

// ==========================================
// SCHEMI STRUCTURED OUTPUT & TYPE GUARDS
// ==========================================

export interface ScentDNAResponse {
  archetipo: string;
  descrizione: string;
  consiglio: string;
}

export const SCENT_DNA_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    archetipo: { type: 'STRING' },
    descrizione: { type: 'STRING' },
    consiglio: { type: 'STRING' },
  },
  required: ['archetipo', 'descrizione', 'consiglio'],
};

export function isScentDNAResponse(data: unknown): data is ScentDNAResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.archetipo === 'string' &&
    obj.archetipo.trim().length > 0 &&
    typeof obj.descrizione === 'string' &&
    obj.descrizione.trim().length > 0 &&
    typeof obj.consiglio === 'string' &&
    obj.consiglio.trim().length > 0
  );
}

export interface OracoloResponse {
  reply: string;
}

export const ORACOLO_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
  },
  required: ['reply'],
};

export function isOracoloResponse(data: unknown): data is OracoloResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.reply === 'string' && obj.reply.trim().length > 0;
}

// ==========================================
// CONFIGURAZIONE CATENA DI FALLBACK (5 MODELLI)
// ==========================================

interface ProviderTarget {
  provider: ProviderName;
  model: string;
}

const FALLBACK_CHAIN: ProviderTarget[] = [
  // 1. GEMINI - motore principale
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  // 2. GROQ - fallback alternativo
  { provider: 'groq', model: 'openai/gpt-oss-20b' },
  { provider: 'groq', model: 'qwen/qwen3.8-27b' },
  // 3. OPENROUTER - router gratuito automatico
  { provider: 'openrouter', model: 'openrouter/free' },
];

type LogEvent =
  | 'SUCCESS'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'INVALID_JSON'
  | 'VALIDATION_ERROR'
  | 'MISSING_API_KEY'
  | 'ERROR';

class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = true,
    public readonly event: LogEvent = 'ERROR'
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ==========================================
// UTILITY: TIMEOUT, SANITIZZAZIONE, LOGGING
// ==========================================

function extractTextFromParts(parts: AIPart[]): string {
  return parts
    .map((p) => p.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n\n');
}

function sanitizeJsonString(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return cleaned;
  }

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];

  return cleaned;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError(`Timeout dopo ${timeoutMs}ms`, 408, true, 'TIMEOUT');
    }
    throw new ProviderError(
      err instanceof Error ? err.message : 'Errore di rete sconosciuto',
      undefined,
      true,
      'ERROR'
    );
  } finally {
    clearTimeout(timer);
  }
}

function logAttempt(params: {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  event: LogEvent;
  attempt: number;
  error?: string;
}): void {
  const payload = {
    tag: '[AtelierLG:AI]',
    timestamp: new Date().toISOString(),
    ...params,
  };
  if (params.event !== 'SUCCESS') {
    console.warn(`[AtelierLG:AI] ${JSON.stringify(payload)}`);
  } else {
    console.info(`[AtelierLG:AI] ${JSON.stringify(payload)}`);
  }
}

function isNonRetryableStatus(status: number): boolean {
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 429 ||
    status === 503
  );
}

// ==========================================
// CONNETTORI DIRETTI AI PROVIDER
// ==========================================

export async function callGeminiDirect(
  model: string,
  parts: AIPart[],
  options: AICallOptions,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError('GEMINI_API_KEY mancante', 401, false, 'MISSING_API_KEY');
  }

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.6,
  };

  // Con google_search attivo evitiamo responseMimeType/responseSchema per compatibilità API
  if (options.jsonMode && !options.useGoogleSearch) {
    generationConfig.responseMimeType = 'application/json';
    if (options.responseSchema) {
      generationConfig.responseSchema = options.responseSchema;
    }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };

  if (options.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  if (options.systemInstruction) {
    body.system_instruction = { parts: [{ text: options.systemInstruction }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const retryAfter = res.headers.get('retry-after');
    const retryInfo = retryAfter ? ` (retry-after: ${retryAfter}s)` : '';
    throw new ProviderError(
      `Gemini HTTP ${res.status}${retryInfo}: ${errText.slice(0, 200)}`,
      res.status,
      !isNonRetryableStatus(res.status),
      'HTTP_ERROR'
    );
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const responseParts = json.candidates?.[0]?.content?.parts ?? [];
  const text = responseParts
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('\n');

  if (!text.trim()) {
    throw new ProviderError('Gemini ha restituito una risposta vuota', 502, true, 'ERROR');
  }
  return text;
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string | undefined,
  keyName: string,
  model: string,
  parts: AIPart[],
  options: AICallOptions,
  timeoutMs: number,
  extraHeaders?: Record<string, string>
): Promise<string> {
  if (!apiKey) {
    throw new ProviderError(`${keyName} mancante`, 401, false, 'MISSING_API_KEY');
  }

  const promptText = extractTextFromParts(parts);
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  if (options.jsonMode) {
    messages.push({
      role: 'system',
      content:
        'Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo aggiuntivo o blocchi markdown.',
    });
  }
  messages.push({ role: 'user', content: promptText });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.6,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const retryAfter = res.headers.get('retry-after');
    const retryInfo = retryAfter ? ` (retry-after: ${retryAfter}s)` : '';
    throw new ProviderError(
      `HTTP ${res.status}${retryInfo}: ${errText.slice(0, 200)}`,
      res.status,
      !isNonRetryableStatus(res.status),
      'HTTP_ERROR'
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = json.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new ProviderError('Risposta vuota dal provider', 502, true, 'ERROR');
  }
  return text;
}

export async function callGroqDirect(
  model: string,
  parts: AIPart[],
  options: AICallOptions,
  timeoutMs: number
): Promise<string> {
  return callOpenAICompatible(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY,
    'GROQ_API_KEY',
    model,
    parts,
    options,
    timeoutMs
  );
}

export async function callOpenRouterDirect(
  model: string,
  parts: AIPart[],
  options: AICallOptions,
  timeoutMs: number
): Promise<string> {
  return callOpenAICompatible(
    'https://openrouter.ai/api/v1/chat/completions',
    process.env.OPENROUTER_API_KEY,
    'OPENROUTER_API_KEY',
    model,
    parts,
    options,
    timeoutMs,
    {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'Atelier LG',
    }
  );
}

// ==========================================
// ORCHESTRATORE FALLBACK CHAIN
// ==========================================

export async function callAIWithFallback<T = unknown>(
  parts: AIPart[],
  options: AICallOptions<T> = {}
): Promise<AIResult<T>> {
  const defaultTimeout = options.timeoutMs ?? 8000;
  const maxRetries = options.maxRetries ?? 1;
  const globalDeadline = options.deadline ?? Date.now() + 25000;
  const errors: string[] = [];

  const activeChain = options.onlyGemini
    ? FALLBACK_CHAIN.filter((t) => t.provider === 'gemini')
    : FALLBACK_CHAIN;

  for (const target of activeChain) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const remaining = globalDeadline - Date.now();
      if (remaining <= 500) {
        throw new Error(`Deadline globale superata. Errori precedenti: ${errors.join(' | ')}`);
      }

      const effectiveTimeout = Math.min(defaultTimeout, remaining);
      const start = Date.now();

      try {
        let rawText: string;

        switch (target.provider) {
          case 'gemini':
            rawText = await callGeminiDirect(target.model, parts, options, effectiveTimeout);
            break;
          case 'groq':
            rawText = await callGroqDirect(target.model, parts, options, effectiveTimeout);
            break;
          case 'openrouter':
            rawText = await callOpenRouterDirect(target.model, parts, options, effectiveTimeout);
            break;
        }

        let validatedData: T | undefined;
        let finalText = rawText;

        if (options.jsonMode || options.validator) {
          const cleaned = sanitizeJsonString(rawText);
          let parsed: unknown;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            throw new ProviderError(
              'JSON malformato restituito dal modello',
              422,
              true,
              'INVALID_JSON'
            );
          }

          if (options.validator && !options.validator(parsed)) {
            throw new ProviderError(
              'Validazione schema (type guard) fallita: risposta scartata',
              422,
              true,
              'VALIDATION_ERROR'
            );
          }

          validatedData = parsed as T;
          finalText = cleaned;
        }

        const latencyMs = Date.now() - start;
        logAttempt({
          provider: target.provider,
          model: target.model,
          latencyMs,
          event: 'SUCCESS',
          attempt,
        });

        return {
          text: finalText,
          data: validatedData,
          providerUsed: target.provider,
          modelUsed: target.model,
          latencyMs,
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        const retryable = err instanceof ProviderError ? err.retryable : true;
        const event: LogEvent = err instanceof ProviderError ? err.event : 'ERROR';

        logAttempt({
          provider: target.provider,
          model: target.model,
          latencyMs,
          event,
          attempt,
          error: message,
        });

        errors.push(`${target.provider}/${target.model}: ${message}`);

        if (!retryable || attempt === maxRetries) {
          break;
        }

        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
    }
  }

  throw new Error(
    `Tutti i provider AI hanno fallito. Dettagli: ${errors.slice(-4).join(' | ')}`
  );
}

// ==========================================
// EXPORT RETROCOMPATIBILI
// ==========================================

export type GeminiPart = AIPart;

export const callGeminiWithFallback = callAIWithFallback;

export function extractJsonFromAiText<T = unknown>(text: string): T {
  const cleaned = sanitizeJsonString(text);
  return JSON.parse(cleaned) as T;
}

export async function callOpenRouterFree(
  partsOrPrompt: AIPart[] | string,
  systemPromptOrOptions?: string | (AICallOptions & { json?: boolean }),
  maybeOptions?: AICallOptions & { json?: boolean }
): Promise<{ text: string; modelUsed: string }> {
  const parts: AIPart[] =
    typeof partsOrPrompt === 'string' ? [{ text: partsOrPrompt }] : partsOrPrompt;

  const systemInstruction =
    typeof systemPromptOrOptions === 'string' ? systemPromptOrOptions : undefined;
  const rawOptions =
    typeof systemPromptOrOptions === 'string' ? (maybeOptions ?? {}) : (systemPromptOrOptions ?? {});

  const options: AICallOptions = {
    ...rawOptions,
    systemInstruction: rawOptions.systemInstruction ?? systemInstruction,
    jsonMode: rawOptions.jsonMode ?? rawOptions.json,
  };

  const remaining = options.deadline ? Math.max(1000, options.deadline - Date.now()) : 8000;
  const timeoutMs = Math.min(options.timeoutMs ?? 8000, remaining);
  const model = 'openrouter/free';

  const text = await callOpenRouterDirect(model, parts, options, timeoutMs);
  return { text, modelUsed: model };
}
