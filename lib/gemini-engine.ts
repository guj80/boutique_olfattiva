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

export async function callGroqDirect(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  if (!groqKey || groqKey === 'undefined') return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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
        model: 'llama-3.3-70b-versatile',
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
        return { text: content, modelUsed: 'groq:llama-3.3-70b-versatile' };
      }
    }
  } catch {
    // Fallimento silenzioso per passare al fallback
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

  // Estrae il testo del prompt
  const promptText = parts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('\n');

  // Se abbiamo la chiave Groq, usiamola come priorità assoluta per evitare i 404 di Google
  const groqRes = await callGroqDirect(promptText, options?.systemInstruction);
  if (groqRes) {
    return groqRes;
  }

  // Altrimenti tenta con Gemini 1.5 Flash standard
  if (apiKey && apiKey !== 'undefined') {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload: Record<string, any> = {
        contents: [{ role: 'user', parts: parts.map(p => ({ text: p.text || '' })) }],
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
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 5) {
          return { text, modelUsed: 'gemini-1.5-flash' };
        }
      }
    } catch {
      // Ignora e lancia l'errore sotto
    }
  }

  throw new Error('Impossibile contattare i motori AI (né Groq né Gemini hanno risposto).');
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
