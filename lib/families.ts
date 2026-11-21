// lib/families.ts
// Fonte unica e oggettiva per famiglie olfattive canoniche (12), accordi secondari,
// proiezione verso i 6 assi dello Scent DNA e risoluzione cromatica Aura.

export const PURE_FAMILIES = [
  'Agrumata',
  'Aromatica',
  'Marina',
  'Floreale',
  'Fruttata',
  'Verde',
  'Speziata',
  'Legnosa',
  'Ambrata',
  'Gourmand',
  'Cuoiata',
  'Muschiata',
] as const;

export type PureFamily = (typeof PURE_FAMILIES)[number];

export type ScentAxisKey =
  | 'agrumatoFresco'
  | 'florealeFruttato'
  | 'legnosoTerroso'
  | 'ambratoOrientale'
  | 'gourmandDolce'
  | 'cuoiatoAnimale';

export interface FamilyAuraPalette {
  primary: string;
  secondary: string;
  familyLabel: string;
}

interface CanonicalFamilyDefinition {
  family: PureFamily;
  stems: readonly string[];
  axis: ScentAxisKey;
  aura: FamilyAuraPalette;
}

/**
 * Definizione unica delle 12 Famiglie Canoniche:
 * - stems: radici IT/EN per il riconoscimento oggettivo da stringhe grezze o accordi
 * - axis: asse corrispondente nel radar Scent DNA
 * - aura: coppia cromatica ufficiale del tema Aura
 */
export const CANONICAL_FAMILY_DEFS: ReadonlyArray<CanonicalFamilyDefinition> = [
  {
    family: 'Agrumata',
    stems: ['agrum', 'citrus', 'esperid', 'bergamot', 'limon', 'neroli', 'yuzu'],
    axis: 'agrumatoFresco',
    aura: { primary: '#34D399', secondary: '#114232', familyLabel: 'Agrumato Verde' },
  },
  {
    family: 'Aromatica',
    stems: ['aromatic', 'fouger', 'fougèr', 'lavand', 'salvia', 'rosmarin', 'erbace'],
    axis: 'agrumatoFresco',
    aura: { primary: '#38BDF8', secondary: '#172554', familyLabel: 'Marino Aromatico' },
  },
  {
    family: 'Marina',
    stems: ['marin', 'acquat', 'aquat', 'acque', 'ozon', 'sale', 'salin'],
    axis: 'agrumatoFresco',
    aura: { primary: '#38BDF8', secondary: '#172554', familyLabel: 'Marino Aromatico' },
  },
  {
    family: 'Verde',
    stems: ['verd', 'green', 'forestal', 'chypre', 'cipriat', 'terros', 'earth'],
    axis: 'agrumatoFresco',
    aura: { primary: '#34D399', secondary: '#114232', familyLabel: 'Agrumato Verde' },
  },
  {
    family: 'Floreale',
    stems: ['floreal', 'fiorit', 'floral', 'rosa', 'gelsomin', 'iris', 'tuber', 'polveros', 'powdery', 'talc'],
    axis: 'florealeFruttato',
    aura: { primary: '#F472B6', secondary: '#500724', familyLabel: 'Floreale' },
  },
  {
    family: 'Fruttata',
    stems: ['fruttat', 'fruity', 'tropical', 'tropic'],
    axis: 'florealeFruttato',
    aura: { primary: '#F472B6', secondary: '#500724', familyLabel: 'Floreale' },
  },
  {
    family: 'Legnosa',
    stems: ['legnos', 'woody', 'bois', 'oud', 'sandal', 'cedr', 'vetiver', 'patchouli'],
    axis: 'legnosoTerroso',
    aura: { primary: '#F59E0B', secondary: '#592212', familyLabel: 'Legnoso Ambrato' },
  },
  {
    family: 'Muschiata',
    stems: ['musch', 'musk', 'pulit', 'clean'],
    axis: 'legnosoTerroso',
    aura: { primary: '#C084FC', secondary: '#2E1065', familyLabel: 'Cuoiato Muschiato' },
  },
  {
    family: 'Ambrata',
    stems: ['ambrat', 'amber', 'oriental', 'resin', 'balsam', 'incens', 'mirra', 'labdan'],
    axis: 'ambratoOrientale',
    aura: { primary: '#F59E0B', secondary: '#592212', familyLabel: 'Legnoso Ambrato' },
  },
  {
    family: 'Speziata',
    stems: ['spezi', 'spic', 'pepe', 'cannell', 'cardamom', 'zafferan'],
    axis: 'ambratoOrientale',
    aura: { primary: '#FB7185', secondary: '#4C1127', familyLabel: 'Speziato Caldo' },
  },
  {
    family: 'Gourmand',
    stems: ['gourmand', 'vanigl', 'vanilla', 'dolc', 'sweet', 'lattonic', 'cremos', 'creamy', 'liquor', 'boozy', 'vino'],
    axis: 'gourmandDolce',
    aura: { primary: '#FBBF24', secondary: '#4A2511', familyLabel: 'Gourmand' },
  },
  {
    family: 'Cuoiata',
    stems: ['cuoi', 'leath', 'animal', 'tabacc', 'fum', 'smok', 'affumicat', 'metall', 'ferros', 'sintetic'],
    axis: 'cuoiatoAnimale',
    aura: { primary: '#C084FC', secondary: '#2E1065', familyLabel: 'Cuoiato Muschiato' },
  },
];

const DEF_BY_FAMILY = new Map<PureFamily, CanonicalFamilyDefinition>(
  CANONICAL_FAMILY_DEFS.map((d) => [d.family, d])
);

/**
 * Normalizza una stringa grezza o composita (es. "Fumée / Cuoiata / Speziata" o
 * "Oriental, Woody") nella famiglia canonica dominante, oppure null se assente/non riconosciuta.
 * Non inventa mai un default arbitrario.
 */
export function normalizeFamily(raw?: string | null): PureFamily | null {
  const matches = extractCanonicalFamilies(raw);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Estrae tutte le famiglie canoniche presenti in una stringa composita o array JSON di tag,
 * preservando l'ordine di apparizione (dominanza) senza duplicati.
 */
export function extractCanonicalFamilies(raw?: string | string[] | null): PureFamily[] {
  if (!raw) return [];

  let segments: string[];
  if (Array.isArray(raw)) {
    segments = raw.map((s) => String(s || '').trim()).filter(Boolean);
  } else {
    const trimmed = String(raw).trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          segments = parsed.map((s) => String(s || '').trim()).filter(Boolean);
        } else {
          segments = [trimmed];
        }
      } catch {
        segments = trimmed.split(/[/,|;•]+/);
      }
    } else {
      segments = trimmed.split(/[/,|;•]+/);
    }
  }

  const found: PureFamily[] = [];
  for (const seg of segments) {
    const lower = seg.toLowerCase().trim();
    if (!lower) continue;
    for (const def of CANONICAL_FAMILY_DEFS) {
      if (def.stems.some((stem) => lower.includes(stem))) {
        if (!found.includes(def.family)) {
          found.push(def.family);
        }
      }
    }
  }

  return found;
}

export function getFamilyDefinition(family: PureFamily): CanonicalFamilyDefinition {
  return DEF_BY_FAMILY.get(family)!;
}

export function getAxisForFamily(family: PureFamily): ScentAxisKey {
  return DEF_BY_FAMILY.get(family)!.axis;
}

export function getAuraForFamily(family: PureFamily): FamilyAuraPalette {
  return DEF_BY_FAMILY.get(family)!.aura;
}

export function isWarmEveningFamily(raw?: string | null): boolean {
  const fams = extractCanonicalFamilies(raw);
  return fams.some((f) => f === 'Ambrata' || f === 'Cuoiata' || f === 'Speziata' || f === 'Gourmand');
}

export function isColdWeatherFamily(raw?: string | null): boolean {
  const fams = extractCanonicalFamilies(raw);
  return fams.some(
    (f) => f === 'Ambrata' || f === 'Legnosa' || f === 'Speziata' || f === 'Gourmand' || f === 'Cuoiata'
  );
}

export function isWarmWeatherFamily(raw?: string | null): boolean {
  const fams = extractCanonicalFamilies(raw);
  return fams.some((f) => f === 'Agrumata' || f === 'Marina' || f === 'Verde' || f === 'Aromatica');
}
