import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { query, profumi } = await req.json();

    if (!query || !Array.isArray(profumi) || profumi.length === 0) {
      return NextResponse.json(
        { error: 'Inserisci una richiesta per CHIEDI ALL\'IA e assicurati che la collezione sia caricata.' },
        { status: 400 }
      );
    }

    const catalogoCompatto = profumi.map((p: any) => ({
      id: p.id,
      brand: p.brand,
      nome: p.nome,
      concentrazione: p.concentrazione || '',
      famiglia: p.famiglia_olfattiva || '',
      note_testa: p.note_testa || '',
      note_cuore: p.note_cuore || '',
      note_fondo: p.note_fondo || '',
      note_complete: p.note_olfattive || '',
      stagione: p.stagione_ideale || '',
      occasione: p.occasione_ideale || '',
      descrizione: p.descrizione_ai || '',
      mouche: p.note_mouche || '',
      pelle: p.note_pelle || '',
    }));

    const prompt = `Sei il motore di analisi tecnica olfattiva ("CHIEDI ALL'IA") della collezione di Luca.
REGOLE TASSATIVE:
1. NON usare toni poetici, teatrali o da "sommelier". Sii diretto, analitico, preciso e oggettivo.
2. Basati ESCLUSIVAMENTE sulle note olfattive e sui dati reali presenti nel JSON della collezione qui sotto. È severamente vietato attribuire a un profumo note che non sono scritte nella sua scheda.

Richiesta di Luca:
"${query}"

Collezione certificata di Luca (JSON):
${JSON.stringify(catalogoCompatto)}

Seleziona da questa lista solo i profumi (da 1 a 5) che rispondono tecnicamente alla richiesta.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:
{
  "recommendedIds": ["id_1", "id_2"],
  "sommelierAdvice": "Analisi tecnica diretta e chiara (3-4 frasi) rivolta a Luca che spiega perché queste fragranze rispondono alla richiesta, citando solo le vere note presenti nelle loro schede.",
  "motivazioniPerProfumo": {
    "id_1": "Spiegazione tecnica precisa (1 frase) basata sulle note reali di questo profumo.",
    "id_2": "Spiegazione tecnica precisa (1 frase) per il secondo profumo."
  }
}`;

    const { text, modelUsed } = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.0,
      jsonMode: true,
    });

    const parsed = extractJsonFromAiText<{
      recommendedIds?: string[];
      sommelierAdvice?: string;
      motivazioniPerProfumo?: Record<string, string>;
    }>(text);

    return NextResponse.json({
      recommendedIds: Array.isArray(parsed.recommendedIds) ? parsed.recommendedIds : [],
      sommelierAdvice:
        parsed.sommelierAdvice ||
        'Ecco la selezione tecnica calcolata dall\'IA in base alle piramidi olfattive della tua collezione.',
      motivazioniPerProfumo: parsed.motivazioniPerProfumo || {},
      _modelUsed: modelUsed,
    });
  } catch (error: any) {
    console.error('[API /api/search Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore nella consultazione dell\'IA.' },
      { status: 500 }
    );
  }
}
