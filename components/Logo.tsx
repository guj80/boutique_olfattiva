'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  variant?: string;
}

const LUMA_FILTER_ID = 'lg-luma-to-alpha';

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-16 w-16',
    xl: 'h-44 w-44 sm:h-52 sm:w-52',
  };

  return (
    <div
      style={{
        WebkitMaskImage: 'radial-gradient(circle at center, black 62%, transparent 98%)',
        maskImage: 'radial-gradient(circle at center, black 62%, transparent 98%)',
      }}
      className={`relative flex items-center justify-center shrink-0 select-none ${sizeClasses[size]} ${className}`}
    >
      {/*
        Il nero del JPG diventa trasparenza reale: l'alpha deriva dalla
        luminosita' del pixel. Funziona su qualsiasi sfondo e dentro
        qualsiasi contenitore animato (a differenza del solo blend-mode,
        che non attraversa gli stacking context).
      */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
        style={{ position: 'absolute' }}
      >
        <filter id={LUMA_FILTER_ID} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1.12 0 0 0 0  0 1.12 0 0 0  0 0 1.12 0 0  0.51 1.72 0.17 0 -0.03"
          />
        </filter>
      </svg>
      <Image
        src="/LOGO_LG.jpg"
        alt="Atelier LG"
        fill
        sizes="(max-width: 768px) 180px, 240px"
        style={{ filter: `url(#${LUMA_FILTER_ID})` }}
        className="object-contain mix-blend-screen"
        priority
      />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** Numero di creazioni mostrato a destra nella barra compatta (es. 57 -> "57 CREAZIONI"). */
  count?: number;
  /** Etichetta personalizzata del conteggio. Di default CREAZIONE/CREAZIONI. */
  countLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  rightSlot,
  count,
  countLabel,
}: PageHeaderProps) {
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [barActive, setBarActive] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setBarActive(latest > 90);
  });

  // Transizioni fluide
  const titleOpacity = useTransform(scrollY, [0, 90], [1, 0]);
  const titleY = useTransform(scrollY, [0, 90], [0, -16]);
  const bigLogoOpacity = useTransform(scrollY, [0, 70], [1, 0]);
  const bigLogoScale = useTransform(scrollY, [0, 70], [1, 0.5]);
  const bigLogoX = useTransform(scrollY, [0, 70], [0, -48]);
  const barOpacity = useTransform(scrollY, [50, 120], [0, 1]);
  const barLogoX = useTransform(scrollY, [50, 120], [-16, 0]);

  // Versioni "a scatto" per prefers-reduced-motion (nessun movimento)
  const titleOpacityStep = useTransform(scrollY, [89, 90], [1, 0]);
  const barOpacityStep = useTransform(scrollY, [89, 90], [0, 1]);

  const countText =
    typeof count === 'number'
      ? `${count} ${countLabel ?? (count === 1 ? 'CREAZIONE' : 'CREAZIONI')}`
      : null;

  return (
    <>
      {/* Barra glassmorphism sticky: compare quando il titolo grande svanisce */}
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
          style={{ borderColor: `${aura.primary}30` }}
          className="absolute inset-0 border-b bg-[#08060C]/60 backdrop-blur-xl"
        />
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/"
            tabIndex={barActive ? 0 : -1}
            title="Torna alla Home"
            className="flex min-w-0 items-center gap-2.5"
          >
            <motion.div style={prefersReducedMotion ? undefined : { x: barLogoX }}>
              <Logo size="sm" />
            </motion.div>
            <span className="truncate font-serif text-lg tracking-tight text-[#F6EFE4]">
              {title}
            </span>
          </Link>

          {countText && (
            <span
              style={{ color: aura.primary }}
              className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.18em]"
            >
              {countText}
            </span>
          )}
        </div>
      </motion.div>

      {/* Header espanso */}
      <header
        style={{ borderColor: `${aura.primary}30` }}
        className="flex flex-col items-center border-b pb-6 text-center"
      >
        <motion.div
          style={
            prefersReducedMotion
              ? { opacity: titleOpacityStep }
              : { opacity: bigLogoOpacity, scale: bigLogoScale, x: bigLogoX }
          }
        >
          <Link
            href="/"
            title="Torna alla Home"
            className="group relative flex items-center justify-center transition-transform duration-300 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
          >
            <div
              style={{ backgroundColor: aura.primary }}
              className="absolute inset-0 rounded-full blur-xl opacity-20 transition-opacity duration-300 group-hover:opacity-40"
            />
            <Logo size="lg" />
          </Link>
        </motion.div>

        {subtitle && (
          <div
            style={{ borderColor: `${aura.primary}55`, backgroundColor: '#0E0A16' }}
            className="mt-4 inline-block rounded-md border px-2.5 py-0.5 shadow-sm"
          >
            <span
              style={{ color: aura.primary }}
              className="block font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
            >
              {subtitle}
            </span>
          </div>
        )}

        <motion.div
          style={
            prefersReducedMotion
              ? { opacity: titleOpacityStep }
              : { opacity: titleOpacity, y: titleY }
          }
          className={subtitle ? 'mt-2' : 'mt-4'}
        >
          <h1 className="font-serif text-4xl tracking-tight text-[#F6EFE4] sm:text-5xl">
            {title}
          </h1>
          {countText && (
            <p
              style={{ color: aura.primary }}
              className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em]"
            >
              {countText}
            </p>
          )}
        </motion.div>

        {rightSlot && <div className="mt-5 flex justify-center">{rightSlot}</div>}
      </header>
    </>
  );
}
