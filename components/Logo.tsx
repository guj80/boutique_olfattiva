'use client';

import React, { useId } from 'react';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  /**
   * 'original' = Colori originali bicolore (Smeraldo + Magenta/Viola) per Splash, Home e Sigillo Collezione
   * 'black'    = Nero ossidiana extra-dark con micro-contorno del colore tema per le schermate interne
   */
  variant?: 'original' | 'bicolor' | 'black' | 'mono';
}

export function Logo({ className = 'h-16', variant = 'original' }: LogoProps) {
  const { aura } = useAura();
  const rawId = useId().replace(/:/g, '');
  const mainGradId = `lg-orig-main-${rawId}`;
  const rimGradId = `lg-orig-rim-${rawId}`;
  const blackGradId = `lg-black-body-${rawId}`;

  // 'original' e 'bicolor' usano il colore originale; 'black' e 'mono' usano la versione Black su alone del tema
  const isOriginal = variant === 'original' || variant === 'bicolor';
  const themeColor = aura.primary;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Alone posteriore: bicolore originale in Home/Splash, oppure alone del colore tema sotto il logo Black */}
      <div
        className="pointer-events-none absolute -inset-5 rounded-full blur-2xl transition-all duration-700"
        style={{
          background: isOriginal
            ? 'radial-gradient(circle at 50% 45%, rgba(16,245,156,0.34) 0%, rgba(236,72,153,0.22) 60%, transparent 80%)'
            : `radial-gradient(circle at 50% 50%, ${themeColor}55 0%, ${themeColor}20 55%, transparent 78%)`,
        }}
      />

      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-full w-auto overflow-visible transition-all duration-700"
        style={{
          filter: isOriginal
            ? 'drop-shadow(0 0 12px rgba(16, 245, 156, 0.42)) drop-shadow(2px 0 8px rgba(236, 72, 153, 0.32))'
            : `drop-shadow(0 0 10px ${themeColor}75) drop-shadow(0 2px 6px rgba(0,0,0,0.95))`,
        }}
        aria-label="Logo LG"
      >
        <defs>
          {/* Gradiente Originale Smeraldo */}
          <linearGradient id={mainGradId} x1="20" y1="20" x2="210" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2AF598" />
            <stop offset="65%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Gradiente Originale Magenta/Viola */}
          <linearGradient id={rimGradId} x1="40" y1="20" x2="220" y2="210" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          {/* Gradiente Nero Ossidiana per le schermate interne */}
          <linearGradient id={blackGradId} x1="30" y1="20" x2="200" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14101D" />
            <stop offset="50%" stopColor="#07050C" />
            <stop offset="100%" stopColor="#020104" />
          </linearGradient>
        </defs>

        {isOriginal ? (
          <>
            {/* Livello secondario Magenta/Viola (Colore Originale) */}
            <g transform="translate(3.5, 2)" opacity="0.85">
              <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" fill={`url(#${rimGradId})`} />
              <polygon points="94,72 132,72 94,82" fill={`url(#${rimGradId})`} />
              <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" fill={`url(#${rimGradId})`} />
              <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" fill={`url(#${rimGradId})`} />
              <path d="M70 86 H86 V202 H130 L146 218 H70 Z" fill={`url(#${rimGradId})`} />
              <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" fill={`url(#${rimGradId})`} />
            </g>

            {/* Livello principale Smeraldo (Colore Originale) */}
            <g fill={`url(#${mainGradId})`}>
              <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
              <polygon points="94,72 132,72 94,82" />
              <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
              <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
              <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
              <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
            </g>
          </>
        ) : (
          /* Versione BLACK per i tab interni con alone del colore del tema */
          <g
            fill={`url(#${blackGradId})`}
            stroke={themeColor}
            strokeWidth="2.4"
            strokeLinejoin="round"
          >
            <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
            <polygon points="94,72 132,72 94,82" />
            <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
            <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
            <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
            <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
          </g>
        )}
      </svg>
    </div>
  );
}
