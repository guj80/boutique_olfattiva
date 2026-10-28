// ============================================================================
// API ROUTE: /api/perfumes/[id] — GET (detail + conferma)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/perfumes/[id] — dettaglio completo del profumo
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // 1. Fetch primary perfume record
    const { data: perfume, error: perfumeError } = await supabase
      .from('perfume')
      .select('*')
      .eq('id', id)
      .single();

    if (perfumeError || !perfume) {
      return NextResponse.json({ error: 'Perfume not found' }, { status: 404 });
    }

    // 2. Fetch notes via perfume_note bridge
    const { data: perfumeNotes, error: pnError } = await supabase
      .from('perfume_note')
      .select('note_id, layer, strength')
      .eq('perfume_id', id);

    if (pnError || !perfumeNotes) {
      console.error('[getPerfumeNote] error:', pnError);
      return NextResponse.json({ error: 'Failed to load perfume notes' }, { status: 500 });
    }

    // 3. Fetch note details
    const noteIds = [...new Set(perfumeNotes.map((pn: any) => pn.note_id))];
    const { data: notes, error: notesError } = await supabase
      .from('note')
      .select('*')
      .in('id', noteIds)
      .order('family');

    // 4. Fetch maison info
    const { data: maison, error: maisonError } = await supabase
      .from('maison')
      .select('*')
      .eq('id', perfume.maison_id)
      .single();



    // 5. Fetch accords for this perfume (optional)
    const { data: accords, error: accordsError } = await supabase
      .from('accord')
      .select('*')
      .or(`note_a_id.eq.${id},note_b_id.eq.${id}`)
      .limit(50);
    const prices = (perfume as any).prices || [] as number[];
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

    const result = {
      perfume: {
        id: perfume.id,
        name: perfume.name,
        brand: perfume.brand,
        maisonId: perfume.maison_id,
        family: perfume.family,
        concentration: perfume.concentration,
        format: perfume.format,
        priceUsd: perfume.price_usd,
        imageUrl: perfume.image_url,
        youtubeId: perfume.youtube_id,
        description: perfume.description,
        sourceUrl: perfume.source_url,
        confidence: perfume.confidence,
        createdAt: perfume.created_at,
        updatedAt: perfume.updated_at,
        prices: prices,
        minPrice,
        maxPrice,
      },
      notes: notes || [],
      accords: accords || [],
      maison: maison || null,
      perfumeNotes: perfumeNotes || [],
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
