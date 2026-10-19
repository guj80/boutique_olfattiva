import { NextResponse } from 'next/server';
import {
  callGeminiWithFallback,
  extractJsonFromAiText,
} from '@/lib/gemini-engine';
import { isCollezioneProfumo, getUnifiedNotes } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, profumi = [], recentWornIds = [] } = body;

    if (!query || !Array.isArray(profumi) || profumi.length === 0) {
      return NextResponse.json(
        { error: 'Collezione vuota o richiesta mancante.' },
        { status: 400 }
      );
    }

    // Filtra prioritariamente i flaconi in Collezione (se presenti), altrimenti usa tutti
    const ownedBottles = profumi.filter(isCollezioneProfumo);
    const pool = ownedBottles.length > 0 ? ownedBottles : profumi;

    // Payload compatto per velocità estrema e risparmio token
    const compactCatalog = pool.slice(0, 85).map((p: any) => ({
      id: p.id,
      brand: p.brand || 'Maison',
      nome: p.nome || 'Fragranza',
      famiglia: p.famiglia_olfattiva || '',
      note: getUnifiedNotes(p).slice(0, 140),
      stagione: p.stagione_ideale || '',
      occasione: p.occasione_ideale || '',
      indossatoDiRecente: Array.isArray(recentWornIds) && recentWornIds.includes(p.id),
    }));

    const prompt = `Sei un Maître Parfumeur e Sommelier Olfattivo personale.
L'utente chiede un consiglio per oggi con queste indicazioni:
"${query}"

Ecco i flaconi disponibili nella sua Collezione (in JSON compatto):
${JSON.stringify(compactCatalog)}

REGOLE DI SELEZIONE:
1. Scegli 1 profumo principale perfetto + fino a 2 alternative valide (totale massimo 3 ID reali presenti nella lista sopra).
2. Se possibile, penalizza i profumi con "indossatoDiRecente": true per favorire una rotazione elegante della collezione.
3. Spiega il perché tecnico (accordi, scia, aderenza a clima/outfit/occasione) in italiano impeccabile, incisivo e mai banale.

Restituisci ESCLUSIVAMENTE questo oggetto JSON:
{
  "sommelierAdvice": "Il tuo consiglio diretto (2-3 frasi ricche di dettagli sulle note dei profumi scelti e perché funzionano oggi)",
  "recommendedIds": ["id_scelta_1", "id_alternativa_2", "id_alternativa_3"],
  "motivazioniPerProfumo": {
    "id_scelta_1": "Scelta Principale: motivazione specifica in 1 frase",
    "id_alternativa_2": "Alternativa: motivazione specifica in 1 frase",
    "id_alternativa_3": "Alternativa: motivazione specifica in 1 frase"
  }
}`;

    const { text, modelUsed } = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.25,
      jsonMode: true,
      useGoogleSearch: false,
    });

    const parsed = extractJsonFromAiText<{
      sommelierAdvice?: string;
      recommendedIds?: string[];
      motivazioniPerProfumo?: Record<string, string>;
    }>(text);

    // Validazione ferrea: accetta solo ID realmente esistenti nella collezione dell'utente
    const validIdSet = new Set(pool.map((p: any) => String(p.id)));
    const validatedIds = (parsed.recommendedIds || [])
      .map((id) => String(id))
      .filter((id) => validIdSet.has(id))
      .slice(0, 3);

    return NextResponse.json({
      sommelierAdvice:
        parsed.sommelierAdvice ||
        'Ecco la selezione ideale dalla tua collezione per questa occasione.',
      recommendedIds: validatedIds,
      motivazioniPerProfumo: parsed.motivazioniPerProfumo || {},
      _modelUsed: modelUsed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Errore durante la consulenza olfattiva.' },
      { status: 500 }
    );
  }
}
