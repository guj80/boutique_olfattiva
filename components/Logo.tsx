'use client';

import React from 'react';
import { useAura } from './AuraProvider';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

export function PageHeader({ title, subtitle, rightSlot }: PageHeaderProps) {
  const { aura } = useAura();

  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <div className="space-y-1">
        <span
          style={{ color: aura.primary }}
          className="font-mono text-[11px] uppercase tracking-[0.25em] font-bold"
        >
          {subtitle}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
          {title}
        </h1>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </header>
  );
}
