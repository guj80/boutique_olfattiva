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

export async function callOpenRouterFree(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
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

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY non configurata.');
  }

  // Normalizza le parti per l'API di Gemini
  const contents = parts.map((p) => {
    if (p.text) return { role: 'user', parts: [{ text: p.text }] };
    const imgData = p.inlineData?.data || p.inline_data?.data;
    const imgMime = p.inlineData?.mimeType || p.inline_data?.mime_type;
    if (imgData && imgMime) {
      return {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: imgMime,
              data: imgData.includes(',') ? imgData.split(',')[1] : imgData,
            },
          },
        ],
      };
    }
    return { role: 'user', parts: [{ text: '' }] };
  });

  // Usiamo gemini-2.0-flash che supporta perfettamente le nuove chiavi AQ.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload: Record<string, any> = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.1,
      ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (options?.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 25000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      throw new Error('Risposta vuota da Gemini.');
    }

    return { text, modelUsed: 'gemini-2.0-flash' };
  } catch (err: any) {
    clearTimeout(timer);
    throw new Error(`Errore motore Gemini: ${err?.message || 'Timeout'}`);
  }
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
