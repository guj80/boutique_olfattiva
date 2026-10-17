'use client';

import React, { useId } from 'react';
import { useAura } from './AuraProvider';

export function Logo({ className = 'h-8' }: { className?: string }) {
  const { aura } = useAura();
  const rawId = useId();
  const gradId = `bo-aura-grad-${rawId.replace(/:/g, '')}`;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        className="h-full w-auto shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={aura.primary} />
            <stop offset="100%" stopColor={aura.secondary} />
          </linearGradient>
        </defs>
        <rect x="13" y="3" width="10" height="4" rx="2" fill="#D8B995" />
        <path d="M15 7h6v3h-6z" fill="#D8B995" opacity="0.8" />
        <rect
          x="6"
          y="10"
          width="24"
          height="23"
          rx="9"
          fill={`url(#${gradId})`}
          stroke="#F6EFE4"
          strokeWidth="1.2"
          strokeOpacity="0.4"
        />
        <circle
          cx="18"
          cy="21.5"
          r="5.5"
          fill="#140D1C"
          fillOpacity="0.65"
          stroke="#D8B995"
          strokeWidth="1"
        />
      </svg>
      <span className="font-serif text-xl tracking-tight text-[#F6EFE4]">
        Boutique Olfattiva
      </span>
    </div>
  );
}
