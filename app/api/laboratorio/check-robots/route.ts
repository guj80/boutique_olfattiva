import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const USER_AGENT = 'AtelierLG-Radar/1.0 (+https://atelierlg.app; contact@atelierlg.app)';
const TIMEOUT_MS = 10000;

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
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

type RobotsVerdict = {
  permission: 'si' | 'no' | 'da_verificare';
  reason: string;
};

async function checkRobotsForHost(baseUrl: string): Promise<RobotsVerdict> {
  try {
    let robotsUrl: string;
    try {
      robotsUrl = new URL('/robots.txt', baseUrl).toString();
    } catch {
      return { permission: 'da_verificare', reason: `URL non valido: ${baseUrl}` };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(robotsUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 404) {
      return {
        permission: 'si',
        reason: 'robots.txt assente (404) → nessuna restrizione dichiarata dal sito',
      };
    }
    if (!res.ok) {
      return { permission: 'da_verificare', reason: `robots.txt HTTP ${res.status}` };
    }

    const text = (await res.text()).slice(0, 200_000);

    let inStarSection = false;
    let disallowAll = false;
    let allowAll = false;
    const specificDisallow: string[] = [];
    const specificAllow: string[] = [];

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const val = line.slice(colon + 1).trim();

      if (key === 'user-agent') {
        inStarSection = val === '*';
      } else if (inStarSection && key === 'disallow') {
        if (val === '/') disallowAll = true;
        else if (val) specificDisallow.push(val);
      } else if (inStarSection && key === 'allow') {
        if (val === '/' || val === '/*') allowAll = true;
        else if (val) specificAllow.push(val);
      }
    }

    if (disallowAll && allowAll) {
      return {
        permission: 'da_verificare',
        reason:
          'robots.txt contiene Disallow: / e Allow: / contrastanti per User-agent *. Da verificare a mano.',
      };
    }
    if (disallowAll && specificAllow.length === 0) {
      return {
        permission: 'no',
        reason: 'robots.txt: Disallow: / per User-agent * senza eccezioni → estrazione vietata',
      };
    }
    if (disallowAll && specificAllow.length > 0) {
      return {
        permission: 'da_verificare',
        reason: `robots.txt: Disallow: / con eccezioni (${specificAllow
          .slice(0, 3)
          .join(', ')}). Da verificare a mano.`,
      };
    }
    if (allowAll && !disallowAll && specificDisallow.length === 0) {
      return { permission: 'si', reason: 'robots.txt: Allow: / esplicito per User-agent *' };
    }
    if (specificDisallow.length > 0) {
      return {
        permission: 'da_verificare',
        reason: `robots.txt: alcuni path bloccati (${specificDisallow
          .slice(0, 3)
          .join(', ')}). Da verificare se i path dei prodotti sono liberi.`,
      };
    }
    return {
      permission: 'si',
      reason: 'robots.txt: nessuna restrizione per User-agent *',
    };
  } catch (e: any) {
    return {
      permission: 'da_verificare',
      reason: `errore fetch robots.txt: ${e?.message || String(e)}`,
    };
  }
}

export async function POST(req: Request) {
  const auth = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Autenticazione richiesta.' }, { status: 401 });
  }

  const service = getSupabaseService();
  if (!service) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY non configurata.' },
      { status: 500 }
    );
  }

  const { data: fonti, error: fontiErr } = await service
    .from('fonti_ufficiali')
    .select('*')
    .eq('attivo', true);

  if (fontiErr) {
    console.error('[check-robots] lettura fonti:', fontiErr.message);
    return NextResponse.json({ error: fontiErr.message }, { status: 500 });
  }
  if (!fonti || fonti.length === 0) {
    return NextResponse.json({
      ok: true,
      riepilogo: { si: 0, no: 0, da_verificare: 0 },
      risultati: [],
    });
  }

  const risultati = await Promise.all(
    fonti.map(async (f: any) => {
      const verdict = await checkRobotsForHost(f.url_sito);
      const { error: updErr } = await service
        .from('fonti_ufficiali')
        .update({
          permission_scraping: verdict.permission,
          ultima_visita: new Date().toISOString(),
        })
        .eq('id', f.id);
      if (updErr) {
        console.error(`[check-robots] update ${f.brand}:`, updErr.message);
      }
      return {
        brand: f.brand,
        url: f.url_sito,
        permission: verdict.permission,
        reason: verdict.reason,
      };
    })
  );

  const riepilogo = {
    si: risultati.filter((r) => r.permission === 'si').length,
    no: risultati.filter((r) => r.permission === 'no').length,
    da_verificare: risultati.filter((r) => r.permission === 'da_verificare').length,
  };

  return NextResponse.json({ ok: true, riepilogo, risultati });
}
