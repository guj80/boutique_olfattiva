// ============================================================================
// DATASET — BOUTIQUE OLFATTIVA — "Enciclopedia Olfattiva"
// ============================================================================
// Carica il dataset reale Fragrantica/Scent Chords (public/data/scent-database.json)
// e lo rende disponibile per ricerca immediata, filtri per famiglia, nota e
// piramide olfattiva (Top/Heart/Base), oltre che le barre degli accordi.
// ============================================================================

import { detectFamily, FamilyId } from '@/lib/scent-families';

export interface ScentPerfume {
  id: string;
  name: string;
  brand: string;
  year: number | null;
  gender: number | null;
  country: number | null;
  rating: number | null;
  votes: number | null;
  perfumers: string[];
  url: string;
  top: string[];       // note testa
  middle: string[];    // note cuore
  base: string[];      // note fondo
  accords: string[];   // accordi principali (nomi)
}

export interface ScentDatabase {
  source: string;
  count: number;
  notes: string[];
  accords: string[];
  perfumes: ScentPerfume[];
}

// Cache in-memory (evita reload ripetuti del JSON 10MB)
let cachedDb: ScentDatabase | null = null;
let cachePromise: Promise<ScentDatabase> | null = null;

export function loadScentDatabase(): Promise<ScentDatabase> {
  if (cachedDb) return Promise.resolve(cachedDb);
  if (cachePromise) return cachePromise;

  const url = '/data/scent-database.json';
  cachePromise = fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`Dataset non caricabile (${res.status})`);
      return res.json();
    })
    .then((data: ScentDatabase) => {
      cachedDb = data;
      return data;
    })
    .finally(() => { cachePromise = null; });
  return cachePromise;
}

export interface PerfumeFilters {
  q: string;              // ricerca immediata (nome/maison/accord)
  families: FamilyId[];   // filtro multi-scegli 10 famiglie
  notes: string[];        // filtro nota singola (Teste/Cuore/Fondo)
  position: 'top' | 'heart' | 'base' | null; // None = tutti i livelli
  brand: string;          // filtro maison
}

export interface PerfumeMatch {
  perfume: ScentPerfume;
  matchedTerms: string[]; // termini del filtro q che hanno corrisposto
  families: FamilyId[];
}

export function classifyPerfumeFamily(p: ScentPerfume): FamilyId {
  const allNotes = [...p.top, ...p.middle, ...p.base];
  if (!allNotes.length) return 'floral';
  const counts = new Map<FamilyId, number>();
  for (const n of allNotes) {
    const f = detectFamily(n);
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  let best: FamilyId = 'floral';
  let bestCount = -1;
  for (const [f, c] of counts) {
    if (c > bestCount || (c === bestCount && FAMILY_ORDER.indexOf(f) < FAMILY_ORDER.indexOf(best))) {
      bestCount = c;
      best = f;
    }
  }
  return best;
}

const FAMILY_ORDER: FamilyId[] = [
  'citrus', 'fresh', 'herbal', 'floral', 'fruity', 'sweet',
  'spicy', 'amber', 'woody', 'musky',
];

export function familiesOfPerfume(p: ScentPerfume): FamilyId[] {
  const set = new Set<FamilyId>();
  for (const n of [...p.top, ...p.middle, ...p.base]) set.add(detectFamily(n));
  return [...set];
}

// Applica i filtri a un db caricato e restituisce i risultati ordinati.
export function applyFilters(db: ScentDatabase, filters: PerfumeFilters): PerfumeMatch[] {
  const q = filters.q.trim().toLowerCase();
  const families = filters.families;
  const noteFilter = filters.notes;
  const position = filters.position;
  const brand = filters.brand.trim().toLowerCase();

  const results: PerfumeMatch[] = [];

  for (const p of db.perfumes) {
    let ok = true;
    const matchedTerms: string[] = [];

    // 1) Ricerca immediata q (nome, brand, maison, note, accordi)
    if (q) {
      const haystack = `
        ${p.name} ${p.brand} ${p.perfumers} ${p.top.join(' ')} ${p.middle.join(' ')} ${p.base.join(' ')} ${p.accords.join(' ')}
      `.toLowerCase();
      const qTerms = q.split(/\s+/).filter((t) => t.length >= 2);
      const hits = qTerms.filter((t) => haystack.includes(t));
      if (hits.length === 0) ok = false;
      matchedTerms.push(...hits);
    }

    // 2) Filtro maison
    if (brand && !p.brand.toLowerCase().includes(brand)) ok = false;

    // 3) Filtro famiglia
    if (ok && families.length > 0) {
      const pFamily = classifyPerfumeFamily(p);
      if (!families.includes(pFamily)) ok = false;
    }

    if (!ok) continue;

    // 4) Filtro nota singola (Top/Cuore/Fondo)
    if (noteFilter.length > 0) {
      const pos = position ?? null;
      const layerNotes = (pos === 'top' || pos === null) ? [...p.top] : pos === 'heart' ? [...p.middle] : pos === 'base' ? [...p.base] : [];
      const noteLower = noteFilter.map((n) => n.toLowerCase());
      const hits = layerNotes.filter((n) => noteLower.includes(n.toLowerCase()));
      if (hits.length === 0) continue;
    }

    results.push({
      perfume: p,
      matchedTerms: [...new Set(matchedTerms)],
      families: familiesOfPerfume(p),
    });
  }

  // Ordinamento: matching q (più termini = più rilevanti), poi rating, poi name
  results.sort((a, b) => {
    const ta = a.matchedTerms.length;
    const tb = b.matchedTerms.length;
    if (ta !== tb) return tb - ta;
    const ra = (a.perfume.rating ?? 0) - (b.perfume.rating ?? 0);
    if (ra !== 0) return ra > 0 ? 1 : -1;
    return a.perfume.name.localeCompare(b.perfume.name);
  });

  return results;
}

// Piramide olfattiva renderizzabile: soffitto (top), mezzo (heart), base
export function pyramidData(p: ScentPerfume) {
  return {
    top: p.top,
    heart: p.middle,
    base: p.base,
    notes: { top: p.top, heart: p.middle, base: p.base },
  };
}

// Accordi più frequenti (nomi + count stimato dal dataset)
export function topAccords(p: ScentPerfume, limit = 8) {
  // Ogni perfume ha un array accordi (nomi); restituisce i primi `limit`
  return p.accords.slice(0, limit);
}
