// app/api/ultranicicchia/enrich/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { enrichStagingPerfume } from '@/lib/ultranicchia-enrich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

    const { data: record, error: fetchError } = await supabaseAdmin
      .from('profumi_staging')
      .select('brand_canonico, nome')
      .eq('id', stagingId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record non trovato' }, { status: 404 });
    }

    const result = await enrichStagingPerfume(
      record.brand_canonico,
      record.nome,
      'web_search_ai'
    );

    const { error: updateError } = await supabaseAdmin
      .from('profumi_staging')
      .update(result.updatePayload)
      .eq('id', stagingId);

    if (updateError) throw new Error(updateError.message);

    if (result.status !== 'success') {
      return NextResponse.json({
        updated: false,
        error:
          result.status === 'not_found'
            ? 'Nessuna fonte web trovata per questo profumo.'
            : "L'AI non ha restituito dati validi.",
      });
    }

    return NextResponse.json({
      success: true,
      updated: true,
      data: result.data,
      fonte: result.fonteUrl,
    });
  } catch (error) {
    console.error('[AtelierLG:Enrich]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante l'arricchimento" },
      { status: 500 }
    );
  }
}
