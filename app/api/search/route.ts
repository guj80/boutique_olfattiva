import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('perfumes')
      .select('id, name, brand, release_year, concentration, rating_value')
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
      .limit(12);

    if (error) {
      return NextResponse.json({ results: [], error: error.message });
    }

    return NextResponse.json({ results: data || [] });
  } catch (err: any) {
    return NextResponse.json({ results: [], error: err?.message });
  }
}
