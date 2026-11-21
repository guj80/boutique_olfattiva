'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, BookmarkPlus, RefreshCw, Send, Wand2, X } from 'lucide-react';
import {
  supabase,
  isCollezioneProfumo,
  isRadarProfumo,
  type Indosso,
  type Profumo,
} from '@/lib/supabase';
import { apiFetch } from '@/lib/api-fetch';
import { SCENT_AXES, computeScentDNA } from '@/lib/scent-dna';
import { useAura } from './AuraProvider';

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface OracoloContextPayload {
  collection: string[];
  radar: string[];
  recentWears: string[];
  scentDNA: Record<string, number>;
  currentTime: string;
  weather?: string;
}

const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY = 20;
const CONTEXT_MAX_AGE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 28000;

/** Altezza indicativa della dock (16px dal fondo + ~66px di pillola) + 24px di respiro */
const FAB_BOTTOM_OFFSET_PX = 82 + 24;

const SUGGESTIONS = [
  'Cosa mi consigli di indossare ora?',
  'Quali famiglie mancano alla mia collezione?',
  'Come posso fare layering con i miei profumi?',
];

/* ------------------------------------------------------------------ */
/* Costruzione del contesto (dati reali da Supabase)                   */
/* ------------------------------------------------------------------ */

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function describePerfume(p: Profumo, withNotes: boolean): string {
  let text = `${p.brand} – ${p.nome}`;
  if (p.famiglia_olfattiva) text += ` [${p.famiglia_olfattiva}]`;
  if (withNotes) {
    const layers: Array<[string, string | null | undefined]> = [
      ['testa', p.note_testa],
      ['cuore', p.note_cuore],
      ['fondo', p.note_fondo],
    ];
    const notes = layers
      .filter(([, value]) => Boolean(value && value.trim()))
      .map(([label, value]) => `${label}: ${clip(value as string, 50)}`);
    if (notes.length > 0) text += ` — ${notes.join('; ')}`;
  }
  return text;
}

function momentOfDay(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Mattina';
  if (h >= 12 && h < 18) return 'Pomeriggio';
  if (h >= 18 && h < 23) return 'Sera';
  return 'Notte';
}

function formatNow(): string {
  const now = new Date();
  const label = now.toLocaleString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${label} (${momentOfDay(now)})`;
}

async function fetchContext(): Promise<OracoloContextPayload> {
  const [profumiRes, indossiRes] = await Promise.all([
    supabase.from('profumi').select('*').order('nome', { ascending: true }),
    supabase
      .from('indossi')
      .select('id, profumo_id, created_at, momento_giornata')
      .order('created_at', { ascending: false })
      .limit(400),
  ]);

  if (profumiRes.error) throw profumiRes.error;
  if (indossiRes.error) throw indossiRes.error;

  const profumi = (profumiRes.data ?? []) as Profumo[];
  const wears = (indossiRes.data ?? []) as Indosso[];
  const byId = new Map(profumi.map((p) => [p.id, p]));

  const collection = profumi.filter(isCollezioneProfumo);
  const radar = profumi.filter(isRadarProfumo);

  const recentWears: string[] = [];
  for (const wear of wears) {
    if (recentWears.length >= 10) break;
    const p = byId.get(wear.profumo_id);
    if (!p) continue;
    const when = wear.created_at
      ? new Date(wear.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      : '';
    const detail = [wear.momento_giornata, when].filter(Boolean).join(', ');
    recentWears.push(`${p.brand} – ${p.nome}${detail ? ` (${detail})` : ''}`);
  }

  const dna = computeScentDNA(profumi, wears);
  const scentDNA: Record<string, number> = {};
  if (dna.hasSignal) {
    for (const axis of SCENT_AXES) scentDNA[axis.label] = dna.rawPercent[axis.key];
  }

  return {
    collection: collection.slice(0, 60).map((p) => describePerfume(p, true)),
    radar: radar.slice(0, 40).map((p) => describePerfume(p, false)),
    recentWears,
    scentDNA,
    currentTime: formatNow(),
  };
}

function readErrorMessage(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>).error;
    if (typeof err === 'string' && err.trim()) return err;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export function Oracolo() {
  const pathname = usePathname() ?? '';
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

  const { aura, hideDock, setHideDock } = useAura();
  const prefersReducedMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const contextRef = useRef<{ at: number; data: OracoloContextPayload } | null>(null);
  const requestId = useRef(0);
  const idCounter = useRef(0);
  const hiddenByMe = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  messagesRef.current = messages;

  /* ---------- apertura / chiusura ---------- */

  const closeSheet = useCallback(() => {
    setOpen(false);
    if (hiddenByMe.current) {
      hiddenByMe.current = false;
      setHideDock(false);
    }
  }, [setHideDock]);

  const openSheet = useCallback(() => {
    hiddenByMe.current = true;
    setHideDock(true);
    setOpen(true);
  }, [setHideDock]);

  // Cleanup su unmount: la dock non resta mai nascosta per colpa nostra
  useEffect(() => {
    return () => {
      if (hiddenByMe.current) {
        hiddenByMe.current = false;
        setHideDock(false);
      }
    };
  }, [setHideDock]);

  // Se si finisce su login/signup il foglio si chiude
  useEffect(() => {
    if (isAuthRoute && open) closeSheet();
  }, [isAuthRoute, open, closeSheet]);

  // Escape + blocco scroll della pagina sotto il foglio
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 420);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, closeSheet]);

  /* ---------- contesto (lazy alla prima apertura) ---------- */

  const ensureContext = useCallback(async (): Promise<OracoloContextPayload> => {
    const cached = contextRef.current;
    if (cached && Date.now() - cached.at < CONTEXT_MAX_AGE_MS) {
      return { ...cached.data, currentTime: formatNow() };
    }
    const data = await fetchContext();
    contextRef.current = { at: Date.now(), data };
    return data;
  }, []);

  useEffect(() => {
    if (!open) return;
    ensureContext().catch(() => {
      /* l'errore viene mostrato solo se l'utente invia un messaggio */
    });
  }, [open, ensureContext]);

  /* ---------- auto-scroll ---------- */

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages, thinking, error, open, prefersReducedMotion]);

  /* ---------- invio / risposta ---------- */

  const requestReply = useCallback(
    async (history: ChatMessage[]) => {
      const rid = ++requestId.current;
      setThinking(true);
      setError(null);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        let context: OracoloContextPayload;
        try {
          context = await ensureContext();
        } catch {
          throw new Error(
            'Non riesco a leggere la tua collezione in questo momento. Controlla la connessione e riprova.'
          );
        }

        const res = await apiFetch('/api/oracolo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history
              .slice(-MAX_HISTORY)
              .map(({ role, content }) => ({ role, content })),
            context,
          }),
          signal: controller.signal,
        });
        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(readErrorMessage(data) ?? 'CAMILLA non è raggiungibile. Riprova.');
        }
        const reply =
          data && typeof data === 'object' ? (data as Record<string, unknown>).reply : null;
        if (typeof reply !== 'string' || !reply.trim()) {
          throw new Error('CAMILLA non ha prodotto una risposta. Riprova.');
        }
        if (rid !== requestId.current) return;

        idCounter.current += 1;
        setMessages((prev) => [
          ...prev,
          { id: `a-${idCounter.current}`, role: 'assistant', content: reply.trim() },
        ]);
      } catch (err) {
        if (rid !== requestId.current) return;
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        setError(
          aborted
            ? 'CAMILLA sta impiegando troppo tempo. Riprova.'
            : err instanceof Error
            ? err.message
            : 'Errore imprevisto. Riprova.'
        );
      } finally {
        clearTimeout(timer);
        if (rid === requestId.current) setThinking(false);
      }
    },
    [ensureContext]
  );

  const sendMessage = useCallback(
    (text: string) => {
      const content = text.trim().slice(0, MAX_INPUT_LENGTH);
      if (!content || thinking) return;

      idCounter.current += 1;
      const next: ChatMessage[] = [
        ...messagesRef.current,
        { id: `u-${idCounter.current}`, role: 'user', content },
      ];
      setMessages(next);
      setDraft('');
      void requestReply(next);
    },
    [thinking, requestReply]
  );

  const retry = useCallback(() => {
    if (thinking) return;
    const history = messagesRef.current;
    if (history.length === 0 || history[history.length - 1].role !== 'user') return;
    void requestReply(history);
  }, [thinking, requestReply]);

  // Invalida eventuali risposte in volo allo smontaggio
  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  if (isAuthRoute) return null;

  /* ---------- UI ---------- */

  const sheetMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      };

  const canSend = draft.trim().length > 0 && !thinking;

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && !hideDock && (
          <motion.button
            key="camilla-fab"
            type="button"
            onClick={openSheet}
            aria-label="Apri CAMILLA, consulente olfattiva"
            title="CAMILLA"
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            style={{
              bottom: `calc(env(safe-area-inset-bottom, 0px) + ${FAB_BOTTOM_OFFSET_PX}px)`,
              right: 24,
              background:
                'radial-gradient(circle at 30% 25%, var(--aura-1), color-mix(in srgb, var(--aura-1) 45%, var(--aura-2)))',
              boxShadow: '0 12px 32px -10px var(--aura-1)',
            }}
            className="fixed z-[35] flex h-14 w-14 items-center justify-center rounded-full text-[#08060C]"
          >
            {!prefersReducedMotion && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ border: '2px solid var(--aura-1)' }}
                animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <Wand2 className="relative h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Foglio a schermo intero */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="camilla-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="CAMILLA, consulente olfattiva"
            {...sheetMotion}
            style={{
              background:
                'radial-gradient(120% 55% at 50% -8%, color-mix(in srgb, var(--aura-1) 20%, transparent), transparent 62%), #08060C',
            }}
            className="fixed inset-0 z-[70] flex h-[100dvh] flex-col text-[#F6EFE4]"
          >
            {/* Header */}
            <header
              style={{
                borderColor: `${aura.primary}30`,
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              }}
              className="flex items-center justify-between border-b px-5 pb-3"
            >
              <div>
                <h2 className="font-serif text-2xl leading-none tracking-wide text-[#F6EFE4]">
                  CAMILLA
                </h2>
                <p
                  style={{ color: aura.primary }}
                  className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.24em]"
                >
                  Consulente olfattiva
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeSheet}
                aria-label="Chiudi CAMILLA"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0E0A16] text-[#B8A9C9] transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Messaggi */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
                {messages.length === 0 && !thinking && (
                  <div className="space-y-5 py-8 text-center">
                    <p className="font-serif text-3xl text-[#F6EFE4]">Chiedi a CAMILLA</p>
                    <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#B8A9C9]">
                      Conosce la tua collezione, il tuo diario e il tuo DNA olfattivo. Chiedile
                      cosa indossare, come abbinare i tuoi profumi o cosa manca.
                    </p>
                    <div className="flex flex-col items-center gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => sendMessage(suggestion)}
                          style={{ borderColor: `${aura.primary}40` }}
                          className="rounded-full border bg-[#0E0A16] px-4 py-2 text-xs text-[#F6EFE4] transition hover:bg-white/5"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) =>
                  message.role === 'user' ? (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                      className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-2.5 text-sm leading-relaxed text-[#F6EFE4]"
                    >
                      {message.content}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                      className="flex max-w-[92%] items-start gap-3"
                    >
                      <span
                        aria-hidden="true"
                        style={{ borderColor: `${aura.primary}66`, color: aura.primary }}
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[#0E0A16] font-mono text-[10px] font-bold"
                      >
                        CM
                      </span>
                      <div className="min-w-0 space-y-1.5">
                        <div
                          style={{ borderColor: `${aura.primary}25` }}
                          className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border bg-[#161024] px-4 py-3 text-sm leading-relaxed text-[#F6EFE4]"
                        >
                          {message.content}
                        </div>
                        <button
                          type="button"
                          disabled
                          title="Presto disponibile"
                          className="inline-flex cursor-not-allowed items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9] opacity-40"
                        >
                          <BookmarkPlus className="h-3 w-3" />
                          Salva come nota
                        </button>
                      </div>
                    </motion.div>
                  )
                )}

                {thinking && (
                  <div className="flex items-start gap-3" role="status" aria-label="CAMILLA sta pensando">
                    <span
                      aria-hidden="true"
                      style={{ borderColor: `${aura.primary}66`, color: aura.primary }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[#0E0A16] font-mono text-[10px] font-bold"
                    >
                      CM
                    </span>
                    <div
                      style={{ borderColor: `${aura.primary}25` }}
                      className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border bg-[#161024] px-4 py-3.5"
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          style={{
                            backgroundColor: aura.primary,
                            animationDelay: `${dot * 180}ms`,
                          }}
                          className="h-1.5 w-1.5 animate-pulse rounded-full opacity-80 motion-reduce:animate-none"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {error && !thinking && (
                  <div
                    role="alert"
                    className="flex flex-col items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-2.5 text-sm text-red-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                    {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                      <button
                        type="button"
                        onClick={retry}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-300/40 px-4 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/15"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Riprova
                      </button>
                    )}
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(draft);
              }}
              style={{
                borderColor: `${aura.primary}30`,
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              }}
              className="border-t bg-[#08060C]/90 px-4 pt-3 backdrop-blur-xl sm:px-6"
            >
              <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  maxLength={MAX_INPUT_LENGTH}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendMessage(draft);
                    }
                  }}
                  placeholder="Chiedi qualcosa a CAMILLA…"
                  aria-label="Scrivi un messaggio a CAMILLA"
                  style={{ borderColor: `${aura.primary}40` }}
                  className="min-w-0 flex-1 rounded-full border bg-[#161024] px-5 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Invia"
                  style={{ backgroundColor: aura.primary }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#08060C] transition hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
