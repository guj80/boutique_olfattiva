export interface ScoutFilters {
  scoutFamily: string;
  includeNotes: string[];
  excludeNotes: string[];
}

export interface ScoutProposal {
  brand: string;
  nome: string;
  concentrazione: string;
  famiglia_olfattiva: string;
  naso: string;
  note_testa: string;
  note_cuore: string;
  note_fondo: string;
  categoria: 'Designer' | 'Artistico' | 'Nicchia';
}

// Archivio Curato di Alta Profumeria (usato come motore deterministico o paracadute istantaneo)
const CURATED_VAULT: ScoutProposal[] = [
  // AMBRATA
  {
    brand: 'Dior',
    nome: 'Ambre Nuit',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Ambrata',
    naso: 'François Demachy',
    note_testa: 'Bergamotto, Pompelmo',
    note_cuore: 'Rosa Turca, Pepe Rosa',
    note_fondo: 'Ambra Grigia, Legno di Cedro, Patchouli',
    categoria: 'Designer',
  },
  {
    brand: 'Serge Lutens',
    nome: 'Ambre Sultan',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Ambrata',
    naso: 'Christopher Sheldrake',
    note_testa: 'Coriandolo, Foglia di Alloro, Origano',
    note_cuore: 'Mirto, Angelica, Resine',
    note_fondo: 'Ambra, Benzoino, Vaniglia, Sandalo, Patchouli',
    categoria: 'Artistico',
  },
  {
    brand: 'Maison Francis Kurkdjian',
    nome: 'Grand Soir',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Ambrata',
    naso: 'Francis Kurkdjian',
    note_testa: 'Cisto Labdano, Arancia Amara',
    note_cuore: 'Lavandino, Cannella',
    note_fondo: 'Benzoino del Siam, Fava Tonka, Vaniglia, Ambra',
    categoria: 'Nicchia',
  },
  // LEGNOSA
  {
    brand: 'Chanel',
    nome: 'Sycomore',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Legnosa',
    naso: 'Jacques Polge',
    note_testa: 'Pepe Rosa, Bacche di Ginepro, Aldeidi',
    note_cuore: 'Vetiver di Haiti, Cipresso, Violetta',
    note_fondo: 'Sandalo, Tabacco, Incenso',
    categoria: 'Designer',
  },
  {
    brand: 'Diptyque',
    nome: 'Tam Dao',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Legnosa',
    naso: 'Daniel Molière',
    note_testa: 'Cipresso, Mirto, Rosa',
    note_cuore: 'Sandalo di Mysore, Legno di Cedro',
    note_fondo: 'Palissandro, Spezie, Ambra, Muschio Bianco',
    categoria: 'Artistico',
  },
  {
    brand: 'Ex Nihilo',
    nome: 'Blue Talisman',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Legnosa',
    naso: 'Jordi Fernández',
    note_testa: 'Pera, Bergamotto, Mandarino, Zenzero',
    note_cuore: 'Fiore d’Arancio, Georgywood',
    note_fondo: 'Akigalawood, Muschio, Ambrofix, Legno di Cedro',
    categoria: 'Nicchia',
  },
  // AGRUMATA
  {
    brand: 'Chanel',
    nome: 'Allure Homme Edition Blanche',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Agrumata',
    naso: 'Jacques Polge',
    note_testa: 'Limone di Sicilia, Bergamotto di Calabria, Pepe Rosa',
    note_cuore: 'Zenzero, Legno di Cedro, Petitgrain',
    note_fondo: 'Sandalo, Fava Tonka, Vaniglia del Madagascar, Vetiver',
    categoria: 'Designer',
  },
  {
    brand: 'Laboratorio Olfattivo',
    nome: 'Arancia Rossa',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Agrumata',
    naso: 'Jean-Claude Ellena',
    note_testa: 'Arancia Rossa Italiana, Mandarino',
    note_cuore: 'Fiore d’Arancio, Frutto della Passione',
    note_fondo: 'Muschio Bianco, Legno di Cedro',
    categoria: 'Artistico',
  },
  {
    brand: 'Xerjoff',
    nome: 'Nio',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Agrumata',
    naso: 'Chris Maurice',
    note_testa: 'Bergamotto di Calabria, Neroli, Note Verdi',
    note_cuore: 'Cardamomo, Pepe Rosa, Gelsomino, Noce Moscata',
    note_fondo: 'Vetiver di Haiti, Legno di Cedro, Legno di Guaiaco, Ambra',
    categoria: 'Nicchia',
  },
  // SPEZIATA
  {
    brand: 'Hermès',
    nome: 'Poivre Samarcande',
    concentrazione: 'Eau de Toilette',
    famiglia_olfattiva: 'Speziata',
    naso: 'Jean-Claude Ellena',
    note_testa: 'Pepe Nero, Pepe Verde, Note Verdi',
    note_cuore: 'Cumino, Noce Moscata, Paprika, Quercia',
    note_fondo: 'Legno di Cedro, Patchouli, Muschio di Quercia',
    categoria: 'Designer',
  },
  {
    brand: 'Tauer Perfumes',
    nome: '02 L’Air du Désert Marocain',
    concentrazione: 'Eau de Toilette Intense',
    famiglia_olfattiva: 'Speziata',
    naso: 'Andy Tauer',
    note_testa: 'Coriandolo, Cumino, Petitgrain, Lavanda',
    note_cuore: 'Cisto Labdano, Betulla, Gelsomino, Geranio',
    note_fondo: 'Ambra Grigia, Legno di Cedro, Vetiver, Patchouli, Muschio di Quercia',
    categoria: 'Artistico',
  },
  {
    brand: 'Amouage',
    nome: 'Royal Tobacco',
    concentrazione: 'Opus XIV Eau de Parfum',
    famiglia_olfattiva: 'Speziata',
    naso: 'Cécile Zarokian',
    note_testa: 'Incenso, Elemi, Cardamomo, Anice, Basilico, Bergamotto',
    note_cuore: 'Tabacco Assoluto, Liquirizia, Fieno Greco, Prunol, Lavanda',
    note_fondo: 'Mirra, Catrame di Betulla, Benzoino, Oud, Fava Tonka, Guaiaco',
    categoria: 'Nicchia',
  },
  // GOURMAND
  {
    brand: 'Guerlain',
    nome: 'Fève Gourmande',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Gourmand',
    naso: 'Delphine Jelk',
    note_testa: 'Pepe Rosa, Rum, Spezie Calde',
    note_cuore: 'Cacao Amaro, Rosa Affumicata, Tè Nero',
    note_fondo: 'Patchouli, Note Legnose, Vaniglia',
    categoria: 'Designer',
  },
  {
    brand: 'Akro',
    nome: 'Awake',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Gourmand',
    naso: 'Olivier Cresp',
    note_testa: 'Caffè Santos, Limone Italiano',
    note_cuore: 'Cardamomo Verde, Cacao',
    note_fondo: 'Vetiver di Haiti, Legno Ambrato',
    categoria: 'Artistico',
  },
  {
    brand: 'Xerjoff',
    nome: 'XJ 1861 Naxos',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Gourmand',
    naso: 'Chris Maurice',
    note_testa: 'Bergamotto, Limone, Lavanda',
    note_cuore: 'Miele, Cannella, Cashmeran, Gelsomino Sambac',
    note_fondo: 'Foglia di Tabacco, Fava Tonka, Bacca di Vaniglia',
    categoria: 'Nicchia',
  },
  // CUOIATA
  {
    brand: 'Tom Ford',
    nome: 'Ombré Leather Parfum',
    concentrazione: 'Parfum',
    famiglia_olfattiva: 'Cuoiata',
    naso: 'Sonia Constant',
    note_testa: 'Foglia di Violetta, Legno di Cedro',
    note_cuore: 'Gelsomino Sambac, Burro d’Iris',
    note_fondo: 'Cuoio Nero, Tabacco Verde, Note Legnose',
    categoria: 'Designer',
  },
  {
    brand: 'Francesca Bianchi',
    nome: 'The Black Knight',
    concentrazione: 'Extrait de Parfum',
    famiglia_olfattiva: 'Cuoiata',
    naso: 'Francesca Bianchi',
    note_testa: 'Artemisia, Miele, Cumino',
    note_cuore: 'Rosa Bulgara, Burro d’Iris, Narciso',
    note_fondo: 'Cuoio, Vetiver, Patchouli, Muschio di Quercia, Cedro',
    categoria: 'Artistico',
  },
  {
    brand: 'Memo Paris',
    nome: 'Irish Leather',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Cuoiata',
    naso: 'Alienor Massenet',
    note_testa: 'Bacche di Ginepro, Pepe Rosa',
    note_cuore: 'Erba Mate Assoluta, Salvia Sclarea, Iris',
    note_fondo: 'Cuoio, Fava Tonka, Betulla, Ambra, Vetiver',
    categoria: 'Nicchia',
  },
  // FLOREALE / AROMATICA / MARINA / FRUTTATA / VERDE / MUSCHIATA
  {
    brand: 'Prada',
    nome: 'Infusion d’Iris',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Floreale',
    naso: 'Daniela Andrier',
    note_testa: 'Fiore d’Arancio Africano, Mandarino, Neroli',
    note_cuore: 'Iris Pallida, Galbano, Lentisco',
    note_fondo: 'Incenso, Benzoino, Vetiver, Legno di Cedro',
    categoria: 'Designer',
  },
  {
    brand: 'Editions de Parfums Frédéric Malle',
    nome: 'Portrait of a Lady',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Floreale',
    naso: 'Dominique Ropion',
    note_testa: 'Rosa Turca, Chiodi di Garofano, Lampone, Ribes Nero, Cannella',
    note_cuore: 'Patchouli, Incenso, Sandalo',
    note_fondo: 'Muschio, Benzoino, Ambra Grigia',
    categoria: 'Artistico',
  },
  {
    brand: 'Ormonde Jayne',
    nome: 'Ormonde Man',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Aromatica',
    naso: 'Geza Schoen',
    note_testa: 'Bacche di Ginepro, Bergamotto, Pepe Rosa, Cardamomo, Coriandolo',
    note_cuore: 'Cicuta Nera (Black Hemlock), Oud',
    note_fondo: 'Vetiver, Legno di Cedro, Sandalo, Muschio',
    categoria: 'Nicchia',
  },
  {
    brand: 'Heeley',
    nome: 'Sel Marin',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Marina',
    naso: 'James Heeley',
    note_testa: 'Limone Italiano, Bergamotto, Foglia di Faggio',
    note_cuore: 'Sale Marino, Alghe, Muschio Marino',
    note_fondo: 'Vetiver, Legno di Cedro, Cuoio, Muschio Bianco',
    categoria: 'Artistico',
  },
  {
    brand: 'Orto Parisi',
    nome: 'Megamare',
    concentrazione: 'Extrait de Parfum',
    famiglia_olfattiva: 'Marina',
    naso: 'Alessandro Gualtieri',
    note_testa: 'Bergamotto, Limone, Accordo Ozono',
    note_cuore: 'Alghe Marine, Calone, Hedione',
    note_fondo: 'Ambroxan, Muschio, Legno di Cedro',
    categoria: 'Nicchia',
  },
  {
    brand: 'Byredo',
    nome: 'Bal d’Afrique',
    concentrazione: 'Eau de Parfum',
    famiglia_olfattiva: 'Muschiata',
    naso: 'Jérôme Epinette',
    note_testa: 'Bergamotto, Limone, Neroli, Calendula Africana, Bucchu',
    note_cuore: 'Violetta, Petali di Gelsomino, Ciclamino',
    note_fondo: 'Ambra Nera, Muschio, Vetiver, Legno di Cedro Marocchino',
    categoria: 'Artistico',
  },
];

export function ownedListForPrompt(profumi: any[]): string[] {
  return (profumi || [])
    .map((p) => `${p.brand || ''} ${p.nome || ''}`.trim())
    .filter(Boolean);
}

/** Mappa occasioni → famiglia olfattiva. Utile per suggerimenti mirati. */
const OCCASION_FAMILY_MAP: Record<string, string> = {
  ufficio: 'Agrumata',
  'ufficio / lavoro': 'Agrumata',
  'ufficio/lavoro': 'Agrumata',
  formale: 'Legnosa',
  'riunione formale': 'Legnosa',
  'riunione': 'Legnosa',
  'tempo libero': 'Agrumata',
  cena: 'Ambrata',
  'aperitivo': 'Ambrata',
  'aperitivo / cena': 'Ambrata',
  serata: 'Ambrata',
  notte: 'Ambrata',
  sera: 'Ambrata',
  mattina: 'Agrumata',
  pomeriggio: 'Agrumata',
  'cena / serata': 'Ambrata',
};

export function getFamilyFromOccasione(occasione: string): string {
  const key = occasione.toLowerCase().trim();
  return OCCASION_FAMILY_MAP[key] || 'Qualsiasi';
}

export function buildScoutPrompt(filters: ScoutFilters, ownedNames: string[] = []): string {
  const { scoutFamily, includeNotes, excludeNotes } = filters;

  return `Sei un esperto internazionale di alta profumeria, profumeria artistica indipendente e case di nicchia storiche.
REGOLE TASSATIVE:
- Escludi rigorosamente qualsiasi clone, dupe, imitazione o profumo arabo di massa.
- Restituisci ESATTAMENTE 3 creazioni reali e distinte: 1 Designer di alto profilo, 1 Artistico indipendente e 1 di Nicchia prestigiosa.

Criteri richiesti:
- Famiglia olfattiva: ${scoutFamily}
- Note da includere: ${includeNotes.length > 0 ? includeNotes.join(', ') : 'Qualsiasi'}
- Note da escludere: ${excludeNotes.length > 0 ? excludeNotes.join(', ') : 'Nessuna'}

Restituisci SOLO un array JSON valido di 3 oggetti con queste chiavi esatte:
[
  {
    "brand": "...",
    "nome": "...",
    "concentrazione": "Eau de Parfum",
    "famiglia_olfattiva": "...",
    "naso": "...",
    "note_testa": "...",
    "note_cuore": "...",
    "note_fondo": "...",
    "categoria": "Designer | Artistico | Nicchia"
  }
]`;
}

export function parseScoutArray(rawText: string): any[] {
  const cleanText = String(rawText)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleanText.indexOf('[');
  const end = cleanText.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('Formato risposta non valido.');
  }

  const jsonSlice = cleanText.slice(start, end + 1);
  const parsed = JSON.parse(jsonSlice);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Risposta non in formato lista.');
  }
  return parsed;
}

export function filterNewProposals(proposals: any[], ownedNames: string[] = []): any[] {
  if (!ownedNames || ownedNames.length === 0) return proposals;
  const owned = ownedNames.map((n) => n.toLowerCase().trim());
  return proposals.filter((p) => {
    const key = `${p.brand || ''} ${p.nome || ''}`.toLowerCase().trim();
    // Escluso se è proprio nel possesso dell'utente (match esatto o contenuto)
    return !owned.some((o) => key === o || key.includes(o) || o.includes(key));
  });
}

/**
 * Motore di selezione deterministico locale:
 * seleziona 3 profumi reali (1 Designer, 1 Artistico, 1 Nicchia) dal Vault
 * valutando Famiglia, Note Incluse e Note Escluse.
 */
function selectFromCuratedVault(filters: ScoutFilters): ScoutProposal[] {
  const { scoutFamily, includeNotes, excludeNotes } = filters;
  const incLower = includeNotes.map((n) => n.toLowerCase().trim()).filter(Boolean);
  const excLower = excludeNotes.map((n) => n.toLowerCase().trim()).filter(Boolean);

  const scored = CURATED_VAULT.map((item) => {
    const allNotes = `${item.note_testa} ${item.note_cuore} ${item.note_fondo} ${item.famiglia_olfattiva}`.toLowerCase();

    // Penalizza fortemente se contiene una nota esclusa
    const hasExcluded = excLower.some((ex) => allNotes.includes(ex));
    if (hasExcluded) {
      return { item, score: -100 };
    }

    let score = 0;
    if (
      scoutFamily !== 'Qualsiasi' &&
      item.famiglia_olfattiva.toLowerCase() === scoutFamily.toLowerCase()
    ) {
      score += 50;
    }

    for (const inc of incLower) {
      if (allNotes.includes(inc)) {
        score += 30;
      }
    }

    // Leggero fattore random per variare le proposte a parità di punteggio
    score += Math.random() * 5;

    return { item, score };
  })
    .filter((entry) => entry.score > -50)
    .sort((a, b) => b.score - a.score);

  const categories: Array<'Designer' | 'Artistico' | 'Nicchia'> = [
    'Designer',
    'Artistico',
    'Nicchia',
  ];
  const selected: ScoutProposal[] = [];

  for (const cat of categories) {
    const match = scored.find(
      (s) => s.item.categoria === cat && !selected.includes(s.item)
    );
    if (match) {
      selected.push({
        ...match.item,
        famiglia_olfattiva:
          scoutFamily !== 'Qualsiasi' ? scoutFamily : match.item.famiglia_olfattiva,
      });
    }
  }

  // Se per filtri molto stretti mancano elementi, riempie fino a 3
  for (const entry of scored) {
    if (selected.length >= 3) break;
    if (!selected.includes(entry.item)) {
      selected.push(entry.item);
    }
  }

  return selected.slice(0, 3);
}

export async function collectProposals(
  filters: ScoutFilters,
  ownedNames: string[] = []
): Promise<any[]> {
  let aiProposals: any[] = [];
  try {
    const prompt = buildScoutPrompt(filters, ownedNames);
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, search: false }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.text) {
        const parsed = parseScoutArray(data.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          aiProposals = parsed;
        }
      }
    }
  } catch {
    // Se l'API fallisce o è in rate-limit, usiamo silenziosamente il Vault Curato
  }

  // Aggregazione: preferisce l'AI, completa con il vault se manca materiale
  const candidates: any[] = [];
  if (aiProposals.length >= 1) candidates.push(...aiProposals);
  if (candidates.length < 3) candidates.push(...selectFromCuratedVault(filters));

  // Filtra possedimenti e duplicati
  const filtered = filterNewProposals(candidates, ownedNames);

  // Garanzia esatti 3, una per categoria (Designer / Artistico / Nicchia)
  const categories: Array<'Designer' | 'Artistico' | 'Nicchia'> = ['Designer', 'Artistico', 'Nicchia'];
  const result: any[] = [];
  const seen = new Set<string>();
  for (const cat of categories) {
    const match = filtered.find((p) => p.categoria === cat && !seen.has(`${p.brand || ''}-${p.nome || ''}`));
    if (match) {
      seen.add(`${match.brand || ''}-${match.nome || ''}`);
      result.push(match);
    }
  }

  // Completa eventuali slot mancanti dal vault (esclusi i possessi)
  for (const item of filtered) {
    if (result.length >= 3) break;
    const key = `${item.brand || ''}-${item.nome || ''}`;
    if (!seen.has(key) && !result.includes(item)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result.slice(0, 3);
}
