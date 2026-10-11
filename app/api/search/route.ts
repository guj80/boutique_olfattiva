import { NextResponse } from 'next/server';
import { callGeminiWithFallback, extractJsonFromAiText } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { query, profumi } = await req.json();

    if (!query || !Array.isArray(profumi) || profumi.length === 0) {
      return NextResponse.json(
        { error: 'Inserisci una richiesta per il Sommelier e assicurati che la collezione sia caricata.' },
        { status: 400 }
      );
    }

    // Compattiamo il catalogo per dare a Gemini visibilità totale sui 40+ profumi reali
    const catalogoCompatto = profumi.map((p: any) => ({
      id: p.id,
      brand: p.brand,
      nome: p.nome,
      famiglia: p.famiglia_olfattiva || '',
      note:
        [p.note_testa, p.note_cuore, p.note_fondo, p.note_olfattive]
          .filter(Boolean)
          .join(' | ') || '',
      stagione: p.stagione_ideale || '',
      occasione: p.occasione_ideale || '',
      descrizione: p.descrizione_ai || '',
      mouche: p.note_mouche || '',
      pelle: p.note_pelle || '',
    }));

    const prompt = `Sei il Personal Sommelier Olfattivo di Luca nella sua "Boutique Olfattiva".
Luca ti ha appena chiesto:
"${query}"

Ecco l'elenco ESATTO dei profumi realmente presenti nel Vault di Luca (in formato JSON):
${JSON.stringify(catalogoCompatto)}

Seleziona da questa lista i 3-5 profumi (o meno se la richiesta è iper-specifica) che rispondono in modo sublime alla richiesta di Luca.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "recommendedIds": ["id_1", "id_2", "id_3"],
  "sommelierAdvice": "Un consiglio elegante, caldo e competente di 3-4 frasi rivolto direttamente a Luca (es. 'Luca, per questa serata d'autunno ho selezionato tre gioielli dalla tua collezione...'), spiegando il filo conduttore e perché queste fragranze sono perfette.",
  "motivazioniPerProfumo": {
    "id_1": "Spiegazione breve (1 frase) del perché questo specifico profumo è perfetto per la richiesta.",
    "id_2": "Spiegazione breve (1 frase) per il secondo profumo."
  }
}`;

    const { text, modelUsed } = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.35,
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
        'Ecco la selezione curata dal tuo Sommelier AI in base alle note della tua collezione.',
      motivazioniPerProfumo: parsed.motivazioniPerProfumo || {},
      _modelUsed: modelUsed,
    });
  } catch (error: any) {
    console.error('[API /api/search Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore nella consultazione del Sommelier AI.' },
      { status: 500 }
    );
  }
}
