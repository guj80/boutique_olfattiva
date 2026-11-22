'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface BottleImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function BottleImage({
  src,
  alt,
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
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#08060C]/60 backdrop-blur-md text-white/30 ${sizeClasses[size]} ${className}`}
      >
        <div className="h-2.5 w-5 rounded-t-sm border-x border-t border-white/20 mb-0.5" />
        <div className="flex h-1/2 w-3/5 flex-col items-center justify-center rounded-lg border border-white/15 bg-white/[0.02]">
          <Sparkles className="h-3.5 w-3.5 opacity-40" />
        </div>
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
        filter: 'drop-shadow(0 18px 24px rgba(0, 0, 0, 0.75))',
      }}
      loading="lazy"
    />
  );
}

interface BottlePedestalProps {
  src?: string | null;
  alt: string;
  size?: 'md' | 'lg' | 'xl';
  showSigil?: boolean;
  className?: string;
}

export function BottlePedestal({
  src,
  alt,
  size = 'lg',
  className = '',
}: BottlePedestalProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-3xl p-4 ${className}`}
    >
      {/* Bagliore uniforme dietro il flacone scontornato */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 rounded-full opacity-35 blur-2xl"
        style={{ backgroundColor: 'var(--aura-1)' }}
      />

      <BottleImage
        src={src}
        alt={alt}
        size={size}
        className="relative z-10 h-full w-full"
      />

      {/* Ombra di contatto uniforme alla base del flacone */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 h-3 w-24 rounded-full bg-black/75 blur-md"
      />
    </div>
  );
}
