// app/api/ultranicicchia/import-brand/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';

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

function stripBrandPrefix(nome: string, brand: string): string {
  const cleanName = nome.trim();
  const cleanBrand = brand.trim();
  if (!cleanBrand) return cleanName;
  const escaped = cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return cleanName.replace(new RegExp(`^${escaped}[\\s\\-–—:]+`, 'i'), '').trim() || cleanName;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const remaining = () => Math.max(1500, t0 + BUDGET_MS - Date.now());

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { brand } = await req.json();
    const cleanBrand = typeof brand === 'string' ? brand.trim() : '';
    if (!cleanBrand) {
      return NextResponse.json({ error: 'Brand mancante o non valido.' }, { status: 400 });
    }

    // 1. Ricerca Web singola e pulita (niente catene OR/site: che rallentano Tavily)
    const webData = await withTimeout(
      tavilySearch(`"${cleanBrand}" perfume fragrances collection list fragrantica parfumo`, {
        maxResults: 6,
        timeoutMs: 5500,
      }).catch(() => null),
      6000,
      null
    );

    const webContext = webData?.contextText?.trim() || '';
    const hasWebContext = webContext.length > 120;

    // 2. Estrazione AI:
    // - Se Tavily ha trovato testo: niente Google Search, consentiamo anche Groq/fallback (veloce)
    // - Se Tavily è vuoto: Gemini con Google Search grounding e budget ampio
    const prompt = `Sei un esperto di profumeria di nicchia e ultra-nicchia.
Estrai l'elenco COMPLETO e REALE dei profumi del brand "${cleanBrand}".

${
  hasWebContext
    ? `Testo estratto dal web:\n---\n${webContext.slice(0, 6000)}\n---`
    : 'Nessun testo web fornito: usa la ricerca Google per trovare il catalogo ufficiale (Fragrantica, Parfumo, Basenotes, rivenditori ufficiali).'
}

REGOLE TASSATIVE:
1. Estrai SOLO fragranze realmente prodotte da "${cleanBrand}". Ignora prodotti correlati di altri brand.
2. Nel campo "nome" metti solo il nome della creazione, senza ripetere "${cleanBrand}".
3. In "concentrazione" metti la concentrazione solo se esplicitamente documentata (es. "Extrait de Parfum", "Eau de Parfum"), altrimenti null.
4. NON inventare nulla. Se non trovi nessun profumo documentato, restituisci [].
5. Restituisci ESCLUSIVAMENTE un array JSON valido:
[{"nome": "Nome Creazione", "concentrazione": "Extrait de Parfum"}]`;

    const aiTimeout = hasWebContext
      ? Math.min(10000, remaining())
      : Math.min(15000, remaining());

    const aiResult = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.1,
      jsonMode: !hasWebContext ? false : true, // Google Search su alcuni modelli Gemini è più stabile senza jsonMode rigido
      useGoogleSearch: !hasWebContext,
      onlyGemini: !hasWebContext,
      timeoutMs: aiTimeout,
      deadline: t0 + BUDGET_MS,
    });

    let parsed: unknown = [];
    try {
      parsed = extractJsonFromAiText(aiResult.text);
    } catch {
      parsed = [];
    }

    // 3. Normalizzazione e deduplica
    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const firstArray = Object.values(parsed).find(Array.isArray);
      if (firstArray) rawList = firstArray as any[];
    }

    const seen = new Set<string>();
    const uniqueCandidates: Array<{ nome: string; concentrazione: string | null }> = [];

    for (const item of rawList) {
      if (!item || typeof item.nome !== 'string') continue;
      const nome = stripBrandPrefix(item.nome, cleanBrand);
      if (nome.length < 2) continue;

      const conc =
        typeof item.concentrazione === 'string' && item.concentrazione.trim()
          ? item.concentrazione.trim()
          : null;

      const key = `${nome.toLowerCase()}::${(conc || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      uniqueCandidates.push({ nome, concentrazione: conc });
    }

    if (uniqueCandidates.length === 0) {
      return NextResponse.json(
        {
          error: `Nessun profumo documentato trovato per "${cleanBrand}".`,
          candidates: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      brand: cleanBrand,
      candidates: uniqueCandidates,
    });
  } catch (error: any) {
    console.error('[AtelierLG:ImportBrand]', error);
    const isTimeout =
      error?.name === 'AbortError' ||
      /timeout|deadline/i.test(String(error?.message || ''));
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Il server ha impiegato troppo tempo (Timeout). Riprova tra qualche secondo.'
          : 'Errore durante la ricerca del brand. Riprova.',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
