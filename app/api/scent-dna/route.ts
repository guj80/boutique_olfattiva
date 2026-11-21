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
export const maxDuration = 30;

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

const AXIS_KEYS: AxisKey[] = [
  'agrumatoFresco',
  'florealeFruttato',
  'legnosoTerroso',
  'ambratoOrientale',
  'gourmandDolce',
  'cuoiatoAnimale',
];

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>{}[\]`"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return clean.length >= 2 ? clean : null;
}

function cleanTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value.slice(0, 8)) {
    const clean = cleanToken(item);
    if (clean) out.push(clean);
  }
  return out;
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
  }

  const rawAxes = (body.axes ?? body.scentDNA ?? body.scores) as Record<string, unknown> | undefined;
  const axes: Record<string, number> = {};
  if (rawAxes && typeof rawAxes === 'object') {
    for (const key of AXIS_KEYS) {
      const v = rawAxes[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        axes[key] = Math.max(0, Math.min(100, Math.round(v)));
      }
    }
  }
  if (Object.keys(axes).length === 0) {
    return NextResponse.json({ error: 'Dati del profilo olfattivo incompleti o non validi.' }, { status: 400 });
  }

  const dominantFamilies = cleanTokens(body.dominantFamilies);
  const topNotes = cleanTokens(body.topNotes);

  const prompt = `Sei un direttore artistico di alta profumeria per Atelier LG.
Analizza SOLO questi dati reali della collezione dell'utente (non inventare profumi o brand):
- Assi olfattivi (0-100): ${JSON.stringify(axes)}
- Famiglie dominanti: ${dominantFamilies.length > 0 ? dominantFamilies.join(', ') : 'Non specificate'}
- Note ricorrenti: ${topNotes.length > 0 ? topNotes.join(', ') : 'Non specificate'}

Restituisci ESCLUSIVAMENTE un oggetto JSON con:
- "archetipo": titolo evocativo in italiano, 2-5 parole (es. "L'Esploratore delle Ombre", "Il Nomade della Luce")
- "descrizione": 2-3 frasi poetiche ma sobrie sul carattere olfattivo
- "consiglio": 1 frase di consiglio pratico per la collezione
L'archetipo deve riflettere gli assi più alti.`;

  try {
    const res = await callAIWithFallback<ScentDNAResponse>([{ text: prompt }], {
      jsonMode: true,
      responseSchema: SCENT_DNA_SCHEMA,
      validator: isScentDNAResponse,
      temperature: 0.7,
      deadline: Date.now() + 20000,
    });

    if (res.data) {
      return NextResponse.json({
        archetipo: clip(res.data.archetipo, 60),
        descrizione: clip(res.data.descrizione, 520),
        consiglio: clip(res.data.consiglio, 240),
      });
    }
  } catch (err) {
    console.warn('[scent-dna] AI non disponibile, attivo salvagente locale:', err);
  }

  const fallback = buildLocalScentDNA(axes);
  return NextResponse.json({ ...fallback, _fallback: 'local' });
}
