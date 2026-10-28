// ============================================================================
// API ROUTE: /api/perfumes — GET (search & filter) + POST (upsert from sync)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';

// POST /api/perfumes — sync via CATALOG_SOURCE_URL (upsert on id)
export async function POST(req: Request) {
  try {
    const catalogUrl = process.env.CATALOG_SOURCE_URL;
    const body = await req.json().catch(() => ({}));
    const remoteUrl = body.url || catalogUrl || process.env.CATALOG_SOURCE_URL;

    if (!remoteUrl) {
      return NextResponse.json({ error: 'CATALOG_SOURCE_URL env or body.url required' }, { status: 400 });
    }

    // Fetch remote JSON source
    const upstream = await fetch(remoteUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Failed to fetch catalog: ${upstream.status}` }, { status: 502 });
    }
    const rows = await upstream.json();

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Catalog JSON must be an array' }, { status: 400 });
    }

    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      try {
        // Transform flat record to normalized schema
        const perf = {
          name: row.nome || row.name || row.title || '',
          brand: row.brand || row.marchio || '',
          family: row.famiglia_olfattiva || row.family || '',
          concentration: row.concentrazione || row.concentration || '',
          format: row.formato_ml ? `${row.formato_ml}ml` : '',
          price_usd: row.prezzo_stimato_euro ? parseFloat(String(row.prezzo_stimato_euro).replace(/[^0-9.,]/g, '')) : null,
          image_url: row.immagine_url || row.url_foto_vetrina || row.image_url || null,
          youtube_id: row.youtube_id || null,
          description: row.descrizione_ai || row.description || null,
          source_url: row.source_url,
          confidence: row.confidence ?? 100,
          maison_id: row.maison_id || null,
        };

        if (!perf.name) continue;

        const { error: upsertError } = await supabase
          .from('perfume')
          .upsert(perf, { onConflict: 'name,brand,family,concentration,format' });

        if (upsertError) {
          errors.push(`Upsert ${perf.name}: ${upsertError.message}`);
        } else {
          row.id && (upsertError ? inserted++ : updated++);
        }
      } catch (e: any) {
        errors.push(`Row ${row.nome || row.name || '?'} ${e.message}`);
      }
    }

    // Parse embeddings if provided (vector(1536))
    // (example: if using Spotify's audio features embedding or external model)
    const embeddingData = body.embedding || process.env.CATALOG_EMBEDDING || null;
    if (embeddingData && Array.isArray(embeddingData)) {
      // Upsert embeddings separately if needed
    }

    return NextResponse.json({
      status: 'ok',
      inserted,
      updated,
      errors: errors.slice(0, 10),
      totalRows: rows.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/perfumes — filtrato
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const family = searchParams.get('family') || '';
    const note = searchParams.get('note') || '';
    const position = searchParams.get('position') || '';
    const concentration = searchParams.get('concentration') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    let query = supabase
      .from('perfume')
      .select('*', { count: 'exact', head: true })
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (q) {
      query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
    }
    if (family) query = query.eq('family', family);
    if (position) query = query.eq('position', position);
    if (concentration) query = query.eq('concentration', concentration);
    if (note) {
      query = query.or(`note_olfattive.ilike.%${note}%,note_testa.ilike.%${note}%,note_cuore.ilike.%${note}%,note_fondo.ilike.%${note}%`);
    }

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      perfumes: data || [],
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > page * limit,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
