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
    sm: 'h-16 w-16',
    md: 'h-28 w-24',
    lg: 'h-52 w-full',
    xl: 'h-72 w-60',
  }[size];

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }[size];

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-transparent ${sizeClasses} ${className}`}>
      {/* Alone cromatico reattivo di sottofondo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,185,149,0.18)_0%,transparent_75%)] pointer-events-none" />

      {src ? (
        <div className="relative z-10 h-full w-full p-2 flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
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
        <img src={src} alt={alt} className="h-full w-full object-contain drop-shadow-md" />
      ) : (
        <FlaskConical className={`${iconSize} text-[#D8B995]/60`} />
      )}
    </div>
  );
}
