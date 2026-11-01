import type { Profumo } from '@/lib/supabase';
import type { IndossoItem } from '@/lib/home-logic';

export type OccasioneSel = 'Tutti' | 'Ufficio' | 'Formale' | 'Tempo libero' | 'Cena' | 'Serata';
export type MomentoSel = 'Tutti' | 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';
export type MomentoReale = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';
export type Clima = 'Freddo' | 'Mite' | 'Caldo';
export type Stagione = 'Inverno' | 'Primavera' | 'Estate' | 'Autunno';

export interface WearContext {
  occasione: OccasioneSel;
  momento: MomentoSel;
  clima: Clima | null;
  nota: string;
  excludeIds: string[];
}

export interface WearCandidate {
  profumo: Profumo;
  punteggio: number;
  motivi: string[];
  giorniDallUltimo: number | null;
}

export type WearRuolo = 'principale' | 'alternativa';

export interface WearPick {
  profumoId: string;
  ruolo: WearRuolo;
  motivazione: string;
  punteggio: number;
  fonte: 'ai' | 'locale';
}

export interface WearSuggestion {
  picks: WearPick[];
  momentoRisolto: MomentoReale;
  stagione: Stagione;
  modello: string | null;
}

export function resolveMomento(sel: MomentoSel, now: Date = new Date()): MomentoReale {
  if (sel !== 'Tutti') return sel as MomentoReale;
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Mattina';
  if (h >= 12 && h < 18) return 'Pomeriggio';
  if (h >= 18 && h < 23) return 'Sera';
  return 'Notte';
}

export function resolveStagione(now: Date = new Date()): Stagione {
  const m = now.getMonth() + 1;
  if (m === 12 || m === 1 || m === 2) return 'Inverno';
  if (m >= 3 && m <= 5) return 'Primavera';
  if (m >= 6 && m <= 8) return 'Estate';
  return 'Autunno';
}

export function resolveClima(clima: Clima | null, now: Date = new Date()): Clima {
  if (clima) return clima;
  const s = resolveStagione(now);
  if (s === 'Inverno') return 'Freddo';
  if (s === 'Estate') return 'Caldo';
  return 'Mite';
}

export function sanitizeNota(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[`\x01]/g, '')
    .slice(0, 200)
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesOccasioneScore(p: Profumo, occasione: OccasioneSel): number {
  if (occasione === 'Tutti') return 10;
  const f = (p.famiglia_olfattiva || '').toLowerCase();
  const occ = occasione.toLowerCase();
  const occIdeal = (p.occasione_ideale || '').toLowerCase();

  if (occIdeal.includes(occ)) return 30;

  if (occ === 'ufficio') {
    if (f.includes('agrumata') || f.includes('aromatica') || f.includes('legnosa') || f.includes('muschiata') || f.includes('verde')) return 15;
  } else if (occ === 'formale') {
    if (f.includes('legnosa') || f.includes('speziata') || f.includes('cuoiata') || f.includes('ambrata')) return 15;
  } else if (occ === 'tempo libero') {
    if (f.includes('agrumata') || f.includes('marina') || f.includes('fruttata') || f.includes('aromatica')) return 15;
  } else if (occ === 'cena' || occ === 'serata') {
    if (f.includes('ambrata') || f.includes('gourmand') || f.includes('speziata') || f.includes('cuoiata')) return 15;
  }
  return 5;
}

function matchesMomentoScore(p: Profumo, momento: MomentoReale): number {
  const f = (p.famiglia_olfattiva || '').toLowerCase();
  if (momento === 'Mattina' || momento === 'Pomeriggio') {
    return f.includes('agrumata') || f.includes('marina') || f.includes('verde') || f.includes('aromatica') || f.includes('floreale') || f.includes('fruttata') ? 20 : 5;
  } else {
    return f.includes('ambrata') || f.includes('gourmand') || f.includes('cuoiata') || f.includes('speziata') || f.includes('legnosa') ? 20 : 5;
  }
}

export function rankCollection(
  profumi: Profumo[],
  indossi: IndossoItem[],
  ctx: WearContext,
  now: Date = new Date()
): WearCandidate[] {
  const collezione = profumi.filter((p) => {
    const st = (p.stato || '').toLowerCase().trim();
    return st === 'collezione' || st === '';
  });

  if (collezione.length === 0) return [];

  const momentoRisolto = resolveMomento(ctx.momento, now);
  const climaRisolto = resolveClima(ctx.clima, now);

  const lastWornMap: Record<string, string> = {};
  indossi.forEach((item) => {
    if (item.profumo_id && (!lastWornMap[item.profumo_id] || new Date(item.created_at) > new Date(lastWornMap[item.profumo_id]))) {
      lastWornMap[item.profumo_id] = item.created_at;
    }
  });

  let candidates = collezione.filter((p) => !ctx.excludeIds.includes(p.id));
  if (candidates.length === 0) {
    candidates = collezione; // reset se esclusi tutti
  }

  const scored: WearCandidate[] = candidates.map((p) => {
    let score = 50;
    const motivi: string[] = [];

    const occScore = matchesOccasioneScore(p, ctx.occasione);
    score += occScore;
    if (occScore >= 15) motivi.matchesOccasione = true; // flag logico o stringa nei motivi

    const momScore = matchesMomentoScore(p, momentoRisolto);
    score += momScore;

    const lastWorn = lastWornMap[p.id];
    const daysSinceLast = lastWorn ? Math.floor((now.getTime() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (daysSinceLast === null) {
      score += 15;
      motivi.push('Mai indossato di recente');
    } else if (daysSinceLast > 30) {
      score += 12;
      motivi.push(`Non indossato da ${daysSinceLast} giorni`);
    } else if (daysSinceLast < 3) {
      score -= 10;
    }

    const fam = (p.famiglia_olfattiva || '').toLowerCase();
    if (climaRisolto === 'Freddo' && (fam.includes('ambrata') || fam.includes('legnosa') || fam.includes('speziata') || fam.includes('gourmand'))) {
      score += 10;
      motivi.push('Ideale per il clima freddo');
    } else if (climaRisolto === 'Caldo' && (fam.includes('agrumata') || fam.includes('marina') || fam.includes('verde'))) {
      score += 10;
      motivi.push('Perfetto per il clima caldo');
    }

    score += (p.valutazione_stelle ?? 3);

    return {
      profumo: p,
      punteggio: Math.max(0, Math.min(100, Math.round(score))),
      motivi: motivi.length > 0 ? motivi : [`Famiglia olfattiva: ${p.famiglia_olfattiva || 'Versatile'}`],
      giorniDallUltimo: daysSinceLast,
    };
  });

  scored.sort((a, b) => b.punteggio - a.punteggio);
  return scored;
}

export function pickLocal(candidates: WearCandidate[], ctx: WearContext, now: Date = new Date()): WearSuggestion {
  const momentoRisolto = resolveMomento(ctx.momento, now);
  const stagione = resolveStagione(now);

  const picks: WearPick[] = [];
  if (candidates.length > 0) {
    picks.push({
      profumoId: candidates[0].profumo.id,
      ruolo: 'principale',
      motivazione: candidates[0].motivi[0] || 'Scelta ottimale per oggi.',
      punteggio: candidates[0].punteggio,
      fonte: 'locale',
    });
  }

  for (let i = 1; i < candidates.length && picks.size < 3; i++) {
    if (candidates[i].profumo.famiglia_olfattiva !== candidates[0].profumo.famiglia_olfattiva) {
      picks.push({
        profumoId: candidates[i].profumo.id,
        ruolo: 'alternativa',
        motivazione: candidates[i].motivi[0] || 'Ottima alternativa.',
        punteggio: candidates[i].punteggio,
        fonte: 'locale',
      });
    }
  }

  return {
    picks,
    momentoRisolto,
    stagione,
    modello: null,
  };
}

export function buildWearPrompt(candidates: WearCandidate[], ctx: WearContext, now: Date = new Date()) {
  const momentoRisolto = resolveMomento(ctx.momento, now);
  const stagione = resolveStagione(now);
  const clima = resolveClima(ctx.clima, now);

  const system = `Sei un esperto consulente di alta profumeria. Devi scegliere i migliori profumi dalla collezione personale dell'utente per il momento e contesto indicati. Rispondi ESCLUSIVAMENTE in JSON valido con struttura: {"principale": {"id": "...", "motivazione": "..."}, "alternative": [{"id": "...", "motivazione": "..."}]}. Motivazioni in italiano, sobrie, massimo 220 caratteri.`;

  const user = JSON.stringify({
    contesto: { occasione: ctx.occasione, momento: momentoRisolto, stagione, clima, nota: sanitizeNota(ctx.nota) },
    candidati: candidates.map(c => ({
      id: c.profumo.id,
      brand: c.profumo.brand,
      nome: c.profumo.nome,
      famiglia: c.profumo.famiglia_olfattiva,
      note: `${c.profumo.note_testa || ''} ${c.profumo.note_cuore || ''} ${c.profumo.note_fondo || ''}`,
      giorniDallUltimo: c.giorniDallUltimo,
      punteggioLocale: c.punteggio,
    })),
  });

  return { system, user };
}

export function validateAiPicks(raw: unknown, candidates: WearCandidate[]): WearPick[] | null {
  try {
    const data = raw as any;
    if (!data || !data.principale || !data.principale.id) return null;

    const validIds = new Set(candidates.map(c => c.profumo.id));
    const picks: WearPick[] = [];

    if (validIds.has(data.principale.id)) {
      const cand = candidates.find(c => c.profumo.id === data.principale.id);
      picks.push({
        profumoId: data.principale.id,
        ruolo: 'principale',
        motivazione: String(data.principale.motivazione || '').slice(0, 220),
        punteggio: cand ? cand.punteggio : 80,
        fonte: 'ai',
      });
    }

    if (Array.isArray(data.alternative)) {
      for (const alt of data.alternative) {
        if (alt && alt.id && validIds.has(alt.id) && !picks.some(p => p.profumoId === alt.id)) {
          const cand = candidates.find(c => c.profumo.id === alt.id);
          picks.push({
            profumoId: alt.id,
            ruolo: 'alternativa',
            motivazione: String(alt.motivazione || '').slice(0, 220),
            punteggio: cand ? cand.punteggio : 70,
            fonte: 'ai',
          });
        }
      }
    }

    return picks.length > 0 ? picks : null;
  } catch {
    return null;
  }
}
