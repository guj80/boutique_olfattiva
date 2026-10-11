import { createClient } from '@supabase/supabase-js';

// Sanitizzazione automatica dell'URL: impedisce il bug /rest/v1/rest/v1/profumi
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

export interface Profumo {
  id: string;
  user_id?: string | null;
  created_at?: string;
  nome: string;
  brand: string;
  concentrazione?: string | null;       // es. "Extrait de Parfum", "Eau de Parfum"
  famiglia_olfattiva?: string | null;   // es. "Ambrato Legnoso", "Agrumato"
  note_testa?: string | null;
  note_cuore?: string | null;
  note_fondo?: string | null;
  note_olfattive?: string | null;       // Campo unificato/legacy sempre popolato
  descrizione_ai?: string | null;       // Racconto sensoriale del Sommelier AI
  prezzo_stimato_euro?: string | null;  // es. "€185" o "185"
  prezzo?: number | string | null;      // Eventuale campo legacy numerico
  formato_ml?: number | null;           // es. 50, 100
  url_foto_vetrina?: string | null;     // URL immagine boccetta
  immagine_url?: string | null;         // Eventuale alias legacy
  stato?: 'collezione' | 'radar' | string | null;
  // Dual-Testing (Mouche vs Pelle)
  note_mouche?: string | null;
  note_pelle?: string | null;
  note_personali?: string | null;       // Eventuale alias legacy
  // Performance Metrics (1-10)
  voto_longevita?: number | null;
  voto_scia?: number | null;
  voto_proiezione?: number | null;
  voto_complessita?: number | null;
  valutazione_stelle?: number | null;   // 1-5 o 1-10
  // Contesto d'uso
  stagione_ideale?: string | null;
  occasione_ideale?: string | null;
}

export interface Indosso {
  id: string;
  profumo_id: string;
  user_id?: string | null;
  data_indosso?: string;
  created_at?: string;
  momento_giornata?: 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte' | string | null;
  contesto_outfit?: string | null;
  note_giorno?: string | null;
  complimenti_ricevuti?: number | null;
  profumi?: Profumo | null;
}

/**
 * REGOLA ZERO-TRUST PER I 40 PROFUMI DI LUCA:
 * Un profumo va nel Radar SOLO se ha esplicitamente stato === 'radar'.
 * Qualsiasi profumo con stato NULL, undefined, vuoto o 'collezione' appartiene alla Collezione!
 */
export function isRadarProfumo(p: Profumo): boolean {
  return (p.stato || '').trim().toLowerCase() === 'radar';
}

export function isCollezioneProfumo(p: Profumo): boolean {
  return !isRadarProfumo(p);
}

/**
 * Estrae il valore numerico in Euro da qualsiasi formato ("€ 185,00", "220€", "160", ecc.)
 */
export function parsePrezzoEuro(p: Profumo): number {
  const raw = p.prezzo_stimato_euro ?? p.prezzo ?? '';
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Costruisce una stringa unificata delle note olfattive anche se solo testa/cuore/fondo sono presenti
 */
export function getUnifiedNotes(p: Profumo): string {
  const parts = [p.note_testa, p.note_cuore, p.note_fondo].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');
  return p.note_olfattive || '';
}
