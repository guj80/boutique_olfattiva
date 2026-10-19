'use client';

import React, { useState } from 'react';
import { Logo } from './Logo';

interface BottlePedestalProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSigil?: boolean;
}

const SIZE_MAP = {
  sm: {
    wrapper: 'h-24 w-24 p-2',
    sigil: 'h-6 w-6 bottom-1.5 right-1.5',
    fallbackLogo: 'h-12',
  },
  md: {
    wrapper: 'h-48 w-full p-4',
    sigil: 'h-8 w-8 bottom-2.5 right-2.5',
    fallbackLogo: 'h-20',
  },
  lg: {
    wrapper: 'h-64 w-full p-6',
    sigil: 'h-10 w-10 bottom-3 right-3',
    fallbackLogo: 'h-28',
  },
};

export function BottlePedestal({
  src,
  alt,
  size = 'md',
  className = '',
  showSigil = true,
}: BottlePedestalProps) {
  const [imgError, setImgError] = useState(false);
  const cfg = SIZE_MAP[size] || SIZE_MAP.md;
  const hasValidImage = Boolean(src && src.trim().startsWith('http') && !imgError);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06)_0%,rgba(5,3,8,0.92)_80%)] border border-white/10 ${cfg.wrapper} ${className}`}
    >
      {hasValidImage ? (
        <>
          <img
            src={src!}
            alt={alt}
            loading="lazy"
            onError={() => setImgError(true)}
            className="relative z-10 h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-transform duration-500 group-hover:scale-105"
          />
          {showSigil && (
            <div
              title="Pezzo in Collezione"
              className={`pointer-events-none absolute z-20 flex items-center justify-center rounded-full bg-[#050308]/90 border border-white/15 p-1 shadow-[0_4px_14px_rgba(0,0,0,0.9)] backdrop-blur-md ${cfg.sigil}`}
            >
              <Logo variant="original" className="h-full w-full" />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <Logo variant="original" className={cfg.fallbackLogo} />
        </div>
      )}
    </div>
  );
}

// Alias esportato per retrocompatibilità totale con app/diario/page.tsx
export const SmartBottleImage = BottlePedestal;
