import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - t, value };
  } catch (e: any) {
    return { ms: Date.now() - t, error: e?.message || String(e) };
  }
}

export async function GET() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    envCheck: {},
    engineTest: {},
    geminiModels: {},
    groqTest: {},
    openRouterTest: {},
    supabaseTest: {},
    externalPerfumeDbTest: {},
  };

  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const orKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supaKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  report.envCheck = {
    hasGeminiKey: Boolean(geminiKey),
    geminiKeyFormatWarning:
      geminiKey && !geminiKey.startsWith('AIza')
        ? 'ATTENZIONE: le chiavi Google AI Studio iniziano con "AIza". Questa potrebbe non essere valida per generativelanguage.googleapis.com.'
        : 'OK',
    hasGroqKey: Boolean(groqKey),
    hasOpenRouterKey: Boolean(orKey),
    hasJinaKey: Boolean((process.env.JINA_API_KEY || '').trim()),
    hasSupabaseUrl: Boolean(supaUrl),
    hasSupabaseKey: Boolean(supaKey),
    usesServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    geminiModelsOverride: process.env.GEMINI_MODELS || null,
  };

  // 1. Motore reale: quale modello risponde davvero, e in quanto tempo
  const engine = await timed(() =>
    callGeminiWithFallback([{ text: 'Rispondi solo con: {"ok":true}' }], {
      jsonMode: true,
      timeoutMs: 8000,
      deadline: Date.now() + 14000,
    })
  );
  report.engineTest = engine.error
    ? { ok: false, ms: engine.ms, error: engine.error }
    : { ok: true, ms: engine.ms, modelUsed: engine.value?.modelUsed };

  // 2. Elenco modelli Gemini disponibili per questa chiave
  if (geminiKey) {
    const list = await timed(async () => {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
        headers: { 'x-goog-api-key': geminiKey },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ''}`.trim());
      return (data?.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1)
        .map((m: any) => String(m.name || '').replace('models/', ''))
        .filter((n: string) => n.indexOf('gemini') !== -1);
    });
    report.geminiModels = list.error
      ? { ok: false, error: list.error }
      : { ok: true, count: list.value?.length, flash: (list.value || []).filter((n: string) => n.indexOf('flash') !== -1).slice(0, 12) };
  }

  // 3. Groq
  if (groqKey) {
    const g = await timed(async () => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Rispondi solo OK' }],
          max_tokens: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ''}`.trim());
      return data?.choices?.[0]?.message?.content;
    });
    report.groqTest = g.error ? { ok: false, ms: g.ms, error: g.error } : { ok: true, ms: g.ms, reply: g.value };
  }

  // 4. OpenRouter
  if (orKey) {
    const o = await timed(async () => {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${orKey}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return true;
    });
    report.openRouterTest = o.error ? { ok: false, error: o.error } : { ok: true, ms: o.ms };
  }

  // 5. Supabase: catalogo, RPC e collezione
  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

      const cat = await supabase
        .from('perfumes')
        .select('id, name, brand, release_year', { count: 'exact' })
        .limit(3);
      const col = await supabase
        .from('profumi')
        .select('id, nome, brand', { count: 'exact' })
        .limit(3);
      const rpc = await supabase.rpc('search_perfume_exact', { search_query: 'Naxos' });

      report.supabaseTest = {
        tabella_perfumes_catalogo: {
          ok: !cat.error,
          totalRowsRead: cat.count,
          sample: cat.data,
          error: cat.error?.message || null,
          hint:
            !cat.error && cat.count === 0
              ? 'La tabella restituisce 0 righe: la policy RLS di Supabase blocca la lettura anonima.'
              : null,
        },
        rpc_search_perfume_exact: {
          ok: !rpc.error,
          rows: Array.isArray(rpc.data) ? rpc.data.length : 0,
          error: rpc.error?.message || null,
          hint: rpc.error ? 'RPC assente: /api/extract usa la ricerca diretta sul catalogo.' : null,
        },
        tabella_profumi_collezione: {
          ok: !col.error,
          totalRowsRead: col.count,
          sample: col.data,
          error: col.error?.message || null,
        },
      };
    } catch (e: any) {
      report.supabaseTest = { ok: false, exception: e?.message };
    }
  }

  // 6. Ricerca web (Jina)
  const jinaHeaders: Record<string, string> = { Accept: 'text/plain', 'X-Retain-Images': 'none' };
  if (process.env.JINA_API_KEY) jinaHeaders.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const jina = await timed(async () => {
    const res = await fetch(
      `https://s.jina.ai/${encodeURIComponent('Xerjoff Naxos fragrantica notes perfumer')}`,
      { headers: jinaHeaders, cache: 'no-store' }
    );
    const txt = await res.text();
    return { status: res.status, length: txt.length, ok: res.ok && txt.length > 200 };
  });
  report.externalPerfumeDbTest = jina.error
    ? { ok: false, error: jina.error }
    : { ...jina.value, ms: jina.ms };

  return NextResponse.json(report, { status: 200 });
}
