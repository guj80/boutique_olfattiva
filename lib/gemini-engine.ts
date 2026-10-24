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
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
];

function normalizeParts(parts: GeminiPart[]): any[] {
  return parts.map((p) => {
    if (p.text !== undefined) return { text: p.text };
    const imgData = p.inlineData?.data || p.inline_data?.data;
    const imgMime = p.inlineData?.mimeType || p.inline_data?.mime_type;
    if (imgData && imgMime) {
      const cleanBase64 = imgData.includes(',') ? imgData.split(',')[1] : imgData;
      return { inlineData: { mimeType: imgMime, data: cleanBase64 } };
    }
    return p;
  });
}

export async function callGroqFallback(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  if (!groqKey || groqKey === 'undefined') return null;

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({
        role: 'user',
        content: `${prompt}\n\nRispondi ESCLUSIVAMENTE con un oggetto JSON valido.`,
      });

      const groqEndpoint = ['https:', '', 'api.groq.com', 'openai', 'v1', 'chat', 'completions'].join('/');
      const res = await fetch(groqEndpoint, {
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
        if (content && content.length > 10) {
          return { text: content, modelUsed: `groq:${model}` };
        }
      }
    } catch {
      clearTimeout(timer);
      continue;
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

  const normalizedParts = normalizeParts(parts);
  const hasInlineImage = normalizedParts.some((p) => p.inlineData);
  const timeoutMs = options?.timeoutMs ?? 18000;
  const errors: string[] = [];

  if (apiKey && apiKey !== 'undefined') {
    for (const model of GEMINI_MODELS) {
      const modes =
        options?.useGoogleSearch && !hasInlineImage
          ? [
              { search: true, strictJson: false },
              { search: false, strictJson: options?.jsonMode ?? true },
            ]
          : [{ search: false, strictJson: options?.jsonMode ?? true }];

      for (const mode of modes) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const base = ['https:', '', 'generativelanguage.googleapis.com', 'v1beta', 'models'].join('/');
          const url = `${base}/${model}:generateContent?key=${apiKey}`;
          const generationConfig: Record<string, any> = {
            temperature: options?.temperature ?? 0.1,
          };
          if (mode.strictJson) {
            generationConfig.responseMimeType = 'application/json';
          }

          const payload: Record<string, any> = {
            contents: [{ role: 'user', parts: normalizedParts }],
            generationConfig,
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
            const rawParts: any[] = data?.candidates?.[0]?.content?.parts || [];
            const text = rawParts
              .filter((p) => !p?.thought)
              .map((p) => p?.text || '')
              .join('')
              .trim();

            if (text.length > 5) {
              return {
                text,
                modelUsed: mode.search ? `${model}+google_search` : model,
              };
            }
          } else {
            const errBody = await res.text();
            errors.push(`${model}(${res.status}): ${errBody.slice(0, 60)}`);
            if (res.status === 404 || res.status === 403 || res.status === 400) break;
          }
        } catch (err: any) {
          clearTimeout(timer);
          errors.push(`${model}:${err?.name === 'AbortError' ? 'Timeout' : 'Err'}`);
          break;
        }
      }
    }
  }

  if (!hasInlineImage) {
    const promptText = normalizedParts
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n');
    const groqRes = await callGroqFallback(promptText, options?.systemInstruction);
    if (groqRes) return groqRes;
  }

  throw new Error(`Dettaglio errore AI: ${errors.join(' | ') || 'Chiavi mancanti'}`);
}

export function extractJsonFromAiText<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Risposta AI vuota.');
  }

  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj !== -1 && lastObj > firstObj) {
      return JSON.parse(cleaned.slice(firstObj, lastObj + 1)) as T;
    }
    throw new Error('Formato JSON non riconosciuto.');
  }
}
