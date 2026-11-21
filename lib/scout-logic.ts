import { apiFetch } from '@/lib/api-fetch';

export type ScoutMode = 'triad' | 'ultranicchia';
export type ScoutCategory = 'Designer' | 'Artistico' | 'Ultra-Nicchia';

export interface ScoutFilters {
  mode: ScoutMode;
  scoutFamily: string;
  lastFamily?: string | null;
  includeNotes: string[];
  excludeNotes: string[];
}

export interface ScoutProposal {
  brand: string;
  nome: string;
  concentrazione: string | null;
  famiglia_olfattiva: string | null;
  naso: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  categoria: ScoutCategory;
  fonte: 'catalogo' | 'ultranicchia';
  motivo: string;
  url_foto_vetrina: string | null;
}

export interface ScoutResponse {
  proposals: ScoutProposal[];
  resolvedFamily: string | null;
  totalMatches: number;
}

/**
 * Note rare e d'avanguardia realmente presenti nella tabella ultranicchia_import (385 referenze).
 */
export const STRANGE_NOTES_PRESETS: ReadonlyArray<{
  label: string;
  query: string;
  group: string;
}> = [
  { label: 'Inchiostro', query: 'Inchiostro', group: 'Concettuali' },
  { label: 'Catrame di betulla', query: 'Catrame di betulla', group: 'Fumose' },
  { label: 'Polvere da sparo', query: 'Polvere da sparo', group: 'Concettuali' },
  { label: 'Note metalliche', query: 'Note metalliche', group: 'Concettuali' },
  { label: 'Sangue / Ferro', query: 'Sangue', group: 'Concettuali' },
  { label: 'Castoreo', query: 'Castoreo', group: 'Animaliche' },
  { label: 'Zibetto', query: 'Zibetto', group: 'Animaliche' },
  { label: 'Iraceo (Hyraceum)', query: 'Iraceo', group: 'Animaliche' },
  { label: 'Ambra grigia', query: 'Ambra grigia', group: 'Animaliche' },
  { label: 'Oud selvatico', query: 'Oud', group: 'Animaliche' },
  { label: 'Geosmina / Petrichor', query: 'Geosmina', group: 'Terrose' },
  { label: 'Tartufo / Fungo', query: 'Tartufo', group: 'Terrose' },
  { label: 'Assenzio', query: 'Assenzio', group: 'Boozy' },
  { label: 'Whisky / Rum', query: 'Whisky', group: 'Boozy' },
  { label: "Cera d'api", query: "Cera d'api", group: 'Resinose' },
  { label: 'Cannabis', query: 'Cannabis', group: 'Botaniche' },
];

export function normalizeScoutKey(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function makeScoutPairKey(brand?: string | null, nome?: string | null): string {
  return `${normalizeScoutKey(brand)}::${normalizeScoutKey(nome)}`;
}

/**
 * Estrae le chiavi normalizzate (brand::nome) di tutti i profumi in Collezione e nel Radar
 * affinché il motore di scouting li escluda tassativamente.
 */
export function ownedListForPrompt(
  profumi: Array<{ brand?: string | null; nome?: string | null }>
): string[] {
  const keys = new Set<string>();
  for (const p of profumi || []) {
    if (!p?.brand || !p?.nome) continue;
    keys.add(makeScoutPairKey(p.brand, p.nome));
  }
  return Array.from(keys);
}

/**
 * Filtro di sicurezza lato client: scarta qualsiasi proposta già presente
 * nella collezione/radar dell'utente o duplicata nella risposta.
 */
export function filterNewProposals(
  proposals: ScoutProposal[],
  ownedKeys: string[] = []
): ScoutProposal[] {
  const ownedSet = new Set(ownedKeys);
  const seen = new Set<string>();
  const clean: ScoutProposal[] = [];

  for (const item of proposals || []) {
    if (!item?.brand || !item?.nome) continue;
    const key = makeScoutPairKey(item.brand, item.nome);
    if (ownedSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    clean.push(item);
  }

  return clean;
}

export async function collectProposals(
  filters: ScoutFilters,
  ownedKeys: string[] = [],
  excludedKeys: string[] = []
): Promise<ScoutResponse> {
  const res = await apiFetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: filters.mode,
      scoutFamily: filters.scoutFamily,
      lastFamily: filters.lastFamily ?? null,
      includeNotes: filters.includeNotes,
      excludeNotes: filters.excludeNotes,
      ownedKeys,
      excludedKeys,
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | (ScoutResponse & { error?: string })
    | null;

  if (!res.ok) {
    throw new Error(data?.error || 'Errore durante la ricerca nel catalogo olfattivo.');
  }

  const rawProposals = Array.isArray(data?.proposals) ? data!.proposals : [];
  const filtered = filterNewProposals(rawProposals, ownedKeys);

  return {
    proposals: filtered,
    resolvedFamily: data?.resolvedFamily ?? null,
    totalMatches: typeof data?.totalMatches === 'number' ? data.totalMatches : filtered.length,
  };
}
