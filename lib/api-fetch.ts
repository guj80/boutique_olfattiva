// lib/api-fetch.ts
import { supabase } from '@/lib/supabase';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // 1. Recupera la sessione attuale
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 2. Prepara gli header
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 3. Esegue la chiamata
  const res = await fetch(input, { ...init, headers });

  // 4. Gestione automatica della sessione scaduta
  if (res.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Sessione scaduta. Effettua di nuovo il login.');
  }

  return res;
}
