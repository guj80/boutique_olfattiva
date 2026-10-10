import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Profumo {
  id: string;
  created_at: string;
  nome: string;
  brand: string;
  famiglia_olfattiva?: string | null;
  note_olfattive?: string | null;
  prezzo_stimato_euro?: string | null;
  url_foto_vetrina?: string | null;
  stato?: string | null;
  note_pelle?: string | null;
  note_mouche?: string | null;
  voto_longevita?: number | null;
  voto_scia?: number | null;
  voto_proiezione?: number | null;
  stagione_ideale?: string | null;
  occasione_ideale?: string | null;
}
