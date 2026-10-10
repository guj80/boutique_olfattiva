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

export type Profumo = {
  id: string;
  nome: string;
  brand: string;
  famiglia_olfattiva: string | null;
  prezzo_stimato_euro: string | null;
  user_id: string;
  created_at: string;
};

export type GeminiResult = {
  nome: string;
  brand: string;
  famiglia_olfattiva: string;
  prezzo_stimato_euro: string;
};
