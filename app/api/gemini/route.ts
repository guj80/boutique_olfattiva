import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt mancante.' }, { status: 400 });
    }

    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ''
    ).trim();

    const groqKey = (process.env.GROQ_API_KEY || '').trim();

    let lastError = '';

    // 1. Tentativo diretto con Gemini 1.5 Flash
    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2000,
              ...(prompt.toLowerCase().includes('json') ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text || '')
            .join('')
            .trim();

          if (text) {
            return NextResponse.json({ text, modelUsed: 'gemini-1.5-flash' });
          }
          lastError = 'Gemini ha risposto con un testo vuoto.';
        } else {
          const errText = await res.text().catch(() => '');
          lastError = `Gemini HTTP ${res.status}: ${errText.slice(0, 150)}`;
        }
      } catch (e: any) {
        lastError = `Gemini eccezione: ${e?.message}`;
      }
    } else {
      lastError = 'Nessuna GEMINI_API_KEY trovata nelle variabili d’ambiente.';
    }

    // 2. Tentativo di fallback immediato su Groq
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content?.trim();
          if (text) {
            return NextResponse.json({ text, modelUsed: 'groq-llama-3.1-8b' });
          }
          lastError += ' | Groq ha risposto con testo vuoto.';
        } else {
          const errText = await res.text().catch(() => '');
          lastError += ` | Groq HTTP ${res.status}: ${errText.slice(0, 150)}`;
        }
      } catch (e: any) {
        lastError += ` | Groq eccezione: ${e?.message}`;
      }
    } else {
      lastError += ' | Nessuna GROQ_API_KEY trovata.';
    }

    console.error('Fallimento totale API AI:', lastError);
    return NextResponse.json(
      { error: `Errore AI: ${lastError}` },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore interno del server.' },
      { status: 500 }
    );
  }
}
