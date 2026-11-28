// app/api/ultranicicchia/save-candidates/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand, candidates } = await req.json();
    const cleanBrand = typeof brand === 'string' ? brand.trim() : '';

    if (!cleanBrand || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Dati mancanti o non validi' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Controlla duplicati già presenti in staging o nel catalogo globale
    const [existingStaging, existingGlobal] = await Promise.all([
      supabaseAdmin
        .from('profumi_staging')
        .select('nome')
        .ilike('brand_canonico', cleanBrand),
      supabaseAdmin
        .from('ultranicchia_import')
        .select('nome')
        .ilike('brand', cleanBrand),
    ]);

    const existingSet = new Set<string>([
      ...(existingStaging.data || []).map((r: any) => normKey(r.nome)),
      ...(existingGlobal.data || []).map((r: any) => normKey(r.nome)),
    ]);

    const batchId = randomUUID();
    const seenInPayload = new Set<string>();
    const recordsToInsert: any[] = [];

    for (const c of candidates) {
      const nome = typeof c?.nome === 'string' ? c.nome.trim() : '';
      if (!nome) continue;
      const key = normKey(nome);
      if (existingSet.has(key) || seenInPayload.has(key)) continue;
      seenInPayload.add(key);

      recordsToInsert.push({
        batch_id: batchId,
        brand_input: cleanBrand,
        brand_canonico: cleanBrand,
        nome,
        concentrazione:
          typeof c?.concentrazione === 'string' && c.concentrazione.trim()
            ? c.concentrazione.trim()
            : null,
        fonte_lista: 'web_search',
        fonte_dettagli: [],
        stato: 'pending',
      });
    }

    if (recordsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        batchId: null,
        inserted: 0,
        skipped: candidates.length,
        records: [],
        message: 'Tutte le fragranze selezionate sono già presenti in bozze o in archivio.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('profumi_staging')
      .insert(recordsToInsert)
      .select('id, nome, stato, motivo_review');

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      batchId,
      inserted: data?.length || 0,
      skipped: candidates.length - recordsToInsert.length,
      records: data,
    });
  } catch (error) {
    console.error('[AtelierLG:SaveCandidates]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante il salvataggio' },
      { status: 500 }
    );
  }
}
