import { NextResponse } from 'next/server';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface NasoContext {
  collection?: string[];
  radar?: string[];
  recentWears?: string[];
  scentDNA?: Record<string, number>;
  currentTime?: string;
  weather?: string;
}

const SYSTEM_PROMPT = `Sei Il Naso di Atelier LG, un consulente olfattivo personale di alta profumeria.
Conosci la collezione dell'utente, il suo diario indossi e la sua identità olfattiva (Scent DNA).
Rispondi in italiano con tono caldo, colto e diretto, mai generico.
- Se ti chiede cosa indossare, considera: cosa ha usato di recente (evita ripetizioni), l'ora e il momento della giornata, la stagionalità.
- Se ti chiede del layering, spiega brevemente la chimica delle note.
- Se ti chiede dei gap nella collezione, analizza le famiglie mancanti.
- REGOLA ASSOLUTA: non inventare profumi che non possiede. Se chiede un profumo assente, dillo chiaramente e proponi alternative reali dalla sua collezione o dal Radar.
- Rispondi in modo conciso (max 3-4 frasi salvo richieste esplicite di approfondimento).`;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 20;
const MAX_COLLECTION = 60;
const MAX_RADAR = 40;
const MAX_RECENT_WEARS = 10;
const MAX_ITEM_LENGTH = 240;
const MAX_DNA_KEYS = 12;

const INJECTION_PATTERNS = [
  /ignor[ae]\s+(tutte\s+)?(le\s+|ogni\s+)?(tue\s+)?(istruzion[ei]|regole|direttive)/i,
  /dimentica\s+(tutte\s+)?(le\s+)?(tue\s+)?(istruzion[ei]|regole)/i,
  /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules)/i,
  /disregard\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /system\s*prompt/i,
  /prompt\s+di\s+sistema/i,
];

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return clean.length > 0 ? clean : null;
}

function cleanList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    const clean = cleanLine(item, MAX_ITEM_LENGTH);
    if (clean) out.push(clean);
  }
  return out;
}

function parseMessages(value: unknown): ChatMessage[] | string {
  if (!Array.isArray(value) || value.length === 0) return 'Nessun messaggio fornito.';
  if (value.length > MAX_MESSAGES) {
    return `Conversazione troppo lunga (massimo ${MAX_MESSAGES} messaggi).`;
  }
  const turns: ChatMessage[] = [];
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

function parseContext(value: unknown): NasoContext {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const scentDNA: Record<string, number> = {};
  if (raw.scentDNA && typeof raw.scentDNA === 'object' && !Array.isArray(raw.scentDNA)) {
    for (const [key, val] of Object.entries(raw.scentDNA as Record<string, unknown>).slice(0, MAX_DNA_KEYS)) {
      const label = cleanLine(key, 40);
      if (label && typeof val === 'number' && Number.isFinite(val)) {
        scentDNA[label] = Math.max(0, Math.min(100, Math.round(val)));
      }
    }
  }
  return {
    collection: cleanList(raw.collection, MAX_COLLECTION),
    radar: cleanList(raw.radar, MAX_RADAR),
    recentWears: cleanList(raw.recentWears, MAX_RECENT_WEARS),
    scentDNA,
    currentTime: cleanLine(raw.currentTime, 80) ?? undefined,
    weather: cleanLine(raw.weather, 100) ?? undefined,
  };
}

function buildLocalNasoReply(userQuestion: string, ctx: NasoContext): string {
  const collection = Array.isArray(ctx.collection) ? ctx.collection : [];
  const radar = Array.isArray(ctx.radar) ? ctx.radar : [];
  const recent = Array.isArray(ctx.recentWears) ? ctx.recentWears : [];
  const q = userQuestion.toLowerCase();

  if (collection.length === 0) {
    return 'Al momento sono in modalità essenziale e la tua collezione risulta vuota. Aggiungi almeno un profumo in collezione per ricevere suggerimenti mirati.';
  }

  const recentLower = recent.map((r) => r.toLowerCase());
  const freshPicks = collection.filter(
    (item) => !recentLower.some((r) => r.includes(item.toLowerCase()) || item.toLowerCase().includes(r))
  );
  const pool = freshPicks.length > 0 ? freshPicks : collection;

  if ((q.includes('radar') || q.includes('comprare') || q.includes('acquist')) && radar.length > 0) {
    const picks = radar.slice(0, 2).join(' oppure ');
    return `In modalità essenziale ti segnalo dal tuo Radar: ${picks}. Sono già nella tua lista di interesse e meritano una prova su pelle prima del prossimo acquisto.`;
  }

  const hour = new Date().getHours();
  const moment =
    hour < 12 ? 'questa mattina' : hour < 18 ? 'questo pomeriggio' : 'questa sera';
  const pick1 = pool[hour % pool.length];
  const pick2 = pool.length > 1 ? pool[(hour + 1) % pool.length] : null;

  const suggestion = pick2 ? `${pick1} oppure ${pick2}` : pick1;
  return `Sono temporaneamente in modalità essenziale, ma guardando la tua collezione e gli ultimi indossi, per ${moment} ti consiglio ${suggestion}: sono scelte reali già presenti nel tuo armadio che evitano ripetizioni recenti.`;
}

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

  const messages = parseMessages(payload.messages);
  if (typeof messages === 'string') {
    return NextResponse.json({ error: messages }, { status: 400 });
  }
  if (messages.some((m) => m.role === 'user' && INJECTION_PATTERNS.some((re) => re.test(m.content)))) {
    return NextResponse.json({ error: 'Richiesta non consentita.' }, { status: 400 });
  }

  const context = parseContext(payload.context);
  const collection = context.collection ?? [];
  const radar = context.radar ?? [];
  const recentWears = context.recentWears ?? [];
  const lastMessage = messages[messages.length - 1];

  const contextBlock = [
    `CONTESTO UTENTE ATELIER LG (usa solo questi dati, non aggiungere profumi che non compaiono):`,
    `- Ora attuale: ${context.currentTime ?? new Date().toLocaleString('it-IT')}`,
    context.weather ? `- Meteo: ${context.weather}` : null,
    `- Scent DNA (0-100): ${JSON.stringify(context.scentDNA ?? {})}`,
    `- Collezione (${collection.length}): ${collection.join(', ') || 'Vuota'}`,
    `- Radar (${radar.length}): ${radar.join(', ') || 'Vuoto'}`,
    `- Ultimi indossi: ${recentWears.join(' | ') || 'Nessuno'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const historyText = messages
    .map((m) => `${m.role === 'user' ? 'Utente' : 'Il Naso'}: ${m.content}`)
    .join('\n');

  const fullPrompt = `${contextBlock}\n\nCONVERSAZIONE:\n${historyText}\n\nRispondi come Il Naso all'ultimo messaggio dell'utente.`;

  try {
    const res = await callAIWithFallback([{ text: fullPrompt }], {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      deadline: Date.now() + 20000,
    });

    const reply = res.text.trim();
    if (!reply) throw new Error('Risposta vuota');
    return NextResponse.json({ reply });
  } catch (err) {
    console.warn('[il-naso] AI non disponibile, attivo salvagente locale:', err);
    const localReply = buildLocalNasoReply(lastMessage.content, {
      ...context,
      collection,
      radar,
      recentWears,
    });
    return NextResponse.json({ reply: localReply, _fallback: 'local' });
  }
}
