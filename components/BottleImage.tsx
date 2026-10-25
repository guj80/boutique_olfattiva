'use client';

import React, { useState } from 'react';
import { Logo } from './Logo';

interface BottlePedestalProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  iconSize?: string;
  className?: string;
  showSigil?: boolean;
  bare?: boolean;
}

const SIZE_MAP = {
  sm: {
    wrapper: 'h-24 w-24 p-2',
    sigil: 'h-6 w-6 bottom-1.5 right-1.5',
  },
  md: {
    wrapper: 'h-48 w-full p-4',
    sigil: 'h-8 w-8 bottom-2.5 right-2.5',
  },
  lg: {
    wrapper: 'h-64 w-full p-6',
    sigil: 'h-10 w-10 bottom-3 right-3',
  },
  xl: {
    wrapper: 'h-80 w-full p-8',
    sigil: 'h-12 w-12 bottom-4 right-4',
  },
};

export function BottlePedestal({
  src,
  alt,
  size = 'md',
  className = '',
  showSigil = false,
  bare = false,
}: BottlePedestalProps) {
  const [imgError, setImgError] = useState(false);
  const cfg = SIZE_MAP[size] ?? SIZE_MAP.md;

  const hasValidImage = Boolean(
    src &&
      /^https?:\/\//i.test(src.trim()) &&
      !imgError
  );

  if (bare) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
        {hasValidImage ? (
          <img
            src={src!.trim()}
            alt={alt}
            loading="lazy"
            onError={() => setImgError(true)}
            className="relative z-10 h-full w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            aria-label={alt ? `Immagine non disponibile: ${alt}` : 'Immagine non disponibile'}
            className="h-full w-full"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06)_0%,rgba(5,3,8,0.92)_80%)] ${cfg.wrapper} ${className}`}
    >
      {hasValidImage ? (
        <>
          <img
            src={src!.trim()}
            alt={alt}
            loading="lazy"
            onError={() => setImgError(true)}
            className="relative z-10 h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-transform duration-500 group-hover:scale-105"
          />

          {showSigil && (
            <div
              title="Pezzo in Collezione"
              aria-hidden="true"
              className={`pointer-events-none absolute z-20 flex items-center justify-center rounded-full border border-white/15 bg-[#050308]/90 p-1 shadow-[0_4px_14px_rgba(0,0,0,0.9)] backdrop-blur-md ${cfg.sigil}`}
            >
              <Logo className="h-full w-full" />
            </div>
          )}
        </>
      ) : (
        <div
          aria-label={alt ? `Immagine non disponibile: ${alt}` : 'Immagine non disponibile'}
          className="h-full w-full"
        />
      )}
    </div>
  );
}

export const SmartBottleImage = BottlePedestal;
