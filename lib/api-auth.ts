// lib/api-auth.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      error: NextResponse.json(
        { error: 'Autenticazione richiesta. Effettua il login.' }, 
        { status: 401 }
      ) 
    };
  }

  const token = authHeader.split(' ')[1];
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Creiamo un client usa-e-getta solo per validare il token.
  // NOTA: Non usiamo la service role qui. La sicurezza prima di tutto.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { 
      error: NextResponse.json(
        { error: 'Sessione non valida o scaduta. Effettua di nuovo il login.' }, 
        { status: 401 }
      ) 
    };
  }

  // Se OWNER_USER_ID e' impostata su Vercel, solo quell'utente puo' usare le API.
  // Se non e' impostata il comportamento resta invariato (qualsiasi utente loggato).
  const ownerId = (process.env.OWNER_USER_ID || '').trim();
  if (ownerId && user.id !== ownerId) {
    return {
      error: NextResponse.json({ error: 'Accesso non consentito.' }, { status: 403 }),
    };
  }

  return { user };
}
