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
  } catch (err) {
    console.error('Groq direct error:', err);
  }
  return null;
}

export async function callGeminiWithFallback(
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<{ text: string; modelUsed: string }> {
  // Estrae tutto il testo dai pezzi
  const promptText = parts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('\n');

  // Tenta prima con Groq se disponibile
  const groqResult = await callOpenRouterFree(promptText, options?.systemInstruction);
  if (groqResult) {
    return groqResult;
  }

  // Fallback estremo se Groq non risponde
  throw new Error('Motori AI non raggiungibili. Verifica la chiave GROQ_API_KEY su Vercel.');
}

export function extractJsonFromAiText<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Risposta AI vuota.');
  }

  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

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
