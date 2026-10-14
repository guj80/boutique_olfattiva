export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

export interface GeminiCallOptions {
  temperature?: number;
  jsonMode?: boolean;
  systemInstruction?: string;
  timeoutMs?: number;
  useGoogleSearch?: boolean;
}

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

let cachedDiscoveredModels: string[] | null = null;
let lastDiscoveryTimestamp = 0;
let lastWorkingModel: string | null = null;
const deadModelsForKey = new Set<string>();
const CACHE_TTL_MS = 3600000;

function normalizeParts(parts: GeminiPart[]): any[] {
  return parts.map((p) => {
    if (p.text !== undefined) {
      return { text: p.text };
    }
    const imgData = p.inlineData?.data || p.inline_data?.data;
    const imgMime = p.inlineData?.mimeType || p.inline_data?.mime_type;
    if (imgData && imgMime) {
      const cleanBase64 = imgData.includes(',') ? imgData.split(',')[1] : imgData;
      return {
        inlineData: {
          mimeType: imgMime,
          data: cleanBase64,
        },
      };
    }
    return p;
  });
}

function isModelNameAllowed(rawName: string): boolean {
  const name = rawName.toLowerCase().replace(/^models\//, '');
  if (deadModelsForKey.has(name)) return false;

  const excludedKeywords = [
    'embedding',
    'aqa',
    'imagen',
    'image',
    'veo',
    'tts',
    'audio',
    'live',
    'robotics',
    'computer-use',
    'learnlm',
    'gemma',
    '1.0',
    '1.5-flash-8b',
    'thinking',
    'customtools',
  ];

  return !excludedKeywords.some((kw) => name.includes(kw));
}

function scoreModelPriority(modelName: string): number {
  if (lastWorkingModel && modelName === lastWorkingModel) return 0;
  if (modelName === 'gemini-2.5-flash') return 1;
  if (modelName === 'gemini-2.5-pro') return 2;
  if (modelName === 'gemini-3-flash-preview') return 3;
  if (modelName === 'gemini-3.1-flash-lite-preview') return 4;
  if (modelName === 'gemini-2.0-flash') return 5;
  if (modelName === 'gemini-flash-latest') return 6;
  if (modelName.includes('2.5')) return 7;
  if (modelName.includes('flash')) return 8;
  if (modelName.includes('pro')) return 9;
  return 15;
}

async function getActiveModelsForKey(apiKey: string, errors: string[]): Promise<string[]> {
  const now = Date.now();
  if (
    cachedDiscoveredModels &&
    cachedDiscoveredModels.length > 0 &&
    now - lastDiscoveryTimestamp < CACHE_TTL_MS
  ) {
    return cachedDiscoveredModels.filter((m) => !deadModelsForKey.has(m));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (listRes.ok) {
      const listData = await listRes.json();
      const allModels: any[] = listData?.models || [];

      const validFromGoogle = allModels
        .filter((m) => {
          const methods: string[] = m?.supportedGenerationMethods || [];
          if (!methods.includes('generateContent')) return false;
          return isModelNameAllowed(String(m?.name || ''));
        })
        .map((m) => String(m.name).replace(/^models\//, ''));

      validFromGoogle.sort((a, b) => scoreModelPriority(a) - scoreModelPriority(b));

      if (validFromGoogle.length > 0) {
        cachedDiscoveredModels = validFromGoogle;
        lastDiscoveryTimestamp = now;
        return validFromGoogle;
      }
    } else {
      const errTxt = await listRes.text();
      errors.push(`ListModels (${listRes.status}): ${errTxt.slice(0, 80)}`);
    }
  } catch (e: any) {
    clearTimeout(timeout);
    errors.push(
      `ListModels skip: ${e?.name === 'AbortError' ? 'Timeout 3s' : e?.message}`
    );
  }

  return [];
}

// Giudice / Motore Secondario Ultraveloce Gratuito (Groq Llama-3.3-70B + Qwen / DeepSeek)
export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const orKey = (process.env.OPENROUTER_API_KEY || '').trim();

  // 1. PRIORITÀ ASSOLUTA: GROQ (Latenza ~0.2s, JSON Mode nativo, 14.400 req/giorno gratis)
  if (groqKey && groqKey !== 'undefined') {
    const groqModels = [
      'llama-3.3-70b-versatile',
      'qwen-qwq-32b',
      'llama-3.1-8b-instant',
    ];

    for (const model of groqModels) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const messages: any[] = [];
        if (systemInstruction) {
          messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.0,
            response_format: { type: 'json_object' },
            messages,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content?.trim();
          if (content && content.length > 5) {
            return { text: content, modelUsed: `groq:${model}` };
          }
        }
      } catch {
        continue;
      }
    }
  }

  // 2. FALLBACK SECONDARIO: OPENROUTER FREE (se presente)
  if (orKey && orKey !== 'undefined') {
    const freeModels = [
      'openrouter/free',
      'deepseek/deepseek-chat:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ];

    for (const model of freeModels) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const messages: any[] = [];
        if (systemInstruction) {
          messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${orKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.0,
            messages,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content?.trim();
          if (content && content.length > 5) {
            return { text: content, modelUsed: `openrouter:${model}` };
          }
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();

  if (!apiKey || apiKey === 'undefined') {
    throw new Error(
      'Chiave API Gemini mancante! Configura GEMINI_API_KEY nelle Environment Variables di Vercel.'
    );
  }

  const temperature = options?.temperature ?? 0.0;
  const jsonMode = options?.jsonMode ?? false;
  const useGoogleSearch = options?.useGoogleSearch ?? false;
  const perAttemptTimeoutMs = options?.timeoutMs ?? 16000;
  const errors: string[] = [];

  const discoveredModels = await getActiveModelsForKey(apiKey, errors);

  const rawQueue = Array.from(
    new Set([
      ...(lastWorkingModel ? [lastWorkingModel] : []),
      ...FALLBACK_MODELS,
      ...discoveredModels,
    ])
  ).filter((m) => !deadModelsForKey.has(m));

  rawQueue.sort((a, b) => scoreModelPriority(a) - scoreModelPriority(b));

  const normalizedParts = normalizeParts(parts);

  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ];

  for (const model of rawQueue) {
    const jsonAttempts = useGoogleSearch ? [false] : jsonMode ? [true, false] : [false];

    for (const useStrictJsonConfig of jsonAttempts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const generationConfig: Record<string, any> = { temperature };
        if (useStrictJsonConfig) {
          generationConfig.responseMimeType = 'application/json';
        }

        const payload: Record<string, any> = {
          contents: [{ role: 'user', parts: normalizedParts }],
          generationConfig,
          safetySettings,
        };

        if (options?.systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
          };
        }

        if (useGoogleSearch) {
          payload.tools = [{ google_search: {} }];
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const candidate = data?.candidates?.[0];
          const rawParts: any[] = candidate?.content?.parts || [];

          const nonThoughtParts = rawParts.filter((p) => !p?.thought);
          const partsToRead = nonThoughtParts.length > 0 ? nonThoughtParts : rawParts;

          const text = partsToRead
            .map((p: { text?: string }) => p?.text || '')
            .join('')
            .trim();

          if (text.length > 0) {
            lastWorkingModel = model;
            return { text, modelUsed: useGoogleSearch ? `${model}+google_search` : model };
          } else {
            const blockReason =
              candidate?.finishReason ||
              data?.promptFeedback?.blockReason ||
              'EMPTY';
            errors.push(`${model}: risposta vuota (${blockReason})`);
            break;
          }
        } else {
          const errBody = await res.text();

          if (res.status === 400 && errBody.includes('API_KEY_INVALID')) {
            throw new Error(
              'La tua GEMINI_API_KEY non è valida. Verifica di averla copiata correttamente su Vercel.'
            );
          }

          if (res.status === 400 && useGoogleSearch) {
            break;
          }

          if (res.status === 404 || res.status === 403) {
            deadModelsForKey.add(model);
            if (lastWorkingModel === model) lastWorkingModel = null;
            errors.push(`${model} (${res.status}): escluso`);
            break;
          }

          if (res.status === 400 && useStrictJsonConfig) {
            continue;
          }

          errors.push(`${model} (${res.status}): ${errBody.slice(0, 70)}`);
          break;
        }
      } catch (err: any) {
        clearTimeout(timer);
        if (err?.message?.includes('GEMINI_API_KEY non è valida')) {
          throw err;
        }
        const msg =
          err?.name === 'AbortError'
            ? `Timeout (${perAttemptTimeoutMs}ms)`
            : err?.message || 'Network error';
        errors.push(`${model}: ${msg}`);
        break;
      }
    }
  }

  // Se tutti i modelli Gemini sono in rate-limit, interviene Groq Llama-3.3-70B in 0.2 secondi
  const promptTextOnly = normalizedParts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('\n');
  if (promptTextOnly) {
    const backupResult = await callOpenRouterFree(promptTextOnly, options?.systemInstruction);
    if (backupResult) return backupResult;
  }

  throw new Error(
    `Nessun modello AI ha risposto. Dettagli: ${errors.slice(0, 5).join(' | ')}`
  );
}

export function extractJsonFromAiText<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Testo AI vuoto o non valido per estrazione JSON.');
  }

  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const safeParse = (str: string): T => {
    const normalizedQuotes = str
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(str) as T;
    } catch {
      return JSON.parse(normalizedQuotes) as T;
    }
  };

  try {
    return safeParse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    const firstArr = cleaned.indexOf('[');
    const lastArr = cleaned.lastIndexOf(']');

    const isArrayFirst =
      firstArr !== -1 && (firstObj === -1 || firstArr < firstObj);

    if (isArrayFirst && lastArr > firstArr) {
      try {
        return safeParse(cleaned.slice(firstArr, lastArr + 1));
      } catch {
        // Fallback
      }
    }

    if (firstObj !== -1 && lastObj > firstObj) {
      return safeParse(cleaned.slice(firstObj, lastObj + 1));
    }

    throw new Error(
      `Risposta AI non in formato JSON valido: "${cleaned.slice(0, 80)}..."`
    );
  }
}
