import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOPWORDS = ['de', 'du', 'des', 'la', 'le', 'les', 'di', 'da', 'del', 'the', 'by', 'of', 'and', 'et', 'pour'];

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('q') || '').slice(0, 80);

    // Solo [a-z0-9]: il testo dell'utente non può mai alterare il filtro PostgREST.
    const tokens = fold(raw)
      .split(' ')
      .map((t) => t.slice(0, 30))
      .filter((t) => (t.length >= 2 || /^\d$/.test(t)) && STOPWORDS.indexOf(t) === -1)
      .slice(0, 4);

    if (raw.trim().length < 2 || tokens.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ results: [] });

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    let q = supabase
      .from('perfumes')
      .select('id, name, brand, release_year, concentration')
      .limit(40);
    for (const t of tokens) {
      q = q.or(`brand.ilike.%${t}%,name.ilike.%${t}%`);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ results: [] });

    const last = tokens[tokens.length - 1];
    const ranked = (data || [])
      .map((r: any) => {
        const full = fold(`${r.brand || ''} ${r.name || ''}`);
        const name = fold(r.name || '');
        let score = 0;
        if (tokens.every((t) => full.indexOf(t) !== -1)) score += 10;
        if (name.indexOf(last) === 0) score += 3;
        if (fold(r.brand || '').indexOf(tokens[0]) === 0) score += 2;
        return { r, score, len: full.length };
      })
      .sort((a: any, b: any) => b.score - a.score || a.len - b.len)
      .slice(0, 8)
      .map((x: any) => x.r);

    return NextResponse.json({ results: ranked });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
