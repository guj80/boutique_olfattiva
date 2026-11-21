import { Profumo, Indosso, isCollezioneProfumo } from './supabase';
import { formatPerfumeNote } from './dictionary';
import {
  extractCanonicalFamilies,
  getAxisForFamily,
  type ScentAxisKey,
} from './families';

export type { ScentAxisKey };
export type ScentAxisValues = Record<ScentAxisKey, number>;

export const SCENT_AXES: ReadonlyArray<{
  key: ScentAxisKey;
  /** Etichetta completa (due parole al massimo, per andare a capo nel radar) */
  label: string;
}> = [
  { key: 'agrumatoFresco', label: 'Agrumato Fresco' },
  { key: 'florealeFruttato', label: 'Floreale Fruttato' },
  { key: 'legnosoTerroso', label: 'Legnoso Terroso' },
  { key: 'ambratoOrientale', label: 'Ambrato Orientale' },
  { key: 'gourmandDolce', label: 'Gourmand Dolce' },
  { key: 'cuoiatoAnimale', label: 'Cuoiato Animale' },
];

function emptyAxes(): ScentAxisValues {
  return {
    agrumatoFresco: 0,
    florealeFruttato: 0,
    legnosoTerroso: 0,
    ambratoOrientale: 0,
    gourmandDolce: 0,
    cuoiatoAnimale: 0,
  };
}

export interface ScentDNAResult {
  /** true se la collezione e' vuota */
  isEmpty: boolean;
  /** true se almeno una famiglia olfattiva e' stata riconosciuta */
  hasSignal: boolean;
  /** Profumi in collezione considerati */
  perfumesCount: number;
  /** Percentuali reali per asse (somma ~100), per il prompt AI */
  rawPercent: ScentAxisValues;
  /** Valori 0-100 normalizzati sull'asse dominante, per il poligono */
  radar: ScentAxisValues;
  /** Famiglie piu' presenti (nomi canonici, max 3) */
  dominantFamilies: string[];
  /** Note piu' ricorrenti in testa/cuore/fondo (max 6) */
  topNotes: string[];
  /** Firma stabile usata per invalidare la cache */
  signature: string;
}

export const WEAR_WINDOW_DAYS = 90;
const MAX_WEAR_BOOST = 10;

function splitNotes(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;•·|/]+/)
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && n.length <= 40);
}

function countWearsLastDays(indossi: Indosso[], days: number, now: number): Map<string, number> {
  const since = now - days * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const wear of indossi) {
    if (!wear || !wear.profumo_id || !wear.created_at) continue;
    const time = Date.parse(wear.created_at);
    if (Number.isNaN(time) || time < since || time > now + 24 * 60 * 60 * 1000) continue;
    counts.set(wear.profumo_id, (counts.get(wear.profumo_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Calcolo puro dello Scent DNA basato sulla fonte unica lib/families.ts.
 * peso profumo = 1 + min(indossi ultimi 90 giorni, 10) * 0.2  (da 1x a 3x)
 */
export function computeScentDNA(
  profumi: Profumo[],
  indossi: Indosso[],
  now: number = Date.now()
): ScentDNAResult {
  const collection = (profumi || []).filter((p) => p && isCollezioneProfumo(p));

  if (collection.length === 0) {
    return {
      isEmpty: true,
      hasSignal: false,
      perfumesCount: 0,
      rawPercent: emptyAxes(),
      radar: emptyAxes(),
      dominantFamilies: [],
      topNotes: [],
      signature: 'empty',
    };
  }

  const wears = countWearsLastDays(indossi || [], WEAR_WINDOW_DAYS, now);

  const axisWeight = emptyAxes();
  const familyWeight = new Map<string, number>();
  const noteStats = new Map<string, { label: string; count: number; weight: number }>();
  let totalWeight = 0;

  for (const p of collection) {
    const weight = 1 + Math.min(wears.get(p.id) ?? 0, MAX_WEAR_BOOST) * 0.2;

    const families = extractCanonicalFamilies(p.famiglia_olfattiva);
    if (families.length > 0) {
      const share = weight / families.length;
      for (const fam of families) {
        const axis = getAxisForFamily(fam);
        axisWeight[axis] += share;
        familyWeight.set(fam, (familyWeight.get(fam) ?? 0) + share);
        totalWeight += share;
      }
    }

    // Ogni nota conta una volta per profumo
    const seen = new Set<string>();
    for (const raw of [p.note_testa, p.note_cuore, p.note_fondo]) {
      for (const note of splitNotes(raw)) {
        const key = note.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const stat = noteStats.get(key);
        if (stat) {
          stat.count += 1;
          stat.weight += weight;
        } else {
          noteStats.set(key, { label: formatPerfumeNote(note) || note, count: 1, weight });
        }
      }
    }
  }

  const rawPercent = emptyAxes();
  const radar = emptyAxes();
  const hasSignal = totalWeight > 0;

  if (hasSignal) {
    const keys = Object.keys(axisWeight) as ScentAxisKey[];
    let maxShare = 0;
    for (const key of keys) {
      const share = axisWeight[key] / totalWeight;
      rawPercent[key] = Math.round(share * 100);
      if (share > maxShare) maxShare = share;
    }
    for (const key of keys) {
      const share = axisWeight[key] / totalWeight;
      radar[key] = maxShare > 0 ? Math.round((share / maxShare) * 100) : 0;
    }
  }

  const dominantFamilies = Array.from(familyWeight.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([family]) => family);

  const topNotes = Array.from(noteStats.values())
    .sort((a, b) => b.count - a.count || b.weight - a.weight)
    .slice(0, 6)
    .map((stat) => stat.label);

  const topAxes = (Object.keys(radar) as ScentAxisKey[])
    .sort((a, b) => radar[b] - radar[a])
    .slice(0, 3)
    .join('|');
  const signature = `${collection.length}:${topAxes}`;

  return {
    isEmpty: false,
    hasSignal,
    perfumesCount: collection.length,
    rawPercent,
    radar,
    dominantFamilies,
    topNotes,
    signature,
  };
}

export interface ScentArchetype {
  archetipo: string;
  descrizione: string;
  consiglio: string;
}

export function isScentArchetype(value: unknown): value is ScentArchetype {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.archetipo === 'string' &&
    v.archetipo.trim().length > 0 &&
    typeof v.descrizione === 'string' &&
    v.descrizione.trim().length > 0 &&
    typeof v.consiglio === 'string' &&
    v.consiglio.trim().length > 0
  );
}

export function isScentAxisValues(value: unknown): value is ScentAxisValues {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return SCENT_AXES.every((axis) => {
    const n = v[axis.key];
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
  });
}
