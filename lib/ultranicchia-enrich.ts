// lib/ultranicchia-enrich.ts
import { callAIWithFallback } from '@/lib/gemini-engine';
import { tavilySearch } from '@/lib/web-search';
import { formatPerfumeNote } from '@/lib/dictionary';
import { normalizeFamily } from '@/lib/families';

export interface EnrichedPerfumeData {
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  naso: string | null;
  famiglia_originale: string | null;
}

function isEnrichedData(data: unknown): data is EnrichedPerfumeData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const ok = (v: unknown) => v === null || typeof v === 'string';
  return (
    ok(d.note_testa) &&
    ok(d.note_cuore) &&
    ok(d.note_fondo) &&
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
  // 1. Ricerca mirata sui database principali
  let webData = await tavilySearch(`"${brand}" "${nome}" perfume notes pyramid`, {
    maxResults: 3,
    timeoutMs: 5000,
    includeDomains: ['fragrantica.com', 'parfumo.com', 'parfumo.net', 'basenotes.com'],
  }).catch(() => null);

  // 2. Fallback su web aperto (fondamentale per brand ultra-nicchia/artigianali)
  if (!webData || webData.results.length === 0) {
    webData = await tavilySearch(`"${brand}" "${nome}" perfume notes OR "top notes" OR "note di testa"`, {
      maxResults: 4,
      timeoutMs: 5500,
    }).catch(() => null);
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
${webData.contextText.slice(0, 5000)}
---

REGOLE TASSATIVE:
1. Estrai note_testa, note_cuore, note_fondo in italiano, separate da virgola. Se non presenti nel testo, metti null.
2. Estrai naso (profumiere) e famiglia_originale (es. Legnosa, Ambrata, Cuoiata). Se assenti, metti null.
3. NON inventare nulla e ignora note di altri profumi correlati presenti nella pagina.
4. Rispondi SOLO con JSON valido:
{"note_testa": null, "note_cuore": null, "note_fondo": null, "naso": null, "famiglia_originale": null}`;

  const aiResult = await callAIWithFallback<EnrichedPerfumeData>([{ text: prompt }], {
    jsonMode: true,
    validator: isEnrichedData,
    onlyGemini: false, // Consente Groq/fallback veloce avendo già il contesto web
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

  const normalized: EnrichedPerfumeData = {
    note_testa: noteTesta ? formatPerfumeNote(noteTesta) : null,
    note_cuore: noteCuore ? formatPerfumeNote(noteCuore) : null,
    note_fondo: noteFondo ? formatPerfumeNote(noteFondo) : null,
    naso: cleanField(aiResult.data.naso),
    famiglia_originale:
      normalizeFamily(cleanField(aiResult.data.famiglia_originale)) ||
      cleanField(aiResult.data.famiglia_originale),
  };

  const hasAnyNote = Boolean(normalized.note_testa || normalized.note_cuore || normalized.note_fondo);

  const updatePayload: Record<string, any> = {
    ...normalized,
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
