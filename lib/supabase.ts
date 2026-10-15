import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Momento = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';

export interface Profumo {
  id: string;
  nome: string;
  brand: string;
  concentrazione?: string | null;
  famiglia_olfattiva?: string | null;
  note_testa?: string | null;
  note_cuore?: string | null;
  note_fondo?: string | null;
  note_olfattive?: string | null;
  descrizione_ai?: string | null;
  prezzo_stimato_euro?: string | null;
  prezzo?: string | number | null;
  formato_ml?: number | null;
  url_foto_vetrina?: string | null;
  immagine_url?: string | null;
  stato?: string | null;
  note_mouche?: string | null;
  note_pelle?: string | null;
  voto_longevita?: number | null;
  voto_scia?: number | null;
  voto_proiezione?: number | null;
  voto_complessita?: number | null;
  stagione_ideale?: string | null;
  occasione_ideale?: string | null;
  naso?: string | null;
  created_at?: string;
}

export interface Indosso {
  id: string;
  profumo_id: string;
  momento_giornata?: string | null;
  contesto_outfit?: string | null;
  note_giorno?: string | null;
  created_at?: string;
  profumi?: Profumo | null;
}

export function isCollezioneProfumo(p: Profumo): boolean {
  const st = (p.stato || '').toLowerCase().trim();
  return st === 'collezione' || st === '';
}

export function isRadarProfumo(p: Profumo): boolean {
  const st = (p.stato || '').toLowerCase().trim();
  return st === 'radar' || st === 'testing';
}

export function getUnifiedNotes(p: Profumo): string {
  if (p.note_olfattive && p.note_olfattive.trim()) {
    return p.note_olfattive.trim();
  }
  return [p.note_testa, p.note_cuore, p.note_fondo]
    .filter(Boolean)
    .join(', ');
}

export function parsePrezzoEuro(p: Profumo): number {
  const raw = p.prezzo_stimato_euro ?? p.prezzo ?? '';
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}
