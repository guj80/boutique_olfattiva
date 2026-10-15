import { createClient } from '@supabase/supabase-js';

function getCleanSupabaseUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://xmkpldgaawwsafbsjmhz.supabase.co';
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

const supabaseUrl = getCleanSupabaseUrl();
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Momento = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte' | string;

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
  naso?: string | null; // <--- AGGIUNTO QUI
  created_at?: string;
}

export interface Indosso {
  id: string;
  profumo_id: string;
  user_id?: string | null;
  data_indosso?: string;
  created_at?: string;
  momento?: Momento | null;
  momento_giornata?: Momento | null;
  contesto_outfit?: string | null;
  note?: string | null;
  note_giorno?: string | null;
  complimenti_ricevuti?: number | null;
  profumi?: Profumo | null;
}

export function isRadarProfumo(p: Profumo): boolean {
  return (p.stato || '').trim().toLowerCase() === 'radar';
}

export function isCollezioneProfumo(p: Profumo): boolean {
  return !isRadarProfumo(p);
}

export function parsePrezzoEuro(p: Profumo): number {
  const raw = p.prezzo_stimato_euro ?? p.prezzo ?? '';
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export function getUnifiedNotes(p: Profumo): string {
  const parts = [p.note_testa, p.note_cuore, p.note_fondo].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');
  return p.note_olfattive || '';
}
