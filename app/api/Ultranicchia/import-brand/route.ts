// app/api/ultranicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';

export async function POST(req: Request) {
  try {
    // 1. Controllo autenticazione
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    if (!brand || typeof brand !== 'string') {
      return NextResponse.json({ error: 'Brand mancante o non valido' }, { status: 400 });
    }

    // 2. Ricerca Web (Tavily) per trovare il sito ufficiale o pagine di elenco
    const searchQuery = `site:${brand.replace(/\s+/g, '')}.com OR "catalogo profumi ${brand}" OR "perfumes ${brand}"`;
    const webData = await tavilySearch(searchQuery, { maxResults: 3 });

    // Se non trova nulla, proviamo una ricerca più generica
    const finalWebData = webData || await tavilySearch(`profumi ${brand} fragranze`, { maxResults: 3 });
    const contextText = finalWebData?.contextText || 'Nessun risultato web trovato.';

    // 3. Estrazione AI
    const prompt = `
      Sei un esperto di profumeria. Il tuo compito è estrarre l'elenco dei profumi del brand "${brand}".
      
      Ecco il testo estratto dalla ricerca web:
      ---
      ${contextText}
      ---

      ISTRUZIONI TASSATIVE:
      1. Estrai TUTTI i nomi dei profumi che riesci a trovare associati a questo brand.
      2. Se trovi la concentrazione (es. Extrait, EDP) o il formato, includili.
      3. NON INVENTARE NULLA. Se un profumo non è menzionato nel testo, non scriverlo.
      4. Restituisci un JSON array di oggetti con questa struttura esatta:
         [ { "nome": "Nome Profumo", "concentrazione": "Extrait de Parfum" } ]
    `;

    const aiResult = await callAIWithFallback<Array<{ nome: string; concentrazione: string | null }>>(
      [{ text: prompt }],
      { 
        jsonMode: true, 
        validator: (data) => Array.isArray(data) && data.every(d => typeof d.nome === 'string'),
        onlyGemini: true, // Usiamo solo Gemini per evitare che Groq/OpenRouter allucinino
        temperature: 0.1 
      }
    );

    if (!aiResult.data || aiResult.data.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun profumo trovato per questo brand nelle fonti online.',
        candidates: [] 
      }, { status: 404 });
    }

    // 4. Restituiamo i candidati al frontend per la selezione
    return NextResponse.json({
      brand,
      candidates: aiResult.data,
      providerUsed: aiResult.providerUsed
    });

  } catch (error) {
    console.error('[AtelierLG:ImportBrand]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante la ricerca del brand' },
      { status: 500 }
    );
  }
}
