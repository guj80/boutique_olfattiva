import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Momento = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';
export type StatoProfumo = 'collezione' | 'radar';

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

export interface Profumo {
  id: string;
  created_at?: string;
  nome: string;
  brand: string;
  concentrazione?: string | null;
  famiglia_olfattiva?: string | null;
  prezzo_stimato_euro?: string | null;
  formato_ml?: number | null;
  anno_lancio?: number | null;
  naso?: string | null;
  note_olfattive?: string | null;
  note_testa?: string | null;
  note_cuore?: string | null;
  note_fondo?: string | null;
  info_fragrantica?: string | null;
  url_foto_vetrina?: string | null;
  stato?: string | null;
  note_pelle?: string | null;
  note_mouche?: string | null;
  voto_longevita?: number | null;
  voto_scia?: number | null;
  voto_proiezione?: number | null;
  voto_complessita?: number | null;
  valutazione_stelle?: number | null;
  stagione_ideale?: string | null;
  occasione_ideale?: string | null;
  descrizione_ai?: string | null;
}

export interface Indosso {
  id: string;
  profumo_id: string;
  created_at?: string;
  data_indosso?: string | null;
  momento_giornata?: Momento | string | null;
  meteo?: string | null;
  temperatura?: number | null;
  note_indosso?: string | null;
  contesto_outfit?: string | null;
  note_giorno?: string | null;
  complimenti_ricevuti?: number | null;
  profumi?: Profumo | null;
}

export function isCollezioneProfumo(p?: Profumo | null): boolean {
  if (!p) return false;
  const st = (p.stato || '').toLowerCase().trim();
  return st === 'collezione' || st === '';
}

export function isRadarProfumo(p?: Profumo | null): boolean {
  if (!p) return false;
  const st = (p.stato || '').toLowerCase().trim();
  return st === 'radar' || st === 'testing';
}

export function getUnifiedNotes(p?: Profumo | null): string {
  if (!p) return '';
  const pyramid = [p.note_testa, p.note_cuore, p.note_fondo]
    .map((n) => (n || '').trim())
    .filter(Boolean)
    .join(', ');
  if (pyramid) return pyramid;
  return (p.note_olfattive || '').trim();
}

export function parsePrezzoEuro(p?: Profumo | null): number {
  if (!p) return 0;
  const raw = p.prezzo_stimato_euro ?? '';
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const match = String(raw).match(/€\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*€/);
  const target = match ? match[1] || match[2] : String(raw).replace(/[^0-9.,]/g, '');
  const val = parseFloat(String(target).replace(',', '.'));
  return isNaN(val) ? 0 : val;
}

/**
 * Restituisce la data locale nel formato YYYY-MM-DD (senza bug di fuso orario UTC).
 */
export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
