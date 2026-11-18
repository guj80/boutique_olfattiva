// lib/gemini-engine.ts
// Motore AI multi-provider a cascata (Gemini -> Groq -> OpenRouter -> HuggingFace)
// con structured output, timeout 8s, retry selettivo, type guard e logging [AtelierLG:AI].

export type ProviderName = 'gemini' | 'groq' | 'openrouter' | 'huggingface';

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
// CONFIGURAZIONE CATENA DI FALLBACK
// ==========================================

interface ProviderTarget {
  provider: ProviderName;
  model: string;
}

const FALLBACK_CHAIN: ProviderTarget[] = [
  // 1. GEMINI (Provider principale)
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  // 2. GROQ (Seconda linea - Velocità)
  { provider: 'groq', model: 'openai/gpt-oss-120b' },
  { provider: 'groq', model: 'qwen/qwen3.8-27b' },
  // 3. OPENROUTER (Terza linea - Varietà)
  { provider: 'openrouter', model: 'google/gemma-4-31b-it:free' },
  { provider: 'openrouter', model: 'nvidia/nemotron-3-ultra:free' },
  // 4. HUGGING FACE (Rete di sicurezza finale)
  { provider: 'huggingface', model: 'Qwen/Qwen2.5-72B-Instruct' },
];

class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = true
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
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
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
      throw new ProviderError(`Timeout dopo ${timeoutMs}ms`, 408, true);
    }
    throw new ProviderError(
      err instanceof Error ? err.message : 'Errore di rete sconosciuto',
      undefined,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

function logAttempt(params: {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  status: 'SUCCESS' | 'ERROR';
  attempt: number;
  error?: string;
}): void {
  const payload = {
    tag: '[AtelierLG:AI]',
    timestamp: new Date().toISOString(),
    ...params,
  };
  if (params.status === 'ERROR') {
    console.warn(`[AtelierLG:AI] ${JSON.stringify(payload)}`);
  } else {
    console.info(`[AtelierLG:AI] ${JSON.stringify(payload)}`);
  }
}

function isNonRetryableStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 429;
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
    throw new ProviderError('GEMINI_API_KEY mancante', 401, false);
  }

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.6,
  };

  if (options.jsonMode) {
    generationConfig.responseMimeType = 'application/json';
    if (options.responseSchema) {
      generationConfig.responseSchema = options.responseSchema;
    }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };

  if (options.systemInstruction) {
    body.system_instruction = { parts: [{ text: options.systemInstruction }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new ProviderError(
      `Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      !isNonRetryableStatus(res.status)
    );
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new ProviderError('Gemini ha restituito una risposta vuota', 502, true);
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
    throw new ProviderError(`${keyName} mancante`, 401, false);
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
    throw new ProviderError(
      `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      !isNonRetryableStatus(res.status)
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError('Risposta vuota dal provider', 502, true);
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

export async function callHuggingFaceDirect(
  model: string,
  parts: AIPart[],
  options: AICallOptions,
  timeoutMs: number
): Promise<string> {
  return callOpenAICompatible(
    'https://router.huggingface.co/v1/chat/completions',
    process.env.HUGGINGFACE_API_KEY,
    'HUGGINGFACE_API_KEY',
    model,
    parts,
    options,
    timeoutMs
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
  const maxRetries = options.maxRetries ?? 2;
  const errors: string[] = [];

  for (const target of FALLBACK_CHAIN) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const remaining = options.deadline ? options.deadline - Date.now() : defaultTimeout;
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
          case 'huggingface':
            rawText = await callHuggingFaceDirect(target.model, parts, options, effectiveTimeout);
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
            throw new ProviderError('JSON malformato restituito dal modello', 422, true);
          }

          if (options.validator && !options.validator(parsed)) {
            throw new ProviderError(
              'Validazione schema (type guard) fallita: risposta scartata',
              422,
              true
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
          status: 'SUCCESS',
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

        logAttempt({
          provider: target.provider,
          model: target.model,
          latencyMs,
          status: 'ERROR',
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

export const callGeminiWithFallback = callAIWithFallback;

export function extractJsonFromAiText<T = unknown>(text: string): T {
  const cleaned = sanitizeJsonString(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error('Formato JSON non riconosciuto nella risposta AI.');
  }
}
