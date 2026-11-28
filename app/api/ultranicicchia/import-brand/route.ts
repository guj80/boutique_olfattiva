// app/api/ultranicicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { tavilySearch, tavilyExtract } from '@/lib/web-search';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const BUDGET_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), Math.max(500, ms))),
  ]);
}

function isHttpUrl(str: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(str.trim());
}

function stripBrandPrefix(nome: string, brand: string): string {
  const cleanName = nome.trim();
  const cleanBrand = brand.trim();
  if (!cleanBrand || isHttpUrl(cleanBrand)) return cleanName;
  const escaped = cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return cleanName.replace(new RegExp(`^${escaped}[\\s\\-–—:]+`, 'i'), '').trim() || cleanName;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const remaining = () => Math.max(2000, t0 + BUDGET_MS - Date.now());

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    const rawInput = typeof brand === 'string' ? brand.trim() : '';
    if (!rawInput) {
      return NextResponse.json({ error: 'Inserisci un brand o un link catalogo.' }, { status: 400 });
    }

    const inputIsUrl = isHttpUrl(rawInput);
    let resolvedBrand = rawInput;
    let webContext = '';
    let dbCandidates: Array<{ nome: string; concentrazione: string | null }> = [];

    if (inputIsUrl) {
      // MODALITÀ 1: Link diretto (sito ufficiale, Parfumo, Fragrantica, shop)
      const extracted = await withTimeout(
        tavilyExtract(rawInput, 7000).catch(() => null),
        7500,
        null
      );
      webContext = extracted?.trim() || '';
    } else {
      // MODALITÀ 2: Nome brand -> Ricerca parallela su DB locale + Tavily
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const dbJob =
        supabaseUrl && supabaseKey
          ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
              .from('perfumes')
              .select('name, concentration')
              .ilike('brand', `%${rawInput}%`)
              .limit(80)
              .then((res) =>
                (res.data || [])
                  .filter((r: any) => typeof r?.name === 'string' && r.name.trim().length > 1)
                  .map((r: any) => ({
                    nome: stripBrandPrefix(r.name, rawInput),
                    concentrazione: r.concentration ? String(r.concentration).trim() : null,
                  }))
              )
              .catch(() => [])
          : Promise.resolve([]);

      const webJob = withTimeout(
        tavilySearch(`"${rawInput}" perfume fragrances list collection`, {
          maxResults: 6,
          timeoutMs: 5500,
        }).catch(() => null),
        6000,
        null
      );

      const [dbRes, webRes] = await Promise.all([dbJob, webJob]);
      dbCandidates = dbRes;
      webContext = webRes?.contextText?.trim() || '';
    }

    const hasWebContext = webContext.length > 100;
    let aiCandidates: Array<{ nome: string; concentrazione: string | null }> = [];

    // Chiama l'AI se abbiamo testo web, oppure se anche il DB locale è vuoto
    if (hasWebContext || dbCandidates.length === 0) {
      const prompt = inputIsUrl
        ? `Sei un catalogatore di profumeria di nicchia.
Analizza questa pagina web (${rawInput}) ed estrai:
1. Il nome esatto del brand ("brand").
2. L'elenco di TUTTE le fragranze prodotte da quel brand presenti nella pagina ("profumi").

Testo della pagina:
---
${webContext.slice(0, 6500)}
---

REGOLE:
- Non inventare nulla e ignora prodotti di altri brand.
- Nel campo "nome" metti solo il nome della creazione (senza ripetere il brand).
- In "concentrazione" metti la concentrazione solo se scritta, altrimenti null.
- Rispondi SOLO con JSON valido:
{"brand": "Nome Brand", "profumi": [{"nome": "Creazione", "concentrazione": "Extrait de Parfum"}]}`
        : `Sei un catalogatore di profumeria di nicchia e ultra-nicchia.
Estrai l'elenco COMPLETO e REALE delle fragranze prodotte dal brand "${rawInput}".

${
  hasWebContext
    ? `Testo estratto dal web:\n---\n${webContext.slice(0, 6000)}\n---`
    : 'Nessun testo web trovato: usa Google Search per trovare il catalogo ufficiale.'
}

REGOLE:
- Estrai SOLO fragranze realmente prodotte da "${rawInput}".
- Nel campo "nome" metti solo il nome della creazione (senza ripetere "${rawInput}").
- In "concentrazione" metti la concentrazione solo se documentata, altrimenti null.
- Non inventare nulla. Se non trovi nulla, restituisci [].
- Rispondi SOLO con JSON valido:
[{"nome": "Creazione", "concentrazione": "Extrait de Parfum"}]`;

      try {
        const aiResult = await callGeminiWithFallback([{ text: prompt }], {
          temperature: 0.1,
          jsonMode: hasWebContext,
          useGoogleSearch: !hasWebContext && !inputIsUrl,
          onlyGemini: !hasWebContext && !inputIsUrl,
          timeoutMs: Math.min(7000, remaining()),
          deadline: t0 + BUDGET_MS,
        });

        const parsed: any = extractJsonFromAiText(aiResult.text);
        if (inputIsUrl && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (typeof parsed.brand === 'string' && parsed.brand.trim()) {
            resolvedBrand = parsed.brand.trim();
          }
          if (Array.isArray(parsed.profumi)) aiCandidates = parsed.profumi;
        } else if (Array.isArray(parsed)) {
          aiCandidates = parsed;
        } else if (parsed && typeof parsed === 'object') {
          const firstArray = Object.values(parsed).find(Array.isArray);
          if (firstArray) aiCandidates = firstArray as any[];
        }
      } catch (aiErr) {
        // Se l'AI fallisce ma il DB locale ha trovato risultati, non buttiamo via tutto
        if (dbCandidates.length === 0) throw aiErr;
      }
    }

    // Unisce e deduplica risultati DB + AI
    const seen = new Set<string>();
    const merged: Array<{ nome: string; concentrazione: string | null }> = [];

    for (const item of [...dbCandidates, ...aiCandidates]) {
      if (!item || typeof item.nome !== 'string') continue;
      const nome = stripBrandPrefix(item.nome, resolvedBrand);
      if (nome.length < 2) continue;

      const conc =
        typeof item.concentrazione === 'string' && item.concentrazione.trim()
          ? item.concentrazione.trim()
          : null;

      const key = `${nome.toLowerCase()}::${(conc || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ nome, concentrazione: conc });
    }

    if (merged.length === 0) {
      return NextResponse.json(
        {
          error: inputIsUrl
            ? 'Nessun profumo leggibile da questo link. Prova con la pagina catalogo del sito ufficiale o Parfumo.'
            : `Nessun profumo trovato per "${rawInput}". Prova a incollare direttamente il link del sito ufficiale o di Parfumo.`,
          candidates: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      brand: resolvedBrand,
      candidates: merged,
    });
  } catch (error: any) {
    console.error('[AtelierLG:ImportBrand]', error);
    return NextResponse.json(
      { error: 'Errore durante la ricerca. Prova a incollare il link diretto del brand.' },
      { status: 500 }
    );
  }
}
