import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { tipo, valore } = await req.json();

    if (!valore) {
      return NextResponse.json({ error: 'Nessun dato fornito' }, { status: 400 });
    }

    let prompt = '';
    let contents: any[] = [];

    if (tipo === 'link') {
      prompt = `Agisci come un maestro sommelier di profumi. Analizza questo URL: "${valore}". 
      Estrai il nome del brand e del profumo direttamente dalle parole contenute nel link. 
      Usa il tuo vasto database interno per ricavare la piramide olfattiva (Testa, Cuore, Fondo), la famiglia olfattiva e il prezzo stimato.
      Se non trovi il prezzo esatto, fai una stima realistica per la profumeria di nicchia.
      Restituisci SOLO un oggetto JSON puro senza formattazione markdown. 
      Struttura esatta: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      
      contents = [{ parts: [{ text: prompt }] }];
    } else if (tipo === 'foto') {
      const base64Data = valore.split(',')[1];
      const mimeType = valore.substring(valore.indexOf(':') + 1, valore.indexOf(';'));
      prompt = `Analizza questa boccetta di profumo. Restituisci SOLO un oggetto JSON puro senza formattazione markdown. 
      Struttura esatta: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      
      contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }];
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Manca la chiave GEMINI_API_KEY.");
    }
    
const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=" + apiKey;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents, 
        generationConfig: { 
          response_mime_type: "application/json", 
          temperature: 0.1 
        },
        // Disattiviamo i filtri di sicurezza che causano il blocco delle risposte vuote
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const aiData = await response.json();
    
    // Se l'IA è andata in errore o è stata bloccata dal server
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }
    
    if (!aiData.candidates || aiData.candidates.length === 0) {
      throw new Error("L'Intelligenza Artificiale non è riuscita a elaborare la richiesta.");
    }

    let resultText = aiData.candidates[0].content.parts[0].text;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(resultText);

    return NextResponse.json(extractedData);

  } catch (error: any) {
    console.error("Errore API Extract:", error);
    return NextResponse.json({ error: error.message || 'Elaborazione fallita' }, { status: 500 });
  }
}
