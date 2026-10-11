export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
];

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: { temperature?: number; jsonMode?: boolean }
): Promise<{ text: string; modelUsed: string }> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Chiave API Gemini mancante! Configura GEMINI_API_KEY nelle variabili d\'ambiente (Vercel o .env.local).'
    );
  }

  const temperature = options?.temperature ?? 0.25;
  const errors: string[] = [];

  const buildPayload = (useResponseMimeType: boolean) => ({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      ...(useResponseMimeType && options?.jsonMode
        ? { responseMimeType: 'application/json' }
        : {}),
    },
  });

  // 1. Tentativo sequenziale sui modelli preferiti
  for (const model of PREFERRED_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true)),
      });

      // Se il modello non gradisce responseMimeType, riprova senza
      if (res.status === 400 && options?.jsonMode) {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(false)),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('') || '';
        if (text) {
          return { text, modelUsed: model };
        }
      } else {
        const errBody = await res.text();
        errors.push(`${model} (${res.status}): ${errBody.slice(0, 140)}`);
      }
    } catch (err: any) {
      errors.push(`${model}: ${err?.message || 'Network error'}`);
    }
  }

  // 2. Dynamic Model Discovery: se tutti i nomi statici falliscono, chiediamo a Google quali modelli vede la tua API Key!
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    if (listRes.ok) {
      const listData = await listRes.json();
      const dynamicModelObj = (listData?.models || []).find(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          !String(m.name).includes('embedding') &&
          !String(m.name).includes('vision-legacy')
      );

      if (dynamicModelObj?.name) {
        const cleanModelName = String(dynamicModelObj.name).replace(/^models\//, '');
        const dynUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`;
        const dynRes = await fetch(dynUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(false)),
        });

        if (dynRes.ok) {
          const dynData = await dynRes.json();
          const text =
            dynData?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';
          if (text) {
            return { text, modelUsed: cleanModelName };
          }
        }
      }
    }
  } catch (dynErr: any) {
    errors.push(`DynamicDiscovery: ${dynErr?.message}`);
  }

  throw new Error(
    `Impossibile contattare Gemini AI. Dettagli: ${errors.join(' | ')}`
  );
}

/**
 * Estrae in modo sicuro un oggetto JSON dalla risposta testuale dell'AI
 */
export function extractJsonFromAiText<T = any>(rawText: string): T {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('Risposta AI non in formato JSON valido.');
  }
}
