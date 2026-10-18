'use client';

import React, { useId } from 'react';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  variant?: 'bicolor' | 'mono';
}

export function Logo({ className = 'h-16', variant = 'mono' }: LogoProps) {
  const { aura } = useAura();
  const rawId = useId().replace(/:/g, '');
  const mainGradId = `lg-main-${rawId}`;
  const rimGradId = `lg-rim-${rawId}`;

  const isBicolor = variant === 'bicolor';
  const monoColor = aura.primary;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Bagliore diffuso posteriore libero da qualsiasi cornice */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-full blur-2xl transition-all duration-700"
        style={{
          background: isBicolor
            ? 'radial-gradient(circle at 50% 45%, rgba(16,245,156,0.32) 0%, rgba(236,72,153,0.22) 55%, transparent 78%)'
            : `radial-gradient(circle at 50% 50%, ${monoColor}40 0%, transparent 75%)`,
        }}
      />

      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-full w-auto overflow-visible transition-all duration-700"
        style={{
          filter: isBicolor
            ? 'drop-shadow(0 0 14px rgba(16, 245, 156, 0.45)) drop-shadow(3px 0 10px rgba(236, 72, 153, 0.35))'
            : `drop-shadow(0 0 12px ${monoColor}65)`,
        }}
        aria-label="Logo LG"
      >
        <defs>
          <linearGradient id={mainGradId} x1="20" y1="20" x2="210" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2AF598" />
            <stop offset="65%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id={rimGradId} x1="40" y1="20" x2="220" y2="210" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>

        {/* LIVELLO BORDATURA BICOLORE (Visibile in modalità bicolor per l'effetto neon originale) */}
        {isBicolor && (
          <g transform="translate(3.5, 2)" opacity="0.85">
            <path
              d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z"
              fill={`url(#${rimGradId})`}
            />
            <polygon points="94,72 132,72 94,82" fill={`url(#${rimGradId})`} />
            <path
              d="M62 88 L30 112 L68 202 L52 120 L62 112 Z"
              fill={`url(#${rimGradId})`}
            />
            <path
              d="M172 90 L200 112 L172 200 L184 120 L172 112 Z"
              fill={`url(#${rimGradId})`}
            />
            <path
              d="M70 86 H86 V202 H130 L146 218 H70 Z"
              fill={`url(#${rimGradId})`}
            />
            <path
              d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z"
              fill={`url(#${rimGradId})`}
            />
          </g>
        )}

        {/* LIVELLO PRINCIPALE SCULTOREO (Geometria esatta di image_f59ea3.png) */}
        <g fill={isBicolor ? `url(#${mainGradId})` : monoColor}>
          {/* 1. Tappo superiore asimmetrico a punta */}
          <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />

          {/* 2. Scheggia del collo intermedio */}
          <polygon points="94,72 132,72 94,82" />

          {/* 3. Ala laterale sinistra del flacone */}
          <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />

          {/* 4. Ala laterale destra del flacone */}
          <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />

          {/* 5. Lettera L scolpita a sinistra */}
          <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />

          {/* 6. Lettera G scolpita a destra con taglio diagonale interno */}
          <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
        </g>
      </svg>
    </div>
  );
}
