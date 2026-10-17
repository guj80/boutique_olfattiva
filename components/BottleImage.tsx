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
      className={`relative flex items-center justify-center overflow-hidden border border-[#D8B995]/30 bg-gradient-to-b from-[#1E1428] via-[#140D1C] to-[#0A060F] shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] ${sizeClasses} ${className}`}
    >
      {/* Alone luminoso di profondità */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,185,149,0.12)_0%,transparent_75%)] pointer-events-none" />

      {src ? (
        <div className="relative z-10 h-full w-full p-3 flex items-center justify-center">
          {/* Maschera radiale morbida per fondere sfondi bianchi o colorati nel podio scuro */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:scale-105"
            style={{
              maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
            }}
          />
        </div>
      ) : (
        <FlaskConical className={`${iconSizes} text-[#D8B995]/60 transition-transform duration-500 hover:scale-110`} />
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

export function SmartBottleImage({ src, alt = 'Profumo', className = '', iconSize = 'h-5 w-5' }: SmartBottleImageProps) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[14px] bg-[#140D1C]/90 p-1.5 border border-white/10 ${className}`}>
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
        <FlaskConical className={`${iconSize} text-[#D8B995]/60`} />
      )}
    </div>
  );
}
