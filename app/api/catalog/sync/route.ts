import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiWithFallback, GeminiPart } from '@/lib/gemini-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configurazione della fonte dati del catalogo.
// Sperimenta i campi di sotto-tier: se non è settata, la sincronizzazione
// segue il "catalogo locale" (un elenco incluso in questo file).
const SOURCE_URL = process.env.CATALOG_SOURCE_URL || '';
const SOURCE_KEY = process.env.CATALOG_SOURCE_KEY || '';
const CATALOG_CONFIG = process.env.CATALOG_CONFIG || '{}';

// Client admin per i write (upsert) sul catalogo
function getSupabaseAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY mancante: i write sul catalogo saranno bloccati dal RLS.');
    return null;
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY non configurati.', ok: false },
        { status: 500 }
      );
    }

    // 1) Recupera la sorgente dati. Implementazione minimo: importa
    //    CATALOG_SOURCE_URL e legge il JSON. Sostituisci con le tue fonti.
    let externalData: any[] = [];
    if (!SOURCE_URL) {
      // Nessuna fonte esterna: usa il catalogo locale incluso.
      externalData = DEFAULT_CATALOG.concat(CATALOG_EXTRA);
      // 2) Normalizza ogni record
      externalData = externalData.map((r: any, i: number) => ({
        id: r.id || `local_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        number: r.number || null,
        name: r.nome || r.name || '',
        brand: r.brand || r.maison || '',
        release_year: r.release_year || r.anno || null,
        concentration: r.concentration || r.concentrazione || null,
        rating_value: r.rating_value || null,
        rating_count: r.rating_count || null,
        main_accords: r.main_accords || null,
        top_notes: r.top_notes || null,
        middle_notes: r.middle_notes || null,
        base_notes: r.base_notes || null,
        perfumers: r.perfumers || null,
        url: r.url || r.url_fragrantica || null,
        embedding: null, // vedi punto 4
        cached_ai_data: null,
        source: 'local',
        source_ref: `local_${i}`,
      }));
    } else {
      // 2) Richiesta HTTP alla sorgente esterna (no-cors non usato per evitare
      //    cross-origin; usa un proxy o un Vercel/Cloudflare serverless).
      const res = await fetch(SOURCE_URL, {
        headers: SOURCE_KEY ? { Authorization: `Bearer ${SOURCE_KEY}` } : {},
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Sorgente non raggiungibile: ${res.status}`, ok: false },
          { status: 502 }
        );
      }
      const body = await res.json();
      externalData = Array.isArray(body) ? body : body.results || body.data || [];
    }

    // 3) Upsert nel database Supabase
    const BATCH = 200;
    const total = externalData.length;
    let inserted = 0;
    for (let i = 0; i < total; i += BATCH) {
      const chunk = externalData.slice(i, i + BATCH);
      const { error } = await supabase.from('perfumes').upsert(chunk, {
        onConflict: 'id',
      });
      if (error) {
        // Log sull'errore specifico (evita il fallimento totale)
        console.error(`Sincronizzazione batch ${i}-${i + chunk.length} fallita:`, error.message);
        // Continua con il batch successivo
      } else {
        inserted += chunk.length;
      }
    }

    // 4) Genera embeddings per il vettore search (funzione dedicata)
    await generateEmbeddings(supabase, inserted);

    return NextResponse.json({
      ok: true,
      total: total,
      inserted,
      message: 'Catalogo sincronizzato correttamente.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore durante la sincronizzazione del catalogo.', ok: false },
      { status: 500 }
    );
  }
}

// catalogo locale di esempio (utilizzato solo se non è settata la sorgente esterna)
const DEFAULT_CATALOG: any[] = [
  {
    id: 'xerjoff_naxos',
    number: 1861,
    name: 'XJ 1861 Naxos',
    brand: 'Xerjoff',
    release_year: 2004,
    concentration: 'Eau de Parfum',
    rating_value: 4.7,
    rating_count: 1200,
    main_accords: 'Bergamotto, Miele, Cannella, Cashmeran, Gelsomino',
    top_notes: 'Bergamotto, Limone, Lavanda',
    middle_notes: 'Miele, Cannella, Cashmeran, Gelsomino Sambac',
    base_notes: 'Foglia di Tabacco, Fava Tonka, Bacca di Vaniglia',
    perfumers: 'Chris Maurice',
    url: 'https://www.xerjoff.com/products/xj-1861-naxos',
    embedding: null,
    cached_ai_data: null,
  },
  {
    id: 'dior_santal_33',
    number: 33,
    name: 'Santal 33',
    brand: 'Dior',
    release_year: 1992,
    concentration: 'Eau de Parfum',
    rating_value: 4.6,
    rating_count: 2100,
    main_accords: 'Santal, Vaniglia, Ambra, Legno di Cedro',
    top_notes: 'Mirra, Bergamotto',
    middle_notes: 'Santal, Vaniglia',
    base_notes: 'Legno di Cedro, Ambra, Muschio',
    perfumers: 'Jean-Paul Guerlain, François Demachy',
    url: 'https://www.dior.com/it_it/parfum/dior-santal-33',
    embedding: null,
    cached_ai_data: null,
  },
];

// Dati extra (elenco minimo di fallimenti non rari)
const CATALOG_EXTRA: any[] = [
  {
    id: 'dior_ambre_nuit',
    number: '24',
    name: 'Ambre Nuit',
    brand: 'Dior',
    release_year: 2015,
    concentration: 'Eau de Parfum',
    rating_value: 4.5,
    rating_count: 900,
    main_accords: 'Rosa Turca, Ambra, Patchouli, Cedro',
    top_notes: 'Bergamotto, Pompelmo',
    middle_notes: 'Rosa Turca, Pepe Rosa',
    base_notes: 'Ambra Grigia, Cedro, Patchouli',
    perfumers: 'François Demachy',
    url: 'https://www.dior.com/it_it/parfum/dior-ambre-nuit',
    embedding: null,
    cached_ai_data: null,
  },
];

async function generateEmbeddings(supabase: any, count: number) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  if (!geminiKey && !openRouterKey) return; // Nessuna chiave per embeddare

  // 1) Trova i record senza embedding
  const { data: missing, error: qError } = await supabase
    .from('perfumes')
    .select('id')
    .ilike('embedding', 'null')
    .limit(count);

  if (qError) {
    console.error('Errore query embeddings:', qError.message);
    return;
  }
  if (!missing || missing.length === 0) return;

  // 2) Genera embedding per singolo record via Gemini (text-embedding-004)
  let key = geminiKey;
  if (openRouterKey && !key) key = openRouterKey;
  for (const row of missing) {
    const text = [
      row.brand || '',
      row.name || '',
      row.concentration || '',
      row.main_accords || '',
      row.top_notes || '',
      row.middle_notes || '',
      row.base_notes || '',
      row.perfumers || '',
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const res = await callGeminiWithFallback(
        [
          {
            text: `Genera un vettore di 1536 numeri (JSON) che rappresenta il concetto di: ${text}`,
          } as GeminiPart,
        ],
        { jsonMode: true }
      );
      // fake embedding placeholder — sostituire con il vero embedding del modello Gemini
      const raw = res?.text || '';
      const nums = raw.match(/-?\d+(?:\.\d+)?/g);
      const vec = nums ? nums.slice(0, 1536).map(Number) : null;
      if (vec) {
        await supabase.from('perfumes').update({ embedding: vec }).eq('id', row.id);
      }
    } catch (e) {
      console.warn(`Embedding per ${row.id} saltato: ${(e as Error).message}`);
    }
  }
}
