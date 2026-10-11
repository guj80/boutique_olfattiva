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
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-pro-latest',
];

let cachedDiscoveredModels: string[] | null = null;
let lastDiscoveryTimestamp = 0;
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

async function getActiveModelsForKey(apiKey: string, errors: string[]): Promise<string[]> {
  const now = Date.now();
  if (
    cachedDiscoveredModels &&
    cachedDiscoveredModels.length > 0 &&
    now - lastDiscoveryTimestamp < CACHE_TTL_MS
  ) {
    return cachedDiscoveredModels;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timeout);

    if (listRes.ok) {
      const listData = await listRes.json();
      const allModels: any[] = listData?.models || [];

      const validFromGoogle = allModels
        .filter((m) => {
          const name = String(m?.name || '').toLowerCase();
          const methods: string[] = m?.supportedGenerationMethods || [];
          if (!methods.includes('generateContent')) return false;

          const excludedKeywords = [
            'embedding',
            'aqa',
            'imagen',
            'veo',
            'tts',
            'audio',
            'robotics',
            'computer-use',
            'learnlm',
            'gemma',
            'image-generation',
            '1.5',
            '2.0',
            '2.5-pro',
            'thinking',
          ];
          return !excludedKeywords.some((kw) => name.includes(kw));
        })
        .map((m) => String(m.name).replace(/^models\//, ''));

      validFromGoogle.sort((a, b) => {
        const getScore = (modelName: string) => {
          if (modelName === 'gemini-2.5-flash') return 1;
          if (modelName === 'gemini-2.5-flash-lite') return 2;
          if (modelName.includes('2.5') && modelName.includes('flash')) return 3;
          if (modelName.includes('flash') && !modelName.includes('preview')) return 4;
          if (modelName.includes('flash')) return 5;
          return 10;
        };
        return getScore(a) - getScore(b);
      });

      if (validFromGoogle.length > 0) {
        cachedDiscoveredModels = validFromGoogle;
        lastDiscoveryTimestamp = now;
        return validFromGoogle;
      }
    } else {
      const errTxt = await listRes.text();
      errors.push(`ListModels (${listRes.status}): ${errTxt.slice(0, 100)}`);
    }
  } catch (e: any) {
    errors.push(
      `ListModels skip: ${e?.name === 'AbortError' ? 'Timeout 3.5s' : e?.message}`
    );
  }

  return [];
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

  const temperature = options?.temperature ?? 0.1;
  const jsonMode = options?.jsonMode ?? false;
  const useGoogleSearch = options?.useGoogleSearch ?? false;
  const timeoutPerModelMs = options?.timeoutMs ?? 9000;
  const errors: string[] = [];

  const discoveredModels = await getActiveModelsForKey(apiKey, errors);
  const finalQueue = Array.from(
    new Set([...discoveredModels, ...FALLBACK_2026_MODELS])
  );

  const normalizedParts = normalizeParts(parts);

  const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ];

  // Costruiamo le configurazioni da tentare: se useGoogleSearch è attivo, proviamo prima col Grounding Google!
  const attemptModes: Array<{ search: boolean; strictJson: boolean }> = [];
  if (useGoogleSearch) {
    attemptModes.push({ search: true, strictJson: false });
  }
  if (jsonMode) {
    attemptModes.push({ search: false, strictJson: true });
  }
  attemptModes.push({ search: false, strictJson: false });

  for (const model of finalQueue) {
    for (const mode of attemptModes) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutPerModelMs);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const generationConfig: Record<string, any> = { temperature };
        if (mode.strictJson) {
          generationConfig.responseMimeType = 'application/json';
        }

        const payload: Record<string, any> = {
          contents: [{ role: 'user', parts: normalizedParts }],
          generationConfig,
          safetySettings,
        };

        if (mode.search) {
          payload.tools = [{ google_search: {} }];
        }

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
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const candidate = data?.candidates?.[0];

          const text =
            candidate?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';

          if (text && text.trim().length > 0) {
            return { text: text.trim(), modelUsed: model };
          } else {
            const blockReason =
              candidate?.finishReason ||
              data?.promptFeedback?.blockReason ||
              'UNKNOWN';
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

          // Se il modello non supporta google_search o responseMimeType (400), passa subito al tentativo successivo sullo stesso modello
          if (res.status === 400 && (mode.search || mode.strictJson)) {
            continue;
          }

          errors.push(`${model} (${res.status}): ${errBody.slice(0, 90)}`);
          break;
        }
      } catch (err: any) {
        if (err?.message?.includes('GEMINI_API_KEY non è valida')) {
          throw err;
        }
        const msg =
          err?.name === 'AbortError'
            ? `Timeout (${timeoutPerModelMs}ms)`
            : err?.message || 'Network error';
        errors.push(`${model}: ${msg}`);
        break;
      }
    }
  }

  throw new Error(
    `Nessun modello Gemini ha risposto. Modelli testati [${finalQueue
      .slice(0, 6)
      .join(', ')}...]. Dettagli: ${errors.slice(0, 4).join(' | ')}`
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
    try {
      return JSON.parse(str) as T;
    } catch {
      const fixedStr = str.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixedStr) as T;
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
      return safeParse(cleaned.slice(firstArr, lastArr + 1));
    }

    if (firstObj !== -1 && lastObj > firstObj) {
      return safeParse(cleaned.slice(firstObj, lastObj + 1));
    }

    throw new Error(
      `Risposta AI non in formato JSON valido: "${cleaned.slice(0, 80)}..."`
    );
  }
}
