'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Se true, attiva un sottile bagliore ambientale legato all'aura attiva */
  glow?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-44 w-44 sm:h-52 sm:w-52',
};

/**
 * Monogramma vettoriale ufficiale Atelier LG.
 * Riproduce fedelmente le geometrie sfaccettate del flacone-monogramma
 * adattando il gradiente interno alle variabili CSS dell'Aura attiva.
 */
export function Logo({ className = '', size = 'md', glow = false }: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradMainId = `lg-grad-${uid}`;
  const gradCapId = `lg-cap-${uid}`;
  const sheenId = `lg-sheen-${uid}`;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {glow && (
        <span
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--aura-1) 42%, transparent) 0%, transparent 70%)',
          }}
          className="pointer-events-none absolute -inset-2 rounded-full blur-md"
        />
      )}

      <svg
        viewBox="0 0 200 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Atelier LG"
        className="relative h-full w-full overflow-visible"
      >
        <defs>
          {/* Gradiente principale del corpo flacone/monogramma: Aura 1 -> Champagne -> Aura 2 */}
          <linearGradient id={gradMainId} x1="30" y1="58" x2="170" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0%" style={{ stopColor: 'var(--aura-1)' }} />
            <stop
              offset="52%"
              style={{
                stopColor: 'color-mix(in srgb, var(--aura-1) 58%, #F6EFE4)',
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: 'color-mix(in srgb, var(--aura-2) 72%, var(--aura-1))',
              }}
            />
          </linearGradient>

          {/* Gradiente del tappo asimmetrico: luminosita' pura di Aura 1 + avorio */}
          <linearGradient id={gradCapId} x1="60" y1="14" x2="148" y2="54" gradientUnits="userSpaceOnUse">
            <stop
              offset="0%"
              style={{
                stopColor: 'color-mix(in srgb, var(--aura-1) 75%, #F6EFE4)',
              }}
            />
            <stop offset="100%" style={{ stopColor: 'var(--aura-1)' }} />
          </linearGradient>

          {/* Riflesso interno sottile sui tagli geometrici */}
          <linearGradient id={sheenId} x1="100" y1="14" x2="100" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        {/* 1. Tappo inclinato superiore (poligono cavo con taglio interno) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M61 28 L145 14 L132 46 L124 44 L131 24 L76 33 L103 44 L91 49 L61 28 Z"
          fill={`url(#${gradCapId})`}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M61 28 L145 14 L132 46 L124 44 L131 24 L76 33 L103 44 L91 49 L61 28 Z"
          fill={`url(#${sheenId})`}
        />

        {/* 2. Colletto / atomizzatore sottile */}
        <polygon points="87,51 118,51 87,59" fill={`url(#${gradCapId})`} />

        {/* 3. Spalla sinistra sfaccettata */}
        <polygon
          points="54,67 54,82 40,95 57,178 30,93"
          fill={`url(#${gradMainId})`}
          opacity="0.92"
        />

        {/* 4. Spalla destra sfaccettata */}
        <polygon
          points="146,67 170,93 143,178 160,95 146,82"
          fill={`url(#${gradMainId})`}
          opacity="0.92"
        />

        {/* 5. Lettera L strutturale (asta verticale + base orizzontale) */}
        <polygon
          points="64,67 79,67 79,179 134,179 144,193 64,193"
          fill={`url(#${gradMainId})`}
        />

        {/* 6. Lettera G incastrata con taglio diagonale */}
        <polygon
          points="89,67 141,67 127,81 104,81 104,132 146,184 146,133 128,133 116,120 159,120 159,195 148,195 89,137"
          fill={`url(#${gradMainId})`}
        />

        {/* Velatura speculare su corpo L + G */}
        <polygon
          points="64,67 79,67 79,179 134,179 144,193 64,193"
          fill={`url(#${sheenId})`}
        />
        <polygon
          points="89,67 141,67 127,81 104,81 104,132 146,184 146,133 128,133 116,120 159,120 159,195 148,195 89,137"
          fill={`url(#${sheenId})`}
        />
      </svg>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** Numero di creazioni mostrato nella pillola contatore */
  count?: number;
  /** Etichetta personalizzata del conteggio (default: CREAZIONE / CREAZIONI) */
  countLabel?: string;
  /** 'editorial' (default: impianto asimmetrico di sala regia) | 'compact' (barra snella per gallerie/tool) */
  variant?: 'editorial' | 'compact';
}

export function PageHeader({
  title,
  subtitle,
  rightSlot,
  count,
  countLabel,
  variant = 'editorial',
}: PageHeaderProps) {
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [barActive, setBarActive] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setBarActive(latest > 72);
  });

  const headerOpacity = useTransform(scrollY, [0, 75], [1, 0]);
  const headerY = useTransform(scrollY, [0, 75], [0, -10]);
  const barOpacity = useTransform(scrollY, [40, 95], [0, 1]);

  const headerOpacityStep = useTransform(scrollY, [71, 72], [1, 0]);
  const barOpacityStep = useTransform(scrollY, [71, 72], [0, 1]);

  const countText =
    typeof count === 'number'
      ? `${count} ${countLabel ?? (count === 1 ? 'CREAZIONE' : 'CREAZIONI')}`
      : null;

  const isCompact = variant === 'compact';

  return (
    <>
      {/* Barra glassmorphism sticky: emerge quando si scorre */}
      <motion.div
        style={{
          opacity: prefersReducedMotion ? barOpacityStep : barOpacity,
          pointerEvents: barActive ? 'auto' : 'none',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        aria-hidden={!barActive}
        className="fixed inset-x-0 top-0 z-30"
      >
        <div
          aria-hidden="true"
          style={{ borderColor: `${aura.primary}28` }}
          className="absolute inset-0 border-b bg-[#08060C]/75 backdrop-blur-xl"
        />
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            tabIndex={barActive ? 0 : -1}
            title="Torna all'Atelier"
            className="flex min-w-0 items-center gap-3"
          >
            <Logo size="sm" />
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="truncate font-serif text-lg tracking-tight text-[#F6EFE4]">
                {title}
              </span>
              {subtitle && (
                <span
                  style={{ color: aura.primary }}
                  className="hidden sm:inline font-mono text-[9px] uppercase tracking-[0.22em] opacity-80"
                >
                  {subtitle}
                </span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-3 shrink-0">
            {countText && (
              <span
                style={{ color: aura.primary, borderColor: `${aura.primary}35` }}
                className="rounded-full border bg-[#0E0A16]/90 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
              >
                {countText}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Header principale: impianto editoriale asimmetrico, zero ingombro verticale inutile */}
      <motion.header
        style={
          prefersReducedMotion
            ? { opacity: headerOpacityStep, borderColor: `${aura.primary}28` }
            : { opacity: headerOpacity, y: headerY, borderColor: `${aura.primary}28` }
        }
        className={`relative border-b ${isCompact ? 'pb-4' : 'pb-6'}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* Blocco sinistro: Monogramma + Gerarchia tipografica */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <Link
              href="/"
              title="Torna all'Atelier"
              className="group relative flex items-center justify-center rounded-2xl border border-white/[0.07] bg-[#0E0A16]/90 p-2.5 shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 motion-reduce:transition-none"
              style={{
                boxShadow: `0 8px 28px -10px color-mix(in srgb, var(--aura-1) 45%, transparent)`,
              }}
            >
              <Logo size={isCompact ? 'sm' : 'md'} glow />
            </Link>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {subtitle && (
                  <span
                    style={{ color: aura.primary }}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]"
                  >
                    {subtitle}
                  </span>
                )}
                {subtitle && countText && (
                  <span className="text-white/20 text-[10px]" aria-hidden="true">
                    •
                  </span>
                )}
                {countText && (
                  <span
                    style={{ borderColor: `${aura.primary}40`, color: '#F6EFE4' }}
                    className="inline-flex items-center rounded-full border bg-[#0E0A16] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                  >
                    {countText}
                  </span>
                )}
              </div>

              <h1
                className={`font-serif tracking-tight text-[#F6EFE4] leading-[1.05] ${
                  isCompact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
                }`}
              >
                {title}
              </h1>
            </div>
          </div>

          {/* Blocco destro: Azioni contestuali allineate alla base del titolo */}
          {rightSlot && (
            <div className="flex items-center justify-start sm:justify-end shrink-0">
              {rightSlot}
            </div>
          )}
        </div>
      </motion.header>
    </>
  );
}
