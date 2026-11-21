'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Fingerprint, Lightbulb, RefreshCw } from 'lucide-react';
import type { Indosso, Profumo } from '@/lib/supabase';
import { apiFetch } from '@/lib/api-fetch';
import {
  SCENT_AXES,
  computeScentDNA,
  isScentArchetype,
  type ScentArchetype,
  type ScentDNAResult,
} from '@/lib/scent-dna';
import { useAura } from './AuraProvider';

/* ------------------------------------------------------------------ */
/* Cache localStorage (24h)                                            */
/* ------------------------------------------------------------------ */

const CACHE_KEY = 'atelier_lg_scent_dna_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 26000;

interface CacheEntry {
  savedAt: number;
  signature: string;
  data: ScentArchetype;
}

function readCache(signature: string): ScentArchetype | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CacheEntry> | null;
    if (
      !entry ||
      typeof entry.savedAt !== 'number' ||
      entry.signature !== signature ||
      Date.now() - entry.savedAt > CACHE_TTL_MS ||
      !isScentArchetype(entry.data)
    ) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(signature: string, data: ScentArchetype): void {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), signature, data };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* storage pieno o non disponibile: il DNA resta comunque visibile */
  }
}

function readErrorMessage(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>).error;
    if (typeof err === 'string' && err.trim()) return err;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Geometria del radar                                                 */
/* ------------------------------------------------------------------ */

const VIEW_W = 400;
const VIEW_H = 380;
const CX = 200;
const CY = 188;
const RADIUS = 104;
const LABEL_RADIUS = RADIUS + 18;
const RINGS = [25, 50, 75, 100];

/** Il centro non e' mai vuoto: lo 0 occupa l'8% del raggio, cosi' il poligono resta leggibile. */
function radiusFor(value: number): number {
  return RADIUS * (0.08 + 0.92 * (Math.max(0, Math.min(100, value)) / 100));
}

function angleFor(index: number): number {
  return (Math.PI / 3) * index - Math.PI / 2;
}

function pointAt(index: number, radius: number): [number, number] {
  const a = angleFor(index);
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function toPath(points: Array<[number, number]>): string {
  return `${points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')} Z`;
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

interface ScentDNAProps {
  profumi: Profumo[];
  indossi: Indosso[];
  /** true finche' la pagina sta ancora caricando i dati (evita lo stato vuoto fuorviante) */
  loading?: boolean;
}

type Status = 'idle' | 'loading' | 'error';

export function ScentDNA({ profumi, indossi, loading = false }: ScentDNAProps) {
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();

  const dna: ScentDNAResult = useMemo(
    () => computeScentDNA(profumi, indossi),
    [profumi, indossi]
  );
  const dnaRef = useRef<ScentDNAResult>(dna);
  dnaRef.current = dna;

  const [archetype, setArchetype] = useState<ScentArchetype | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestId = useRef(0);

  const generate = useCallback(async (force: boolean) => {
    const current = dnaRef.current;
    if (current.isEmpty || !current.hasSignal) return;

    if (!force) {
      const cached = readCache(current.signature);
      if (cached) {
        requestId.current += 1;
        setArchetype(cached);
        setStatus('idle');
        setErrorMessage(null);
        return;
      }
    }

    const id = ++requestId.current;
    setStatus('loading');
    setErrorMessage(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await apiFetch('/api/scent-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          axes: current.rawPercent,
          dominantFamilies: current.dominantFamilies,
          topNotes: current.topNotes,
        }),
        signal: controller.signal,
      });
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(readErrorMessage(data) ?? 'Servizio non disponibile. Riprova.');
      }
      if (!isScentArchetype(data)) {
        throw new Error('Risposta non valida dal servizio. Riprova.');
      }
      if (id !== requestId.current) return;

      setArchetype(data);
      setStatus('idle');
      writeCache(current.signature, data);
    } catch (err) {
      if (id !== requestId.current) return;
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setErrorMessage(
        aborted
          ? 'La richiesta ha impiegato troppo tempo. Riprova.'
          : err instanceof Error
          ? err.message
          : 'Errore imprevisto. Riprova.'
      );
      setStatus('error');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // Carica da cache o genera quando il profilo cambia in modo significativo
  useEffect(() => {
    if (loading || dna.isEmpty || !dna.hasSignal) return;
    void generate(false);
  }, [loading, dna.isEmpty, dna.hasSignal, dna.signature, generate]);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  const isGenerating = status === 'loading';

  const polygon = useMemo(
    () => toPath(SCENT_AXES.map((axis, i) => pointAt(i, radiusFor(dna.radar[axis.key])))),
    [dna.radar]
  );

  const ariaSummary = useMemo(
    () =>
      `Radar del profilo olfattivo. ${SCENT_AXES.map(
        (axis) => `${axis.label} ${dna.rawPercent[axis.key]}%`
      ).join(', ')}.`,
    [dna.rawPercent]
  );

  /* ---------------------------- Stati ---------------------------- */

  const cardClass = 'rounded-[26px] border bg-[#0E0A16] p-5 sm:p-6 shadow-2xl';

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-2xl" aria-busy="true">
        <div style={{ borderColor: `${aura.primary}30` }} className={cardClass}>
          <div className="aura-skeleton h-[340px] rounded-[20px]" />
        </div>
      </section>
    );
  }

  const header = (
    <div
      style={{ borderColor: `${aura.primary}25` }}
      className="mb-4 flex items-center justify-between border-b pb-3"
    >
      <div
        style={{ borderColor: `${aura.primary}55` }}
        className="inline-flex items-center gap-2 rounded-md border bg-[#161024] px-2.5 py-1"
      >
        <Fingerprint style={{ color: aura.primary }} className="h-3.5 w-3.5" />
        <span
          style={{ color: aura.primary }}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
        >
          Scent DNA
        </span>
      </div>

      {!dna.isEmpty && dna.hasSignal && (
        <button
          type="button"
          onClick={() => void generate(true)}
          disabled={isGenerating}
          aria-label="Rigenera il profilo olfattivo"
          title="Rigenera"
          style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
          className="inline-flex items-center gap-1.5 rounded-full border bg-[#161024] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition hover:bg-white/5 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
          <span>Rigenera</span>
        </button>
      )}
    </div>
  );

  if (dna.isEmpty) {
    return (
      <section className="mx-auto w-full max-w-2xl">
        <div style={{ borderColor: `${aura.primary}50` }} className={cardClass}>
          {header}
          <div className="space-y-3 py-6 text-center">
            <p className="font-serif text-2xl text-[#F6EFE4]">Il tuo DNA olfattivo ti aspetta</p>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#B8A9C9]">
              Aggiungi qualche profumo alla collezione: il radar prende forma dalle famiglie
              olfattive che indossi davvero.
            </p>
            <Link
              href="/scanner"
              style={{ backgroundColor: aura.primary }}
              className="inline-flex items-center rounded-full px-5 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90"
            >
              Acquisisci un profumo
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!dna.hasSignal) {
    return (
      <section className="mx-auto w-full max-w-2xl">
        <div style={{ borderColor: `${aura.primary}50` }} className={cardClass}>
          {header}
          <p className="py-6 text-center text-sm leading-relaxed text-[#B8A9C9]">
            Nessuna famiglia olfattiva riconosciuta nelle schede della collezione. Completa il
            campo famiglia per far comparire il tuo radar.
          </p>
        </div>
      </section>
    );
  }

  /* ---------------------------- Radar ---------------------------- */

  const draw = !prefersReducedMotion;

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div style={{ borderColor: `${aura.primary}50` }} className={cardClass}>
        {header}

        <div className="relative mx-auto w-full max-w-[420px]">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label={ariaSummary}
            className="h-auto w-full overflow-visible"
          >
            <defs>
              <linearGradient id="scent-dna-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--aura-1)', stopOpacity: 0.7 }} />
                <stop offset="100%" style={{ stopColor: 'var(--aura-2)', stopOpacity: 0.55 }} />
              </linearGradient>
            </defs>

            {/* Esagoni concentrici */}
            {RINGS.map((ring) => (
              <path
                key={ring}
                d={toPath(SCENT_AXES.map((_, i) => pointAt(i, radiusFor(ring))))}
                fill="none"
                stroke="rgba(246,239,228,0.10)"
                strokeWidth={ring === 100 ? 1.2 : 1}
              />
            ))}

            {/* Assi */}
            {SCENT_AXES.map((axis, i) => {
              const [x, y] = pointAt(i, RADIUS);
              return (
                <line
                  key={axis.key}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  stroke="rgba(246,239,228,0.08)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Area: compare mentre il contorno si disegna */}
            <motion.path
              key={`fill-${polygon}`}
              d={polygon}
              style={{ fill: 'url(#scent-dna-fill)' }}
              initial={draw ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={draw ? { duration: 0.5, delay: 0.45, ease: 'easeOut' } : { duration: 0 }}
            />

            {/* Contorno: si disegna progressivamente in 800ms */}
            <motion.path
              key={`line-${polygon}`}
              d={polygon}
              pathLength={1}
              style={{ fill: 'none', stroke: 'var(--aura-1)', strokeDasharray: 1 }}
              strokeWidth={2}
              strokeLinejoin="round"
              initial={draw ? { strokeDashoffset: 1 } : false}
              animate={{ strokeDashoffset: 0 }}
              transition={draw ? { duration: 0.8, ease: 'easeInOut' } : { duration: 0 }}
            />

            {/* Vertici */}
            {SCENT_AXES.map((axis, i) => {
              const [x, y] = pointAt(i, radiusFor(dna.radar[axis.key]));
              return (
                <motion.circle
                  key={`${axis.key}-${polygon}`}
                  cx={x}
                  cy={y}
                  r={3.2}
                  style={{ fill: 'var(--aura-1)' }}
                  initial={draw ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={draw ? { duration: 0.3, delay: 0.7 } : { duration: 0 }}
                />
              );
            })}

            {/* Etichette */}
            {SCENT_AXES.map((axis, i) => {
              const a = angleFor(i);
              const lx = CX + LABEL_RADIUS * Math.cos(a);
              const ly = CY + LABEL_RADIUS * Math.sin(a);
              const cos = Math.cos(a);
              const sin = Math.sin(a);
              const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
              const blockTop = ly - 36 * ((1 - sin) / 2);
              const words = axis.label.split(' ');

              return (
                <text key={axis.key} textAnchor={anchor} className="font-mono">
                  {words.map((word, w) => (
                    <tspan
                      key={word}
                      x={lx}
                      y={blockTop + 10 + w * 12}
                      fill="#B8A9C9"
                      fontSize={10}
                      letterSpacing="0.08em"
                      style={{ textTransform: 'uppercase' }}
                    >
                      {word}
                    </tspan>
                  ))}
                  <tspan
                    x={lx}
                    y={blockTop + 10 + words.length * 12}
                    fontSize={11}
                    fontWeight={700}
                    style={{ fill: 'var(--aura-1)' }}
                  >
                    {dna.rawPercent[axis.key]}%
                  </tspan>
                </text>
              );
            })}
          </svg>

          {/* Archetipo al centro del radar */}
          <div
            style={{ top: `${(CY / VIEW_H) * 100}%`, left: '50%' }}
            className="pointer-events-none absolute w-[36%] -translate-x-1/2 -translate-y-1/2 text-center"
          >
            {archetype ? (
              <h3
                style={{ textShadow: '0 2px 14px rgba(5,3,8,0.95), 0 0 4px rgba(5,3,8,0.9)' }}
                className="font-serif text-lg leading-tight text-[#F6EFE4] sm:text-xl"
              >
                {archetype.archetipo}
              </h3>
            ) : (
              <span
                style={{ textShadow: '0 2px 10px rgba(5,3,8,0.95)' }}
                className={`font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6EFE4]/80 ${
                  isGenerating ? 'animate-pulse motion-reduce:animate-none' : ''
                }`}
              >
                {isGenerating ? 'Lettura…' : 'Il tuo DNA'}
              </span>
            )}
          </div>
        </div>

        {/* Narrazione */}
        <div className="mt-5 space-y-4" aria-live="polite">
          {archetype ? (
            <p className="text-center text-[15px] leading-[1.85] text-[#F6EFE4]">
              {archetype.descrizione}
            </p>
          ) : (
            isGenerating && (
              <div className="space-y-2.5 px-4">
                <div className="aura-skeleton mx-auto h-3 w-full rounded-full" />
                <div className="aura-skeleton mx-auto h-3 w-[92%] rounded-full" />
                <div className="aura-skeleton mx-auto h-3 w-[70%] rounded-full" />
              </div>
            )
          )}

          {status === 'error' && (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage ?? 'Non sono riuscito a leggere il tuo DNA olfattivo.'}</span>
              </div>
              <button
                type="button"
                onClick={() => void generate(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-300/40 px-4 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/15"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Riprova
              </button>
            </div>
          )}

          {archetype && (
            <div className="flex justify-end">
              <div
                style={{ borderColor: `${aura.primary}40` }}
                className="inline-flex max-w-[94%] items-start gap-2 rounded-2xl border bg-[#161024] px-3 py-2"
              >
                <Lightbulb style={{ color: aura.primary }} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] leading-snug text-[#B8A9C9]">{archetype.consiglio}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
