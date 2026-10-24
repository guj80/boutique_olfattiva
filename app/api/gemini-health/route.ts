import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    envCheck: {},
    geminiTest: {},
    groqTest: {},
    supabaseTest: {},
     externalPerfumeDbTest: {},
  };

  // 1. CONTROLLO FORMATO CHIAVI
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supaKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  report.envCheck = {
    hasGeminiKey: Boolean(geminiKey),
    geminiKeyPrefix: geminiKey ? `${geminiKey.slice(0, 6)}...` : 'MANCANTE',
    geminiKeyFormatWarning:
      geminiKey && !geminiKey.startsWith('AIza')
        ? 'ATTENZIONE: Le chiavi Google AI Studio standard iniziano con "AIzaSy...". Una chiave che inizia con "AQ." non è valida per generativelanguage.googleapis.com!'
        : 'OK',
    hasGroqKey: Boolean(groqKey),
    groqKeyPrefix: groqKey ? `${groqKey.slice(0, 6)}...` : 'MANCANTE',
    hasSupabaseUrl: Boolean(supaUrl),
    hasSupabaseKey: Boolean(supaKey),
    supabaseKeyPrefix: supaKey ? `${supaKey.slice(0, 15)}...` : 'MANCANTE',
  };

  // 2. TEST REALE GEMINI (Lista modelli + Chiamata)
  if (geminiKey) {
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { cache: 'no-store' }
      );
      const listData = await listRes.json();
      if (!listRes.ok) {
        report.geminiTest = {
          ok: false,
          status: listRes.status,
          errorFromGoogle: listData?.error?.message || listData,
        };
      } else {
        const availableModels = (listData?.models || [])
          .map((m: any) => m.name?.replace('models/', ''))
          .filter((name: string) => name?.includes('gemini'));
        report.geminiTest = {
          ok: true,
          availableModelsSample: availableModels.slice(0, 10),
        };
      }
    } catch (e: any) {
      report.geminiTest = { ok: false, exception: e?.message };
    }
  }

  // 3. TEST REALE GROQ
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Rispondi solo OK' }],
          max_tokens: 5,
        }),
      });
      const groqData = await groqRes.json();
      report.groqTest = {
        ok: groqRes.ok,
        status: groqRes.status,
        reply: groqData?.choices?.[0]?.message?.content || groqData?.error?.message,
      };
    } catch (e: any) {
      report.groqTest = { ok: false, exception: e?.message };
    }
  }

  // 4. TEST TABELLE SUPABASE (Verifica se la tabella perfumes è leggibile o bloccata da RLS)
  if (supaUrl && supaKey) {
    try {
      const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

      const { data: catData, count: catCount, error: catErr } = await supabase
        .from('perfumes')
        .select('id, name, brand, release_year', { count: 'exact' })
        .limit(3);

      const { data: colData, count: colCount, error: colErr } = await supabase
        .from('profumi')
        .select('id, nome, brand', { count: 'exact' })
        .limit(3);

      report.supabaseTest = {
        tabella_perfumes_catalogo: {
          ok: !catErr,
          totalRowsRead: catCount,
          sample: catData,
          error: catErr?.message || null,
          hint:
            !catErr && catCount === 0
              ? 'La tabella restituisce 0 righe: la policy RLS su Supabase sta bloccando la lettura anonima!'
              : null,
        },
        tabella_profumi_collezione: {
          ok: !colErr,
          totalRowsRead: colCount,
          sample: colData,
          error: colErr?.message || null,
        },
      };
    } catch (e: any) {
      report.supabaseTest = { ok: false, exception: e?.message };
    }
  }

  // 5. TEST CONNETTORE ESTERNO LIVE (Wikipedia / Wikidata / Jina Search)
  try {
    const jinaRes = await fetch(
      `https://s.jina.ai/${encodeURIComponent('Xerjoff Naxos fragrantica notes perfumer')}`,
      { headers: { Accept: 'text/plain', 'X-Retain-Images': 'none' } }
    );
    const txt = await jinaRes.text();
    report.externalPerfumeDbTest = {
      ok: jinaRes.ok && txt.length > 200,
      status: jinaRes.status,
      snippetLength: txt.length,
    };
  } catch (e: any) {
    report.externalPerfumeDbTest = { ok: false, exception: e?.message };
  }

  return NextResponse.json(report, { status: 200 });
}
