import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Chiave API Gemini non configurata sul server.' },
      { status: 500 }
    );
  }

  try {
    const { image, mimeType } = await req.json();

    if (!image || !mimeType) {
      return NextResponse.json(
        { error: 'Immagine o formato mancante.' },
        { status: 400 }
      );
    }

    const prompt = `Sei un esperto profumiere di lusso. Analizza questa immagine di un flacone di profumo.
Estrai le seguenti informazioni e restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza markdown, senza testo aggiuntivo, senza virgolette esterne) con queste chiavi esatte:
- "nome": il nome del profumo
- "brand": la marca/casa del profumo
- "famiglia_olfattiva": la famiglia olfattiva principale (es. Floreale, Legnoso, Orientale, Agrumato, Chypre, Fougère, Gourmand)
- "prezzo_stimato_euro": una stima del prezzo di mercato in euro (come stringa, es. "120€" o "N/D" se non stimabile)

Se l'immagine non contiene un flacone di profumo riconoscibile, restituisci:
{"nome": "Non riconosciuto", "brand": "Non riconosciuto", "famiglia_olfattiva": "N/D", "prezzo_stimato_euro": "N/D"}

Rispondi SOLO con il JSON, nessun'altra parola.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return NextResponse.json(
        { error: 'Errore durante l\'analisi dell\'immagine.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: 'Nessuna risposta valida dall\'IA.' },
        { status: 500 }
      );
    }

    let parsed: { nome: string; brand: string; famiglia_olfattiva: string; prezzo_stimato_euro: string };

    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: 'Formato risposta IA non valido.' },
          { status: 500 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    return NextResponse.json({
      nome: parsed.nome || 'Non riconosciuto',
      brand: parsed.brand || 'Non riconosciuto',
      famiglia_olfattiva: parsed.famiglia_olfattiva || 'N/D',
      prezzo_stimato_euro: parsed.prezzo_stimato_euro || 'N/D',
    });
  } catch (err) {
    console.error('Gemini route error:', err);
    return NextResponse.json(
      { error: 'Errore imprevisto durante l\'analisi.' },
      { status: 500 }
    );
  }
}
