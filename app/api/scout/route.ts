import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { extractCanonicalFamilies, normalizeFamily, PURE_FAMILIES } from '@/lib/families';
import { formatPerfumeNote } from '@/lib/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type ScoutMode = 'trittico' | 'ultranicchia';
type ScoutCategory = 'Designer' | 'Nicchia' | 'Artistico' | 'Ultra-Nicchia';

interface ScoutRequestPayload {
  mode?: ScoutMode;
  scoutFamily?: string;
  lastFamily?: string | null;
  freeQuery?: string;
  includeNotes?: string[];
  excludeNotes?: string[];
  ownedKeys?: string[];
  excludedKeys?: string[];
}

interface CandidatePerfume {
  brand: string;
  nome: string;
  concentrazione: string | null;
  famiglia_olfattiva: string | null;
  naso: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  categoria: ScoutCategory;
  fonte: 'catalogo' | 'ultranicchia';
  motivo: string;
  url_foto_vetrina: string | null;
}

// 1. DESIGNER: Maison storiche della moda e linee esclusive classiche
const DESIGNER_BRANDS: string[] = [
  'chanel',
  'dior',
  'christian dior',
  'guerlain',
  'hermes',
  'hermès',
  'tom ford',
  'prada',
  'yves saint laurent',
  'ysl',
  'giorgio armani',
  'armani',
  'givenchy',
  'cartier',
  'bottega veneta',
  'loewe',
  'louis vuitton',
  'celine',
  'céline',
  'valentino',
  'bvlgari',
  'bulgari',
  'acqua di parma',
  'van cleef & arpels',
  'maison margiela',
  'mugler',
  'thierry mugler',
  'narciso rodriguez',
  'issey miyake',
  'kenzo',
  'lalique',
];

// 2. NICCHIA: Case indipendenti strutturate e selettive
const NICHE_BRANDS: string[] = [
  'byredo',
  'diptyque',
  'le labo',
  'maison francis kurkdjian',
  'amouage',
  'xerjoff',
  'nishane',
  'parfums de marly',
  'initio',
  'initio parfums prives',
  'creed',
  'penhaligons',
  "penhaligon's",
  'lartisan parfumeur',
  "l'artisan parfumeur",
  'memo paris',
  'ex nihilo',
  'kilian',
  'by kilian',
  'profumum roma',
  'tiziana terenzi',
  'montale',
  'mancera',
  'bdk parfums',
  'essential parfums',
  'miller harris',
  'ormonde jayne',
  'heeley',
  'james heeley',
  'laboratorio olfattivo',
  'santa maria novella',
  'histoires de parfums',
  'atelier cologne',
  'jovoy',
  'jovoy paris',
  'roja parfums',
  'clive christian',
  'bond no 9',
  'bond no. 9',
  'sospiro',
  'casamorati',
  'nobile 1942',
  'carthusia',
  'pantheon roma',
  'gritti',
  'moresque',
  'the merchant of venice',
  'juliette has a gun',
];

// 3. ARTISTICO: Profumeria d'autore, nasi indipendenti e ricerca materica
const ARTISTIC_BRANDS: string[] = [
  'serge lutens',
  'editions de parfums frederic malle',
  'frederic malle',
  'frédéric malle',
  'etat libre dorange',
  "etat libre d'orange",
  'nasomatto',
  'orto parisi',
  'lorenzo pazzaglia',
  'francesca bianchi',
  'filippo sorcinelli',
  'mendittorosa',
  'meo fusciuni',
  'naomi goodsir',
  'stephane humbert lucas',
  's humbert lucas',
  's. humbert lucas',
  'les liquides imaginaires',
  'marc-antoine barrois',
  'marc antoine barrois',
  'tauer perfumes',
  'andy tauer',
  'zoologist',
  'zoologist perfumes',
  'imaginary authors',
  'dusita',
  'parfums dusita',
  'masque milano',
  'beaufort london',
  'bogue',
  'bogue profumo',
  'baruti',
  'kerosene',
  'hiram green',
  'papillon artisan perfumes',
  'rogue perfumery',
  'stora skuggan',
  'jorum studio',
  'rania j',
  'olympic orchids',
];

function normalizeKey(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function makePairKey(brand?: string | null, nome?: string | null): string {
  return `${normalizeKey(brand)}::${normalizeKey(nome)}`;
}

const DESIGNER_SET = new Set(DESIGNER_BRANDS.map((b) => normalizeKey(b)));
const NICHE_SET = new Set(NICHE_BRANDS.map((b) => normalizeKey(b)));
const ARTISTIC_SET = new Set(ARTISTIC_BRANDS.map((b) => normalizeKey(b)));

function classifyCatalogBrand(brandRaw: string): 'Designer' | 'Nicchia' | 'Artistico' | null {
  const b = normalizeKey(brandRaw);
  if (!b) return null;
  if (DESIGNER_SET.has(b)) return 'Designer';
  if (NICHE_SET.has(b)) return 'Nicchia';
  if (ARTISTIC_SET.has(b)) return 'Artistico';
  return null;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cleanNoteField(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const formatted = formatPerfumeNote(raw);
  return formatted.trim() ? formatted : null;
}

function buildSearchableText(...parts: Array<string | null | undefined>): string {
  const rawCombined = parts.filter(Boolean).join(', ');
  const translated = formatPerfumeNote(rawCombined);
  return normalizeKey(`${rawCombined} ${translated}`);
}

function matchesNotesFilter(
  searchableNotes: string,
  includeTokens: string[],
  excludeTokens: string[]
): { ok: boolean; matchScore: number } {
  for (let i = 0; i < excludeTokens.length; i++) {
    const ex = excludeTokens[i];
    if (ex && searchableNotes.includes(ex)) {
      return { ok: false, matchScore: -1 };
    }
  }
  if (includeTokens.length === 0) {
    return { ok: true, matchScore: 0 };
  }
  let matched = 0;
  for (let i = 0; i < includeTokens.length; i++) {
    const inc = includeTokens[i];
    if (inc && searchableNotes.includes(inc)) {
      matched += 1;
    }
  }
  if (matched === 0) {
    return { ok: false, matchScore: 0 };
  }
  return { ok: true, matchScore: matched * 25 };
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function enrichReasonsWithAI(
  candidates: CandidatePerfume[],
  contextHint: string
): Promise<CandidatePerfume[]> {
  if (candidates.length === 0) return candidates;

  const fallbackReason = (c: CandidatePerfume): string => {
    const notes = [c.note_testa, c.note_cuore, c.note_fondo]
      .filter(Boolean)
      .join(', ')
      .split(',')
      .slice(0, 3)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    return notes ? `Accordo costruito su ${notes}.` : `Selezione ${c.categoria.toLowerCase()}.`;
  };

  try {
    const listText = candidates
      .map(
        (c, idx) =>
          `${idx + 1}. [${c.categoria}] ${c.brand} — ${c.nome} | Testa: ${
            c.note_testa || '-'
          } | Cuore: ${c.note_cuore || '-'} | Fondo: ${c.note_fondo || '-'}`
      )
      .join('\n');

    const prompt = `Sei il curatore di Atelier LG. Scrivi una nota editoriale asciutta e tecnica in italiano (1 frase breve, max 120 caratteri, zero enfasi pubblicitaria) per ciascuna di queste ${candidates.length} fragranze reali${
      contextHint ? ` (${contextHint})` : ''
    }:

${listText}

Restituisci SOLO JSON valido:
{
  "motivi": ["frase 1", "frase 2", "frase 3"]
}`;

    const { text } = await callGeminiWithFallback([{ text: prompt }], {
      jsonMode: true,
      temperature: 0.4,
      timeoutMs: 6500,
      deadline: Date.now() + 9000,
    });

    const parsed = extractJsonFromAiText<{ motivi?: unknown }>(text);
    const motivi = Array.isArray(parsed?.motivi) ? parsed.motivi : [];

    return candidates.map((c, idx) => {
      const m = typeof motivi[idx] === 'string' ? motivi[idx].trim() : '';
      return {
        ...c,
        motivo: m.length >= 8 ? m.slice(0, 160) : fallbackReason(c),
      };
    });
  } catch {
    return candidates.map((c) => ({
      ...c,
      motivo: fallbackReason(c),
    }));
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: ScoutRequestPayload;
  try {
    body = (await req.json()) as ScoutRequestPayload;
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Configurazione database mancante.' }, { status: 500 });
  }

  const mode: ScoutMode = body.mode === 'ultranicchia' ? 'ultranicchia' : 'trittico';
  const rawFamily = (body.scoutFamily || 'Qualsiasi').trim();
  const lastFamily = (body.lastFamily || '').trim();
  const freeQueryTokens = normalizeKey(body.freeQuery)
    .split(' ')
    .filter((t) => t.length >= 2);

  let effectiveFamily = rawFamily;
  if (rawFamily === 'Qualsiasi') {
    const pool = PURE_FAMILIES.filter((f) => f.toLowerCase() !== lastFamily.toLowerCase());
    effectiveFamily = pool[Math.floor(Math.random() * pool.length)] || 'Ambrata';
  }

  const includeNotes = Array.isArray(body.includeNotes)
    ? body.includeNotes.map((n) => String(n).trim()).filter(Boolean).slice(0, 8)
    : [];
  const excludeNotes = Array.isArray(body.excludeNotes)
    ? body.excludeNotes.map((n) => String(n).trim()).filter(Boolean).slice(0, 8)
    : [];

  const includeTokens = includeNotes.map(normalizeKey).filter(Boolean);
  const excludeTokens = excludeNotes.map(normalizeKey).filter(Boolean);

  const blockedKeys = new Set<string>([
    ...(Array.isArray(body.ownedKeys) ? body.ownedKeys.map(String) : []),
    ...(Array.isArray(body.excludedKeys) ? body.excludedKeys.map(String) : []),
  ]);

  try {
    // RAMO 1: ULTRA-NICCHIA (ricerca libera su ultranicchia_import)
    if (mode === 'ultranicchia') {
      const { data: ultraRows, error: ultraErr } = await supabase
        .from('ultranicchia_import')
        .select(
          'brand, nome, concentrazione, famiglia_originale, famiglia_tags, naso, note_testa, note_cuore, note_fondo, dati_completi'
        );

      if (ultraErr) throw ultraErr;

      const ultraPool: Array<{ item: CandidatePerfume; score: number }> = [];

      for (const row of ultraRows || []) {
        const brand = String(row.brand || '').trim();
        const nome = String(row.nome || '').trim();
        if (!brand || !nome) continue;

        const pairKey = makePairKey(brand, nome);
        if (blockedKeys.has(pairKey)) continue;

        const testa = cleanNoteField(row.note_testa);
        const cuore = cleanNoteField(row.note_cuore);
        const fondo = cleanNoteField(row.note_fondo);
        if (!testa && !cuore && !fondo) continue;

        const fams = extractCanonicalFamilies(row.famiglia_tags || row.famiglia_originale);
        const dominantFam =
          normalizeFamily(row.famiglia_tags) || normalizeFamily(row.famiglia_originale);

        if (
          rawFamily !== 'Qualsiasi' &&
          !fams.some((f) => f.toLowerCase() === rawFamily.toLowerCase())
        ) {
          continue;
        }

        const searchable = buildSearchableText(
          brand,
          nome,
          row.naso,
          row.famiglia_originale,
          row.note_testa,
          row.note_cuore,
          row.note_fondo
        );

        // Ricerca libera: ogni parola digitata deve comparire tra note, accordi, naso o maison
        if (freeQueryTokens.length > 0) {
          const allTokensMatch = freeQueryTokens.every((tok) => searchable.includes(tok));
          if (!allTokensMatch) continue;
        }

        const noteCheck = matchesNotesFilter(searchable, includeTokens, excludeTokens);
        if (!noteCheck.ok) continue;

        const completenessBonus = row.dati_completi ? 12 : 0;
        const queryBonus = freeQueryTokens.length > 0 ? 30 : 0;

        ultraPool.push({
          item: {
            brand,
            nome,
            concentrazione: row.concentrazione ? String(row.concentrazione).trim() : null,
            famiglia_olfattiva: dominantFam,
            naso: row.naso ? String(row.naso).trim() : null,
            note_testa: testa,
            note_cuore: cuore,
            note_fondo: fondo,
            categoria: 'Ultra-Nicchia',
            fonte: 'ultranicchia',
            motivo: '',
            url_foto_vetrina: null,
          },
          score: noteCheck.matchScore + completenessBonus + queryBonus + Math.random() * 20,
        });
      }

      ultraPool.sort((a, b) => b.score - a.score);

      const picked = shuffle(ultraPool.slice(0, 14))
        .slice(0, 3)
        .map((c) => c.item);

      const hint = [
        body.freeQuery?.trim(),
        rawFamily !== 'Qualsiasi' ? `famiglia ${rawFamily}` : '',
        includeNotes.length > 0 ? `note: ${includeNotes.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(', ');

      const enriched = await enrichReasonsWithAI(picked, hint);

      return NextResponse.json({
        proposals: enriched,
        resolvedFamily: rawFamily === 'Qualsiasi' ? null : rawFamily,
        totalMatches: ultraPool.length,
      });
    }

    // RAMO 2: IL TRITTICO (1 Designer · 1 Nicchia · 1 Artistico dal catalogo perfumes)
    const sampledBrands = shuffle([
      ...shuffle(DESIGNER_BRANDS).slice(0, 12),
      ...shuffle(NICHE_BRANDS).slice(0, 14),
      ...shuffle(ARTISTIC_BRANDS).slice(0, 14),
    ]);

    const orBrandFilter = sampledBrands
      .map((b) => `brand.ilike.%${b.replace(/[^a-z0-9\s'-]/gi, '')}%`)
      .join(',');

    const { data: catalogRows, error: catErr } = await supabase
      .from('perfumes')
      .select('brand, name, concentration, main_accords, top_notes, middle_notes, base_notes, perfumers')
      .or(orBrandFilter)
      .not('top_notes', 'is', null)
      .limit(550);

    if (catErr) throw catErr;

    const designerPool: Array<{ item: CandidatePerfume; score: number }> = [];
    const nichePool: Array<{ item: CandidatePerfume; score: number }> = [];
    const artisticPool: Array<{ item: CandidatePerfume; score: number }> = [];

    for (const row of catalogRows || []) {
      const brand = String(row.brand || '').trim();
      const nome = String(row.name || '').trim();
      if (!brand || !nome) continue;

      const pairKey = makePairKey(brand, nome);
      if (blockedKeys.has(pairKey)) continue;

      const cat = classifyCatalogBrand(brand);
      if (!cat) continue;

      const testa = cleanNoteField(row.top_notes);
      const cuore = cleanNoteField(row.middle_notes);
      const fondo = cleanNoteField(row.base_notes);
      if (!testa && !cuore && !fondo) continue;

      const fams = extractCanonicalFamilies(row.main_accords);
      const dominantFam = normalizeFamily(row.main_accords);

      const targetFamLower = effectiveFamily.toLowerCase();
      const hasFam = fams.some((f) => f.toLowerCase() === targetFamLower);

      if (rawFamily !== 'Qualsiasi' && !hasFam) continue;

      const searchable = buildSearchableText(
        row.top_notes,
        row.middle_notes,
        row.base_notes,
        row.main_accords
      );
      const noteCheck = matchesNotesFilter(searchable, includeTokens, excludeTokens);
      if (!noteCheck.ok) continue;

      const entry = {
        item: {
          brand,
          nome,
          concentrazione: row.concentration ? String(row.concentration).trim() : null,
          famiglia_olfattiva: dominantFam,
          naso: row.perfumers ? String(row.perfumers).trim() : null,
          note_testa: testa,
          note_cuore: cuore,
          note_fondo: fondo,
          categoria: cat,
          fonte: 'catalogo' as const,
          motivo: '',
          url_foto_vetrina: null,
        },
        score: (hasFam ? 45 : 10) + noteCheck.matchScore + Math.random() * 20,
      };

      if (cat === 'Designer') designerPool.push(entry);
      else if (cat === 'Nicchia') nichePool.push(entry);
      else artisticPool.push(entry);
    }

    designerPool.sort((a, b) => b.score - a.score);
    nichePool.sort((a, b) => b.score - a.score);
    artisticPool.sort((a, b) => b.score - a.score);

    const trittico: CandidatePerfume[] = [];
    const usedKeys = new Set<string>();

    const pickOne = (pool: Array<{ item: CandidatePerfume; score: number }>) => {
      const topSlice = shuffle(pool.slice(0, 8));
      for (const entry of topSlice) {
        const k = makePairKey(entry.item.brand, entry.item.nome);
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          trittico.push(entry.item);
          return;
        }
      }
    };

    pickOne(designerPool);
    pickOne(nichePool);
    pickOne(artisticPool);

    for (const pool of [artisticPool, nichePool, designerPool]) {
      if (trittico.length >= 3) break;
      for (const entry of pool) {
        if (trittico.length >= 3) break;
        const k = makePairKey(entry.item.brand, entry.item.nome);
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          trittico.push(entry.item);
        }
      }
    }

    const hint = [
      `direzione ${effectiveFamily}`,
      includeNotes.length > 0 ? `note: ${includeNotes.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const enriched = await enrichReasonsWithAI(trittico, hint);

    return NextResponse.json({
      proposals: enriched,
      resolvedFamily: effectiveFamily,
      totalMatches: designerPool.length + nichePool.length + artisticPool.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore durante la ricerca.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
