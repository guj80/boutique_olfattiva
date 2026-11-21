// app/api/oracolo/route.ts
// Endpoint conversazionale "Il Naso" con fallback AI multi-provider e salvagente locale sui dati reali.

import { NextResponse } from 'next/server';
import { callAIWithFallback } from '@/lib/gemini-engine';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const INJECTION_PATTERNS = [
  /ignora\s+(tutte\s+)?le\s+istruzioni/i,
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
];

function buildLocalNasoReply(userQuestion: string, ctx: NasoContext): string {
  const collection = Array.isArray(ctx.collection) ? ctx.collection : [];
  const radar = Array.isArray(ctx.radar) ? ctx.radar : [];
  const recent = Array.isArray(ctx.recentWears) ? ctx.recentWears : [];
  const q = userQuestion.toLowerCase();

  if (collection.length === 0) {
    return 'Al momento sono in modalità essenziale e la tua collezione risulta vuota. Aggiungi almeno un profumo in collezione per ricevere suggerimenti mirati.';
  }

  // Escludi i profumi indossati di recente
  const recentLower = recent.map((r) => r.toLowerCase());
  const freshPicks = collection.filter(
    (item) => !recentLower.some((r) => r.includes(item.toLowerCase()) || item.toLowerCase().includes(r))
  );
  const pool = freshPicks.length > 0 ? freshPicks : collection;

  // Se chiede del Radar o di nuovi acquisti
  if ((q.includes('radar') || q.includes('comprare') || q.includes('acquist')) && radar.length > 0) {
    const picks = radar.slice(0, 2).join(' oppure ');
    return `In modalità essenziale ti segnalo dal tuo Radar: ${picks}. Sono già nella tua lista di interesse e meritano una prova su pelle prima del prossimo acquisto.`;
  }

  // Selezione deterministica in base all'ora
  const hour = new Date().getHours();
  const moment =
    hour < 12 ? 'questa mattina' : hour < 18 ? 'questo pomeriggio' : 'questa sera';
  const pick1 = pool[hour % pool.length];
  const pick2 = pool.length > 1 ? pool[(hour + 1) % pool.length] : null;

  const suggestion = pick2 ? `${pick1} oppure ${pick2}` : pick1;
  return `Sono temporaneamente in modalità essenziale, ma guardando la tua collezione e gli ultimi indossi, per ${moment} ti consiglio ${suggestion}: sono scelte reali già presenti nel tuo armadio che evitano ripetizioni recenti.`;
}

export async function POST(req: Request) {
  export async function POST(req: Request) {
  // --- PROTEZIONE API ---
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  // ----------------------

  let body: unknown;
  // ... resto del codice ...
  let body: { messages?: ChatMessage[]; context?: NasoContext };
  try {
    body = (await req.json()) as { messages?: ChatMessage[]; context?: NasoContext };
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  const context = body.context ?? {};

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Nessun messaggio fornito.' }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.content || lastMessage.content.length > 1000) {
    return NextResponse.json({ error: 'Messaggio vuoto o troppo lungo (max 1000 caratteri).' }, { status: 400 });
  }

  if (INJECTION_PATTERNS.some((pattern) => pattern.test(lastMessage.content))) {
    return NextResponse.json({ error: 'Richiesta non consentita.' }, { status: 400 });
  }

  const collection = (context.collection ?? []).slice(0, 60);
  const radar = (context.radar ?? []).slice(0, 40);
  const recentWears = (context.recentWears ?? []).slice(0, 10);

  const contextBlock = [
    `CONTESTO UTENTE ATELIER LG:`,
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
    });

    return NextResponse.json({ reply: res.text.trim() });
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
