import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { tipo, valore } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // Diagnostica Immediata: Se Vercel non ha la chiave, ferma tutto e avvisa.
    if (!apiKey || apiKey === 'undefined') {
      return NextResponse.json(
        { error: '🚨 CHIAVE GEMINI MANCANTE: Vercel non riesce a leggere GEMINI_API_KEY.' }, 
        { status: 500 }
      );
    }

    if (!valore) {
      return NextResponse.json({ error: 'Nessun dato fornito per l\'estrazione' }, { status: 400 });
    }

    let prompt = '';
    let contents: any[] = [];

    if (tipo === 'link') {
      prompt = `Agisci come un maestro sommelier. Analizza questo URL: "${valore}". Estrai brand, nome, famiglia e note. Restituisci SOLO JSON puro (senza markdown). Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }] }];
    } else if (tipo === 'foto') {
      const base64Data = valore.split(',')[1];
      const mimeType = valore.substring(valore.indexOf(':') + 1, valore.indexOf(';'));
      prompt = `Analizza questa boccetta. Restituisci SOLO JSON puro (senza markdown). Struttura: {"nome": "...", "brand": "...", "famiglia_olfattiva": "...", "note_olfattive": "...", "prezzo_stimato_euro": "..."}`;
      contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }];
    }

    // URL Definitivo e Pulito per Gemini 1.5 Pro
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents, 
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
      })
    });

    const aiData = await response.json();
    
    if (aiData.error) {
      throw new Error(`Errore da Google: ${aiData.error.message}`);
    }
    
    if (!aiData.candidates || aiData.candidates.length === 0) {
      throw new Error("L'IA non è riuscita a generare una risposta.");
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
