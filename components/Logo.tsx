'use client';

import React from 'react';
import { useAura } from './AuraProvider';

export function Logo({
  className = 'h-16',
  monochrome = true,
}: {
  className?: string;
  monochrome?: boolean;
  showText?: boolean;
}) {
  const { aura } = useAura();
  const strokeColor = monochrome ? aura.primary : '#34D399';

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Bagliore diffuso posteriore senza alcuna cornice o gabbia */}
      <div
        style={{
          background: `radial-gradient(circle at center, ${strokeColor}45 0%, transparent 70%)`,
        }}
        className="pointer-events-none absolute -inset-4 blur-xl transition-colors duration-700"
      />

      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-full w-auto overflow-visible transition-all duration-700"
        style={{
          filter: `drop-shadow(0 0 12px ${strokeColor}55)`,
        }}
        aria-label="Logo LG"
      >
        {/* Tappo trapezoidale superiore con intaglio centrale */}
        <path
          d="M84 18 H116 L112 38 H88 Z"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Collo del flacone con fessura orizzontale */}
        <rect
          x="80"
          y="38"
          width="40"
          height="16"
          rx="4"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinejoin="round"
        />

        {/* Spalla destra e arco superiore della G */}
        <path
          d="M72 64 C96 50, 144 62, 162 98"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Lettera L interna (verticale + base orizzontale) */}
        <path
          d="M58 68 V152 H102"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Parete esterna sinistra, base inferiore e risalita con taglio orizzontale della G */}
        <path
          d="M44 82 C34 110, 36 146, 38 176 H118 C146 176, 162 154, 164 126 H112"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
