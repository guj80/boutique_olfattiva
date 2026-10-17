'use client';

import React from 'react';
import { FlaskConical } from 'lucide-react';

interface BottlePedestalProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function BottlePedestal({ src, alt = 'Profumo', size = 'md', className = '' }: BottlePedestalProps) {
  const sizeClasses = {
    sm: 'h-14 w-14 rounded-[16px]',
    md: 'h-24 w-24 rounded-[22px]',
    lg: 'h-40 w-32 rounded-[28px]',
    xl: 'h-64 w-52 rounded-[36px]',
  }[size];

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border border-[#D8B995]/20 bg-gradient-to-b from-[#1E1428] to-[#120A1A] shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)] ${sizeClasses} ${className}`}
    >
      {/* Alone luminoso di profondità */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,185,149,0.08)_0%,transparent_70%)] pointer-events-none" />

      {src ? (
        <div className="relative z-10 h-full w-full p-2 flex items-center justify-center">
          {/* Immagine originale preservata al 100% nella compressione, con vignettatura morbida per azzerare lo stacco dello sfondo */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-105"
            style={{
              maskImage: 'radial-gradient(circle at center, black 65%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 65%, transparent 100%)',
            }}
          />
        </div>
      ) : (
        <FlaskConical className={`${iconSizes} text-[#D8B995]/60 transition-transform duration-500 hover:scale-110`} />
      )}
    </div>
  );
}

export function SmartBottleImage({ src, alt = 'Profumo', className = '' }: { src?: string | null; alt?: string; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[14px] bg-[#140D1C]/80 p-1 border border-white/10 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain drop-shadow-md"
          style={{
            maskImage: 'radial-gradient(circle at center, black 70%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 70%, transparent 100%)',
          }}
        />
      ) : (
        <FlaskConical className="h-5 w-5 text-[#D8B995]/60" />
      )}
    </div>
  );
}
