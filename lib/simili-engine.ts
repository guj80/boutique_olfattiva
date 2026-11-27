// lib/simili-engine.ts
// Motore "profumi simili" sul catalogo reale `perfumes`.
// Nessun profumo viene inventato: ogni risultato è una riga del catalogo e
// ogni motivazione è calcolata dai dati (accordi e note in comune).
import cooc from '@/public/data/note-cooccurrence.json';
import { formatPerfumeNote } from '@/lib/dictionary';

export type SimiliMode = 'vicino' | 'sorprendimi';

export interface CatalogRow {
  id: number | string;
  name: string | null;
  brand: string | null;
  release_year?: number | null;
  concentration?: string | null;
  rating_value?: number | null;
  rating_count?: number | null;
  main_accords?: string | null;
  top_notes?: string | null;
  middle_notes?: string | null;
  base_notes?: string | null;
  perfumers?: string | null;
  url?: string | null;
}

export interface SimiliResult {
  brand: string;
  nome: string;
  concentrazione: string | null;
  anno: number | null;
  naso: string | null;
  url: string | null;
  famiglia_raw: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  motivo: string;
  punteggio: number;
}

/* ------------------------------------------------------------------ */
/* Normalizzazione                                                     */
/* ------------------------------------------------------------------ */

export function fold(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'&.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS = new Map<string, string>();
for (const pair of (cooc as { aliases: string[][] }).aliases || []) {
  if (pair.length >= 2) for (const v of pair.slice(1)) ALIAS.set(fold(v), fold(pair[0]));
}

export function parseList(raw?: string | null): string[] {
  if (!raw) return [];
  let items: string[];
  const t = String(raw).trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    try {
      const parsed = JSON.parse(t);
      items = Array.isArray(parsed) ? parsed.map(String) : [t];
    } catch {
      items = t.split(/[,;|\n]+/);
    }
  } else {
    items = t.split(/[,;|\n]+/);
  }
  const out: string[] = [];
  for (const it of items) {
    let f = fold(it);
    f = ALIAS.get(f) || f;
    if (f.length >= 2 && f.length <= 40 && !out.includes(f)) out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Parentela tra note (dal file di co-occorrenza + gruppi)             */
/* ------------------------------------------------------------------ */

const NAMES: string[] = (cooc as { names: string[] }).names.map((n) => fold(n));
const INDEX = new Map<string, number>();
NAMES.forEach((n, i) => INDEX.set(n, i));
const MATRIX = (cooc as { matrix: number[][] }).matrix;
const TOTALS = (cooc as unknown as { totals: Record<string, number> }).totals || {};
const GROUPS = new Map<string, string>();
for (const [k, v] of Object.entries((cooc as { groups: Record<string, string> }).groups || {})) {
  GROUPS.set(fold(k), String(v));
}

const relCache = new Map<string, number>();

/** 1 se uguali; fino a 0.6 se parenti stretti; 0.3 se stesso gruppo; altrimenti 0. */
export function relatedness(a: string, b: string): number {
  if (a === b) return 1;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  const cached = relCache.get(key);
  if (cached !== undefined) return cached;

  let r = 0;
  const ia = INDEX.get(a);
  const ib = INDEX.get(b);
  if (ia !== undefined && ib !== undefined) {
    const ta = TOTALS[NAMES[ia]] ?? TOTALS[(cooc as { names: string[] }).names[ia]] ?? 0;
    const tb = TOTALS[NAMES[ib]] ?? TOTALS[(cooc as { names: string[] }).names[ib]] ?? 0;
    const co = MATRIX[ia]?.[ib] ?? 0;
    if (ta > 0 && tb > 0 && co > 0) {
      const cos = co / Math.sqrt(ta * tb);
      if (cos > 0.3) r = Math.min(0.6, cos);
    }
  }
  if (r === 0) {
    const ga = GROUPS.get(a);
    const gb = GROUPS.get(b);
    if (ga && gb && ga === gb) r = 0.3;
  }
  relCache.set(key, r);
  return r;
}

function best(a: string, pool: string[]): number {
  let m = 0;
  for (const b of pool) {
    const r = relatedness(a, b);
    if (r > m) m = r;
    if (m === 1) break;
  }
  return m;
}

/** Similarità simmetrica "soft": null se uno dei due strati è vuoto. */
function layerSim(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  let s = 0;
  for (const x of a) s += best(x, b);
  for (const y of b) s += best(y, a);
  return s / (a.length + b.length);
}

/* ------------------------------------------------------------------ */
/* Profili                                                             */
/* ------------------------------------------------------------------ */

interface Profile {
  accords: string[]; // in ordine di prominenza
  top: string[];
  mid: string[];
  base: string[];
  all: string[];
}

export function profileOf(r: CatalogRow): Profile {
  const accords = parseList(r.main_accords);
  const top = parseList(r.top_notes);
  const mid = parseList(r.middle_notes);
  const base = parseList(r.base_notes);
  const all = Array.from(new Set([...top, ...mid, ...base]));
  return { accords, top, mid, base, all };
}

function accordSim(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  const w = (i: number) => 1 / (1 + 0.25 * i);
  let num = 0;
  let den = 0;
  a.forEach((x, i) => {
    num += w(i) * best(x, b);
    den += w(i);
  });
  b.forEach((y, i) => {
    num += w(i) * best(y, a);
    den += w(i);
  });
  return den > 0 ? num / den : null;
}

const MIN_NEAR_SCORE = 0.4;
const W = { acc: 0.35, base: 0.3, mid: 0.22, top: 0.13 };

interface Parts {
  acc: number | null;
  base: number | null;
  mid: number | null;
  top: number | null;
}

function partsBetween(s: Profile, c: Profile): Parts {
  return {
    acc: accordSim(s.accords, c.accords),
    base: layerSim(s.base, c.base),
    mid: layerSim(s.mid, c.mid),
    top: layerSim(s.top, c.top),
  };
}

/** Punteggio 0..1 e copertura dei dati (0..1). */
function combine(p: Parts): { score: number; coverage: number } {
  let num = 0;
  let den = 0;
  (Object.keys(W) as Array<keyof typeof W>).forEach((k) => {
    const v = p[k];
    if (v !== null) {
      num += W[k] * v;
      den += W[k];
    }
  });
  return { score: den > 0 ? num / den : 0, coverage: den };
}

/** "Anima": accordi + fondo, senza cuore e testa. */
function soul(p: Parts): number | null {
  const a = p.acc;
  const b = p.base;
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return 0.55 * a + 0.45 * b;
}

function geoMean(values: number[]): number {
  if (values.length === 0) return 0;
  const prod = values.reduce((acc, v) => acc * Math.max(v, 0.0001), 1);
  return Math.pow(prod, 1 / values.length);
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

export interface RankOptions {
  mode: SimiliMode;
  limit?: number;
  /** stringhe "Brand – Nome" già possedute (collezione + radar) */
  ownedItems?: string[];
  minRatings?: number;
}

const pairKey = (brand?: string | null, name?: string | null) => `${fold(brand)}|${fold(name)}`;

function popularity(count?: number | null): number {
  const c = typeof count === 'number' && count > 0 ? count : 0;
  return Math.min(1, Math.log10(1 + c) / 4.5);
}

// Accordi (Fragrantica/Parfumo) e note con traduzione dizionario difettosa
const IT_OVERRIDE: Record<string, string> = {
  'lily-of-the-valley': 'mughetto',
  'lily of the valley': 'mughetto',
  woody: 'legnoso',
  'woody notes': 'legnoso',
  amber: 'ambra',
  fruity: 'fruttato',
  smoky: 'fumoso',
  'fresh spicy': 'speziato fresco',
  'warm spicy': 'speziato caldo',
  spicy: 'speziato',
  sweet: 'dolce',
  citrus: 'agrumato',
  floral: 'floreale',
  'white floral': 'fiori bianchi',
  powdery: 'cipriato',
  aromatic: 'aromatico',
  fresh: 'fresco',
  green: 'verde',
  leather: 'cuoio',
  musky: 'muschiato',
  earthy: 'terroso',
  balsamic: 'balsamico',
  vanilla: 'vaniglia',
  oud: 'oud',
  aquatic: 'acquatico',
  marine: 'marino',
  animalic: 'animalico',
  tobacco: 'tabacco',
  honey: 'miele',
  coffee: 'caffè',
  chocolate: 'cioccolato',
  caramel: 'caramello',
  boozy: 'etilico',
  gourmand: 'gourmand',
  tropical: 'tropicale',
  rose: 'rosa',
  iris: 'iris',
  patchouli: 'patchouli',
  lactonic: 'lattonico',
  salty: 'salato',
  mineral: 'minerale',
  metallic: 'metallico',
  soapy: 'saponoso',
  ozonic: 'ozonico',
  terpenic: 'terpenico',
  conifer: 'conifere',
  nutty: 'nocciolato',
  almond: 'mandorla',
  cherry: 'ciliegia',
  coconut: 'cocco',
  rum: 'rum',
  anis: 'anice',
  cinnamon: 'cannella',
  'oak moss': 'muschio di quercia',
  oakmoss: 'muschio di quercia',
};

function toItalian(note: string): string {
  const k = fold(note);
  if (IT_OVERRIDE[k]) return IT_OVERRIDE[k];
  return formatPerfumeNote(note).toLowerCase();
}

function italian(list: string[], max: number): string {
  return list.slice(0, max).map(toItalian).join(', ');
}

function buildReason(seeds: Profile[], c: Profile, mode: SimiliMode): string {
  const seedBase = Array.from(new Set(seeds.flatMap((s) => s.base)));
  const seedAcc = Array.from(new Set(seeds.flatMap((s) => s.accords)));
  const seedMidTop = Array.from(new Set(seeds.flatMap((s) => [...s.mid, ...s.top])));

  const sharedBase = c.base.filter((n) => seedBase.includes(n));
  const sharedAcc = c.accords.filter((n) => seedAcc.includes(n));
  const novel = [...c.mid, ...c.top].filter((n) => best(n, seedMidTop) < 0.5);

  const parts: string[] = [];
  if (sharedBase.length) parts.push(`stesso fondo: ${italian(sharedBase, 3)}`);
  if (sharedAcc.length) parts.push(`accordi in comune: ${italian(sharedAcc, 3)}`);
  let text = parts.join(' · ');
  if (novel.length) {
    const diff = `${mode === 'sorprendimi' ? 'ma con' : 'in più'}: ${italian(novel, 3)}`;
    text = text ? `${text} — ${diff}` : diff;
  }
  return text;
}

export function rankSimilar(
  seedRows: CatalogRow[],
  pool: CatalogRow[],
  opts: RankOptions
): SimiliResult[] {
  const limit = opts.limit ?? 5;
  const minRatings = opts.minRatings ?? 5;
  const owned = (opts.ownedItems || []).map(fold);
  const seedProfiles = seedRows.map(profileOf);
  const seedKeys = new Set(seedRows.map((r) => pairKey(r.brand, r.name)));
  const seedBrands = new Set(seedRows.map((r) => fold(r.brand)));
  const seedNames = seedRows.map((r) => fold(r.name)).filter((n) => n.length >= 4);

  const scored: Array<{ row: CatalogRow; prof: Profile; final: number; score: number }> = [];

  for (const row of pool) {
    if (!row.brand || !row.name) continue;
    if ((row.rating_count ?? 0) < minRatings) continue;
    const key = pairKey(row.brand, row.name);
    if (seedKeys.has(key)) continue;
    if (seedBrands.has(fold(row.brand))) continue;

    const nm = fold(row.name);
    if (seedNames.some((s) => nm.includes(s) || (nm.length >= 4 && s.includes(nm)))) continue;

    const fb = fold(row.brand);
    const fn = nm;
    if (owned.some((o) => o.includes(fb) && o.includes(fn))) continue;

    const prof = profileOf(row);
    const perSeed = seedProfiles.map((sp) => partsBetween(sp, prof));
    const combined = perSeed.map(combine);
    if (combined.some((c) => c.coverage < 0.5)) continue; // dati insufficienti

    const score = geoMean(combined.map((c) => c.score));
    const pop = popularity(row.rating_count);

    if (opts.mode === 'vicino') {
      if (score >= 0.92) continue; // quasi-copia: non è una scoperta
      if (score < MIN_NEAR_SCORE) continue; // somiglianza troppo debole: meglio nessun risultato
      scored.push({ row, prof, score, final: score * (1 - 0.12 * pop) });
    } else {
      const souls = perSeed.map(soul);
      if (souls.some((s) => s === null)) continue;
      const soulScore = geoMean(souls as number[]);
      if (soulScore < 0.32 || score >= 0.8) continue;
      const seedMidTop = Array.from(new Set(seedProfiles.flatMap((s) => [...s.mid, ...s.top])));
      const cand = [...prof.mid, ...prof.top];
      const novelty =
        cand.length === 0 ? 0.5 : cand.filter((n) => best(n, seedMidTop) < 0.5).length / cand.length;
      scored.push({
        row,
        prof,
        score,
        final: Math.pow(soulScore, 0.8) * (0.35 + novelty) * (1 - 0.35 * pop),
      });
    }
  }

  scored.sort((a, b) => b.final - a.final);

  const picked: SimiliResult[] = [];
  const usedBrands = new Set<string>();
  const seedsAll = seedProfiles;

  for (const s of scored) {
    if (picked.length >= limit) break;
    const b = fold(s.row.brand);
    if (usedBrands.has(b)) continue;
    const motivo = buildReason(seedsAll, s.prof, opts.mode);
    if (!motivo) continue; // niente motivo reale = niente risultato
    usedBrands.add(b);
    picked.push({
      brand: s.row.brand as string,
      nome: s.row.name as string,
      concentrazione: s.row.concentration ?? null,
      anno: s.row.release_year ?? null,
      naso: s.row.perfumers ?? null,
      url: s.row.url ?? null,
      famiglia_raw: s.row.main_accords ?? null,
      note_testa: s.row.top_notes ?? null,
      note_cuore: s.row.middle_notes ?? null,
      note_fondo: s.row.base_notes ?? null,
      motivo,
      punteggio: Math.round(s.score * 100) / 100,
    });
  }
  return picked;
}

/* ------------------------------------------------------------------ */
/* Accesso al catalogo (query PostgREST)                               */
/* ------------------------------------------------------------------ */

const COLS =
  'id, name, brand, release_year, concentration, rating_value, rating_count, main_accords, top_notes, middle_notes, base_notes, perfumers, url';

const safeToken = (t: string) => t.replace(/[^a-z0-9 \-']/gi, ' ').replace(/\s+/g, ' ').trim();

const STOPWORDS = new Set(['di', 'de', 'the', 'by', 'eau', 'da', 'del', 'la', 'le', 'il']);

export interface ResolvedSeed {
  query: string;
  row: CatalogRow | null;
}

export async function resolveSeed(supabase: any, query: string): Promise<ResolvedSeed> {
  const tokens = fold(query)
    .split(' ')
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .slice(0, 5);
  if (tokens.length === 0) return { query, row: null };

  const anchor = [...tokens].sort((a, b) => b.length - a.length)[0];
  const { data } = await supabase
    .from('perfumes')
    .select(COLS)
    .or(`name.ilike.%${safeToken(anchor)}%,brand.ilike.%${safeToken(anchor)}%`)
    .limit(200);

  let bestRow: CatalogRow | null = null;
  let bestScore = -Infinity;
  for (const r of (data || []) as CatalogRow[]) {
    const full = fold(`${r.brand || ''} ${r.name || ''}`).replace(/[^a-z0-9 ]/g, '');
    if (!tokens.every((t) => full.includes(t))) continue;
    // più corto = più probabile versione base; più voti = più probabile quello giusto
    const score = 100 - full.length + 8 * Math.log10(1 + (r.rating_count || 0));
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return { query, row: bestRow };
}

export async function fetchPool(supabase: any, seeds: CatalogRow[]): Promise<CatalogRow[]> {
  const profiles = seeds.map(profileOf);
  const terms = new Set<string>();
  const cols: Array<[string, string[]]> = [];
  const accTerms = Array.from(new Set(profiles.flatMap((p) => p.accords.slice(0, 3))));
  const baseTerms = Array.from(new Set(profiles.flatMap((p) => p.base.slice(0, 3))));
  const midTerms = Array.from(new Set(profiles.flatMap((p) => p.mid.slice(0, 2))));
  cols.push(['main_accords', accTerms], ['base_notes', baseTerms], ['middle_notes', midTerms]);

  const clauses: string[] = [];
  for (const [col, list] of cols) {
    for (const t of list) {
      const s = safeToken(t);
      if (s && !terms.has(`${col}:${s}`)) {
        terms.add(`${col}:${s}`);
        clauses.push(`${col}.ilike.%${s}%`);
      }
    }
  }
  if (clauses.length === 0) return [];
  const orExpr = clauses.join(',');

  const base = () => supabase.from('perfumes').select(COLS).or(orExpr).gte('rating_count', 5);

  let count = 0;
  try {
    const head = await supabase
      .from('perfumes')
      .select('id', { count: 'exact', head: true })
      .or(orExpr)
      .gte('rating_count', 5);
    count = head?.count || 0;
  } catch {
    count = 0;
  }
  const win = 600;
  const off = count > win ? Math.floor(Math.random() * (count - win)) : 0;

  const [a, b, c] = await Promise.all([
    base().order('rating_count', { ascending: false }).limit(700),
    base().order('id', { ascending: true }).range(off, off + win - 1),
    base().order('rating_count', { ascending: true }).limit(500),
  ]);

  const seen = new Map<string, CatalogRow>();
  for (const res of [a, b, c]) {
    for (const r of (res?.data || []) as CatalogRow[]) seen.set(String(r.id), r);
  }
  return Array.from(seen.values());
}

export async function findSimilar(
  supabase: any,
  seedQueries: string[],
  opts: RankOptions
): Promise<{ seeds: CatalogRow[]; notFound: string[]; results: SimiliResult[] }> {
  const resolved = await Promise.all(seedQueries.slice(0, 3).map((q) => resolveSeed(supabase, q)));
  const seeds = resolved.map((r) => r.row).filter((r): r is CatalogRow => !!r);
  const notFound = resolved.filter((r) => !r.row).map((r) => r.query);
  if (seeds.length === 0) return { seeds, notFound, results: [] };
  const pool = await fetchPool(supabase, seeds);
  const results = rankSimilar(seeds, pool, opts);
  return { seeds, notFound, results };
}
