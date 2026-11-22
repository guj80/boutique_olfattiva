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
]);

export interface CatalogSearchResult {
  id: string;
  rawId: string | number;
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

function canonicalConcentration(raw: unknown): string | null {
  const clean = String(raw || '').trim();
  if (!clean) return null;
  const f = fold(clean);
  if (f === 'edp' || f === 'eau de parfum') return 'Eau de Parfum';
  if (f === 'edt' || f === 'eau de toilette') return 'Eau de Toilette';
  if (f === 'edc' || f === 'eau de cologne') return 'Eau de Cologne';
  if (f === 'extrait' || f === 'extrait de parfum' || f === 'pure perfume') {
    return 'Extrait de Parfum';
  }
  if (f === 'parfum') return 'Parfum';
  if (f === 'elixir') return 'Elixir';
  return clean;
}

function concentrationKey(conc: string | null): string {
  if (!conc) return 'std';
  const f = fold(conc);
  if (f.includes('extrait')) return 'extrait';
  if (f.includes('elixir')) return 'elixir';
  if (f.includes('parfum') && !f.includes('eau')) return 'parfum';
  if (f.includes('eau de parfum') || f === 'edp') return 'edp';
  if (f.includes('eau de toilette') || f === 'edt') return 'edt';
  if (f.includes('cologne') || f === 'edc') return 'edc';
  return f;
}

function makeVariantDedupeKey(brand: string, name: string, conc: string | null): string {
  return `${fold(brand)}::${fold(name)}::${concentrationKey(conc)}`;
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get('q') || '').slice(0, 80);
    const foldedQuery = fold(raw);

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

    const anchorToken = [...tokens].sort((a, b) => b.length - a.length)[0];

    const [ultraRes, catalogRes] = await Promise.all([
      supabase
        .from('ultranicchia_import')
        .select('id, nome, brand, concentrazione')
        .or(`brand.ilike.%${anchorToken}%,nome.ilike.%${anchorToken}%`)
        .limit(80),
      supabase
        .from('perfumes')
        .select('id, name, brand, release_year, concentration')
        .or(`brand.ilike.%${anchorToken}%,name.ilike.%${anchorToken}%`)
        .limit(150),
    ]);

    const merged = new Map<string, CatalogSearchResult>();

    for (const row of ultraRes.data || []) {
      const brand = String(row.brand || '').trim();
      const name = String(row.nome || '').trim();
      if (!brand || !name) continue;

      const conc = canonicalConcentration(row.concentrazione);
      const searchable = fold(`${brand} ${name} ${conc || ''}`);
      if (!tokens.every((t) => searchable.includes(t))) continue;

      const k = makeVariantDedupeKey(brand, name, conc);
      if (!merged.has(k)) {
        merged.set(k, {
          id: `ultra-${row.id}`,
          rawId: row.id,
          name,
          brand,
          release_year: null,
          concentration: conc,
          source: 'ultranicchia',
        });
      }
    }

    for (const row of catalogRes.data || []) {
      const brand = String(row.brand || '').trim();
      const name = String(row.name || '').trim();
      if (!brand || !name) continue;

      const conc = canonicalConcentration(row.concentration);
      const searchable = fold(`${brand} ${name} ${conc || ''}`);
      if (!tokens.every((t) => searchable.includes(t))) continue;

      const k = makeVariantDedupeKey(brand, name, conc);
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, {
          id: `cat-${row.id}`,
          rawId: row.id,
          name,
          brand,
          release_year: row.release_year ?? null,
          concentration: conc,
          source: 'catalogo',
        });
      } else {
        if (!existing.release_year && row.release_year) {
          existing.release_year = row.release_year;
        }
        if (!existing.concentration && conc) {
          existing.concentration = conc;
        }
      }
    }

    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];

    const ranked = Array.from(merged.values())
      .map((item) => {
        const fBrand = fold(item.brand);
        const fName = fold(item.name);
        const fConc = fold(item.concentration || '');
        const fFull = `${fBrand} ${fName} ${fConc}`.trim();

        let score = 0;
        if (`${fBrand} ${fName}` === foldedQuery || fName === foldedQuery) score += 30;
        if (fFull === foldedQuery) score += 35;
        if (fName.startsWith(foldedQuery)) score += 16;
        if (fFull.startsWith(foldedQuery)) score += 14;
        if (fName.startsWith(firstToken) || fName.startsWith(lastToken)) score += 6;
        if (fBrand.startsWith(firstToken)) score += 5;
        if (item.source === 'ultranicchia') score += 4;

        return { item, score, len: fFull.length };
      })
      .sort((a, b) => b.score - a.score || a.len - b.len)
      .slice(0, 15)
      .map((entry) => entry.item);

    return NextResponse.json({ results: ranked });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
