'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { normalizeFamily, getAuraForFamily } from '@/lib/families';

interface BottleImageProps {
  src?: string | null;
  alt: string;
  brand?: string | null;
  famiglia?: string | null;
  concentrazione?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getConcentrationCode(conc?: string | null): string {
  const c = (conc || '').toLowerCase();
  if (c.includes('extrait') || (c.includes('parfum') && !c.includes('eau'))) return 'EXTRAIT';
  if (c.includes('attar') || c.includes('oil') || c.includes('olio')) return 'ATTAR';
  if (c.includes('intense')) return 'EDP INTENSE';
  if (c.includes('eau de parfum') || c === 'edp') return 'EDP';
  if (c.includes('eau de toilette') || c === 'edt') return 'EDT';
  if (c.includes('cologne') || c === 'edc') return 'COLOGNE';
  return 'PARFUM';
}

function getBrandMonogram(brand?: string | null, alt?: string): string {
  const clean = (brand || alt || 'LG')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 3).toUpperCase() || 'LG';
}

/**
 * Flacone vettoriale scultoreo deterministico:
 * calibra silhouette, spessore del vetro, colore del jus e sigla della Maison
 * quando non è ancora presente una fotografia isolata del flacone.
 */
function SculpturalBottleSvg({
  alt,
  brand,
  famiglia,
  concentrazione,
}: {
  alt: string;
  brand?: string | null;
  famiglia?: string | null;
  concentrazione?: string | null;
}) {
  const design = useMemo(() => {
    const seed = hashString(`${brand || ''}::${alt}`);
    const canonicalFam = normalizeFamily(famiglia) || 'Ambrata';
    const palette = getAuraForFamily(canonicalFam);
    const concCode = getConcentrationCode(concentrazione);
    const monogram = getBrandMonogram(brand, alt);

    const isHeavyExtrait =
      concCode === 'EXTRAIT' || concCode === 'ATTAR' || seed % 3 === 0;
    const isMonolith = !isHeavyExtrait && seed % 3 === 1;

    const uid = `b-${seed.toString(36)}`;
    return { palette, concCode, monogram, isHeavyExtrait, isMonolith, uid };
  }, [alt, brand, famiglia, concentrazione]);

  const { palette, concCode, monogram, isHeavyExtrait, isMonolith, uid } = design;

  const body = isHeavyExtrait
    ? { x: 34, y: 66, w: 92, h: 112, rx: 14, capX: 58, capY: 28, capW: 44, capH: 30, capRx: 6 }
    : isMonolith
    ? { x: 42, y: 58, w: 76, h: 122, rx: 6, capX: 52, capY: 24, capW: 56, capH: 26, capRx: 3 }
    : { x: 44, y: 62, w: 72, h: 118, rx: 18, capX: 62, capY: 26, capW: 36, capH: 28, capRx: 8 };

  const juiceY = body.y + Math.round(body.h * 0.22);
  const juiceH = body.h - Math.round(body.h * 0.22) - 6;

  return (
    <svg
      viewBox="0 0 160 200"
      className="h-full w-full select-none transition-transform duration-500 group-hover:scale-105"
      style={{ filter: 'drop-shadow(0 18px 22px rgba(0, 0, 0, 0.8))' }}
      aria-label={alt}
    >
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#08060C" stopOpacity="0.55" />
        </linearGradient>

        <linearGradient id={`${uid}-juice`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.primary} stopOpacity="0.58" />
          <stop offset="65%" stopColor={palette.primary} stopOpacity="0.32" />
          <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.88" />
        </linearGradient>

        <linearGradient id={`${uid}-cap`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2A223A" />
          <stop offset="38%" stopColor="#4A3D63" />
          <stop offset="100%" stopColor="#140F1F" />
        </linearGradient>
      </defs>

      <rect
        x={body.capX}
        y={body.capY}
        width={body.capW}
        height={body.capH}
        rx={body.capRx}
        fill={`url(#${uid}-cap)`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
      />

      <rect
        x={68}
        y={body.capY + body.capH}
        width={24}
        height={body.y - (body.capY + body.capH)}
        fill="#1F192E"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.8"
      />

      <rect
        x={body.x}
        y={body.y}
        width={body.w}
        height={body.h}
        rx={body.rx}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(255,255,255,0.26)"
        strokeWidth="1.2"
      />

      <rect
        x={body.x + 5}
        y={juiceY}
        width={body.w - 10}
        height={juiceH}
        rx={Math.max(4, body.rx - 4)}
        fill={`url(#${uid}-juice)`}
      />

      <rect
        x={body.x + 8}
        y={body.y + 8}
        width={4}
        height={body.h - 16}
        rx={2}
        fill="#FFFFFF"
        opacity="0.16"
      />

      <rect
        x={body.x + 4}
        y={body.y + body.h - 10}
        width={body.w - 8}
        height={6}
        rx={3}
        fill="#FFFFFF"
        opacity="0.12"
      />

      <rect
        x={body.x + 14}
        y={body.y + Math.round(body.h * 0.28)}
        width={body.w - 28}
        height={Math.round(body.h * 0.42)}
        rx={4}
        fill="#0B0812"
        fillOpacity="0.84"
        stroke={palette.primary}
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />

      <text
        x="80"
        y={body.y + Math.round(body.h * 0.48)}
        textAnchor="middle"
        fill="#F6EFE4"
        fontSize="14"
        fontFamily="serif"
        letterSpacing="2.5"
      >
        {monogram}
      </text>

      <text
        x="80"
        y={body.y + Math.round(body.h * 0.61)}
        textAnchor="middle"
        fill={palette.primary}
        fontSize="6.5"
        fontFamily="monospace"
        letterSpacing="1.5"
      >
        {concCode}
      </text>
    </svg>
  );
}

export function BottleImage({
  src,
  alt,
  brand,
  famiglia,
  concentrazione,
  className = '',
  size = 'md',
}: BottleImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const sizeClasses = {
    sm: 'h-16 w-12',
    md: 'h-32 w-24',
    lg: 'h-48 w-36',
    xl: 'h-72 w-52',
  };

  if (!src || hasError) {
    return (
      <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
        <SculpturalBottleSvg
          alt={alt}
          brand={brand}
          famiglia={famiglia}
          concentrazione={concentrazione}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`object-contain select-none transition-transform duration-500 group-hover:scale-105 ${sizeClasses[size]} ${className}`}
      style={{
        filter: 'drop-shadow(0 18px 24px rgba(0, 0, 0, 0.78))',
      }}
      loading="lazy"
    />
  );
}

interface BottlePedestalProps {
  src?: string | null;
  alt: string;
  brand?: string | null;
  famiglia?: string | null;
  concentrazione?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSigil?: boolean;
  bare?: boolean;
  className?: string;
}

export function BottlePedestal({
  src,
  alt,
  brand,
  famiglia,
  concentrazione,
  size = 'lg',
  bare = false,
  className = '',
}: BottlePedestalProps) {
  if (bare) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
        <BottleImage
          src={src}
          alt={alt}
          brand={brand}
          famiglia={famiglia}
          concentrazione={concentrazione}
          size={size}
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-3xl p-4 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 rounded-full opacity-35 blur-2xl"
        style={{ backgroundColor: 'var(--aura-1)' }}
      />

      <BottleImage
        src={src}
        alt={alt}
        brand={brand}
        famiglia={famiglia}
        concentrazione={concentrazione}
        size={size}
        className="relative z-10 h-full w-full"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 h-3 w-24 rounded-full bg-black/75 blur-md"
      />
    </div>
  );
}
