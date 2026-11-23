import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { getNoteSearchVariants, formatPerfumeNote } from '@/lib/dictionary';
import { normalizeFamily, PURE_FAMILIES } from '@/lib/families';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { makeScoutPairKey, type ScoutCategory, type ScoutProposal } from '@/lib/scout-logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESIGNER_BRANDS = new Set([
  'dior', 'christian dior', 'chanel', 'guerlain', 'hermes', 'hermès', 'tom ford',
  'yves saint laurent', 'ysl', 'giorgio armani', 'armani', 'prada', 'valentino',
  'givenchy', 'cartier', 'bulgari', 'bvlgari', 'versace', 'dolce & gabbana',
  'dolce&gabbana', 'gucci', 'burberry', 'loewe', 'bottega veneta', 'celine',
  'louis vuitton', 'maison margiela', 'jean paul gaultier', 'paco rabanne',
  'carolina herrera', 'hugo boss', 'calvin klein', 'issey miyake', 'kenzo',
  'narciso rodriguez', 'thierry mugler', 'mugler', 'viktor & rolf', 'viktor&rolf',
  'lancome', 'lancôme', 'estee lauder', 'estée lauder', 'acqua di parma',
  'jo malone', 'jo malone london', 'lalique', 'montblanc', 'mercedes-benz',
  'azzaro', 'rochas', 'caron', 'chloe', 'chloé', 'marc jacobs', 'coach',
]);

const ARTISTIC_BRANDS = new Set([
  'serge lutens', 'diptyque', 'frederic malle', 'editions de parfums frederic malle',
  'byredo', 'le labo', 'l artisan parfumeur', "l'artisan parfumeur", 'artisan parfumeur',
  'aesop', 'etat libre d orange', "etat libre d'orange", 'histoires de parfums',
  'penhaligon s', "penhaligon's", 'miller harris', 'goutal', 'annick goutal',
  'comptoir sud pacifique', 'maitre parfumeur et gantier', 'parfums d empire',
  "parfum d'empire", 'vilhelm parfumerie', 'juliette has a gun', 'escentric molecules',
  'comme des garcons', 'comme des garçons', 'nobile 1942', 'profumum roma',
  'santa maria novella', 'officina profumo-farmaceutica di santa maria novella',
  'villoresi', 'lorenzo villoresi', 'carthusia', 'farmacia ss. annunziata',
  'laboratorio olfattivo', 'masque milano', 'mendittorosa', 'stephane humbert lucas',
  'stéphane humbert lucas 777', 'heeley', 'james heeley', 'neela vermeire',
  'papillon artisan perfumes', 'zoologist', 'zoologist perfumes', 'imaginary authors',
  'kerosene', 'slumberhouse', 'beaufort london', 'filippo sorcinelli', 'unum',
  'orto parisi', 'nasomatto', 'francesca bianchi', 'meo fusciuni', 'bogue',
  'baruti', 'hiram green', 'olympic orchids', 'alkemia',
]);

const FAMILY_TO_ACCORDS: Record<string, string[]> = {
  Agrumata: ['citrus'],
  Aromatica: ['aromatic', 'herbal', 'lavender', 'fougere'],
  Marina: ['marine', 'aquatic', 'ozonic', 'salty'],
  Floreale: ['floral', 'white floral', 'rose', 'iris', 'powdery', 'yellow floral'],
  Fruttata: ['fruity', 'tropical', 'cherry', 'berry'],
  Verde: ['green', 'earthy', 'mossy', 'chypre'],
  Speziata: ['warm spicy', 'fresh spicy', 'spicy', 'cinnamon'],
  Legnosa: ['woody', 'oud', 'sandalwood', 'cedar', 'patchouli'],
  Ambrata: ['amber', 'balsamic', 'resinous', 'incense', 'smoky'],
  Gourmand: ['sweet', 'vanilla', 'caramel', 'chocolate', 'lactonic', 'nutty', 'honey', 'coffee'],
  Cuoiata: ['leather', 'animalic', 'tobacco'],
  Muschiata: ['musky', 'powdery', 'soapy', 'clean'],
};

function normalizeBrandKey(brand?: string | null): string {
  return (brand || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9&'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyBrand(brand?: string | null): 'Designer' | 'Nicchia' | 'Artistico' {
  const b = normalizeBrandKey(brand);
  if (!b) return 'Nicchia';
  if (ARTISTIC_BRANDS.has(b)) return 'Artistico';
  if (DESIGNER_BRANDS.has(b)) return 'Designer';
  for (const d of Array.from(DESIGNER_BRANDS)) {
    if (b === d || b.startsWith(`${d} `)) return 'Designer';
  }
  for (const a of Array.from(ARTISTIC_BRANDS)) {
    if (b === a || b.includes(a)) return 'Artistico';
  }
  return 'Nicchia';
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sanitizePostgrestToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
}

function buildSearchTerms(rawNotes: string[]): string[][] {
  return rawNotes
    .map((raw) => {
      const variants = getNoteSearchVariants(raw);
      return Array.from(
        new Set(
          [raw, ...variants]
            .map(sanitizePostgrestToken)
            .filter((v) => v.length >= 2)
        )
      ).slice(0, 6);
    })
    .filter((group) => group.length > 0);
}

function rowMatchesAllNoteGroups(haystack: string, groups: string[][]): boolean {
  const lower = haystack.toLowerCase();
  return groups.every((variants) => variants.some((v) => lower.includes(v)));
}

function rowMatchesAnyNoteGroup(haystack: string, groups: string[][]): boolean {
  const lower = haystack.toLowerCase();
  return groups.some((variants) => variants.some((v) => lower.includes(v)));
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('error' in auth && auth.error) return auth.error;

  try {
    const body = await req.json();
    const mode = body.mode === 'ultranicchia' ? 'ultranicchia' : 'trittico';
    const requestedFamily = typeof body.scoutFamily === 'string' ? body.scoutFamily : 'Qualsiasi';
    const lastFamily = typeof body.lastFamily === 'string' ? body.lastFamily : null;
    const includeNotes: string[] = Array.isArray(body.includeNotes) ? body.includeNotes : [];
    const excludeNotes: string[] = Array.isArray(body.excludeNotes) ? body.excludeNotes : [];
    const ownedKeys = new Set<string>(Array.isArray(body.ownedKeys) ? body.ownedKeys : []);
    const excludedKeys = new Set<string>(Array.isArray(body.excludedKeys) ? body.excludedKeys : []);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configurazione Supabase mancante.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    let resolvedFamily: string | null =
      requestedFamily && requestedFamily !== 'Qualsiasi' ? requestedFamily : null;

    if (!resolvedFamily && includeNotes.length === 0) {
      const poolFam = PURE_FAMILIES.filter((f) => f !== lastFamily);
      resolvedFamily = poolFam[Math.floor(Math.random() * poolFam.length)] || 'Ambrata';
    }

    const includeGroups = buildSearchTerms(includeNotes);
    const excludeGroups = buildSearchTerms(excludeNotes);

    // RAMO A: ULTRA-NICCHIA
    if (mode === 'ultranicchia') {
      let query = supabase.from('ultranicchia_import').select('*').limit(400);

      if (resolvedFamily) {
        query = query.ilike('famiglia_olfattiva', `%${sanitizePostgrestToken(resolvedFamily)}%`);
      }

      if (includeGroups.length > 0) {
        const orExpr = includeGroups[0]
          .flatMap((v) => [
            `note_testa.ilike.%${v}%`,
            `note_cuore.ilike.%${v}%`,
            `note_fondo.ilike.%${v}%`,
            `note_olfattive.ilike.%${v}%`,
          ])
          .join(',');
        query = query.or(orExpr);
      }

      const { data: ultraRows } = await query;
      const validUltra = (ultraRows || []).filter((r: any) => {
        const pair = makeScoutPairKey(r.brand, r.nome);
        if (ownedKeys.has(pair) || excludedKeys.has(pair)) return false;
        const notesBlob = `${r.note_testa || ''} ${r.note_cuore || ''} ${r.note_fondo || ''} ${r.note_olfattive || ''}`;
        if (includeGroups.length > 0 && !rowMatchesAllNoteGroups(notesBlob, includeGroups)) {
          return false;
        }
        if (excludeGroups.length > 0 && rowMatchesAnyNoteGroup(notesBlob, excludeGroups)) {
          return false;
        }
        return true;
      });

      const picked = shuffleArray(validUltra).slice(0, 3);
      if (picked.length > 0) {
        const proposals: ScoutProposal[] = picked.map((r: any) => ({
          brand: r.brand,
          nome: r.nome,
          concentrazione: r.concentrazione || 'Extrait de Parfum',
          famiglia_olfattiva: normalizeFamily(r.famiglia_olfattiva) || resolvedFamily || 'Legnosa',
          naso: r.naso || null,
          note_testa: r.note_testa || null,
          note_cuore: r.note_cuore || null,
          note_fondo: r.note_fondo || null,
          categoria: 'Ultra-Nicchia',
          fonte: 'ultranicchia',
          motivo:
            r.descrizione ||
            `Creazione ultra-nicchia ${r.brand} selezionata per affinità con i tuoi parametri.`,
          url_foto_vetrina: r.immagine_url || null,
        }));

        return NextResponse.json({
          proposals,
          resolvedFamily,
          totalMatches: validUltra.length,
        });
      }
    }

    // RAMO B: IL TRITTICO (catalogo `perfumes`)
    let query = supabase
      .from('perfumes')
      .select(
        'id, name, brand, release_year, concentration, rating_value, rating_count, main_accords, top_notes, middle_notes, base_notes, perfumers, url'
      )
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(600);

    if (includeGroups.length > 0) {
      const orClauses = includeGroups[0]
        .flatMap((v) => [
          `top_notes.ilike.%${v}%`,
          `middle_notes.ilike.%${v}%`,
          `base_notes.ilike.%${v}%`,
        ])
        .join(',');
      query = query.or(orClauses);
    }

    if (resolvedFamily && FAMILY_TO_ACCORDS[resolvedFamily]) {
      const accordOr = FAMILY_TO_ACCORDS[resolvedFamily]
        .map((acc) => `main_accords.ilike.%${acc}%`)
        .join(',');
      query = query.or(accordOr);
    }

    const { data: rows, error } = await query;
    if (error) {
      throw new Error(`Errore query catalogo: ${error.message}`);
    }

    let candidates = (rows || []).filter((r: any) => {
      if (!r?.brand || !r?.name) return false;
      const pair = makeScoutPairKey(r.brand, r.name);
      if (ownedKeys.has(pair) || excludedKeys.has(pair)) return false;

      const notesBlob = `${r.top_notes || ''} ${r.middle_notes || ''} ${r.base_notes || ''}`;
      if (includeGroups.length > 0 && !rowMatchesAllNoteGroups(notesBlob, includeGroups)) {
        return false;
      }
      if (excludeGroups.length > 0 && rowMatchesAnyNoteGroup(notesBlob, excludeGroups)) {
        return false;
      }
      return true;
    });

    if (candidates.length < 3 && includeGroups.length > 1) {
      candidates = (rows || []).filter((r: any) => {
        if (!r?.brand || !r?.name) return false;
        const pair = makeScoutPairKey(r.brand, r.name);
        if (ownedKeys.has(pair) || excludedKeys.has(pair)) return false;
        const notesBlob = `${r.top_notes || ''} ${r.middle_notes || ''} ${r.base_notes || ''}`;
        if (!rowMatchesAnyNoteGroup(notesBlob, includeGroups)) return false;
        if (excludeGroups.length > 0 && rowMatchesAnyNoteGroup(notesBlob, excludeGroups)) {
          return false;
        }
        return true;
      });
    }

    const byCategory: Record<'Designer' | 'Nicchia' | 'Artistico', any[]> = {
      Designer: [],
      Nicchia: [],
      Artistico: [],
    };

    for (const row of candidates) {
      byCategory[classifyBrand(row.brand)].push(row);
    }

    const pickedRows: Array<{ row: any; category: ScoutCategory }> = [];
    const usedPairs = new Set<string>();
    const categoriesOrder: Array<'Designer' | 'Nicchia' | 'Artistico'> = [
      'Designer',
      'Nicchia',
      'Artistico',
    ];

    for (const cat of categoriesOrder) {
      const pool = shuffleArray(byCategory[cat].slice(0, 60));
      const chosen = pool.find((r) => !usedPairs.has(makeScoutPairKey(r.brand, r.name)));
      if (chosen) {
        usedPairs.add(makeScoutPairKey(chosen.brand, chosen.name));
        pickedRows.push({ row: chosen, category: cat });
      }
    }

    if (pickedRows.length < 3) {
      const fallbackPool = shuffleArray(candidates.slice(0, 100));
      for (const row of fallbackPool) {
        if (pickedRows.length >= 3) break;
        const pair = makeScoutPairKey(row.brand, row.name);
        if (usedPairs.has(pair)) continue;
        usedPairs.add(pair);
        pickedRows.push({ row, category: classifyBrand(row.brand) });
      }
    }

    const proposals: ScoutProposal[] = pickedRows.map(({ row, category }) => {
      const topIt = formatPerfumeNote(row.top_notes);
      const midIt = formatPerfumeNote(row.middle_notes);
      const baseIt = formatPerfumeNote(row.base_notes);
      const famIt = normalizeFamily(row.main_accords) || resolvedFamily || 'Ambrata';

      if (!resolvedFamily) resolvedFamily = famIt;

      const summaryParts = [
        topIt ? `testa ${topIt}` : null,
        midIt ? `cuore ${midIt}` : null,
        baseIt ? `fondo ${baseIt}` : null,
      ].filter(Boolean);

      return {
        brand: row.brand,
        nome: row.name,
        concentrazione: row.concentration || 'Eau de Parfum',
        famiglia_olfattiva: famIt,
        naso: row.perfumers || null,
        note_testa: topIt || null,
        note_cuore: midIt || null,
        note_fondo: baseIt || null,
        categoria: category,
        fonte: 'catalogo',
        motivo:
          summaryParts.length > 0
            ? `${row.name}: ${summaryParts.join('; ')}.`
            : `${row.name} di ${row.brand} (${row.release_year || 'edizione ricercata'}).`,
        url_foto_vetrina: null,
      };
    });

    if (proposals.length > 0) {
      try {
        const aiPrompt = `Scrivi una micro-descrizione editoriale di 1 frase (max 140 caratteri, in italiano elegante) per ciascuno di questi 3 profumi selezionati per il Trittico (famiglia: ${resolvedFamily || 'mista'}, note richieste: ${includeNotes.join(', ') || 'libere'}):
${proposals.map((p, i) => `${i + 1}. ${p.brand} - ${p.nome} (${p.categoria}): testa ${p.note_testa || '-'}, cuore ${p.note_cuore || '-'}, fondo ${p.note_fondo || '-'}`).join('\n')}
Rispondi SOLO con JSON: {"motivi": ["frase 1", "frase 2", "frase 3"]}`;

        const aiRes = await callAIWithFallback<{ motivi?: string[] }>([{ text: aiPrompt }], {
          jsonMode: true,
          temperature: 0.5,
          timeoutMs: 3500,
          deadline: Date.now() + 4000,
        });

        const motivi = aiRes.data?.motivi;
        if (Array.isArray(motivi)) {
          proposals.forEach((p, idx) => {
            if (typeof motivi[idx] === 'string' && motivi[idx].trim().length > 10) {
              p.motivo = motivi[idx].trim();
            }
          });
        }
      } catch {
        // Mantieni la descrizione piramidale deterministica
      }
    }

    return NextResponse.json({
      proposals,
      resolvedFamily,
      totalMatches: candidates.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore interno durante la ricerca.' },
      { status: 500 }
    );
  }
}
