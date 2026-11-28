// app/api/ultranicchia/save-candidates/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    // 1. Controllo autenticazione
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand, candidates } = await req.json();

    if (!brand || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Dati mancanti o non validi' }, { status: 400 });
    }

    // 2. Client Admin per bypassare RLS (l'utente è già loggato e verificato)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
    );

    const batchId = randomUUID();
    
    // 3. Prepariamo i record
    const recordsToInsert = candidates.map((c: any) => ({
      batch_id: batchId,
      brand_input: brand,
      brand_canonico: brand, 
      nome: c.nome,
      concentrazione: c.concentrazione || null,
      fonte_lista: 'web_search',
      fonte_dettagli: [], 
      stato: 'pending'
    }));

    // 4. Inserimento massivo
    const { data, error } = await supabaseAdmin
      .from('profumi_staging')
      .insert(recordsToInsert)
      .select('id, nome, stato, motivo_review');

    if (error) {
      console.error('[AtelierLG:SaveCandidates] Errore DB:', error);
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      batchId,
      inserted: data?.length || 0,
      records: data
    });

  } catch (error) {
    console.error('[AtelierLG:SaveCandidates]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante il salvataggio' },
      { status: 500 }
    );
  }
}
