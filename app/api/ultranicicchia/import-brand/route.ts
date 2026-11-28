// app/api/ultranicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callAIWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';

export const maxDuration = 15; // Se il tuo piano Vercel lo permette, altrimenti si adatta
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    if (!brand || typeof brand !== 'string') {
      return NextResponse.json({ error: 'Brand mancante o non valido' }, { status: 400 });
    }

    // Usiamo Google Search Grounding nativo di Gemini (come fai nel tuo extract)
    // Bypassiamo Tavily per evitare latenze inutili
    const prompt = `
      Trova l'elenco di TUTTI i profumi del brand "${brand}".
      Restituisci solo un array JSON con questa struttura:
      [ { "nome": "Nome del profumo", "concentrazione": "Extrait de Parfum" } ]
      Se non trovi nessun profumo per questo brand, restituisci un array vuoto: [].
      NON INVENTARE NULLA. Usa solo i dati reali che trovi sul web.
    `;

    // Chiamiamo il tuo motore con i tempi ristretti per evitare il timeout di Vercel
    const aiResult = await callAIWithFallback(
      [{ text: prompt }],
      { 
        useGoogleSearch: true, // <--- IL SEGRETO È QUI
        onlyGemini: true,
        temperature: 0.1,
        timeoutMs: 5000, 
        deadline: Date.now() + 8500 // Ci fermiamo prima che Vercel ci uccida a 10s
      }
    );

    let parsed: any = [];
    try {
      parsed = extractJsonFromAiText(aiResult.text);
    } catch {
      return NextResponse.json({ error: 'L\'AI non ha restituito un elenco valido. Riprova.' }, { status: 500 });
    }

    // Pulizia e validazione del risultato
    let candidates: any[] = [];
    
    if (Array.isArray(parsed)) {
      candidates = parsed.filter(c => c && typeof c.nome === 'string');
    } else if (parsed && typeof parsed === 'object') {
      // Se l'AI ha restituito un oggetto (es. { "profumi": [...] })
      const firstArray = Object.values(parsed).find(Array.isArray);
      if (firstArray) {
        candidates = firstArray.filter((c: any) => c && typeof c.nome === 'string');
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun profumo trovato. Prova con un brand più noto o controlla il nome.',
        candidates: [] 
      }, { status: 404 });
    }

    return NextResponse.json({ brand, candidates });

  } catch (error: any) {
    console.error('[AtelierLG:ImportBrand]', error);
    return NextResponse.json(
      { error: error.message || 'Errore o timeout durante la ricerca. Riprova.' },
      { status: 500 }
    );
  }
}
