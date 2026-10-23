'use client';

import React, { useId } from 'react';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  /**
   * 'original' | 'default' | 'bicolor' = Colori originali bicolore (Smeraldo + Magenta/Viola) per Splash, Home e Sigillo
   * 'black' | 'mono' = Scultura scura ad alto contrasto con bordo luminoso del colore tema per le schermate interne
   */
  variant?: 'original' | 'bicolor' | 'black' | 'mono' | 'default';
}

export function Logo({ className = 'h-16', variant = 'original' }: LogoProps) {
  const { aura } = useAura();
  const rawId = useId().replace(/:/g, '');
  const mainGradId = `lg-orig-main-${rawId}`;
  const rimGradId = `lg-orig-rim-${rawId}`;
  const darkBodyGradId = `lg-dark-body-${rawId}`;
  const themeStrokeGradId = `lg-theme-stroke-${rawId}`;

  const isOriginal =
    variant === 'original' || variant === 'bicolor' || variant === 'default';
  const themeColor = aura.primary || '#10B981';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      {/* Alone luminoso calibrato per staccare sempre il logo dallo sfondo */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-full blur-2xl transition-all duration-700"
        style={{
          background: isOriginal
            ? 'radial-gradient(circle at 50% 45%, rgba(42,245,152,0.42) 0%, rgba(236,72,153,0.28) 58%, transparent 82%)'
            : `radial-gradient(circle at 50% 50%, ${themeColor}66 0%, ${themeColor}22 58%, transparent 82%)`,
        }}
      />

      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-full w-auto overflow-visible transition-all duration-700"
        style={{
          filter: isOriginal
            ? 'drop-shadow(0 0 16px rgba(42, 245, 152, 0.55)) drop-shadow(3px 0 10px rgba(236, 72, 153, 0.42))'
            : `drop-shadow(0 0 12px ${themeColor}88) drop-shadow(0 2px 6px rgba(0,0,0,0.95))`,
        }}
        aria-label="Logo LG"
      >
        <defs>
          <linearGradient
            id={mainGradId}
            x1="20"
            y1="20"
            x2="210"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#34F5A6" />
            <stop offset="60%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient
            id={rimGradId}
            x1="40"
            y1="20"
            x2="220"
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="50%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          <linearGradient
            id={darkBodyGradId}
            x1="30"
            y1="20"
            x2="200"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#261C38" />
            <stop offset="55%" stopColor="#140D1C" />
            <stop offset="100%" stopColor="#09060E" />
          </linearGradient>

          <linearGradient
            id={themeStrokeGradId}
            x1="20"
            y1="20"
            x2="220"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F6EFE4" />
            <stop offset="35%" stopColor={themeColor} />
            <stop offset="100%" stopColor={themeColor} />
          </linearGradient>
        </defs>

        {isOriginal ? (
          <>
            {/* Livello secondario Magenta/Viola */}
            <g transform="translate(4, 2.5)" opacity="0.92">
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

            {/* Livello principale Smeraldo con micro-filo di luce */}
            <g
              fill={`url(#${mainGradId})`}
              stroke="rgba(246, 239, 228, 0.35)"
              strokeWidth="1"
              strokeLinejoin="round"
            >
              <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
              <polygon points="94,72 132,72 94,82" />
              <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
              <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
              <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
              <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
            </g>
          </>
        ) : (
          /* Versione per la Banda Superiore dei Tab: corpo scuro vellutato + filo neon nitido del colore sezione */
          <>
            <g transform="translate(2.5, 2)" opacity="0.45" fill={themeColor}>
              <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
              <polygon points="94,72 132,72 94,82" />
              <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
              <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
              <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
              <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
            </g>
            <g
              fill={`url(#${darkBodyGradId})`}
              stroke={`url(#${themeStrokeGradId})`}
              strokeWidth="3.2"
              strokeLinejoin="round"
            >
              <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
              <polygon points="94,72 132,72 94,82" />
              <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
              <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
              <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
              <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
