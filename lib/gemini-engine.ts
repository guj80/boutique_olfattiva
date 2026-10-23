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
  'gemini-2.0-flash',
];

let lastWorkingModel: string | null = null;
const deadModelsForKey = new Set<string>();

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

export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const orKey = (process.env.OPENROUTER_API_KEY || '').trim();

  if (groqKey && groqKey !== 'undefined') {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of groqModels) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const messages: any[] = [];
        if (systemInstruction) {
          messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({
          role: 'user',
          content: `${prompt}\n\nRispondi ESCLUSIVAMENTE con un oggetto JSON valido.`,
        });

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
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

  if (orKey && orKey !== 'undefined') {
    const freeModels = ['openrouter/free', 'deepseek/deepseek-chat:free'];
    for (const model of freeModels) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
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
          body: JSON.stringify({ model, temperature: 0.1, messages }),
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

  const temperature = options?.temperature ?? 0.1;
  const jsonMode = options?.jsonMode ?? false;
  const perAttemptTimeoutMs = options?.timeoutMs ?? 5200;
  const errors: string[] = [];

  const normalizedParts = normalizeParts(parts);
  const hasInlineImage = normalizedParts.some((p) => p.inlineData);

  if (apiKey && apiKey !== 'undefined') {
    const queue = Array.from(
      new Set([
        ...(lastWorkingModel ? [lastWorkingModel] : []),
        ...FALLBACK_MODELS,
      ])
    ).filter((m) => !deadModelsForKey.has(m));

    const safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ];

    for (const model of queue) {
      const attemptModes: Array<{ search: boolean; strictJson: boolean }> = [];
      if (options?.useGoogleSearch && !hasInlineImage) {
        attemptModes.push({ search: true, strictJson: false });
      }
      if (jsonMode) {
        attemptModes.push({ search: false, strictJson: true });
      } else {
        attemptModes.push({ search: false, strictJson: false });
      }

      for (const mode of attemptModes) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

        try {
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

          if (options?.systemInstruction) {
            payload.systemInstruction = {
              parts: [{ text: options.systemInstruction }],
            };
          }

          if (mode.search) {
            payload.tools = [{ googleSearch: {} }];
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

            if (text.length > 2) {
              lastWorkingModel = model;
              return { text, modelUsed: mode.search ? `${model}+google_search` : model };
            }
          } else {
            const errBody = await res.text();
            if (res.status === 404 || res.status === 403) {
              deadModelsForKey.add(model);
              if (lastWorkingModel === model) lastWorkingModel = null;
              break;
            }
            if (res.status === 400) continue;
            errors.push(`${model} (${res.status}): ${errBody.slice(0, 40)}`);
            break;
          }
        } catch (err: any) {
          clearTimeout(timer);
          errors.push(`${model}: ${err?.name === 'AbortError' ? 'Timeout' : err?.message}`);
          break;
        }
      }
    }
  }

  if (!hasInlineImage) {
    const promptTextOnly = normalizedParts
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n');
    if (promptTextOnly) {
      const backupResult = await callOpenRouterFree(promptTextOnly, options?.systemInstruction);
      if (backupResult) return backupResult;
    }
  }

  throw new Error(
    `Motori AI occupati (${errors.slice(0, 2).join(' | ')}).`
  );
}

export function extractJsonFromAiText<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Risposta AI vuota.');
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
    if (firstObj !== -1 && lastObj > firstObj) {
      return safeParse(cleaned.slice(firstObj, lastObj + 1));
    }
    throw new Error('Formato JSON non riconosciuto.');
  }
}
