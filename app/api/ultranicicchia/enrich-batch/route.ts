// app/api/ultranicchia/enrich-batch/route.ts
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

    const { batchId, limit = 2 } = await req.json();
    if (!batchId) {
      return NextResponse.json({ error: 'batchId mancante' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
    );

    // 1. Quanti record ci sono ancora da processare?
    const { count: totalPending } = await supabaseAdmin
      .from('profumi_staging')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('stato', 'pending');

    // 2. Prendi i prossimi N record da processare
    const { data: records, error: fetchError } = await supabaseAdmin
      .from('profumi_staging')
      .select('id, brand_canonico, nome, concentrazione')
      .eq('batch_id', batchId)
      .eq('stato', 'pending')
      .limit(limit);

    if (fetchError || !records || records.length === 0) {
      return NextResponse.json({ 
        message: 'Nessun record in attesa di elaborazione.',
        processed: 0,
        remaining: 0
      });
    }

    // 3. Processiamo i record in parallelo (usando Promise.all)
    const results = await Promise.all(records.map(async (record) => {
      try {
        const query = `"${record.brand_canonico}" "${record.nome}" note profumo fragrantica parfumo`;
        const webData = await tavilySearch(query, { 
          maxResults: 3,
          includeDomains: ['fragrantica.com', 'parfumo.com', 'parfumo.net', 'basenotes.com']
        });

        if (!webData || webData.results.length === 0) {
          // Se non trova nulla, lo marchiamo come needs_review per non bloccarlo all'infinito
          await supabaseAdmin.from('profumi_staging').update({ 
            stato: 'needs_review', 
            motivo_review: ['nessuna_fonte_trovata'] 
          }).eq('id', record.id);
          return { id: record.id, status: 'not_found' };
        }

        const contextText = webData.contextText;
        const fonteUrl = webData.results[0].url;

        const prompt = `
          Sei un esperto di profumeria ultra-nicchia. Estrai i dati tecnici del profumo:
          Brand: "${record.brand_canonico}"
          Nome: "${record.nome}"
          
          Testo:
          ---
          ${contextText}
          ---

          Restituisci ESCLUSIVAMENTE un JSON con questa struttura esatta:
          { "note_testa": "..." | null, "note_cuore": "..." | null, "note_fondo": "..." | null, "naso": "..." | null, "famiglia_originale": "..." | null }
          NON INVENTARE NULLA. Se un dato non c'è, metti null.
        `;

        const aiResult = await callAIWithFallback<EnrichedData>(
          [{ text: prompt }],
          { jsonMode: true, validator: isEnrichedData, onlyGemini: true, temperature: 0.1 }
        );

        if (!aiResult.data) {
          await supabaseAdmin.from('profumi_staging').update({ 
            stato: 'needs_review', motivo_review: ['ai_estrazione_fallita'] 
          }).eq('id', record.id);
          return { id: record.id, status: 'ai_failed' };
        }

        const updatePayload: any = {
          note_testa: aiResult.data.note_testa,
          note_cuore: aiResult.data.note_cuore,
          note_fondo: aiResult.data.note_fondo,
          naso: aiResult.data.naso,
          famiglia_originale: aiResult.data.famiglia_originale,
          fonte_dettagli: [{ fonte: 'batch_web_ai', url: fonteUrl, data: new Date().toISOString() }]
        };

        // Se ha trovato le note, segna come completo. Il trigger del DB farà i controlli finali.
        if (aiResult.data.note_cuore || aiResult.data.note_fondo) {
          updatePayload.dati_completi = true;
        }

        await supabaseAdmin.from('profumi_staging').update(updatePayload).eq('id', record.id);
        return { id: record.id, status: 'success' };

      } catch (err) {
        console.error(`Errore record ${record.id}:`, err);
        await supabaseAdmin.from('profumi_staging').update({ 
          stato: 'needs_review', motivo_review: ['errore_interno_batch'] 
        }).eq('id', record.id);
        return { id: record.id, status: 'error' };
      }
    }));

    // 4. Calcola quanti ne restano
    const processedCount = results.length;
    const remaining = Math.max(0, (totalPending || 0) - processedCount);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      remaining: remaining,
      details: results
    });

  } catch (error) {
    console.error('[AtelierLG:EnrichBatch]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante il batch' },
      { status: 500 }
    );
  }
}
