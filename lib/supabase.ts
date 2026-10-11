import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Categoria = 'collezione' | 'wishlist' | 'da_studiare';
export type Momento = 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte';

export type Profumo = {
  id: string;
  nome: string;
  brand: string;
  famiglia_olfattiva: string | null;
  prezzo_stimato_euro: string | null;
  note_olfattive: string | null;
  info_fragrantica: string | null;
  url_foto_vetrina: string | null;
  url_brand: string | null;
  url_fragrantica: string | null;
  categoria: Categoria;
  longevita: number | null;
  scia: number | null;
  proiezione: number | null;
  user_id: string;
  created_at: string;
};

export type Indosso = {
  id: string;
  profumo_id: string;
  user_id: string;
  indossato_il: string;
  momento: Momento;
  note_personali: string | null;
  created_at: string;
  profumo?: Pick<Profumo, 'nome' | 'brand' | 'famiglia_olfattiva' | 'url_foto_vetrina'>;
};

export type GeminiResult = {
  nome: string;
  brand: string;
  famiglia_olfattiva: string;
  prezzo_stimato_euro: string;
  note_olfattive: string;
};

export type ProfumoInput = Omit<Profumo, 'id' | 'user_id' | 'created_at'>;
