import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STOPWORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'di',
  'da',
  'del',
  'della',
  'delle',
  'dei',
  'the',
  'by',
  'of',
  'and',
  'et',
  'pour',
  'eau',
  'parfum',
  'extrait',
]);

interface CatalogSearchResult {
  id: string;
  name: string;
  brand: string;
  release_year: number | string | null;
  concentration: string | null;
  source: 'ultranicchia' | 'catalogo';
}

function fold(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeDedupeKey(brand: string, name: string): string {
  return `${fold(brand)}::${fold(name)}`;
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('q') || '').slice(0, 80);
    const foldedQuery = fold(raw);

    // Solo [a-z0-9]: nessuna possibilità di alterare filtri PostgREST
    const tokens = foldedQuery
      .split(' ')
      .map((t) => t.slice(0, 30))
      .filter((t) => (t.length >= 2 || /^\d+$/.test(t)) && !STOPWORDS.has(t))
      .slice(0, 5);

    if (raw.trim().length < 2 || tokens.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ results: [] });

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Usa il token più lungo/specifico come ancora SQL per evitare di saturare il limite righe
    const anchorToken = [...tokens].sort((a, b) => b.length - a.length)[0];

    const [ultraRes, catalogRes] = await Promise.all([
      supabase
        .from('ultranicchia_import')
        .select('id, nome, brand, concentrazione')
        .or(`brand.ilike.%${anchorToken}%,nome.ilike.%${anchorToken}%`)
        .limit(60),
      supabase
        .from('perfumes')
        .select('id, name, brand, release_year, concentration')
        .or(`brand.ilike.%${anchorToken}%,name.ilike.%${anchorToken}%`)
        .limit(120),
    ]);

    const merged = new Map<string, CatalogSearchResult>();

    for (const row of ultraRes.data || []) {
      const brand = String(row.brand || '').trim();
      const name = String(row.nome || '').trim();
      if (!brand || !name) continue;

      const full = fold(`${brand} ${name}`);
      if (!tokens.every((t) => full.includes(t))) continue;

      const k = makeDedupeKey(brand, name);
      if (!merged.has(k)) {
        merged.set(k, {
          id: `ultra-${row.id}`,
          name,
          brand,
          release_year: null,
          concentration: row.concentrazione ? String(row.concentrazione).trim() : null,
          source: 'ultranicchia',
        });
      }
    }

    for (const row of catalogRes.data || []) {
      const brand = String(row.brand || '').trim();
      const name = String(row.name || '').trim();
      if (!brand || !name) continue;

      const full = fold(`${brand} ${name}`);
      if (!tokens.every((t) => full.includes(t))) continue;

      const k = makeDedupeKey(brand, name);
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, {
          id: `cat-${row.id}`,
          name,
          brand,
          release_year: row.release_year ?? null,
          concentration: row.concentration ? String(row.concentration).trim() : null,
          source: 'catalogo',
        });
      } else if (!existing.release_year && row.release_year) {
        existing.release_year = row.release_year;
      }
    }

    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];

    const ranked = Array.from(merged.values())
      .map((item) => {
        const fBrand = fold(item.brand);
        const fName = fold(item.name);
        const fFull = `${fBrand} ${fName}`;

        let score = 0;
        if (fFull === foldedQuery || fName === foldedQuery) score += 30;
        if (fName.startsWith(foldedQuery)) score += 16;
        if (fFull.startsWith(foldedQuery)) score += 14;
        if (fName.startsWith(firstToken) || fName.startsWith(lastToken)) score += 6;
        if (fBrand.startsWith(firstToken)) score += 5;
        if (item.source === 'ultranicchia') score += 4;

        return { item, score, len: fFull.length };
      })
      .sort((a, b) => b.score - a.score || a.len - b.len)
      .slice(0, 12)
      .map((entry) => entry.item);

    return NextResponse.json({ results: ranked });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
