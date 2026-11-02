import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const USER_AGENT = 'AtelierLG-Radar/1.0 (+https://atelierlg.app; contact@atelierlg.app)';
const TIMEOUT_MS = 10000;

// Path transazionali che NON riguardano le pagine prodotto.
// Se un Disallow cade solo qui, il sito resta leggibile per i prodotti.
const TRANSACTIONAL_PREFIXES = [
  '/admin',
  '/cart',
  '/checkout',
  '/checkouts',
  '/account',
  '/orders',
  '/services',
  '/cdn',
  '/recommendations',
  '/wp-admin',
  '/wp-login',
  '/wp-content/uploads/wc-logs',
  '/wp-content/uploads/woocommerce_transient_files',
  '/wp-content/uploads/woocommerce_uploads',
  '/*/cart',
  '/*/checkout',
  '/*/checkouts',
  '/*/account',
  '/*/orders',
];

// Path che, se bloccati, mettono a rischio la lettura dei prodotti.
const PRODUCT_PATH_HINTS = [
  '/products',
  '/collections',
  '/pages',
  '/shop',
  '/p/',
  '/profumi',
  '/fragranze',
  '/perfumes',
];

function isTransactional(disallow: string): boolean {
  const d = disallow.toLowerCase();
  if (d.includes('add-to-cart')) return true;
  if (d.includes('sort_by') || d.includes('filter')) return true;
  if (d.includes('preview_theme_id') || d.includes('oseid')) return true;
  return TRANSACTIONAL_PREFIXES.some((p) => d.startsWith(p.toLowerCase()));
}

function blocksProductPath(disallow: string): boolean {
  const d = disallow.toLowerCase();
  return PRODUCT_PATH_HINTS.some((p) => d.includes(p));
}

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
  } catch (e: any) {
    return {
      permission: 'da_verificare',
      reason: `fetch robots.txt fallito (${e?.name === 'AbortError' ? 'timeout' : e?.message || String(e)}). Il sito potrebbe bloccare la lettura automatica: verificare a mano.`,
    };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) {
    return {
      permission: 'si',
      reason: 'robots.txt assente (404) → nessuna restrizione dichiarata dal sito',
    };
  }
  if (res.status === 403 || res.status === 401) {
    return {
      permission: 'da_verificare',
      reason: `robots.txt HTTP ${res.status}: il sito blocca la lettura automatica. Verificare a mano.`,
    };
  }
  if (!res.ok) {
    return {
      permission: 'da_verificare',
      reason: `robots.txt HTTP ${res.status}: risposta inattesa. Verificare a mano.`,
    };
  }

  const text = (await res.text()).slice(0, 300_000);

  let inStarSection = false;
  let disallowAll = false;
  let allowAll = false;
  const disallowPaths: string[] = [];
  const allowPaths: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();
    if (!val) continue;

    if (key === 'user-agent') {
      inStarSection = val === '*';
    } else if (inStarSection && key === 'disallow') {
      if (val === '/') disallowAll = true;
      else disallowPaths.push(val);
    } else if (inStarSection && key === 'allow') {
      if (val === '/' || val === '/*') allowAll = true;
      else allowPaths.push(val);
    }
  }

  // Caso 1: blocco totale
  if (disallowAll) {
    if (allowPaths.length === 0) {
      return {
        permission: 'no',
        reason: 'robots.txt: Disallow: / per User-agent * senza eccezioni → estrazione vietata',
      };
    }
    return {
      permission: 'da_verificare',
      reason: `robots.txt: Disallow: / con ${allowPaths.length} eccezioni. Verificare a mano se i prodotti sono tra queste.`,
    };
  }

  // Caso 2: nessun Disallow: / — guardiamo cosa bloccano i Disallow specifici
  const productBlockers = disallowPaths.filter(blocksProductPath);
  const nonTransactional = disallowPaths.filter(
    (d) => !blocksProductPath(d) && !isTransactional(d)
  );

  if (productBlockers.length > 0) {
    return {
      permission: 'da_verificare',
      reason: `robots.txt: possibili blocchi su path prodotto (${productBlockers
        .slice(0, 3)
        .join(', ')}). Verificare a mano.`,
    };
  }

  if (nonTransactional.length === 0) {
    const detail = allowAll
      ? 'Allow: / esplicito'
      : 'nessun Disallow: /';
    return {
      permission: 'si',
      reason: `robots.txt: ${detail}, Disallow solo su path transazionali (${disallowPaths
        .slice(0, 3)
        .join(', ') || 'nessuno'}). I prodotti restano leggibili.`,
    };
  }

  return {
    permission: 'da_verificare',
    reason: `robots.txt: Disallow non transazionali (${nonTransactional
      .slice(0, 3)
      .join(', ')}). Verificare a mano.`,
  };
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

  console.log('[check-robots] riepilogo:', riepilogo);
  for (const r of risultati) {
    console.log(`[check-robots] ${r.brand}: ${r.permission} — ${r.reason}`);
  }

  return NextResponse.json({ ok: true, riepilogo, risultati });
}
