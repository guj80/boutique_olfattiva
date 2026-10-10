import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // 1. Scarichiamo l'intero catalogo per farlo leggere all'AI
    const { data: profumi, error } = await supabase
      .from('profumi')
      .select('id, nome, brand, famiglia_olfattiva, note_olfattive, info_fragrantica');

    if (error || !profumi) {
      throw new Error("Errore nel recupero dati da Supabase");
    }

    // Se l'utente clicca "Reset" o cerca a vuoto, restituiamo tutti gli ID
    if (!query || query.trim() === '') {
      return NextResponse.json({ ids: profumi.map(p => p.id) });
    }

    // 2. Prepariamo il prompt rigido per Gemini
    const prompt = `Sei un esperto sommelier di profumi. Un utente ti fa questa richiesta: "${query}".
    Ecco il catalogo disponibile in formato JSON:
    ${JSON.stringify(profumi)}
    
    Analizza le note olfattive, la famiglia e le info. Restituisci ESCLUSIVAMENTE un array JSON contenente solo gli "id" (stringhe) dei profumi che corrispondono alla richiesta. Nessuna formattazione markdown, nessun testo di spiegazione. Solo l'array. Esempio: ["id1", "id2"]`;

    // 3. Interroghiamo Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const aiData = await response.json();
    const resultText = aiData.candidates[0].content.parts[0].text;
    
    // Puliamo la risposta e la trasformiamo in Array
    const matchedIds = JSON.parse(resultText);

    return NextResponse.json({ ids: matchedIds });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore durante l\'analisi AI' }, { status: 500 });
  }
}
