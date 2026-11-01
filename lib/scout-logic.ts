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
  url_foto_vetrina?: string | null;
}

const CURATED_VAULT: ScoutProposal[] = [
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
];

export function ownedListForPrompt(profumi: any[]): string[] {
  return (profumi || [])
    .map((p) => `${p.brand || ''} ${p.nome || ''}`.trim())
    .filter(Boolean);
}

export function getFamilyFromOccasione(occasione: string): string {
  const OCCASION_FAMILY_MAP: Record<string, string> = {
    ufficio: 'Agrumata',
    formale: 'Legnosa',
    'tempo libero': 'Agrumata',
    cena: 'Ambrata',
    serata: 'Ambrata',
  };
  const key = occasione.toLowerCase().trim();
  return OCCASION_FAMILY_MAP[key] || 'Qualsiasi';
}

export function buildScoutPrompt(filters: ScoutFilters, ownedNames: string[] = []): string {
  const { scoutFamily, includeNotes, excludeNotes } = filters;

  return `Sei un esperto internazionale di alta profumeria, profumeria artistica indipendente e ricerca d'autore.
REGOLE TASSATIVE ANTIBANALE:
- EVITA rigorosamente i profumi ultra-commerciali banali o i soliti bestseller da profumeria di massa (es. niente Dior Sauvage, Bleu de Chanel, Baccarat Rouge generico o simili).
- Escludi categoricamente cloni, dupe e profumi arabi di massa.
- Restituisci ESATTAMENTE 3 creazioni reali, ricercate e distinte: 1 Designer di alto profilo di ricerca, 1 Artistico indipendente e 1 di Nicchia di grande prestigio.
- Famiglia olfattiva richiesta: ${scoutFamily}
- Note da includere: ${includeNotes.length > 0 ? includeNotes.join(', ') : 'Qualsiasi'}
- Note da escludere: ${excludeNotes.length > 0 ? excludeNotes.join(', ') : 'Nessuna'}
- PROHIBITION LIST (Profumi già posseduti o tracciati dall'utente da NON proporre MAI): ${ownedNames.join(', ') || 'Nessuno'}

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
    throw new Error('Formato risposta scout non valido.');
  }

  const jsonSlice = cleanText.slice(start, end + 1);
  const parsed = JSON.parse(jsonSlice);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Risposta scout non in formato lista.');
  }
  return parsed;
}

export function filterNewProposals(proposals: any[], ownedNames: string[] = []): any[] {
  if (!ownedNames || ownedNames.length === 0) return proposals;
  const normalizedOwned = ownedNames.map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  return proposals.filter((p) => {
    const key = `${p.brand || ''} ${p.nome || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDuplicate = normalizedOwned.some((o) => key === o || key.includes(o) || o.includes(key));
    return !isDuplicate;
  });
}

function selectFromCuratedVault(filters: ScoutFilters): ScoutProposal[] {
  const { scoutFamily, includeNotes, excludeNotes } = filters;
  const incLower = includeNotes.map((n) => n.toLowerCase().trim()).filter(Boolean);
  const excLower = excludeNotes.map((n) => n.toLowerCase().trim()).filter(Boolean);

  const scored = CURATED_VAULT.map((item) => {
    const allNotes = `${item.note_testa} ${item.note_cuore} ${item.note_fondo} ${item.famiglia_olfattiva}`.toLowerCase();
    const hasExcluded = excLower.some((ex) => allNotes.includes(ex));
    if (hasExcluded) return { item, score: -100 };

    let score = 0;
    if (scoutFamily === 'Qualsiasi' || item.famiglia_olfattiva.toLowerCase() === scoutFamily.toLowerCase()) {
      score += 50;
    }
    for (const inc of incLower) {
      if (allNotes.includes(inc)) score += 30;
    }
    return { item, score };
  })
    .filter((e) => e.score > -50)
    .sort((a, b) => b.score - a.score);

  const categories: Array<'Designer' | 'Artistico' | 'Nicchia'> = ['Designer', 'Artistico', 'Nicchia'];
  const selected: ScoutProposal[] = [];

  for (const cat of categories) {
    const match = scored.find((s) => s.item.categoria === cat && !selected.includes(s.item));
    if (match) {
      selected.push(match.item);
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
    const res = await fetch('/api/ai/scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, ownedNames }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.ok && Array.isArray(data.proposals)) {
        aiProposals = data.proposals;
      }
    }
  } catch {
    // Fallback su Vault
  }

  const candidates: any[] = [];
  if (aiProposals.length >= 1) candidates.push(...aiProposals);
  if (candidates.length < 3) candidates.push(...selectFromCuratedVault(filters));

  const filtered = filterNewProposals(candidates, ownedNames);

  const categories: Array<'Designer' | 'Artistico' | 'Nicchia'> = ['Designer', 'Artistico', 'Nicchia'];
  const result: any[] = [];
  const seen = new Set<string>();

  for (const cat of categories) {
    const match = filtered.find((p) => p.categoria === cat && !seen.has(`${p.brand}-${p.nome}`));
    if (match) {
      seen.add(`${match.brand}-${match.nome}`);
      result.push(match);
    }
  }

  for (const item of filtered) {
    if (result.length >= 3) break;
    const key = `${item.brand}-${item.nome}`;
    if (!seen.has(key) && !result.includes(item)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result.slice(0, 3);
}
