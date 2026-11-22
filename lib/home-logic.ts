import {
  isColdWeatherFamily,
  isWarmEveningFamily,
  isWarmWeatherFamily,
} from './families';

export interface IndossoItem {
  id: string;
  profumo_id: string;
  created_at: string;
  momento_giornata?: string;
  contesto_outfit?: string;
  note_giorno?: string;
  profumi?: any;
}

export interface PodioEntry {
  count: number;
  profumo: any;
  lastDate: string;
  topContesto: string | null;
  topSensazione: string | null;
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

function getMostFrequentToken(map: Record<string, number>): string | null {
  let best: string | null = null;
  let max = 0;
  Object.keys(map).forEach((k) => {
    if (map[k] > max) {
      max = map[k];
      best = k;
    }
  });
  return best;
}

export function computePodio(
  indossi: IndossoItem[],
  timeframe: 'all' | 'month' = 'all'
): PodioEntry[] {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const filtered =
    timeframe === 'month'
      ? indossi.filter((item) => {
          const d = new Date(item.created_at);
          return d.getFullYear() === curYear && d.getMonth() === curMonth;
        })
      : indossi;

  const counts: Record<
    string,
    {
      count: number;
      profumo: any;
      lastDate: string;
      contesti: Record<string, number>;
      sensazioni: Record<string, number>;
    }
  > = {};

  filtered.forEach((item) => {
    if (!item.profumi) return;
    const id = item.profumo_id;
    if (!counts[id]) {
      counts[id] = {
        count: 0,
        profumo: item.profumi,
        lastDate: item.created_at,
        contesti: {},
        sensazioni: {},
      };
    }
    counts[id].count += 1;
    if (new Date(item.created_at) > new Date(counts[id].lastDate)) {
      counts[id].lastDate = item.created_at;
    }

    if (item.contesto_outfit) {
      const ctx = item.contesto_outfit.trim();
      if (ctx) {
        counts[id].contesti[ctx] = (counts[id].contesti[ctx] || 0) + 1;
      }
    }

    if (item.note_giorno) {
      item.note_giorno
        .split(/[·,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 24)
        .forEach((tag) => {
          counts[id].sensazioni[tag] = (counts[id].sensazioni[tag] || 0) + 1;
        });
    }
  });

  return Object.values(counts)
    .map((entry) => ({
      count: entry.count,
      profumo: entry.profumo,
      lastDate: entry.lastDate,
      topContesto: getMostFrequentToken(entry.contesti),
      topSensazione: getMostFrequentToken(entry.sensazioni),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getSmartConsultantSuggestions(profumi: any[], indossi: IndossoItem[]) {
  const collection = profumi.filter((p) => p.stato !== 'radar');
  if (collection.length === 0) return [];

  const h = new Date().getHours();
  const currentMomento =
    h >= 5 && h < 12 ? 'Mattina' : h >= 12 && h < 18 ? 'Pomeriggio' : h >= 18 && h < 23 ? 'Sera' : 'Notte';

  const month = new Date().getMonth();
  const isCold = month < 3 || month >= 10;

  const lastWornMap: Record<string, string> = {};
  indossi.forEach((item) => {
    if (!lastWornMap[item.profumo_id]) {
      lastWornMap[item.profumo_id] = item.created_at;
    }
  });

  const scored = collection.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    const lastWorn = lastWornMap[p.id];
    const daysSinceLast = lastWorn
      ? Math.floor((Date.now() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (!lastWorn) {
      score += 15;
      reasons.push('Mai indossato di recente');
    } else if (daysSinceLast > 30) {
      score += 10;
      reasons.push(`Non indossato da ${daysSinceLast} giorni`);
    }

    if (isCold && isColdWeatherFamily(p.famiglia_olfattiva)) {
      score += 8;
      reasons.push('Ideale per temperature fredde');
    } else if (!isCold && isWarmWeatherFamily(p.famiglia_olfattiva)) {
      score += 8;
      reasons.push('Perfetto per il clima attuale');
    }

    if (currentMomento === 'Sera' && isWarmEveningFamily(p.famiglia_olfattiva)) {
      score += 5;
      reasons.push('Ottimale per la sera');
    }

    return { profumo: p, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.profumo);
}
