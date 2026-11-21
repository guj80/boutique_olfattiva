import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';
import { extractCanonicalFamilies, normalizeFamily, PURE_FAMILIES } from '@/lib/families';
import { formatPerfumeNote } from '@/lib/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type ScoutMode = 'triad' | 'ultranicchia';
type ScoutCategory = 'Designer' | 'Artistico' | 'Ultra-Nicchia';

interface ScoutRequestPayload {
  mode?: ScoutMode;
  scoutFamily?: string;
  lastFamily?: string | null;
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

const ARTISTIC_BRANDS: string[] = [
  'serge lutens',
  'diptyque',
  'editions de parfums frederic malle',
  'frederic malle',
  'frédéric malle',
  'byredo',
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
  'etat libre dorange',
  "etat libre d'orange",
  'memo paris',
  'ex nihilo',
  'kilian',
  'by kilian',
  'nasomatto',
  'orto parisi',
  'lorenzo pazzaglia',
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
  'stephane humbert lucas',
  's humbert lucas',
  's. humbert lucas',
  'les liquides imaginaires',
  'marc-antoine barrois',
  'marc antoine barrois',
  'mendittorosa',
  'meo fusciuni',
  'naomi goodsir',
  'francesca bianchi',
  'tauer perfumes',
  'andy tauer',
  'juliette has a gun',
  'zoologist',
  'zoologist perfumes',
  'imaginary authors',
  'dusita',
  'parfums dusita',
  'masque milano',
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
  'acqua delle langhe',
  'nobile 1942',
  'carthusia',
  'pantheon roma',
  'gritti',
  'moresque',
  'the merchant of venice',
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

const NORMALIZED_DESIGNER_SET = new Set(DESIGNER_BRANDS.map((d) => normalizeKey(d)));
const NORMALIZED_ARTISTIC_SET = new Set(ARTISTIC_BRANDS.map((a) => normalizeKey(a)));

function classifyCatalogBrand(brandRaw: string): 'Designer' | 'Artistico' | null {
  const b = normalizeKey(brandRaw);
  if (!b) return null;
  if (NORMALIZED_DESIGNER_SET.has(b)) return 'Designer';
  if (NORMALIZED_ARTISTIC_SET.has(b)) return 'Artistico';
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

function buildSearchableNotesText(
  testa?: string | null,
  cuore?: string | null,
  fondo?: string | null,
  accords?: string | null
): string {
  const rawCombined = [testa, cuore, fondo, accords].filter(Boolean).join(', ');
  const translated = formatPerfumeNote(rawCombined);
  return normalizeKey(`${rawCombined} ${translated}`);
}

function matchesNotesFilter(
  searchableNotes: string,
  includeTokens: string[],
  excludeTokens: string[]
): { ok: boolean; matchScore: number } {
  if (excludeTokens.some((ex) => ex && searchableNotes.includes(ex))) {
    return { ok: false, matchScore: -1 };
  }
  if (includeTokens.length === 0) {
    return { ok: true, matchScore: 0 };
  }
  let matched = 0;
  for (const inc of includeTokens) {
    if (inc && searchableNotes.includes(inc)) {
      matched += 1;
    }
  }
  if (matched === 0) {
    return { ok: false, matchScore: 0 };
  }
  return { ok: true, matchScore: matched * 20 };
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function enrichReasonsWithAI(
  candidates: CandidatePerfume[],
  filters: {
    mode: ScoutMode;
    targetFamily: string;
    includeNotes: string[];
    excludeNotes: string[];
  }
): Promise<CandidatePerfume[]> {
  if (candidates.length === 0) return candidates;

  const fallbackReason = (c: CandidatePerfume): string => {
    const notes = [c.note_testa, c.note_cuore, c.note_fondo]
      .filter(Boolean)
      .join(', ')
      .split(',')
      .slice(0, 4)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    if (notes) {
      return `Creazione ${c.categoria.toLowerCase()} centrata su ${notes}.`;
    }
    return `Proposta ${c.categoria.toLowerCase()} selezionata per coerenza olfattiva.`;
  };

  try {
    const listText = candidates
      .map(
        (c, idx) =>
          `${idx + 1}. [${c.categoria}] ${c.brand} — ${c.nome} | Famiglia: ${
            c.famiglia_olfattiva || 'Non dichiarata'
          } | Testa: ${c.note_testa || '-'} | Cuore: ${c.note_cuore || '-'} | Fondo: ${
            c.note_fondo || '-'
          }`
      )
      .join('\n');

    const prompt = `Sei il curatore olfattivo di Atelier LG. Ti fornisco ${candidates.length} profumi REALI estratti dal database.
NON cambiare brand, nome o note. Scrivi SOLO una breve motivazione tecnica in italiano (1 frase, max 140 caratteri) per ciascuno, spiegando perché vale la pena provarlo in base alle sue note reali${
      filters.includeNotes.length > 0 ? ` e alle note richieste (${filters.includeNotes.join(', ')})` : ''
    }.

PROFUMI:
${listText}

Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "motivi": ["frase 1", "frase 2", "frase 3"]
}`;

    const { text } = await callGeminiWithFallback([{ text: prompt }], {
      jsonMode: true,
      temperature: 0.45,
      timeoutMs: 6500,
      deadline: Date.now() + 9000,
    });

    const parsed = extractJsonFromAiText<{ motivi?: unknown }>(text);
    const motivi = Array.isArray(parsed?.motivi) ? parsed.motivi : [];

    return candidates.map((c, idx) => {
      const m = typeof motivi[idx] === 'string' ? motivi[idx].trim() : '';
      return {
        ...c,
        motivo: m.length >= 8 ? m.slice(0, 180) : fallbackReason(c),
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

  const mode: ScoutMode = body.mode === 'ultranicchia' ? 'ultranicchia' : 'triad';
  const rawFamily = (body.scoutFamily || 'Qualsiasi').trim();
  const lastFamily = (body.lastFamily || '').trim();

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
    const { data: ultraRows, error: ultraErr } = await supabase
      .from('ultranicchia_import')
      .select(
        'brand, nome, concentrazione, famiglia_originale, famiglia_tags, naso, note_testa, note_cuore, note_fondo, dati_completi'
      );

    if (ultraErr) throw ultraErr;

    const ultraCandidates: Array<{ item: CandidatePerfume; score: number }> = [];

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

      const familyMatch =
        rawFamily === 'Qualsiasi'
          ? fams.some((f) => f.toLowerCase() === effectiveFamily.toLowerCase())
            ? 25
            : 5
          : fams.some((f) => f.toLowerCase() === rawFamily.toLowerCase())
          ? 40
          : -100;

      if (familyMatch < 0) continue;

      const searchable = buildSearchableNotesText(
        row.note_testa,
        row.note_cuore,
        row.note_fondo,
        row.famiglia_originale
      );
      const noteCheck = matchesNotesFilter(searchable, includeTokens, excludeTokens);
      if (!noteCheck.ok) continue;

      const completenessBonus = row.dati_completi ? 10 : 0;

      ultraCandidates.push({
        item: {
          brand,
          nome,
          concentrazione: row.concentrazione ? String(row.concentrazione).trim() : 'Extrait de Parfum',
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
        score: familyMatch + noteCheck.matchScore + completenessBonus + Math.random() * 15,
      });
    }

    ultraCandidates.sort((a, b) => b.score - a.score);

    if (mode === 'ultranicchia') {
      const picked = shuffle(ultraCandidates.slice(0, 12))
        .slice(0, 3)
        .map((c) => c.item);

      const enriched = await enrichReasonsWithAI(picked, {
        mode,
        targetFamily: rawFamily === 'Qualsiasi' ? 'Tutte' : rawFamily,
        includeNotes,
        excludeNotes,
      });

      return NextResponse.json({
        proposals: enriched,
        resolvedFamily: rawFamily === 'Qualsiasi' ? null : rawFamily,
        totalMatches: ultraCandidates.length,
      });
    }

    const targetBrands = shuffle([...DESIGNER_BRANDS, ...ARTISTIC_BRANDS]).slice(0, 32);

    const orBrandFilter = targetBrands
      .map((b) => `brand.ilike.%${b.replace(/[^a-z0-9\s'-]/gi, '')}%`)
      .join(',');

    const { data: catalogRows, error: catErr } = await supabase
      .from('perfumes')
      .select('brand, name, concentration, main_accords, top_notes, middle_notes, base_notes, perfumers')
      .or(orBrandFilter)
      .not('top_notes', 'is', null)
      .limit(450);

    if (catErr) throw catErr;

    const designerPool: Array<{ item: CandidatePerfume; score: number }> = [];
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

      const searchable = buildSearchableNotesText(
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
          concentrazione: row.concentration ? String(row.concentration).trim() : 'Eau de Parfum',
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
        score: (hasFam ? 40 : 10) + noteCheck.matchScore + Math.random() * 20,
      };

      if (cat === 'Designer') designerPool.push(entry);
      else artisticPool.push(entry);
    }

    designerPool.sort((a, b) => b.score - a.score);
    artisticPool.sort((a, b) => b.score - a.score);

    const triad: CandidatePerfume[] = [];
    const usedKeys = new Set<string>();

    const pickOne = (pool: Array<{ item: CandidatePerfume; score: number }>) => {
      const topSlice = shuffle(pool.slice(0, 8));
      for (const entry of topSlice) {
        const k = makePairKey(entry.item.brand, entry.item.nome);
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          triad.push(entry.item);
          return;
        }
      }
    };

    pickOne(designerPool);
    pickOne(artisticPool);
    pickOne(ultraCandidates);

    for (const pool of [ultraCandidates, artisticPool, designerPool]) {
      if (triad.length >= 3) break;
      for (const entry of pool) {
        if (triad.length >= 3) break;
        const k = makePairKey(entry.item.brand, entry.item.nome);
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          triad.push(entry.item);
        }
      }
    }

    const enriched = await enrichReasonsWithAI(triad, {
      mode,
      targetFamily: effectiveFamily,
      includeNotes,
      excludeNotes,
    });

    return NextResponse.json({
      proposals: enriched,
      resolvedFamily: effectiveFamily,
      totalMatches: designerPool.length + artisticPool.length + ultraCandidates.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore durante la ricerca nel catalogo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
