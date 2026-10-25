export interface IndossoItem {
  id: string;
  profumo_id: string;
  created_at: string;
  momento_giornata?: string;
  contesto_outfit?: string;
  note_giorno?: string;
  profumi?: any;
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
  const counts: Record<string, { count: number; profumo: any; lastDate: string }> = {};
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

export function getSmartConsultantSuggestions(profumi: any[], indossi: IndossoItem[]) {
  // Esclude i profumi in stato 'radar' (mantiene solo la collezione)
  const collection = profumi.filter((p) => p.stato !== 'radar');
  if (collection.length === 0) return [];

  const h = new Date().getHours();
  const currentMomento = h >= 5 && h < 12 ? 'Mattina' : h >= 12 && h < 18 ? 'Pomeriggio' : h >= 18 && h < 23 ? 'Sera' : 'Notte';
  
  const month = new Date().getMonth();
  const isCold = month < 3 || month >= 10;

  // Mappa ultimo indosso per ogni profumo
  const lastWornMap: Record<string, string> = {};
  indossi.forEach((item) => {
    if (!lastWornMap[item.profumo_id]) {
      lastWornMap[item.profumo_id] = item.created_at;
    }
  });

  // Calcola un punteggio di affinità basato su dati reali
  const scored = collection.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    const fam = (p.famiglia_olfattiva || '').toLowerCase();
    const lastWorn = lastWornMap[p.id];
    const daysSinceLast = lastWorn ? Math.floor((Date.now() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24)) : 999;

    if (!lastWorn) {
      score += 15;
      reasons.append?.('Mai indossato di recente');
    } else if (daysSinceLast > 30) {
      score += 10;
      reasons.push(`Non indossato da ${daysSinceLast} giorni`);
    }

    if (isCold && (fam.includes('ambrata') || fam.includes('legnosa') || fam.includes('speziata') || fam.includes('gourmand'))) {
      score += 8;
      reasons.push('Ideale per temperature fredde');
    } else if (!isCold && (fam.includes('agrumata') || fam.includes('marina') || fam.includes('verde'))) {
      score += 8;
      reasons.push('Perfetto per il clima attuale');
    }

    if (currentMomento === 'Sera' && (fam.includes('ambrata') || fam.includes('cuoiata'))) {
      score += 5;
      reasons.push('Ottimale per la sera');
    }

    return { profumo: p, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.profumo);
}
