// ============================================================================
// TYPES MODELS — BOUTIQUE OLFATTIVA — SCENT ENCYCLOPEDIA
// ============================================================================
// Tipi TypeScript per il catalogo enciclopedico dei profumi e la gestione
// delle note olfattive, delle maison e degli accordi.
// ============================================================================

// --- Note olfattive --------------------------------------------------------

export type NotePosition = 'top' | 'heart' | 'base';

export interface Note {
  id: string;
  name: string;
  family: string;
  descriptor: string;
  createdAt: string;
  updatedAt: string;
}

// --- Maison (marche) ------------------------------------------------------

export interface Maison {
  id: string;
  name: string;
  brand: string;
  country: string;
  founded: number | null;
  website: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Perfume --------------------------------------------------------------

export interface Perfume {
  id: string;
  name: string;
  brand: string;
  maisonId: string;
  family: string;
  concentration: string;
  format: string;
  priceUsd: number | null;
  imageUrl: string | null;
  youtubeId: string | null;
  description: string | null;
  sourceUrl: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

// --- Accord ---------------------------------------------------------------

export interface Accord {
  id: string;
  noteAId: string;
  noteBId: string;
  strength: number;
  frequency: number | null;
  confidence: number;
  createdAt: string;
}

// --- Perfume note bridge --------------------------------------------------

export interface PerfumeNote {
  perfumeId: string;
  noteId: string;
  layer: NotePosition;
}

// --- Result types ----------------------------------------------------------

export interface PerfumeSearchResult {
  perfumes: Perfume[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters: PerfumeFilters;
}

export interface PerfumeFilters {
  notes: string[];
  families: string[];
  concentration: string | null;
  brand: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface PerfumeDetail {
  perfume: Perfume;
  notes: Note[];
  accords: Accord[];
  maison: Maison | null;
}

// --- Perfume note layer (per il display della piramide olfattiva) ----------

export interface PerfumeNoteLayer {
  note: Note;
  layer: NotePosition;
  strength?: number;
}
