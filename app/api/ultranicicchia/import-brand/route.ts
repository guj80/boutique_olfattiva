// app/api/ultranicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

// Timeout di sicurezza (lascia 3 secondi a Vercel per chiudere la connessione)
const BUDGET_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(req: Request) {
  const t0 = Date.now();
  
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    if (!brand || typeof brand !== 'string') {
      return NextResponse.json({ error: 'Brand mancante o non valido' }, { status: 400 });
    }

    // =====================================================================
    // 1. RICERCA WEB AGGRESSIVA (Tavily)
    // Cerchiamo frammenti di catalogo ovunque: sito, fragrantica, parfumo, shop
    // =====================================================================
    const searchQuery = `"${brand}" fragrance list OR catalog OR "linea profumi" OR "collection" site:fragrantica.com OR site:parfumo.com OR site:basenotes.com OR site:instagram.com OR "profumeria"`;
    
    const webJob = tavilySearch(searchQuery, { 
      maxResults: 6,
      timeoutMs: 3500 // Se Tavily è lento, lo abbandoniamo
    }).catch(() => null);

    const webData = await withTimeout(webJob, 3800, null);
    let webContext = webData?.contextText || '';

    // Se Tavily non trova nulla (tipico per brand nuovi), facciamo una ricerca più larga
    if (!webContext) {
      const fallbackSearch = await withTimeout(
        tavilySearch(`"${brand}" perfume notes fragrantica`, { maxResults: 5, timeoutMs: 2500 }).catch(() => null),
        2800,
        null
      );
      webContext = fallbackSearch?.contextText || '';
    }

    // =====================================================================
    // 2. ESTRAZIONE AI CON DOPPIO BINARIO
    // Se abbiamo testo (Tavily), lo usiamo. Se non abbiamo nulla, usiamo Google Search.
    // =====================================================================
    
    // Prompt chirurgico per l'estrazione
    const prompt = `
      Sei un esperto di profumeria di nicchia. Il tuo compito è estrarre l'elenco COMPLETO dei profumi del brand "${brand}".
      
      ${webContext ? `Ecco il testo estratto dal web:\n---\n${webContext.slice(0, 4000)}\n---` : 'Nessun testo web fornito.'}

      ISTRUZIONI TASSATIVE:
      1. Estrai TUTTI i nomi delle fragranze prodotte da questo brand.
      2. Se trovi la concentrazione (es. Extrait, EDP, Parfum), includila.
      3. NON INVENTARE NULLA. Se trovi solo frammenti, estrai quelli.
      4. Restituisci ESCLUSIVAMENTE un array JSON valido con questa struttura:
         [ { "nome": "Nome Profumo", "concentrazione": "Extrait de Parfum" } ]
      5. Se non trovi NESSUN profumo, restituisci esattamente: []
    `;

    const remainingTime = Math.max(2000, (t0 + BUDGET_MS) - Date.now());
    
    // Usiamo Gemini. Se non c'è contesto web, attiviamo Google Search per farlo cercare in tempo reale.
    const aiJob = callGeminiWithFallback(
      [{ text: prompt }],
      {
        temperature: 0.1,
        jsonMode: true,
        useGoogleSearch: !webContext, // Se webContext è vuoto, fallo cercare su Google
        onlyGemini: true,
        timeoutMs: Math.min(5000, remainingTime),
        deadline: t0 + BUDGET_MS,
      }
    );

    const aiResult = await aiJob;
    
    let parsed: any = [];
    try {
      parsed = extractJsonFromAiText(aiResult.text);
    } catch {
      // Se il parsing fallisce, proviamo a recuperare qualcosa
      parsed = [];
    }

    // =====================================================================
    // 3. NORMALIZZAZIONE E OUTPUT
    // =====================================================================
    let candidates: any[] = [];
    
    if (Array.isArray(parsed)) {
      candidates = parsed.filter((c: any) => c && typeof c.nome === 'string' && c.nome.trim().length > 1);
    } else if (parsed && typeof parsed === 'object') {
      // Fallback se l'AI restituisce { "profumi": [...] }
      const firstArray = Object.values(parsed).find(Array.isArray);
      if (firstArray) {
        candidates = (firstArray as any[]).filter((c: any) => c && typeof c.nome === 'string' && c.nome.trim().length > 1);
      }
    }

    // Rimuoviamo i duplicati
    const uniqueCandidates = Array.from(new Set(candidates.map(c => JSON.stringify(c)))).map(s => JSON.parse(s));

    if (uniqueCandidates.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun catalogo trovato. Prova a incollare il link di un post o del sito ufficiale.',
        candidates: [] 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      brand, 
      candidates: uniqueCandidates 
    });

  } catch (error: any) {
    console.error('[AtelierLG:ImportBrand]', error);
    return NextResponse.json(
      { error: 'Timeout o errore di rete. Riprova.' },
      { status: 500 }
    );
  }
}
