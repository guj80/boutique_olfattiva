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

const FALLBACK_2026_MODELS = [
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
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
    '1.5',
    '2.0',
    '2.5-pro',
    'thinking',
    'customtools',
    'exp',
  ];

  return !excludedKeywords.some((kw) => name.includes(kw));
}

function scoreModelPriority(modelName: string): number {
  if (lastWorkingModel && modelName === lastWorkingModel) return 0;
  if (modelName === 'gemini-flash-latest') return 1;
  if (modelName === 'gemini-3-flash-preview') return 2;
  if (modelName === 'gemini-3.1-flash-lite-preview') return 3;
  if (modelName === 'gemini-flash-lite-latest') return 4;
  if (modelName.includes('3') && modelName.includes('flash')) return 5;
  if (modelName.includes('flash') && !modelName.includes('2.5')) return 6;
  if (modelName === 'gemini-pro-latest') return 7;
  if (modelName.includes('3') && modelName.includes('pro')) return 8;
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
  const timeout = setTimeout(() => controller.abort(), 2200);

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
      `ListModels skip: ${e?.name === 'AbortError' ? 'Timeout 2.2s' : e?.message}`
    );
  }

  return [];
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<{ text: string; modelUsed: string }> {
  const startTime = Date.now();
  const totalBudgetMs = 8800;

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

  const temperature = options?.temperature ?? 0.15;
  const jsonMode = options?.jsonMode ?? false;
  const perAttemptTimeoutMs = options?.timeoutMs ?? 4200;
  const errors: string[] = [];

  const discoveredModels = await getActiveModelsForKey(apiKey, errors);

  const rawQueue = Array.from(
    new Set([
      ...(lastWorkingModel ? [lastWorkingModel] : []),
      ...discoveredModels,
      ...FALLBACK_2026_MODELS,
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
    if (Date.now() - startTime > totalBudgetMs && errors.length > 0) {
      errors.push('Stop preventivo per budget tempo Serverless');
      break;
    }

    for (const useStrictJsonConfig of jsonMode ? [true, false] : [false]) {
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
            return { text, modelUsed: model };
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

  throw new Error(
    `Nessun modello Gemini ha risposto in tempo. Dettagli: ${errors
      .slice(0, 5)
      .join(' | ')}`
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
        // Fallback sull'oggetto se la parentesi quadra era nel testo discorsivo
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
