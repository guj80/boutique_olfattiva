'use client';

import React from 'react';
import { useAura } from './AuraProvider';

export function Logo({
  className = 'h-8',
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  const { aura } = useAura();

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        className="h-full w-auto shrink-0 transition-colors duration-700"
        aria-hidden="true"
      >
        {/* Collo e tappo scultoreo monocromatico */}
        <rect
          x="13"
          y="2.5"
          width="10"
          height="4.5"
          rx="1.5"
          fill={aura.primary}
        />
        <path
          d="M15.5 7h5v3h-5z"
          fill={aura.primary}
          fillOpacity="0.75"
        />
        {/* Corpo sfaccettato del flacone */}
        <rect
          x="6"
          y="10"
          width="24"
          height="23"
          rx="8"
          fill="#140D1C"
          stroke={aura.primary}
          strokeWidth="1.6"
        />
        {/* Sigillo interno centrale */}
        <circle
          cx="18"
          cy="21.5"
          r="5.5"
          fill={aura.primary}
          fillOpacity="0.15"
          stroke={aura.primary}
          strokeWidth="1.2"
        />
        <circle cx="18" cy="21.5" r="2" fill={aura.primary} />
      </svg>
      {showText && (
        <span className="font-serif text-xl tracking-wide text-[#F6EFE4]">
          L&apos;Aura
        </span>
      )}
    </div>
  );
}
