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
  glow?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-9 w-8',
  md: 'h-12 w-10',
  lg: 'h-16 w-14',
  xl: 'h-48 w-40 sm:h-56 sm:w-48',
};

/**
 * Monogramma vettoriale ufficiale Atelier LG (coordinate originali SVG).
 * Finitura platino-argento satinato su sfondo 100% trasparente:
 * si armonizza con qualsiasi Aura senza alcun bordo o riquadro nero.
 */
export function Logo({ className = '', size = 'md', glow = false }: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `lg-platinum-${uid}`;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {glow && (
        <span
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--aura-1) 38%, transparent) 0%, transparent 72%)',
          }}
          className="pointer-events-none absolute -inset-2 rounded-full blur-md"
        />
      )}

      <svg
        viewBox="220 205 1216 1455"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Atelier LG"
        className="relative h-full w-full overflow-visible drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
      >
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="300"
            y1="200"
            x2="1300"
            y2="1650"
          >
            <stop offset="0" stopColor="#F7F9FA" />
            <stop offset="0.45" stopColor="#B7C2CB" />
            <stop offset="0.7" stopColor="#EEF2F4" />
            <stop offset="1" stopColor="#7F8D98" />
          </linearGradient>
        </defs>

        <g fill={`url(#${gradId})`}>
          {/* Tappo geometrico superiore */}
          <polygon points="477,343 1184,220 1003,519 1030,343" />
          <polygon points="477,343 625,452 877,518 587,519" />
          {/* Colletto atomizzatore */}
          <polygon points="680,552 926,553 680,620" />
          {/* Spalla sinistra */}
          <polygon points="459,675 238,823 459,1520 459,1175 372,865 459,805" />
          {/* Spalla destra */}
          <polygon points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805" />
          {/* Lettera L */}
          <polygon points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640" />
          {/* Lettera G */}
          <polygon points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230" />
        </g>
      </svg>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  count?: number;
  countLabel?: string;
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
      {/* Barra glassmorphism sticky allo scroll */}
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
          className="absolute inset-0 border-b bg-[#08060C]/80 backdrop-blur-xl"
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
                <span className="hidden sm:inline font-mono text-[9px] uppercase tracking-[0.22em] text-[#F6EFE4]/70">
                  {subtitle}
                </span>
              )}
            </div>
          </Link>

          {countText && (
            <span
              style={{ borderColor: `${aura.primary}45` }}
              className="shrink-0 rounded-full border bg-[#0E0A16]/90 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#F6EFE4]"
            >
              {countText}
            </span>
          )}
        </div>
      </motion.div>

      {/* Header principale senza scatole nere intorno al logo */}
      <motion.header
        style={
          prefersReducedMotion
            ? { opacity: headerOpacityStep, borderColor: `${aura.primary}25` }
            : { opacity: headerOpacity, y: headerY, borderColor: `${aura.primary}25` }
        }
        className={`relative border-b ${isCompact ? 'pb-4' : 'pb-6'}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <Link
              href="/"
              title="Torna all'Atelier"
              className="group relative flex items-center justify-center transition-transform duration-300 hover:scale-105 active:scale-95 motion-reduce:transition-none"
            >
              <Logo size={isCompact ? 'md' : 'lg'} glow />
            </Link>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {subtitle && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#F6EFE4]/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                    {subtitle}
                  </span>
                )}
                {subtitle && countText && (
                  <span className="text-[#F6EFE4]/40 text-[10px]" aria-hidden="true">
                    •
                  </span>
                )}
                {countText && (
                  <span
                    style={{ borderColor: `${aura.primary}45` }}
                    className="inline-flex items-center rounded-full border bg-[#08060C]/75 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F6EFE4] backdrop-blur-sm"
                  >
                    {countText}
                  </span>
                )}
              </div>

              <h1
                className={`font-serif tracking-tight text-[#F6EFE4] leading-[1.05] drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] ${
                  isCompact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
                }`}
              >
                {title}
              </h1>
            </div>
          </div>

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
