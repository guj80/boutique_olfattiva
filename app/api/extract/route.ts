import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { tipo, valore } = await req.json();

    if (!valore) {
      return NextResponse.json({ error: 'Nessun dato fornito per l\'estrazione' }, { status: 400 });
    }

    let prompt = '';
    let contents: any[] = [];

    if (tipo === 'link') {
      prompt = `Sei un esperto sommelier di profumi di lusso. Analizza questo URL o le informazioni relative a questa pagina web di profumi: "${valore}".
      Estrai le informazioni e restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza blocchi markdown di formattazione, senza testo aggiuntivo) con questa struttura esatta:
      {
        "nome": "Nome del profumo",
        "brand": "Maison o Brand",
        "famiglia_olfattiva": "Es. Legnoso Speziato, Agrumato Fiorito...",
        "note_olfattive": "Elenco note (Testa, Cuore, Fondo)",
        "prezzo_stimato_euro": "Es. 180€",
        "url_foto_vetrina": ""
      }`;
      contents = [{ parts: [{ text: prompt }] }];
    } else if (tipo === 'foto') {
      // valore è la stringa Base64 dell'immagine
      const base64Data = valore.split(',')[1];
      const mimeType = valore.substring(valore.indexOf(':') + 1, valore.indexOf(';'));

      prompt = `Analizza questa boccetta di profumo nell'immagine. Riconoscila con precisione millimetrica.
      Restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza blocchi markdown, senza testo extra) con questa struttura esatta:
      {
        "nome": "Nome del profumo",
        "brand": "Maison o Brand",
        "famiglia_olfattiva": "Es. Orientale Vanigliato...",
        "note_olfattive": "Note principali stimate",
        "prezzo_stimato_euro": "Es. 220€",
        "url_foto_vetrina": ""
      }`;

      contents = [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ];
    }

    // Chiamata diretta a Gemini 1.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const aiData = await response.json();
    
    if (!aiData.candidates || aiData.candidates.length === 0) {
      throw new Error("L'intelligenza artificiale non ha restituito una risposta valida.");
    }

    const resultText = aiData.candidates[0].content.parts[0].text;
    const extractedData = JSON.parse(resultText);

    return NextResponse.json(extractedData);

  } catch (error: any) {
    console.error("Errore API Extract:", error);
    return NextResponse.json({ error: error.message || 'Errore durante l\'estrazione AI' }, { status: 500 });
  }
}
