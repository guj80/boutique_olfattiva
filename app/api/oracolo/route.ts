import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* ------------------------------------------------------------------ */
/* Tipi del payload                                                    */
/* ------------------------------------------------------------------ */

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface OracoloContext {
  collection: string[];
  radar: string[];
  recentWears: string[];
  scentDNA: Record<string, number>;
  currentTime: string;
  weather?: string;
}

/* ------------------------------------------------------------------ */
/* Limiti                                                              */
/* ------------------------------------------------------------------ */

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 20;
const MAX_COLLECTION = 60;
const MAX_RADAR = 40;
const MAX_RECENT_WEARS = 10;
const MAX_CONTEXT_ITEM_LENGTH = 240;
const MAX_DNA_KEYS = 12;

const SYSTEM_PROMPT = [
  "Sei CAMILLA, la consulente olfattiva personale di Atelier LG. Conosci la collezione dell'utente, il suo Radar, il suo diario e il suo Scent DNA.",
  "Rispondi in italiano con tono autorevole, competente e asciutto (max 4-5 frasi salvo richieste tecniche dettagliate).",
  "1) Consigli d'uso e layering: basati esclusivamente sui profumi presenti nella Collezione o nel Radar dell'utente, incrociando ultimi indossi, ora del giorno, meteo e chimica delle note. Non attribuire mai all'utente profumi che non possiede.",
  "2) Ricerca fonti ufficiali e schede tecniche: se l'utente chiede il sito ufficiale di una maison, il link o riferimento su Fragrantica/Parfumo, oppure chiede di verificare/completare la piramide olfattiva, il naso o l'anno di lancio di una fragranza (anche fuori collezione), fornisci con precisione il dominio ufficiale della maison (se certo, altrimenti il riferimento di ricerca su Parfumo/Fragrantica senza mai inventare URL specifici non verificati) e i dettagli olfattivi reali accertati (Testa, Cuore, Fondo, Naso, Concentrazione) così che possa aggiornare la scheda.",
].join(' ');

const INJECTION_PATTERNS: RegExp[] = [
  /ignor[ae]\s+(tutte\s+)?(le\s+|ogni\s+)?(tue\s+)?(istruzion[ei]|regole|direttive)/i,
  /dimentica\s+(tutte\s+)?(le\s+)?(tue\s+)?(istruzion[ei]|regole)/i,
  /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules)/i,
  /disregard\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /system\s*prompt/i,
  /prompt\s+di\s+sistema/i,
];

function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/* ------------------------------------------------------------------ */
/* Sanificazione                                                       */
/* ------------------------------------------------------------------ */

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return clean.length > 0 ? clean : null;
}

function cleanList(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    const clean = cleanLine(item, MAX_CONTEXT_ITEM_LENGTH);
    if (clean) out.push(clean);
  }
  return out;
}

function parseMessages(value: unknown): ChatTurn[] | string {
  if (!Array.isArray(value) || value.length === 0) return 'Nessun messaggio da elaborare.';
  if (value.length > MAX_MESSAGES) {
    return `Conversazione troppo lunga (massimo ${MAX_MESSAGES} messaggi).`;
  }

  const turns: ChatTurn[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return 'Formato dei messaggi non valido.';
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return 'Formato dei messaggi non valido.';
    }
    const trimmed = content.trim();
    if (!trimmed) return 'Messaggio vuoto.';
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return `Messaggio troppo lungo (massimo ${MAX_MESSAGE_LENGTH} caratteri).`;
    }
    turns.push({ role, content: trimmed });
  }

  if (turns[turns.length - 1].role !== 'user') {
    return "L'ultimo messaggio deve essere dell'utente.";
  }
  return turns;
}

function parseContext(value: unknown): OracoloContext | string {
  if (!value || typeof value !== 'object') return 'Contesto mancante.';
  const raw = value as Record<string, unknown>;

  const collection = cleanList(raw.collection, MAX_COLLECTION);
  const radar = cleanList(raw.radar, MAX_RADAR);
  const recentWears = cleanList(raw.recentWears, MAX_RECENT_WEARS);
  const currentTime = cleanLine(raw.currentTime, 80);

  if (!collection || !radar || !recentWears || !currentTime) return 'Contesto non valido.';

  const scentDNA: Record<string, number> = {};
  if (raw.scentDNA && typeof raw.scentDNA === 'object' && !Array.isArray(raw.scentDNA)) {
    for (const [key, val] of Object.entries(raw.scentDNA as Record<string, unknown>).slice(
      0,
      MAX_DNA_KEYS
    )) {
      const label = cleanLine(key, 40);
      if (label && typeof val === 'number' && Number.isFinite(val)) {
        scentDNA[label] = Math.max(0, Math.min(100, Math.round(val)));
      }
    }
  }

  const weather = cleanLine(raw.weather, 100) ?? undefined;
  return { collection, radar, recentWears, scentDNA, currentTime, weather };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

function listBlock(items: string[], emptyLabel: string): string {
  return items.length > 0 ? items.map((item) => `  - ${item}`).join('\n') : `  ${emptyLabel}`;
}

function buildPrompt(turns: ChatTurn[], ctx: OracoloContext): string {
  const dnaLines = Object.entries(ctx.scentDNA)
    .sort((a, b) => b[1] - a[1])
    .map(([label, pct]) => `${label} ${pct}%`)
    .join(', ');

  const contextBlock = [
    "ARCHIVIO PERSONALE DELL'UTENTE:",
    `Collezione (${ctx.collection.length}):`,
    listBlock(ctx.collection, 'Vuota'),
    `Radar / profumi in prova (${ctx.radar.length}):`,
    listBlock(ctx.radar, 'Nessuno'),
    'Ultimi indossi (dal più recente):',
    listBlock(ctx.recentWears, 'Nessun indosso registrato'),
    `Scent DNA: ${dnaLines || 'non ancora disponibile'}`,
    `Data e ora: ${ctx.currentTime}`,
    ...(ctx.weather ? [`Meteo: ${ctx.weather}`] : []),
  ].join('\n');

  const transcript = turns
    .map((turn) => `${turn.role === 'user' ? 'Utente' : 'CAMILLA'}: ${turn.content}`)
    .join('\n');

  return `${contextBlock}\n\nCONVERSAZIONE:\n${transcript}\n\nRispondi ora, come CAMILLA, all'ultimo messaggio dell'utente.`;
}

function tidyReply(raw: string): string {
  return raw
    .replace(/^\s*(Camilla|CAMILLA|Oracolo|L'Oracolo)\s*:\s*/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const turns = parseMessages(payload.messages);
  if (typeof turns === 'string') {
    return NextResponse.json({ error: turns }, { status: 400 });
  }

  if (turns.some((turn) => turn.role === 'user' && looksLikeInjection(turn.content))) {
    return NextResponse.json(
      { error: 'Non posso eseguire questa richiesta. Chiedimi pure dei tuoi profumi.' },
      { status: 400 }
    );
  }

  const context = parseContext(payload.context);
  if (typeof context === 'string') {
    return NextResponse.json({ error: context }, { status: 400 });
  }

  try {
    const { text } = await callGeminiWithFallback([{ text: buildPrompt(turns, context) }], {
      temperature: 0.55,
      systemInstruction: SYSTEM_PROMPT,
      deadline: Date.now() + 20000,
    });

    const reply = tidyReply(text);
    if (!reply) {
      return NextResponse.json(
        { error: 'CAMILLA non ha prodotto una risposta. Riprova.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: 'CAMILLA non è raggiungibile in questo momento. Riprova tra poco.' },
      { status: 502 }
    );
  }
}
