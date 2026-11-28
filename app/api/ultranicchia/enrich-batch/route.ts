// app/api/ultranicicchia/enrich-batch/route.ts
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

    const { batchId, limit = 3 } = await req.json();
    if (!batchId) {
      return NextResponse.json({ error: 'batchId mancante' }, { status: 400 });
    }

    const safeLimit = Math.max(1, Math.min(4, Number(limit) || 3));
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { count: totalPending } = await supabaseAdmin
      .from('profumi_staging')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('stato', 'pending');

    const { data: records, error: fetchError } = await supabaseAdmin
      .from('profumi_staging')
      .select('id, brand_canonico, nome')
      .eq('batch_id', batchId)
      .eq('stato', 'pending')
      .limit(safeLimit);

    if (fetchError || !records || records.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun record in attesa di elaborazione.',
        processed: 0,
        remaining: 0,
      });
    }

    const details = await Promise.all(
      records.map(async (record) => {
        try {
          const result = await enrichStagingPerfume(
            record.brand_canonico,
            record.nome,
            'batch_web_ai'
          );
          await supabaseAdmin
            .from('profumi_staging')
            .update(result.updatePayload)
            .eq('id', record.id);
          return { id: record.id, status: result.status };
        } catch (err) {
          console.error(`Errore record ${record.id}:`, err);
          await supabaseAdmin
            .from('profumi_staging')
            .update({ stato: 'needs_review', motivo_review: ['errore_interno_batch'] })
            .eq('id', record.id);
          return { id: record.id, status: 'error' };
        }
      })
    );

    return NextResponse.json({
      success: true,
      processed: details.length,
      remaining: Math.max(0, (totalPending || 0) - details.length),
      details,
    });
  } catch (error) {
    console.error('[AtelierLG:EnrichBatch]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante il batch' },
      { status: 500 }
    );
  }
}
