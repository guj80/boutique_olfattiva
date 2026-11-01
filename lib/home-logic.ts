import type { Profumo } from '@/lib/supabase';

export interface IndossoItem {
  id: string;
  profumo_id: string;
  created_at: string;
  momento_giornata?: string;
  contesto_outfit?: string;
  note_giorno?: string;
  profumi?: Profumo | null;
}

export function getLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAutoMomento(): 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Mattina';
  if (h >= 12 && h < 18) return 'Pomeriggio';
  if (h >= 18 && h < 23) return 'Sera';
  return 'Notte';
}

export function computePodio(indossi: IndossoItem[]) {
  const counts: Record<string, { count: number; profumo: Profumo; lastDate: string }> = {};
  indossi.forEach((item) => {
    if (item.profumi) {
      const id = item.profumo_id;
      if (!counts[id]) {
        counts[id] = { count: 0, profumo: item.profumi, lastDate: item.created_at };
      }
      counts[id].count += 1;
      if (new Date(item.created_at) > new Date(counts[id].lastDate)) {
        counts[id].lastDate = item.created_at;
      }
    }
  });
  return Object.values(counts).sort((a, b) => b.count - a.count);
}

export function matchesLocalOccasione(p: Profumo, occasione: string): boolean {
  if (!occasione || occasione === 'Tutti') return true;
  const occ = occasione.toLowerCase();
  const occIdeal = (p.occasione_ideale || '').toLowerCase();
  const fam = (p.famiglia_olfattiva || '').toLowerCase();

  if (occIdeal.includes(occ) || occIdeal.includes('versatile')) return true;

  if (occ === 'ufficio') {
    return fam.includes('agrumata') || fam.includes('aromatica') || fam.includes('legnosa') || fam.includes('muschiata') || fam.includes('verde');
  }
  if (occ === 'formale') {
    return fam.includes('legnosa') || fam.includes('speziata') || fam.includes('cuoiata') || fam.includes('ambrata') || fam.includes('aromatica');
  }
  if (occ === 'tempo libero') {
    return fam.includes('agrumata') || fam.includes('marina') || fam.includes('fruttata') || fam.includes('verde') || fam.includes('aromatica') || fam.includes('floreale');
  }
  if (occ === 'cena' || occ === 'serata') {
    return fam.includes('ambrata') || fam.includes('gourmand') || fam.includes('speziata') || fam.includes('cuoiata') || fam.includes('legnosa');
  }
  return true;
}

export function matchesLocalMomento(p: Profumo, momento: string): boolean {
  const resolved = momento === 'Tutti' || !momento ? getAutoMomento() : momento;
  const fam = (p.famiglia_olfattiva || '').toLowerCase();

  if (resolved === 'Mattina' || resolved === 'Pomeriggio') {
    return fam.includes('agrumata') || fam.includes('marina') || fam.includes('verde') || fam.includes('aromatica') || fam.includes('floreale') || fam.includes('fruttata') || fam.includes('muschiata') || fam.includes('legnosa');
  }
  return fam.includes('ambrata') || fam.includes('gourmand') || fam.includes('cuoiata') || fam.includes('speziata') || fam.includes('legnosa') || fam.includes('floreale');
}

export function pickLocalWearSuggestions(
  profumi: Profumo[],
  indossi: IndossoItem[],
  occasione: string,
  momento: string,
  limit = 3
): Profumo[] {
  const collection = profumi.filter((p) => {
    const st = (p.stato || '').toLowerCase().trim();
    return st === 'collezione' || st === '';
  });
  if (collection.length === 0) return [];

  const lastWornMap = new Map<string, number>();
  for (const item of indossi) {
    if (!item.profumo_id || !item.created_at) continue;
    const ts = new Date(item.created_at).getTime();
    const prev = lastWornMap.get(item.profumo_id) ?? 0;
    if (ts > prev) lastWornMap.set(item.profumo_id, ts);
  }

  let pool = collection.filter(
    (p) => matchesLocalOccasione(p, occasione) && matchesLocalMomento(p, momento)
  );
  if (pool.length < limit) {
    const fallbackOcc = collection.filter((p) => matchesLocalOccasione(p, occasione));
    pool = fallbackOcc.length > 0 ? fallbackOcc : collection;
  }

  return [...pool]
    .sort((a, b) => {
      const lastA = lastWornMap.get(a.id) ?? 0;
      const lastB = lastWornMap.get(b.id) ?? 0;
      if (lastA !== lastB) return lastA - lastB;
      return a.nome.localeCompare(b.nome);
    })
    .slice(0, limit);
}
