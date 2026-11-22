'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Profumo } from '@/lib/supabase';
import { formatPerfumeNote } from '@/lib/dictionary';
import { resolveAura } from './AuraProvider';

interface CooccurrenceDataset {
  population: number;
  noteCount: number;
  names: string[];
  totals: Record<string, number>;
  groups: Record<string, string>;
  matrix: number[][];
}

let cachedDataset: CooccurrenceDataset | null = null;
let datasetPromise: Promise<CooccurrenceDataset | null> | null = null;

async function loadGlobalCooccurrence(): Promise<CooccurrenceDataset | null> {
  if (cachedDataset) return cachedDataset;
  if (!datasetPromise) {
    datasetPromise = fetch('/data/note-cooccurrence.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.names) && Array.isArray(data.matrix)) {
          cachedDataset = data as CooccurrenceDataset;
        }
        return cachedDataset;
      })
      .catch(() => null);
  }
  return datasetPromise;
}

const IT_TO_EN_NOTES: Record<string, string> = {
  bergamotto: 'bergamot',
  'bergamotto di calabria': 'bergamot',
  mandarino: 'mandarin orange',
  'mandarino verde': 'mandarin orange',
  limone: 'lemon',
  'limone di amalfi': 'amalfi lemon',
  arancia: 'orange',
  'arancia amara': 'bitter orange',
  'arancia rossa': 'orange',
  neroli: 'neroli',
  lime: 'lime',
  agrumi: 'citruses',
  tangerino: 'tangerine',
  pompelmo: 'grapefruit',
  'note verdi': 'green notes',
  aldeidi: 'aldehydes',
  galbano: 'galbanum',
  petitgrain: 'petitgrain',
  'note marine': 'sea notes',
  sale: 'sea notes',
  menta: 'mint',
  basilico: 'basil',
  salvia: 'sage',
  'salvia sclarea': 'clary sage',
  tabacco: 'tobacco',
  artemisia: 'artemisia',
  ginepro: 'juniper',
  'bacche di ginepro': 'juniper berries',
  timo: 'thyme',
  tè: 'tea',
  'tè verde': 'tea',
  'tè nero': 'tea',
  gelsomino: 'jasmine',
  'gelsomino sambac': 'jasmine sambac',
  rosa: 'rose',
  'rosa bulgara': 'bulgarian rose',
  'rosa turca': 'turkish rose',
  'rosa damascena': 'damask rose',
  mughetto: 'lily-of-the-valley',
  lavanda: 'lavender',
  "fiori d'arancio": 'orange blossom',
  "fiore d'arancio": 'orange blossom',
  'ylang-ylang': 'ylang-ylang',
  'ylang ylang': 'ylang-ylang',
  violetta: 'violet',
  'foglia di violetta': 'violet leaf',
  'foglie di violetta': 'violet leaf',
  iris: 'iris',
  'radice di iris': 'orris root',
  giaggiolo: 'orris',
  geranio: 'geranium',
  fresia: 'freesia',
  tuberosa: 'tuberose',
  peonia: 'peony',
  garofano: 'carnation',
  eliotropio: 'heliotrope',
  magnolia: 'magnolia',
  gardenia: 'gardenia',
  orchidea: 'orchid',
  giglio: 'lily',
  rosmarino: 'rosemary',
  osmanto: 'osmanthus',
  ciclamino: 'cyclamen',
  mimosa: 'mimosa',
  narciso: 'narcissus',
  loto: 'lotus',
  'fiore di loto': 'lotus',
  'note floreali': 'floral notes',
  'fiori bianchi': 'white flowers',
  ninfea: 'water lily',
  lillà: 'lilac',
  frangipane: 'frangipani',
  pesca: 'peach',
  'ribes nero': 'black currant',
  cassis: 'cassis',
  pera: 'pear',
  lampone: 'raspberry',
  mela: 'apple',
  'mela verde': 'green apple',
  'mela rossa': 'red apple',
  prugna: 'plum',
  cocco: 'coconut',
  albicocca: 'apricot',
  litchi: 'litchi',
  melone: 'melon',
  'frutti rossi': 'red berries',
  'note fruttate': 'fruity notes',
  mora: 'blackberry',
  'frutto della passione': 'passionfruit',
  rabarbaro: 'rhubarb',
  fico: 'fig',
  ananas: 'pineapple',
  vaniglia: 'vanilla',
  'vaniglia del madagascar': 'madagascar vanilla',
  'fava tonka': 'tonka bean',
  miele: 'honey',
  caramello: 'caramel',
  mandorla: 'almond',
  pralina: 'praline',
  caffè: 'coffee',
  caprifoglio: 'honeysuckle',
  rum: 'rum',
  cardamomo: 'cardamom',
  'pepe rosa': 'pink pepper',
  cannella: 'cinnamon',
  'noce moscata': 'nutmeg',
  zafferano: 'saffron',
  zenzero: 'ginger',
  coriandolo: 'coriander',
  pepe: 'pepper',
  'pepe nero': 'black pepper',
  'chiodi di garofano': 'cloves',
  spezie: 'spices',
  anice: 'anise',
  ambra: 'amber',
  benzoino: 'benzoin',
  labdano: 'labdanum',
  incenso: 'incense',
  'ambra grigia': 'ambergris',
  olibano: 'olibanum',
  mirra: 'myrrh',
  ambroxan: 'ambroxan',
  storace: 'styrax',
  ambretta: 'ambrette (musk mallow)',
  elemi: 'elemi',
  sandalo: 'sandalwood',
  'legno di sandalo': 'sandalwood',
  patchouli: 'patchouli',
  cedro: 'cedar',
  'legno di cedro': 'cedar',
  'cedro della virginia': 'virginia cedar',
  vetiver: 'vetiver',
  'muschio di quercia': 'oakmoss',
  oud: 'agarwood (oud)',
  agarwood: 'agarwood (oud)',
  'note legnose': 'woody notes',
  'legno di guaiaco': 'guaiac wood',
  guaiaco: 'guaiac wood',
  muschio: 'musk',
  'muschio bianco': 'white musk',
  'legno di cashmere': 'cashmere wood',
  cipresso: 'cypress',
  cashmeran: 'cashmeran',
  cipriolo: 'cypriol oil or nagarmotha',
  nagarmotha: 'cypriol oil or nagarmotha',
  betulla: 'birch',
  amberwood: 'amberwood',
  cuoio: 'leather',
  pelle: 'leather',
  scamosciato: 'suede',
  'pelle scamosciata': 'suede',
};

const EN_GROUP_TO_IT: Record<string, string> = {
  citrus: 'Agrumata',
  fresh: 'Marina',
  herbal: 'Aromatica',
  floral: 'Floreale',
  fruity: 'Fruttata',
  sweet: 'Gourmand',
  spicy: 'Speziata',
  amber: 'Ambrata',
  woody: 'Legnosa',
  musky: 'Muschiata',
};

const TIER_COLORS = ['#E6B422', '#E0689A', '#8A6A4F'];
const TIER_LABELS = ['Testa', 'Cuore', 'Fondo'];

function splitNotes(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;•·|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 36);
}

function polarToXY(cx: number, cy: number, r: number, rad: number) {
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  start: number,
  end: number
) {
  const safeEnd = end - start < 0.01 ? start + 0.01 : end;
  const large = safeEnd - start > Math.PI ? 1 : 0;
  const p1 = polarToXY(cx, cy, rOut, start);
  const p2 = polarToXY(cx, cy, rOut, safeEnd);
  const p3 = polarToXY(cx, cy, rIn, safeEnd);
  const p4 = polarToXY(cx, cy, rIn, start);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function ribbonPath(
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number,
  b1: number,
  b2: number
) {
  const s1 = polarToXY(cx, cy, r, a1);
  const s2 = polarToXY(cx, cy, r, a2);
  const t1 = polarToXY(cx, cy, r, b1);
  const t2 = polarToXY(cx, cy, r, b2);
  return [
    `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    `A ${r} ${r} 0 0 1 ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`,
    `Q ${cx} ${cy} ${t1.x.toFixed(2)} ${t1.y.toFixed(2)}`,
    `A ${r} ${r} 0 0 1 ${t2.x.toFixed(2)} ${t2.y.toFixed(2)}`,
    `Q ${cx} ${cy} ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

interface BottleNoteItem {
  label: string;
  enKey: string | null;
  matrixIdx: number;
  tier: 0 | 1 | 2;
  familyIt: string;
  globalTotal: number;
}

type FocusState =
  | { type: 'pair'; a: number; b: number }
  | { type: 'note'; slot: number }
  | { type: 'group'; band: 'tier' | 'family'; key: string; from: number; to: number }
  | null;

export function PerfumeChord({ profumo }: { profumo: Profumo }) {
  const [dataset, setDataset] = useState<CooccurrenceDataset | null>(cachedDataset);
  const [mode, setMode] = useState<'conventional' | 'distinctive'>('conventional');
  const [arrange, setArrange] = useState<'tier' | 'family'>('tier');
  const [hover, setHover] = useState<FocusState>(null);
  const [selected, setSelected] = useState<FocusState>(null);

  useEffect(() => {
    let cancelled = false;
    loadGlobalCooccurrence().then((data) => {
      if (!cancelled && data) setDataset(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHover(null);
    setSelected(null);
  }, [profumo.id]);

  // Estrae le note dichiarate nei 3 strati (Testa=0, Cuore=1, Fondo=2)
  const rawNotes = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ label: string; tier: 0 | 1 | 2 }> = [];
    const tiers: Array<{ tier: 0 | 1 | 2; text?: string | null }> = [
      { tier: 0, text: profumo.note_testa },
      { tier: 1, text: profumo.note_cuore },
      { tier: 2, text: profumo.note_fondo },
    ];

    for (let t = 0; t < tiers.length; t++) {
      const list = splitNotes(tiers[t].text);
      for (let i = 0; i < list.length; i++) {
        const formatted = formatPerfumeNote(list[i]) || list[i];
        const key = formatted.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label: formatted, tier: tiers[t].tier });
      }
    }
    return out.slice(0, 20);
  }, [profumo]);

  const view = useMemo(() => {
    const nameIndex = new Map<string, number>();
    if (dataset) {
      for (let i = 0; i < dataset.names.length; i++) {
        nameIndex.set(dataset.names[i].toLowerCase(), i);
      }
    }

    const mapped: BottleNoteItem[] = rawNotes.map((item) => {
      const lower = item.label.toLowerCase();
      const enCandidate = IT_TO_EN_NOTES[lower] || lower;
      const idx = nameIndex.has(enCandidate) ? nameIndex.get(enCandidate)! : -1;
      const enKey = idx >= 0 && dataset ? dataset.names[idx] : null;
      const enGroup = enKey && dataset ? dataset.groups[enKey] : null;
      const familyIt =
        (enGroup && EN_GROUP_TO_IT[enGroup]) ||
        profumo.famiglia_olfattiva ||
        'Legnosa';
      const globalTotal = enKey && dataset ? dataset.totals[enKey] || 0 : 0;

      return {
        label: item.label,
        enKey,
        matrixIdx: idx,
        tier: item.tier,
        familyIt,
        globalTotal,
      };
    });

    const ordered =
      arrange === 'family'
        ? mapped
            .slice()
            .sort(
              (a, b) =>
                a.familyIt.localeCompare(b.familyIt) ||
                a.tier - b.tier ||
                a.label.localeCompare(b.label)
            )
        : mapped;

    const n = ordered.length;
    if (n === 0) {
      return {
        items: [],
        arcs: [],
        ribbons: [],
        tierRuns: [],
        familyRuns: [],
        pairCounts: [],
      };
    }

    // Matrice co-occorrenze globali tra le note del flacone
    const pairCounts: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0)
    );
    const population = dataset?.population || 24059;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const mi = ordered[i].matrixIdx;
        const mj = ordered[j].matrixIdx;
        let count = 0;
        if (dataset && mi >= 0 && mj >= 0) {
          count = dataset.matrix[mi]?.[mj] || 0;
        }
        pairCounts[i][j] = count;
        pairCounts[j][i] = count;
      }
    }

    // Calcola peso visivo di ciascun arco e nastro (formula PerfumeChord: EXPONENT 0.45, SHRINK 60)
    const linkWeights: Array<{
      a: number;
      b: number;
      count: number;
      lift: number;
      visualWeight: number;
    }> = [];
    const nodeStrength = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const count = pairCounts[i][j];
        const tA = ordered[i].globalTotal || 200;
        const tB = ordered[j].globalTotal || 200;
        const expected = (tA * tB) / population;
        const lift = count > 0 && expected > 0 ? count / expected : 1;

        let w = 0.6;
        if (count > 0) {
          if (mode === 'distinctive') {
            const damped = 1 + (lift - 1) * (count / (count + 60));
            w = Math.pow(Math.max(0.2, damped), 1.4);
          } else {
            w = Math.pow(count, 0.45);
          }
        }
        linkWeights.push({ a: i, b: j, count, lift, visualWeight: w });
        nodeStrength[i] += w;
        nodeStrength[j] += w;
      }
    }

    const totalStrength = nodeStrength.reduce((acc, v) => acc + v, 0) || 1;
    const gap = 0.032;
    const usable = Math.PI * 2 - gap * n;
    let cursor = -Math.PI / 2;

    const arcs = ordered.map((item, idx) => {
      const span = Math.max(0.08, (nodeStrength[idx] / totalStrength) * usable);
      const seg = {
        slot: idx,
        item,
        start: cursor,
        end: cursor + span,
        mid: cursor + span / 2,
      };
      cursor += span + gap;
      return seg;
    });

    // Ribbons proporzionali al peso su ogni arco
    const slotCursor = arcs.map((a) => a.start);
    const ribbons = linkWeights
      .filter((l) => l.count > 0 || !dataset)
      .sort((x, y) => y.visualWeight - x.visualWeight)
      .map((l) => {
        const arcA = arcs[l.a];
        const arcB = arcs[l.b];
        const spanA =
          ((arcA.end - arcA.start) * l.visualWeight) /
          Math.max(0.01, nodeStrength[l.a]);
        const spanB =
          ((arcB.end - arcB.start) * l.visualWeight) /
          Math.max(0.01, nodeStrength[l.b]);

        const a1 = slotCursor[l.a];
        const a2 = Math.min(arcA.end, a1 + Math.max(0.012, spanA));
        slotCursor[l.a] = a2;

        const b1 = slotCursor[l.b];
        const b2 = Math.min(arcB.end, b1 + Math.max(0.012, spanB));
        slotCursor[l.b] = b2;

        return { ...l, a1, a2, b1, b2 };
      });

    // Raggruppamenti contigui per anello Piramide (tier) e anello Famiglia
    const buildRuns = (keyFn: (slot: number) => string) => {
      const runs: Array<{
        key: string;
        from: number;
        to: number;
        start: number;
        end: number;
      }> = [];
      let i = 0;
      while (i < arcs.length) {
        const key = keyFn(i);
        let j = i;
        while (j < arcs.length && keyFn(j) === key) j++;
        runs.push({
          key,
          from: i,
          to: j - 1,
          start: arcs[i].start,
          end: arcs[j - 1].end,
        });
        i = j;
      }
      return runs;
    };

    const tierRuns = buildRuns((s) => TIER_LABELS[ordered[s].tier]);
    const familyRuns = buildRuns((s) => ordered[s].familyIt);

    return { items: ordered, arcs, ribbons, tierRuns, familyRuns, pairCounts };
  }, [rawNotes, dataset, mode, arrange, profumo.famiglia_olfattiva]);

  if (rawNotes.length < 2) {
    return null;
  }

  const active = hover ?? selected;
  const CX = 260;
  const CY = 260;
  const RIBBON_R = 118;
  const TIER_R = { inner: 123, outer: 136 };
  const FAM_R = { inner: 140, outer: 151 };
  const NOTE_R = { inner: 155, outer: 166 };
  const LABEL_R = 176;

  const slotLit = (slot: number) => {
    if (!active) return true;
    if (active.type === 'pair') return active.a === slot || active.b === slot;
    if (active.type === 'note') return active.slot === slot;
    return slot >= active.from && slot <= active.to;
  };

  const toggleFocus = (next: FocusState) => {
    setSelected((prev) =>
      prev && next && JSON.stringify(prev) === JSON.stringify(next) ? null : next
    );
  };

  // Testo centrale dinamico
  let leadLine = `${view.items.length} note`;
  let subLine = TIER_LABELS.map(
    (lbl, t) => `${view.items.filter((x) => x.tier === t).length} ${lbl}`
  ).join(' · ');
  let detailLine = '';

  if (active?.type === 'note') {
    const it = view.items[active.slot];
    if (it) {
      leadLine = it.label;
      subLine = `${it.familyIt} · ${TIER_LABELS[it.tier]}`;
      detailLine =
        it.globalTotal > 0
          ? `${it.globalTotal.toLocaleString('it-IT')} profumi nel catalogo`
          : '';
    }
  } else if (active?.type === 'group') {
    const count = active.to - active.from + 1;
    leadLine = active.key;
    subLine = `${active.band === 'tier' ? 'Piramide' : 'Famiglia'} · ${count} ${
      count === 1 ? 'nota' : 'note'
    }`;
  } else if (active?.type === 'pair') {
    const itA = view.items[active.a];
    const itB = view.items[active.b];
    const cnt = view.pairCounts[active.a]?.[active.b] || 0;
    const pop = dataset?.population || 24059;
    const exp = ((itA?.globalTotal || 200) * (itB?.globalTotal || 200)) / pop;
    const lift = cnt > 0 && exp > 0 ? cnt / exp : 1;
    leadLine = `${itA?.label} × ${itB?.label}`;
    subLine =
      cnt > 0
        ? `${cnt.toLocaleString('it-IT')} profumi · ${lift.toFixed(1)}×`
        : 'Accordo presente in questa creazione';
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#08060C]/95 p-4 sm:p-6 space-y-4">
      {/* Header & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-xl text-[#F6EFE4]">
            Anatomia degli Accordi
          </h4>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8A9C9]/75">
            Confronto su {(dataset?.population || 24059).toLocaleString('it-IT')} fragranze
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Convenzionale vs Distintivo */}
          <div className="inline-flex rounded-full border border-white/10 bg-[#0E0A16] p-0.5">
            <button
              type="button"
              onClick={() => setMode('conventional')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                mode === 'conventional'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Convenzionale
            </button>
            <button
              type="button"
              onClick={() => setMode('distinctive')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                mode === 'distinctive'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Distintivo
            </button>
          </div>

          {/* Ordina per Piramide vs Famiglia */}
          <div className="inline-flex rounded-full border border-white/10 bg-[#0E0A16] p-0.5">
            <button
              type="button"
              onClick={() => setArrange('tier')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                arrange === 'tier'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Piramide
            </button>
            <button
              type="button"
              onClick={() => setArrange('family')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                arrange === 'family'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Famiglia
            </button>
          </div>
        </div>
      </div>

      {/* Ruota SVG a 3 Anelli Concentrici */}
      <div className="mx-auto aspect-square w-full max-w-[340px] sm:max-w-[400px] select-none">
        <svg
          viewBox="0 0 520 520"
          className="h-full w-full overflow-visible"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {/* Nastri interni */}
          <g>
            {view.ribbons.map((r) => {
              const isLit =
                active == null ||
                (active.type === 'pair'
                  ? active.a === r.a && active.b === r.b
                  : slotLit(r.a) || slotLit(r.b));
              const isExactPair =
                active?.type === 'pair' &&
                active.a === r.a &&
                active.b === r.b;

              return (
                <path
                  key={`${r.a}-${r.b}`}
                  d={ribbonPath(CX, CY, RIBBON_R, r.a1, r.a2, r.b1, r.b2)}
                  fill={isExactPair ? '#FFFFFF' : TIER_COLORS[view.items[r.a].tier]}
                  fillOpacity={isExactPair ? 0.9 : isLit ? 0.46 : 0.06}
                  className="cursor-pointer transition-opacity duration-200"
                  onMouseEnter={() => setHover({ type: 'pair', a: r.a, b: r.b })}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFocus({ type: 'pair', a: r.a, b: r.b });
                  }}
                />
              );
            })}
          </g>

          {/* Anello 1 (interno): Piramide (Testa / Cuore / Fondo) */}
          <g>
            {view.tierRuns.map((run) => {
              const tIdx = TIER_LABELS.indexOf(run.key);
              const lit =
                !active ||
                Array.from({ length: run.to - run.from + 1 }, (_, k) => run.from + k).some(
                  slotLit
                );
              const focus: FocusState = {
                type: 'group',
                band: 'tier',
                key: run.key,
                from: run.from,
                to: run.to,
              };
              return (
                <path
                  key={`tier-${run.key}-${run.from}`}
                  d={arcPath(CX, CY, TIER_R.inner, TIER_R.outer, run.start, run.end)}
                  fill={TIER_COLORS[tIdx] || '#B7C2CB'}
                  fillOpacity={lit ? 0.9 : 0.2}
                  className="cursor-pointer transition-opacity duration-200"
                  onMouseEnter={() => setHover(focus)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFocus(focus);
                  }}
                />
              );
            })}
          </g>

          {/* Anello 2 (medio): Famiglia Olfattiva */}
          <g>
            {view.familyRuns.map((run) => {
              const lit =
                !active ||
                Array.from({ length: run.to - run.from + 1 }, (_, k) => run.from + k).some(
                  slotLit
                );
              const focus: FocusState = {
                type: 'group',
                band: 'family',
                key: run.key,
                from: run.from,
                to: run.to,
              };
              return (
                <path
                  key={`fam-${run.key}-${run.from}`}
                  d={arcPath(CX, CY, FAM_R.inner, FAM_R.outer, run.start, run.end)}
                  fill={resolveAura(run.key).primary}
                  fillOpacity={lit ? 0.92 : 0.22}
                  className="cursor-pointer transition-opacity duration-200"
                  onMouseEnter={() => setHover(focus)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFocus(focus);
                  }}
                />
              );
            })}
          </g>

          {/* Anello 3 (esterno): Singole Note */}
          <g>
            {view.arcs.map((arc) => (
              <path
                key={`note-${arc.slot}`}
                d={arcPath(CX, CY, NOTE_R.inner, NOTE_R.outer, arc.start, arc.end)}
                fill={TIER_COLORS[arc.item.tier]}
                fillOpacity={slotLit(arc.slot) ? 0.95 : 0.22}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHover({ type: 'note', slot: arc.slot })}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFocus({ type: 'note', slot: arc.slot });
                }}
              />
            ))}
          </g>

          {/* Etichette radiali delle Note */}
          <g className="pointer-events-none">
            {view.arcs.map((arc) => {
              const deg = (arc.mid * 180) / Math.PI;
              const flip = Math.cos(arc.mid) < 0;
              return (
                <text
                  key={`lbl-${arc.slot}`}
                  transform={`translate(${CX},${CY}) rotate(${deg}) translate(${LABEL_R},0)${
                    flip ? ' rotate(180)' : ''
                  }`}
                  textAnchor={flip ? 'end' : 'start'}
                  dominantBaseline="middle"
                  opacity={slotLit(arc.slot) ? 1 : 0.28}
                  className="fill-[#F6EFE4] font-mono text-[9px] tracking-wide"
                >
                  {arc.item.label}
                </text>
              );
            })}
          </g>

          {/* Disco Centrale Readout */}
          <g
            className="cursor-pointer"
            onClick={() => setSelected(null)}
          >
            <circle cx={CX} cy={CY} r={54} fill="#08060C" fillOpacity={0.86} />
            <text
              x={CX}
              y={CY - 8}
              textAnchor="middle"
              className="fill-[#F6EFE4] font-serif text-[13px]"
            >
              {leadLine}
            </text>
            <text
              x={CX}
              y={CY + 9}
              textAnchor="middle"
              className="fill-[#B8A9C9] font-mono text-[8px] uppercase tracking-[0.14em]"
            >
              {subLine}
            </text>
            {detailLine && (
              <text
                x={CX}
                y={CY + 23}
                textAnchor="middle"
                className="fill-[#B8A9C9]/75 font-mono text-[7.5px]"
              >
                {detailLine}
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Legenda compatta dei 3 strati */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-3 font-mono text-[10px] text-[#B8A9C9]">
        {TIER_LABELS.map((lbl, idx) => (
          <span key={lbl} className="inline-flex items-center gap-1.5">
            <span
              style={{ backgroundColor: TIER_COLORS[idx] }}
              className="h-2 w-2 rounded-full"
            />
            <span>{lbl}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
