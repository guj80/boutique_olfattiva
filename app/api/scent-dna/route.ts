// app/api/scent-dna/route.ts
// Genera l'archetipo Scent DNA tramite fallback chain AI con salvagente locale deterministico.

import { NextResponse } from 'next/server';
import {
  callAIWithFallback,
  SCENT_DNA_SCHEMA,
  isScentDNAResponse,
  ScentDNAResponse,
} from '@/lib/gemini-engine';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AxisKey =
  | 'agrumatoFresco'
  | 'florealeFruttato'
  | 'legnosoTerroso'
  | 'ambratoOrientale'
  | 'gourmandDolce'
  | 'cuoiatoAnimale';

const LOCAL_ARCHETYPES: Record<AxisKey, ScentDNAResponse> = {
  agrumatoFresco: {
    archetipo: 'Il Nomade della Luce',
    descrizione:
      'La tua firma olfattiva privilegia la trasparenza, il respiro agrumato e le geometrie nitide. Cerchi fragranze che accompagnino la pelle con eleganza ariosa senza mai sovrastarla.',
    consiglio:
      'Esplora un fondo legnoso o muschiato leggero per dare più struttura alle tue giornate serali.',
  },
  florealeFruttato: {
    archetipo: 'Il Custode dei Fiori Segreti',
    descrizione:
      'Ti muovi tra petali strutturati e sfumature fruttate mai banali, con un gusto spiccato per le evoluzioni morbide. La tua collezione racconta una sensibilità luminosa e curata nei dettagli.',
    consiglio:
      'Prova ad affiancare una nota speziata o verde per creare contrasto nelle mezze stagioni.',
  },
  legnosoTerroso: {
    archetipo: "L'Architetto delle Radici",
    descrizione:
      'Prediligi materie asciutte, cortecce, resine e profondità tattili che resistono al tempo. Il tuo gusto olfattivo rifugge il superfluo e punta su carattere e presenza silenziosa.',
    consiglio:
      'Un agrume amaro o un tocco aromatico in apertura può alleggerire la tua rotazione estiva.',
  },
  ambratoOrientale: {
    archetipo: "L'Esploratore delle Ombre",
    descrizione:
      'Ami il calore avvolgente delle resine, delle spezie scure e delle scie magnetiche che si rivelano lentamente. La tua collezione privilegia intensità, persistenza e atmosfera notturna.',
    consiglio:
      'Bilancia la collezione con una fragranza verde o marina per i momenti di luce piena.',
  },
  gourmandDolce: {
    archetipo: "L'Alchimista Gourmand",
    descrizione:
      'Ti attraggono le composizioni avvolgenti, tattili e narcotiche, dove dolcezza e profondità si fondono in una firma riconoscibile. Cerchi nel profumo un piacere immediato ma costruito con maestria.',
    consiglio:
      'Alterna le tue note più calde con un legnoso secco o un cuoiato per evitare saturazione olfattiva.',
  },
  cuoiatoAnimale: {
    archetipo: 'Il Collezionista Ribelle',
    descrizione:
      'Scegli fragranze di forte personalità, tra cuoio, fumo e accordi indomiti che non cercano compromessi. Il tuo percorso olfattivo è istintivo, deciso e profondamente identitario.',
    consiglio:
      'Un floreale scuro o un ambrato morbido può creare un layering sorprendente sulle tue basi cuoiate.',
  },
};

function buildLocalScentDNA(axes: Record<string, number>): ScentDNAResponse {
  const validKeys = Object.keys(LOCAL_ARCHETYPES) as AxisKey[];
  let topKey: AxisKey = 'legnosoTerroso';
  let topScore = -1;

  for (const key of validKeys) {
    const val = typeof axes[key] === 'number' ? axes[key] : 0;
    if (val > topScore) {
      topScore = val;
      topKey = key;
    }
  }

  return LOCAL_ARCHETYPES[topKey];
}

export async function POST(req: Request) {
  export async function POST(req: Request) {
  // --- PROTEZIONE API ---
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  // ----------------------

  let body: unknown;
  // ... resto del codice ...
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
  }

  const axes =
    (body.axes as Record<string, number> | undefined) ??
    (body.scentDNA as Record<string, number> | undefined) ??
    (body.scores as Record<string, number> | undefined) ??
    {};

  const dominantFamilies = Array.isArray(body.dominantFamilies)
    ? body.dominantFamilies.filter((x): x is string => typeof x === 'string')
    : [];
  const topNotes = Array.isArray(body.topNotes)
    ? body.topNotes.filter((x): x is string => typeof x === 'string')
    : [];

  const prompt = `Sei un direttore artistico di alta profumeria per Atelier LG.
Analizza SOLO questi dati reali della collezione dell'utente (non inventare profumi o brand):
- Assi olfattivi (0-100): ${JSON.stringify(axes)}
- Famiglie dominanti: ${dominantFamilies.length > 0 ? dominantFamilies.join(', ') : 'Non specificate'}
- Note ricorrenti: ${topNotes.length > 0 ? topNotes.join(', ') : 'Non specificate'}

Restituisci ESCLUSIVAMENTE un oggetto JSON con:
- "archetipo": titolo evocativo in italiano (es. "L'Esploratore delle Ombre", "Il Nomade della Luce")
- "descrizione": 2-3 frasi poetiche ma sobrie sul carattere olfattivo
- "consiglio": 1 frase di consiglio pratico per la collezione`;

  try {
    const res = await callAIWithFallback<ScentDNAResponse>([{ text: prompt }], {
      jsonMode: true,
      responseSchema: SCENT_DNA_SCHEMA,
      validator: isScentDNAResponse,
      temperature: 0.7,
    });

    if (res.data) {
      return NextResponse.json(res.data);
    }
  } catch (err) {
    console.warn('[scent-dna] AI non disponibile, attivo salvagente locale:', err);
  }

  // Salvagente locale: non fallisce mai
  const fallback = buildLocalScentDNA(axes);
  return NextResponse.json({ ...fallback, _fallback: 'local' });
}
