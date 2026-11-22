import { Profumo, Indosso, isCollezioneProfumo } from './supabase';
import { formatPerfumeNote } from './dictionary';
import { extractCanonicalFamilies } from './families';

export type PyramidLayer = 'all' | 'testa' | 'cuore' | 'fondo';

export interface NoteNode {
  id: string;
  label: string;
  family: string;
  count: number;
  layers: { testa: number; cuore: number; fondo: number };
  perfumeIds: string[];
}

export interface NoteLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  sourceFamily: string;
  targetFamily: string;
  weight: number;
  lift: number;
  perfumes: Profumo[];
}

export interface FamilyStat {
  family: string;
  count: number;
  notesCount: number;
}

export interface OlfactiveGraphData {
  nodes: NoteNode[];
  links: NoteLink[];
  familyLinks: NoteLink[];
  families: FamilyStat[];
  totalPerfumes: number;
}

const MAX_NODES = 40;

function splitRawNotes(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;•·|/]+/)
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && n.length <= 36);
}

export function inferNoteFamily(noteLabel: string, fallbackFamily: string): string {
  const n = noteLabel.toLowerCase();

  if (/(bergamotto|limone|mandarino|arancia|pompelmo|cedro|lime|yuzu|neroli|petitgrain|verbena|agrume)/.test(n)) {
    return 'Agrumata';
  }
  if (/(rosa|gelsomino|iris|neroli|tuberosa|gardenia|fiori|fiore|violetta|peonia|magnolia|ylang|lavanda|geranio|osmanto|fresia|mughetto|mimosa)/.test(n)) {
    return 'Floreale';
  }
  if (/(sandalo|legno|cedro|vetiver|patchouli|oud|agarwood|guaiaco|cipresso|pino|abete|betulla|muschio di quercia|quercia|ebano|papiro)/.test(n)) {
    return 'Legnosa';
  }
  if (/(ambra|benzoino|labdano|incenso|olibano|mirra|resina|balsamo|opoponax|storace)/.test(n)) {
    return 'Ambrata';
  }
  if (/(pepe|cardamomo|cannella|zafferano|noce moscata|chiodi di garofano|zenzero|cumino|coriandolo|anice|spezie)/.test(n)) {
    return 'Speziata';
  }
  if (/(vaniglia|fava tonka|caramello|cioccolato|cacao|miele|mandorla|nocciola|caffè|rum|cognac|zucchero|pralina|latte|cocco)/.test(n)) {
    return 'Gourmand';
  }
  if (/(cuoio|pelle|scamosciato|catrame|tabacco|fumo|cenere|zibetto|castoreo|animale)/.test(n)) {
    return 'Cuoiata';
  }
  if (/(muschio|ambroxan|iso e|cashmeran|ambra grigia|aldeidi)/.test(n)) {
    return 'Muschiata';
  }
  if (/(sale|marino|alga|acqua|ozono|pioggia|brezza)/.test(n)) {
    return 'Marina';
  }
  if (/(tè|tè verde|foglia|erba|menta|basilico|rosmarino|salvia|timo|eucalipto|galbano|fico|assenzio)/.test(n)) {
    return 'Verde';
  }
  if (/(mela|pera|pesca|ribes|lampone|fragola|ciliegia|prugna|albicocca|ananas|mango|frutti)/.test(n)) {
    return 'Fruttata';
  }

  return fallbackFamily || 'Legnosa';
}

export const FAMILY_ORDER = [
  'Agrumata',
  'Marina',
  'Verde',
  'Aromatica',
  'Floreale',
  'Fruttata',
  'Speziata',
  'Gourmand',
  'Ambrata',
  'Legnosa',
  'Cuoiata',
  'Muschiata',
];

export function buildOlfactiveGraph(
  profumi: Profumo[],
  indossi: Indosso[],
  scope: 'all' | 'worn',
  layer: PyramidLayer = 'all'
): OlfactiveGraphData {
  const collection = (profumi || []).filter((p) => p && isCollezioneProfumo(p));
  const wornIds = new Set((indossi || []).map((i) => i.profumo_id).filter(Boolean));
  const pool = scope === 'worn' ? collection.filter((p) => wornIds.has(p.id)) : collection;

  if (pool.length === 0) {
    return { nodes: [], links: [], familyLinks: [], families: [], totalPerfumes: 0 };
  }

  const noteMap = new Map<
    string,
    {
      label: string;
      familyVotes: Map<string, number>;
      perfumeIds: Set<string>;
      layers: { testa: number; cuore: number; fondo: number };
    }
  >();

  const perfumeNotesMap = new Map<string, string[]>();
  const perfumeFamiliesMap = new Map<string, string[]>();

  for (const p of pool) {
    const fams = extractCanonicalFamilies(p.famiglia_olfattiva);
    const primaryFam = fams[0] || 'Legnosa';
    const seenInPerfume = new Set<string>();
    const familiesInPerfume = new Set<string>(fams.length > 0 ? fams : [primaryFam]);

    const layersToRead: Array<{ key: 'testa' | 'cuore' | 'fondo'; raw?: string | null }> = [
      { key: 'testa', raw: p.note_testa },
      { key: 'cuore', raw: p.note_cuore },
      { key: 'fondo', raw: p.note_fondo },
    ];

    for (const item of layersToRead) {
      if (layer !== 'all' && item.key !== layer) continue;
      for (const raw of splitRawNotes(item.raw)) {
        const formatted = formatPerfumeNote(raw) || raw;
        const key = formatted.toLowerCase();
        const inferredFam = inferNoteFamily(formatted, primaryFam);
        familiesInPerfume.add(inferredFam);

        let entry = noteMap.get(key);
        if (!entry) {
          entry = {
            label: formatted,
            familyVotes: new Map(),
            perfumeIds: new Set(),
            layers: { testa: 0, cuore: 0, fondo: 0 },
          };
          noteMap.set(key, entry);
        }
        entry.layers[item.key] += 1;

        if (!seenInPerfume.has(key)) {
          seenInPerfume.add(key);
          entry.perfumeIds.add(p.id);
          entry.familyVotes.set(inferredFam, (entry.familyVotes.get(inferredFam) || 0) + 1);
        }
      }
    }

    perfumeNotesMap.set(p.id, Array.from(seenInPerfume));
    perfumeFamiliesMap.set(p.id, Array.from(familiesInPerfume));
  }

  const allNodes: NoteNode[] = Array.from(noteMap.entries())
    .map(([id, entry]) => {
      let bestFamily = 'Legnosa';
      let bestVotes = -1;
      for (const [fam, votes] of entry.familyVotes.entries()) {
        if (votes > bestVotes) {
          bestVotes = votes;
          bestFamily = fam;
        }
      }
      return {
        id,
        label: entry.label,
        family: bestFamily,
        count: entry.perfumeIds.size,
        layers: entry.layers,
        perfumeIds: Array.from(entry.perfumeIds),
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_NODES);

  allNodes.sort((a, b) => {
    const idxA = FAMILY_ORDER.indexOf(a.family);
    const idxB = FAMILY_ORDER.indexOf(b.family);
    const orderA = idxA === -1 ? 99 : idxA;
    const orderB = idxB === -1 ? 99 : idxB;
    if (orderA !== orderB) return orderA - orderB;
    return b.count - a.count;
  });

  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const perfumeById = new Map(pool.map((p) => [p.id, p]));
  const N = pool.length;

  // Co-occorrenza tra note + Lift: P(A,B) / (P(A) * P(B))
  const pairMap = new Map<string, { a: NoteNode; b: NoteNode; perfumeIds: Set<string> }>();

  for (const [perfumeId, keys] of perfumeNotesMap.entries()) {
    const activeKeys = keys.filter((k) => nodeById.has(k)).sort();
    for (let i = 0; i < activeKeys.length; i++) {
      for (let j = i + 1; j < activeKeys.length; j++) {
        const k1 = activeKeys[i];
        const k2 = activeKeys[j];
        const pairKey = `${k1}__${k2}`;
        let pair = pairMap.get(pairKey);
        if (!pair) {
          pair = { a: nodeById.get(k1)!, b: nodeById.get(k2)!, perfumeIds: new Set() };
          pairMap.set(pairKey, pair);
        }
        pair.perfumeIds.add(perfumeId);
      }
    }
  }

  const links: NoteLink[] = Array.from(pairMap.entries())
    .map(([id, pair]) => {
      const perfumes = Array.from(pair.perfumeIds)
        .map((pid) => perfumeById.get(pid))
        .filter((p): p is Profumo => Boolean(p));
      const weight = perfumes.length;
      const expected = (pair.a.count * pair.b.count) / Math.max(1, N);
      const lift = expected > 0 ? Number((weight / expected).toFixed(2)) : 1;

      return {
        id,
        sourceId: pair.a.id,
        targetId: pair.b.id,
        sourceLabel: pair.a.label,
        targetLabel: pair.b.label,
        sourceFamily: pair.a.family,
        targetFamily: pair.b.family,
        weight,
        lift,
        perfumes,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  // Matrice macro delle Famiglie (per la vista "Accordi / Sinergie")
  const famPairMap = new Map<string, { f1: string; f2: string; perfumeIds: Set<string> }>();
  const famCountMap = new Map<string, number>();

  for (const [perfumeId, fams] of perfumeFamiliesMap.entries()) {
    const sorted = [...new Set(fams)].sort();
    for (const f of sorted) {
      famCountMap.set(f, (famCountMap.get(f) || 0) + 1);
    }
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}__${sorted[j]}`;
        let entry = famPairMap.get(key);
        if (!entry) {
          entry = { f1: sorted[i], f2: sorted[j], perfumeIds: new Set() };
          famPairMap.set(key, entry);
        }
        entry.perfumeIds.add(perfumeId);
      }
    }
  }

  const familyLinks: NoteLink[] = Array.from(famPairMap.entries())
    .map(([id, item]) => {
      const perfumes = Array.from(item.perfumeIds)
        .map((pid) => perfumeById.get(pid))
        .filter((p): p is Profumo => Boolean(p));
      const weight = perfumes.length;
      const c1 = famCountMap.get(item.f1) || 1;
      const c2 = famCountMap.get(item.f2) || 1;
      const expected = (c1 * c2) / Math.max(1, N);
      const lift = expected > 0 ? Number((weight / expected).toFixed(2)) : 1;

      return {
        id,
        sourceId: item.f1,
        targetId: item.f2,
        sourceLabel: item.f1,
        targetLabel: item.f2,
        sourceFamily: item.f1,
        targetFamily: item.f2,
        weight,
        lift,
        perfumes,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  const famStatsMap = new Map<string, { notes: number; totalMentions: number }>();
  for (const node of allNodes) {
    const cur = famStatsMap.get(node.family) || { notes: 0, totalMentions: 0 };
    cur.notes += 1;
    cur.totalMentions += node.count;
    famStatsMap.set(node.family, cur);
  }

  const families: FamilyStat[] = FAMILY_ORDER.filter((f) => famStatsMap.has(f)).map((family) => ({
    family,
    count: famStatsMap.get(family)!.totalMentions,
    notesCount: famStatsMap.get(family)!.notes,
  }));

  return {
    nodes: allNodes,
    links,
    familyLinks,
    families,
    totalPerfumes: pool.length,
  };
}
