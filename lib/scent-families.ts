// ============================================================================
// SCENT FAMILIES — BOUTIQUE OLFATTIVA — "Enciclopedia Olfattiva"
// ============================================================================
// Mappa le note olfattive (inglese, come nel datasetFragrantica/Scent Chords)
// nelle 10 famiglie editoriali del progetto.
// ============================================================================

export type FamilyId =
  | 'citrus' | 'fresh' | 'herbal' | 'floral' | 'fruity' | 'sweet'
  | 'spicy' | 'amber' | 'woody' | 'musky';

export interface Family {
  id: FamilyId;
  label: string; // italiano (anche se i filtri mostrano l'inglese)
  labelEng: string;
  color: string; // accento su sfondo scuro (dark luxury)
}

// Ordine canonice per i filtri (come richiesto: citrus, fresh, herbal,
// floral, fruity, sweet, spicy, amber, woody, musky).
export const FAMILIES: Family[] = [
  { id: 'citrus',  label: 'Agrumata',     labelEng: 'Citrus',     color: '#C98A3A' },
  { id: 'fresh',   label: 'Verde/Fresh',  labelEng: 'Fresh',      color: '#7FAE95' },
  { id: 'herbal',  label: 'Erba',         labelEng: 'Herbal',     color: '#8F9C57' },
  { id: 'floral',  label: 'Floreale',     labelEng: 'Floral',     color: '#C789BB' },
  { id: 'fruity',  label: 'Fruttata',     labelEng: 'Fruity',     color: '#C67B4A' },
  { id: 'sweet',   label: 'Dolce',        labelEng: 'Sweet',      color: '#B8864A' },
  { id: 'spicy',   label: 'Piccante',     labelEng: 'Spicy',      color: '#A45F3B' },
  { id: 'amber',   label: 'Ambra',        labelEng: 'Amber',      color: '#9C8A6D' },
  { id: 'woody',   label: 'Legnosa',      labelEng: 'Woody',      color: '#6B6357' },
  { id: 'musky',   label: 'Muschiosa',    labelEng: 'Musky',      color: '#7E7686' },
];

export const FAMILY_BY_ID: Record<FamilyId, Family> = Object.fromEntries(
  FAMILIES.map((f) => [f.id, f])
) as Record<FamilyId, Family>;

export function familyOf(id: FamilyId): Family {
  return FAMILY_BY_ID[id];
}

export function familyLabel(id: FamilyId): string {
  return FAMILY_BY_ID[id].labelEng;
}

// ---------------------------------------------------------------------------
// Mappatura nota -> famiglia (chiave per filtri e piramide).
// Ogni regola è una lista di sottostringhe che individuano la famiglia.
// ---------------------------------------------------------------------------
interface Rule {
  keywords: string[];
  family: FamilyId;
}

const RULES: Rule[] = [
  // Citrus
  { keywords: ['bergamot', 'bergamote', 'bergamotto', 'mandarin', 'orange', 'grapefruit', 'grapefruit', 'tangerine', 'lemon', 'lime', 'yuzu', 'neroli', 'petitgrain', 'orange blossom', 'citrus', 'citruses', 'clementine', 'amalfi', 'bitter orange', 'orangeflower', 'cassia', 'bergamote daledo'], family: 'citrus' },
  // Fresh
  { keywords: ['aquatic', 'fresh', 'marine', 'ozone', 'wet stone', 'pine', 'fir', 'eucalyptus', 'mint', 'tea', 'green', 'cucumber', 'algae', 'seaweed', 'seawater', 'salt', 'salty', 'mineral', 'fougère', 'fouggere', 'fern', 'sea notes', 'bergamot leaf', 'tea notes', 'ocean', 'river', 'water', 'cool', 'air'], family: 'fresh' },
  // Herbal
  { keywords: ['lavender', 'lavanda', 'rosemary', 'sage', 'basil', 'thyme', 'mint', 'parsley', 'coriander', 'coriandolo', 'dill', 'fennel', 'fino', 'galbanum', 'angelica', 'tarragon', 'oregano', 'marjoram', 'verbena', 'elderflower', 'herb', 'herbs', 'bergamot'], family: 'herbal' },
  // Floral
  { keywords: ['rose', 'jasmine', 'lily', 'orchid', 'tuberose', 'peony', 'gardenia', 'narcissus', 'frangipani', 'violet', 'iris', 'carnation', 'cherry blossom', 'mimosa', 'freesia', 'mallow', 'baie rouge', 'feverfew', 'ylang', 'petal', 'petals', 'floral', 'flowers', 'blossom', 'damask', 'tea rose', 'gardenia', 'naroli'], family: 'floral' },
  // Fruity
  { keywords: ['peach', 'apricot', 'pear', 'apple', 'berry', 'cherry', 'strawberry', 'raspberry', 'cranberry', 'grape', 'melon', 'pineapple', 'mango', 'fig', 'plum', 'blackcurrant', 'red berries', 'lychee', 'nectarine', 'coconut', 'honeydews', 'currant', 'currants', 'fruit', 'fruity', 'peach', 'poire', 'pommes', 'pear'], family: 'fruity' },
  // Sweet
  { keywords: ['vanilla', 'vanille', 'caramel', 'honey', 'honeydews', 'cocoa', 'almond', 'bitter almond', 'hazelnut', 'milk', 'cream', 'praline', 'liquorice', 'liquorice', 'tobacco', 'white musk', 'amber', 'tonka', 'baobab', 'cacao', 'caramel', 'brown sugar', 'sugar', 'sweet', 'arabic gum', 'binchoun', 'orris'], family: 'sweet' },
  // Spicy
  { keywords: ['cinnamon', 'clove', 'nutmeg', 'pepper', 'ginger', 'cardamom', 'sichuan pepper', 'allspice', 'anise', 'star anise', 'licorice', 'black pepper', 'white pepper', 'paprika', 'chili', 'galangal', 'prickly pear', 'spicy', 'spice', 'spices', 'cayenne', 'ginger', 'juniper', 'juniper berries'], family: 'spicy' },
  // Amber
  { keywords: ['amber', 'ambergris', 'labdanum', 'benzoin', 'amber wood', 'ambergris', 'ambroxan', 'iso e super', 'cashmeran', 'amber', 'ambrette', 'ambrette (musk mallow)', 'incense', 'incens', 'resin', 'resinous', 'amber', 'vanille', 'tonka', 'amber', 'ambrogio', 'ambroxide'], family: 'amber' },
  // Woody
  { keywords: ['cedar', 'cedro', 'sandalwood', 'oakmoss', 'oak moss', 'vetiver', 'patchouli', 'vetiver', 'guaiac wood', 'agarwood', 'oud', 'agarwood', 'cypress', 'pine', 'cedarwood', 'cedar', 'sandal', 'fir', 'wood', 'woody', 'leather', 'suede', 'log', 'logs', 'cedar wood', 'sandalwood', 'persimmon', 'birch', 'aspen'], family: 'woody' },
  // Musky
  { keywords: ['musk', 'ambrette', 'ambrette (musk mallow)', 'white musk', 'musk mallow', 'skin', 'plasma', 'amber', 'musk', 'powdery', 'powder', 'talc', 'velvet', 'femmine', 'maschile', 'muskone', 'galaxolide', 'scent', 'byrain', 'by-bliss'], family: 'musky' },
];

export function detectFamily(note: string): FamilyId {
  const n = note.toLowerCase().trim();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (n.includes(kw)) return rule.family;
    }
  }
  return 'floral'; // default: nota generica / non classificata
}

export function familyOfNote(note: string): FamilyId {
  return detectFamily(note);
}

export function allNoteFamilies(): FamilyId[] {
  return FAMILIES.map((f) => f.id);
}

export function getFamilyNotes(familyId: FamilyId, notes: string[]): string[] {
  return notes.filter((n) => detectFamily(n) === familyId);
}
