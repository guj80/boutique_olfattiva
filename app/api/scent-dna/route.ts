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

const AXIS_LABELS: Record<AxisKey, string> = {
  agrumatoFresco: 'Agrumato & Fresco',
  florealeFruttato: 'Floreale & Fruttato',
  legnosoTerroso: 'Legnoso & Terroso',
  ambratoOrientale: 'Ambrato & Resinoso',
  gourmandDolce: 'Gourmand & Vanigliato',
  cuoiatoAnimale: 'Cuoiato & Fumoso',
};

const LOCAL_PROFILES: Record<AxisKey, ScentDNAResponse> = {
  agrumatoFresco: {
    archetipo: 'Asse Esperidato & Trasparente',
    descrizione:
      'La rotazione privilegia aperture esperidate, strutture ariose e costruzioni nitide ad alta leggibilità. Il baricentro olfattivo resta orientato su freschezza e pulizia formale.',
    consiglio:
      'Affianca una struttura legnosa secca o muschiata per estendere la tenuta nelle ore serali.',
  },
  florealeFruttato: {
    archetipo: 'Asse Floreale & Strutturato',
    descrizione:
      'Il profilo mostra una netta prevalenza di accordi floreali articolati e sfumature fruttate calibrate. La selezione privilegia evoluzioni morbide e centralità del cuore.',
    consiglio:
      'Introduci un contrappunto verde o speziato freddo per bilanciare la rotondità nelle mezze stagioni.',
  },
  legnosoTerroso: {
    archetipo: 'Struttura Legnosa & Terrosa',
    descrizione:
      'Prevalenza di materie asciutte, radici, cortecce e fondi minerali a bassa dolcezza. Il guardaroba punta su persistenza strutturale e linearità di fondo.',
    consiglio:
      'Un agrume amaro o una nota aromatica in apertura può alleggerire la rotazione nei mesi caldi.',
  },
  ambratoOrientale: {
    archetipo: 'Struttura Ambrata & Resina',
    descrizione:
      'Dominanza di resine, balsami, incensi e spezie calde con forte sviluppo nel fondo. La collezione privilegia densità aromatica e scia persistente.',
    consiglio:
      'Integra una composizione verde o esperidata per avere un’alternativa diurna ad alta trasparenza.',
  },
  gourmandDolce: {
    archetipo: 'Asse Gourmand & Balsamico',
    descrizione:
      'Forte incidenza di vaniglia, fave tonka, accordi liquorosi e materie avvolgenti. Il profilo ricerca rotondità tattile e profondità dolce nel fondo.',
    consiglio:
      'Alterna le composizioni più dense con un legnoso secco o un cuoiato per evitare assuefazione olfattiva.',
  },
  cuoiatoAnimale: {
    archetipo: 'Struttura Cuoiata & Fumosa',
    descrizione:
      'Netta predilezione per cuoio, catrame di betulla, tabacco e accordi affumicati o animali. La collezione privilegia materie prime di carattere netto e asciutto.',
    consiglio:
      'Un floreale scuro o un ambrato resinoso può offrire un contrappunto morbido per il layering.',
  },
};

function buildLocalScentDNA(axes: Record<string, number>, topNotes: string[]): ScentDNAResponse {
  const validKeys = Object.keys(LOCAL_PROFILES) as AxisKey[];
  const ranked = [...validKeys].sort((a, b) => (axes[b] ?? 0) - (axes[a] ?? 0));
  const primary = ranked[0] || 'legnosoTerroso';
  const secondary = ranked[1];
  const base = LOCAL_PROFILES[primary];

  const primaryPct = axes[primary] ?? 0;
  const secondaryPct = secondary ? axes[secondary] ?? 0 : 0;

  let descrizione = base.descrizione;
  if (primaryPct > 0 && secondary && secondaryPct >= 15) {
    descrizione = `Prevalenza dell’asse ${AXIS_LABELS[primary].toLowerCase()} (${primaryPct}%) con supporto ${AXIS_LABELS[secondary].toLowerCase()} (${secondaryPct}%).`;
    if (topNotes.length > 0) {
      descrizione += ` Materie prime più ricorrenti nelle piramidi: ${topNotes.slice(0, 4).join(', ')}.`;
    }
  }

  return {
    archetipo: base.archetipo,
    descrizione,
    consiglio: base.consiglio,
  };
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

  const prompt = `Sei un valutatore tecnico di profumeria per l'archivio personale Atelier LG.
Analizza SOLO questi dati oggettivi della collezione e degli indossi dell'utente (non inventare profumi, brand o note):
- Distribuzione assi olfattivi (%): ${JSON.stringify(axes)}
- Famiglie dominanti: ${dominantFamilies.length > 0 ? dominantFamilies.join(', ') : 'Non specificate'}
- Materie prime ricorrenti: ${topNotes.length > 0 ? topNotes.join(', ') : 'Non specificate'}

STILE OBBLIGATORIO:
- Registro asciutto, tecnico, da scheda di laboratorio olfattivo.
- VIETATI titoli poetici o da oroscopo (no "Nomade", "Alchimista", "Custode", "Ribelle", "Ombre", "Luce").
- VIETATI aggettivi enfatici o pubblicitari (no "seducente", "magnetico", "irresistibile", "sofisticato").

Restituisci ESCLUSIVAMENTE un oggetto JSON con:
- "archetipo": etichetta strutturale sintetica dell'accordo dominante in italiano, 2-4 parole (es. "Struttura Legnosa & Resina", "Asse Cuoiato & Spezie", "Equilibrio Esperidato & Verde")
- "descrizione": 2 frasi fattuali e sobrie sull'equilibrio tra gli assi e sulle materie prime ricorrenti
- "consiglio": 1 frase tecnica e concreta su quale famiglia o nota complementare può bilanciare la rotazione`;

  try {
    const res = await callAIWithFallback<ScentDNAResponse>([{ text: prompt }], {
      jsonMode: true,
      responseSchema: SCENT_DNA_SCHEMA,
      validator: isScentDNAResponse,
      temperature: 0.25,
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

  const fallback = buildLocalScentDNA(axes, topNotes);
  return NextResponse.json({ ...fallback, _fallback: 'local' });
}
