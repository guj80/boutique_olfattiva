import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Candidato, FonteUfficiale } from '@/lib/laboratorio-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseAnonWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserFromAuthHeader(authHeader: string | null) {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabaseAnon();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token };
}

export async function GET(req: Request) {
  const auth = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Autenticazione richiesta.' }, { status: 401 });
  }

  const supabase = getSupabaseAnonWithToken(auth.token);
  if (!supabase) {
    return NextResponse.json(
      { error: 'Configurazione Supabase mancante.' },
      { status: 500 }
    );
  }

  const [fontiRes, candidatiRes] = await Promise.all([
    supabase.from('fonti_ufficiali').select('*').order('brand', { ascending: true }),
    supabase
      .from('candidati')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (fontiRes.error) {
    console.error('[laboratorio][GET] fonti:', fontiRes.error.message);
    return NextResponse.json({ error: fontiRes.error.message }, { status: 500 });
  }
  if (candidatiRes.error) {
    console.error('[laboratorio][GET] candidati:', candidatiRes.error.message);
    return NextResponse.json({ error: candidatiRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    fonti: (fontiRes.data || []) as FonteUfficiale[],
    candidati: (candidatiRes.data || []) as Candidato[],
  });
}

export async function POST(req: Request) {
  const auth = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Autenticazione richiesta.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }
  if (body.azione !== 'approva' && body.azione !== 'scarta') {
    return NextResponse.json({ error: 'Azione non riconosciuta.' }, { status: 400 });
  }
  if (typeof body.candidato_id !== 'string' || !body.candidato_id) {
    return NextResponse.json({ error: 'candidato_id non valido.' }, { status: 400 });
  }
  if (
    body.azione === 'approva' &&
    body.destinazione !== 'radar' &&
    body.destinazione !== 'collezione'
  ) {
    return NextResponse.json({ error: 'Destinazione non valida.' }, { status: 400 });
  }

  const service = getSupabaseService();
  if (!service) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY non configurata sul server.' },
      { status: 500 }
    );
  }

  const { data: candidatoRaw, error: candErr } = await service
    .from('candidati')
    .select('*')
    .eq('id', body.candidato_id)
    .maybeSingle();

  if (candErr) {
    console.error('[laboratorio][POST] lettura candidato:', candErr.message);
    return NextResponse.json({ error: candErr.message }, { status: 500 });
  }
  if (!candidatoRaw) {
    return NextResponse.json({ error: 'Candidato non trovato.' }, { status: 404 });
  }

  const candidato = candidatoRaw as Candidato;

  if (body.azione === 'scarta') {
    const { error } = await service
      .from('candidati')
      .update({ stato: 'scartato' })
      .eq('id', body.candidato_id);
    if (error) {
      console.error('[laboratorio][POST] scarta:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, stato: 'scartato' });
  }

  const destinazione: 'radar' | 'collezione' = body.destinazione;

  const noteUnite =
    [candidato.note_testa, candidato.note_cuore, candidato.note_fondo]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(', ') || null;

  const payloadProfumo = {
    brand: candidato.brand,
    nome: candidato.nome,
    famiglia_olfattiva: candidato.famiglia || null,
    note_testa: candidato.note_testa || null,
    note_cuore: candidato.note_cuore || null,
    note_fondo: candidato.note_fondo || null,
    note_olfattive: noteUnite,
    stato: destinazione,
    descrizione_ai: candidato.perche || null,
    url_foto_vetrina: null,
  };

  const { error: insErr } = await service.from('profumi').insert([payloadProfumo]);
  if (insErr) {
    console.error('[laboratorio][POST] insert profumi:', insErr.message);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { error: updErr } = await service
    .from('candidati')
    .update({ stato: 'approvato' })
    .eq('id', body.candidato_id);
  if (updErr) {
    console.error('[laboratorio][POST] update candidato:', updErr.message);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stato: 'approvato', destinazione });
}
