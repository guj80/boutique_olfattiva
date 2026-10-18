'use client';

import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useAura } from './AuraProvider';
import { Logo } from './Logo';

interface BottlePedestalProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSigil?: boolean;
}

export function BottlePedestal({
  src,
  alt = 'Flacone',
  size = 'md',
  className = '',
  showSigil = false,
}: BottlePedestalProps) {
  const { aura } = useAura();

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-28 w-24',
    lg: 'h-52 w-full',
    xl: 'h-72 w-64',
  }[size];

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-transparent ${sizeClasses}${className}`}
    >
      <div
        style={{
          background: `radial-gradient(circle at center, ${aura.primary}24 0%, transparent 72%)`,
        }}
        className="absolute inset-0 pointer-events-none transition-all duration-700"
      />

      {src ? (
        <div className="relative z-10 h-full w-full p-2 flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.85)] transition-transform duration-500 hover:scale-105"
          />
        </div>
      ) : (
        <FlaskConical
          style={{ color: aura.primary }}
          className={`${iconSizes} opacity-60 transition-transform duration-500`}
        />
      )}

      {/* Sigillo d'Autore vettoriale (Solo nella modale di dettaglio) */}
      {showSigil && (
        <div
          style={{ borderColor: `${aura.primary}45` }}
          className="absolute bottom-2 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border bg-[#0E0A14]/90 p-1.5 shadow-xl backdrop-blur-md"
        >
          <Logo variant="mono" className="h-full w-full" />
        </div>
      )}
    </div>
  );
}

interface SmartBottleImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconSize?: string;
}

export function SmartBottleImage({
  src,
  alt = 'Flacone',
  className = '',
  iconSize = 'h-5 w-5',
}: SmartBottleImageProps) {
  const { aura } = useAura();
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[14px] bg-[#0E0A14]/90 p-1.5 border border-white/10 ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain drop-shadow-md" />
      ) : (
        <FlaskConical style={{ color: aura.primary }} className={`${iconSize} opacity-60`} />
      )}
    </div>
  );
}
