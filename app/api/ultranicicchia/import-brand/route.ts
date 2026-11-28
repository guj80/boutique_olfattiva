// app/api/ultranicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';

export const maxDuration = 10; // Limite Vercel Hobby
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    if (!brand || typeof brand !== 'string') {
      return NextResponse.json({ error: 'Brand mancante o non valido' }, { status: 400 });
    }

    // 1. Ricerca Web più mirata e veloce
    const searchQuery = `"${brand}" perfume site:fragrantica.com OR site:parfumo.com OR site:basenotes.com`;
    const webData = await tavilySearch(searchQuery, { maxResults: 3, timeoutMs: 4000 });

    // Limitiamo il testo a 3000 caratteri per non far perdere tempo all'AI
    const contextText = (webData?.contextText || '').slice(0, 3000);

    // 2. Prompt stringato
    const prompt = `
      Estrai l'elenco dei profumi del brand "${brand}".
      Testo di riferimento:
      ---
      ${contextText || 'Nessun testo.'}
      ---
      REGOLE:
      1. Estrai solo i nomi dei profumi del brand.
      2. NON INVENTARE NULLA. Se non trovi nomi, restituisci [].
      3. Formato: [ { "nome": "Nome", "concentrazione": "Extrait" } ]
    `;

    // 3. Chiamata AI con timeout di sicurezza stretto (max 4s per modello, 7s totali)
    const aiResult = await callAIWithFallback<Array<{ nome: string; concentrazione: string | null }>>(
      [{ text: prompt }],
      { 
        jsonMode: true, 
        validator: (data): data is Array<{ nome: string; concentrazione: string | null }> => {
          if (!Array.isArray(data)) return false;
          return data.every((d: any) => d && typeof d === 'object' && typeof d.nome === 'string');
        },
        onlyGemini: true,
        temperature: 0.1,
        timeoutMs: 4000, 
        deadline: Date.now() + 7000 // Muore prima che Vercel lo uccida a 10s
      }
    );

    if (!aiResult.data || aiResult.data.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun profumo trovato. Prova a cercare un altro brand.',
        candidates: [] 
      }, { status: 404 });
    }

    return NextResponse.json({ brand, candidates: aiResult.data });

  } catch (error: any) {
    console.error('[AtelierLG:ImportBrand]', error);
    return NextResponse.json(
      { error: error.message || 'Errore o timeout durante la ricerca del brand. Riprova.' },
      { status: 500 }
    );
  }
}
