export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// Modelli attuali (Ottobre 2026) ordinati per priorità
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

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: { temperature?: number; jsonMode?: boolean }
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    throw new Error(
      'Chiave API Gemini mancante! Configura GEMINI_API_KEY nelle Environment Variables di Vercel.'
    );
  }

  const temperature = options?.temperature ?? 0.25;
  const errors: string[] = [];

  // 1. AUTODISCOVERY DIRETTA: Chiediamo a Google quali modelli sono REALMENTE attivi sulla tua API Key
  let candidateModels: string[] = [];

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl, { cache: 'no-store' });

    if (listRes.ok) {
      const listData = await listRes.json();
      const allModels: any[] = listData?.models || [];

      const validFromGoogle = allModels
        .filter((m) => {
          const name = String(m?.name || '').toLowerCase();
          const methods: string[] = m?.supportedGenerationMethods || [];
          // Deve supportare generateContent
          if (!methods.includes('generateContent')) return false;
          // Escludiamo modelli non testuali o deprecati per i nuovi utenti
          if (
            name.includes('embedding') ||
            name.includes('aqa') ||
            name.includes('imagen') ||
            name.includes('veo') ||
            name.includes('tts') ||
            name.includes('audio') ||
            name.includes('robotics') ||
            name.includes('computer-use') ||
            name.includes('learnlm') ||
            name.includes('gemma') ||
            name.includes('image-generation') ||
            name.includes('1.5') ||
            name.includes('2.0') ||
            name.includes('2.5-pro')
          ) {
            return false;
          }
          return true;
        })
        .map((m) => String(m.name).replace(/^models\//, ''));

      // Mettiamo in cima i modelli "flash" (più veloci e sempre abilitati sul piano gratuito)
      validFromGoogle.sort((a, b) => {
        const aFlash = a.includes('flash') ? 0 : 1;
        const bFlash = b.includes('flash') ? 0 : 1;
        return aFlash - bFlash;
      });

      candidateModels = validFromGoogle;
    } else {
      const errTxt = await listRes.text();
      errors.push(`ListModels (${listRes.status}): ${errTxt.slice(0, 120)}`);
    }
  } catch (e: any) {
    errors.push(`ListModels exception: ${e?.message}`);
  }

  // Uniamo i modelli scoperti dal tuo account con la lista 2026 senza duplicati
  const finalQueue = Array.from(new Set([...candidateModels, ...FALLBACK_2026_MODELS]));

  // 2. Proviamo in sequenza TUTTI i modelli validi finché uno non risponde 200 OK
  for (const model of finalQueue) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Payload pulito e universale (senza campi sperimentali che causano 400 Bad Request)
      const payload = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('') || '';

        if (text && text.trim().length > 0) {
          return { text, modelUsed: model };
        } else {
          errors.push(`${model}: risposta vuota`);
        }
      } else {
        const errBody = await res.text();
        errors.push(`${model} (${res.status}): ${errBody.slice(0, 100)}`);
      }
    } catch (err: any) {
      errors.push(`${model}: ${err?.message || 'Network error'}`);
    }
  }

  throw new Error(
    `Nessun modello Gemini ha risposto. Modelli testati [${finalQueue.join(', ')}]. Dettagli: ${errors
      .slice(0, 4)
      .join(' | ')}`
  );
}

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
