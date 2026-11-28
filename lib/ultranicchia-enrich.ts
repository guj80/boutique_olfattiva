// lib/ultranicchia-enrich.ts
import { callAIWithFallback } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';
import { formatPerfumeNote } from '@/lib/dictionary';
import { normalizeFamily } from '@/lib/families';

export interface EnrichedPerfumeData {
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  note_lineari?: string | null;
  naso: string | null;
  famiglia_originale: string | null;
}

function isEnrichedData(data: unknown): data is EnrichedPerfumeData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const ok = (v: unknown) => v === undefined || v === null || typeof v === 'string';
  return (
    ok(d.note_testa) &&
    ok(d.note_cuore) &&
    ok(d.note_fondo) &&
    ok(d.note_lineari) &&
    ok(d.naso) &&
    ok(d.famiglia_originale)
  );
}

function cleanField(v: string | null | undefined): string | null {
  if (!v) return null;
  const trimmed = v.replace(/\s+/g, ' ').trim();
  if (!trimmed || /^(null|n\/a|n\/d|sconosciuto|unknown|-)$/i.test(trimmed)) return null;
  return trimmed;
}

export async function enrichStagingPerfume(
  brand: string,
  nome: string,
  sourceLabel: 'web_search_ai' | 'batch_web_ai'
): Promise<{
  status: 'success' | 'not_found' | 'ai_failed';
  updatePayload: Record<string, any>;
  data?: EnrichedPerfumeData;
  fonteUrl?: string;
}> {
  // 1. Ricerca mirata sui database principali (incluso fragrantica.it)
  let webData = await tavilySearch(`"${brand}" "${nome}" perfume notes OR "contiene note di"`, {
    maxResults: 4,
    timeoutMs: 5000,
    includeDomains: [
      'fragrantica.it',
      'fragrantica.com',
      'parfumo.com',
      'parfumo.net',
      'basenotes.com',
    ],
  }).catch(() => null);

  // 2. Fallback su web aperto per brand ultra-nicchia/artigianali
  if (!webData || webData.results.length === 0) {
    webData = await tavilySearch(
      `"${brand}" "${nome}" perfume notes OR "note di" OR "top notes"`,
      {
        maxResults: 4,
        timeoutMs: 5500,
      }
    ).catch(() => null);
  }

  if (!webData || webData.results.length === 0 || !webData.contextText?.trim()) {
    return {
      status: 'not_found',
      updatePayload: {
        stato: 'needs_review',
        motivo_review: ['nessuna_fonte_trovata'],
      },
    };
  }

  const fonteUrl = webData.results[0].url;
  const prompt = `Sei un catalogatore tecnico di profumeria ultra-nicchia.
Estrai i dati tecnici SOLO per questo profumo:
Brand: "${brand}"
Nome: "${nome}"

Testo web:
---
${webData.contextText.slice(0, 5500)}
---

REGOLE TASSATIVE:
1. PIRAMIDE DIVISA: se il testo divide le note in Testa, Cuore e Fondo, compilali in "note_testa", "note_cuore", "note_fondo" (in italiano, separate da virgola) e lascia "note_lineari": null.
2. PIRAMIDE LINEARE (IMPORTANTE): se il testo elenca le note senza dividerle in strati (es. "La fragranza contiene note di Miele, Tabacco, Oud..." o "Notes include..."), estraile TUTTE in "note_lineari" (in italiano, separate da virgola) e lascia null i 3 strati.
3. Estrai "naso" (profumiere, es. "Pedro García") e "famiglia_originale" (es. "Orientale Speziato", "Legnosa", "Ambrata"). Se assenti, metti null.
4. NON inventare nulla e ignora note di altri profumi correlati presenti nella pagina.
5. Rispondi SOLO con JSON valido:
{"note_testa": null, "note_cuore": null, "note_fondo": null, "note_lineari": null, "naso": null, "famiglia_originale": null}`;

  const aiResult = await callAIWithFallback<EnrichedPerfumeData>([{ text: prompt }], {
    jsonMode: true,
    validator: isEnrichedData,
    onlyGemini: false,
    temperature: 0.1,
    timeoutMs: 9000,
  });

  if (!aiResult.data) {
    return {
      status: 'ai_failed',
      updatePayload: {
        stato: 'needs_review',
        motivo_review: ['ai_estrazione_fallita'],
      },
    };
  }

  const noteTesta = cleanField(aiResult.data.note_testa);
  const noteCuore = cleanField(aiResult.data.note_cuore);
  const noteFondo = cleanField(aiResult.data.note_fondo);
  const noteLineari = cleanField(aiResult.data.note_lineari);

  // Se la fragranza ha una composizione lineare (senza piramide), salva l'elenco in note_cuore
  const hasPyramid = Boolean(noteTesta || noteCuore || noteFondo);
  const finalCuore = noteCuore || (!hasPyramid && noteLineari ? noteLineari : null);

  const normalized: EnrichedPerfumeData = {
    note_testa: noteTesta ? formatPerfumeNote(noteTesta) : null,
    note_cuore: finalCuore ? formatPerfumeNote(finalCuore) : null,
    note_fondo: noteFondo ? formatPerfumeNote(noteFondo) : null,
    naso: cleanField(aiResult.data.naso),
    famiglia_originale:
      normalizeFamily(cleanField(aiResult.data.famiglia_originale)) ||
      cleanField(aiResult.data.famiglia_originale),
  };

  const hasAnyNote = Boolean(
    normalized.note_testa || normalized.note_cuore || normalized.note_fondo
  );

  const updatePayload: Record<string, any> = {
    note_testa: normalized.note_testa,
    note_cuore: normalized.note_cuore,
    note_fondo: normalized.note_fondo,
    naso: normalized.naso,
    famiglia_originale: normalized.famiglia_originale,
    dati_completi: hasAnyNote,
    stato: hasAnyNote ? 'ready' : 'needs_review',
    motivo_review: hasAnyNote ? [] : ['note_non_trovate_in_fonte'],
    fonte_dettagli: [
      {
        fonte: sourceLabel,
        url: fonteUrl,
        data_estrazione: new Date().toISOString(),
      },
    ],
  };

  return { status: 'success', updatePayload, data: normalized, fonteUrl };
}
