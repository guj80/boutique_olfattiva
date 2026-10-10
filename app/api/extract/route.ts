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
      prompt = `Sei un maestro sommelier. Estrai le informazioni da questo URL: "${valore}". Restituisci SOLO un oggetto JSON puro senza formattazione markdown. Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }] }];
    } else if (tipo === 'foto') {
      const base64Data = valore.split(',')[1];
      const mimeType = valore.substring(valore.indexOf(':') + 1, valore.indexOf(';'));
      prompt = `Analizza questa boccetta. Restituisci SOLO un oggetto JSON puro senza formattazione markdown. Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }];
    }

    // Costruzione URL indistruttibile senza backticks problematici
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Manca la chiave GEMINI_API_KEY nelle impostazioni di Vercel.");
    }
    
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { response_mime_type: "application/json", temperature: 0.2 } })
    });

    const aiData = await response.json();
    
    if (!aiData.candidates || aiData.candidates.length === 0) {
      throw new Error("L'Intelligenza Artificiale non ha riconosciuto il profumo.");
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
