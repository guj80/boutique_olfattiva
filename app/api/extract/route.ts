import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { tipo, valore } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Chiave API Google mancante in Vercel.' }, { status: 500 });
    }

    let prompt = '';
    let contents: any[] = [];
    let modelName = ''; // Assegniamo il modello in base al tipo

    if (tipo === 'link') {
      modelName = 'gemini-pro'; // Modello universale testo
      prompt = `Estrai i dati da questo link: "${valore}". Restituisci SOLO un JSON puro. Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }] }];
    } else if (tipo === 'foto') {
      modelName = 'gemini-pro-vision'; // Modello universale immagini
      const base64Data = valore.split(',')[1];
      const mimeType = valore.substring(valore.indexOf(':') + 1, valore.indexOf(';'));
      prompt = `Analizza questa foto di un profumo. Restituisci SOLO un JSON puro. Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }];
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents, 
        generationConfig: { temperature: 0.1 }
      })
    });

    const aiData = await response.json();
    
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    let resultText = aiData.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(resultText);

    return NextResponse.json(extractedData);

  } catch (error: any) {
    console.error("Errore Extract:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
