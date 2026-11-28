// app/api/ultranicchia/enrich/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';
import { createClient } from '@supabase/supabase-js';

interface EnrichedData {
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  naso: string | null;
  famiglia_originale: string | null;
}

// Type Guard rigoroso per TypeScript
function isEnrichedData(data: unknown): data is EnrichedData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const isValidField = (val: unknown) => val === null || typeof val === 'string';
  return (
    isValidField(d.note_testa) &&
    isValidField(d.note_cuore) &&
    isValidField(d.note_fondo) &&
    isValidField(d.naso) &&
    isValidField(d.famiglia_originale)
  );
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { stagingId } = await req.json();
    if (!stagingId) {
      return NextResponse.json({ error: 'stagingId mancante' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
    );

    // 1. Recupera il record in staging
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('profumi_staging')
      .select('brand_canonico, nome, concentrazione')
      .eq('id', stagingId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record non trovato' }, { status: 404 });
    }

    // 2. Ricerca Web mirata (usiamo query specifiche per Fragrantica/Parfumo/Sito)
    const query = `"${record.brand_canonico}" "${record.nome}" note profumo fragrantica parfumo`;
    const webData = await tavilySearch(query, { 
      maxResults: 3,
      includeDomains: ['fragrantica.com', 'parfumo.com', 'parfumo.net', 'basenotes.com'] // Limitiamo ai siti affidabili
    });

    if (!webData || webData.results.length === 0) {
      return NextResponse.json({ 
        error: 'Nessuna fonte web affidabile trovata per questo profumo. Dati lasciati null.',
        updated: false 
      });
    }

    const contextText = webData.contextText;
    const fonteUrl = webData.results[0].url; // Salviamo l'URL principale della fonte

    // 3. Estrazione AI con regole ferree
    const prompt = `
      Sei un esperto di profumeria ultra-nicchia. Il tuo compito è estrarre i dati tecnici del profumo:
      Brand: "${record.brand_canonico}"
      Nome: "${record.nome}"

      Ecco il testo estratto dalla ricerca web:
      ---
      ${contextText}
      ---

      ISTRUZIONI TASSATIVE:
      1. Estrai le note di testa, cuore e fondo. Se una nota non è esplicitamente menzionata, restituisci null.
      2. Estrai il naso (perfumer). Se non c'è, restituisci null.
      3. Estrai la famiglia olfattiva (es. "Ambrata", "Legnosa"). Se non c'è, restituisci null.
      4. NON INVENTARE NULLA. Se un dato non è nel testo, deve essere null.
      5. Restituisci ESCLUSIVAMENTE un oggetto JSON con questa struttura:
         { 
           "note_testa": "Nota1, Nota2" | null, 
           "note_cuore": "Nota1, Nota2" | null, 
           "note_fondo": "Nota1, Nota2" | null, 
           "naso": "Nome" | null, 
           "famiglia_originale": "Famiglia" | null 
         }
    `;

    const aiResult = await callAIWithFallback<EnrichedData>(
      [{ text: prompt }],
      { 
        jsonMode: true, 
        validator: isEnrichedData,
        onlyGemini: true, 
        temperature: 0.1 
      }
    );

    if (!aiResult.data) {
      return NextResponse.json({ error: 'L\'AI non ha restituito dati validi.' }, { status: 500 });
    }

    const enriched = aiResult.data;

    // 4. Prepariamo il payload per l'aggiornamento
    const updatePayload: any = {
      note_testa: enriched.note_testa,
      note_cuore: enriched.note_cuore,
      note_fondo: enriched.note_fondo,
      naso: enriched.naso,
      famiglia_originale: enriched.famiglia_originale,
      fonte_dettagli: [
        {
          fonte: 'web_search_ai',
          url: fonteUrl,
          data_estrazione: new Date().toISOString()
        }
      ]
    };

    // Se almeno un campo è stato trovato, consideriamo i dati "completi" (verrà comunque validato dal DB)
    if (enriched.note_cuore || enriched.note_fondo || enriched.note_testa) {
      updatePayload.dati_completi = true;
    }

    // 5. Aggiornamento del record in staging (scatterà il trigger di validazione)
    const { error: updateError } = await supabaseAdmin
      .from('profumi_staging')
      .update(updatePayload)
      .eq('id', stagingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      updated: true,
      data: enriched,
      fonte: fonteUrl
    });

  } catch (error) {
    console.error('[AtelierLG:Enrich]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante l\'arricchimento' },
      { status: 500 }
    );
  }
}
