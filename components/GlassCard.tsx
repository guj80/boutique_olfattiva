'use client';

import React, { useState } from 'react';
import { useAura } from './AuraProvider';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  interactive?: boolean;
}

export function GlassCard({
  children,
  className = '',
  accentColor,
  interactive = false,
}: GlassCardProps) {
  const { aura } = useAura();
  const color = accentColor || aura.primary;
  const [coords, setCoords] = useState({ x: 50, y: 0, active: false });

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y, active: true });
  }

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setCoords((c) => ({ ...c, active: false }))}
      style={{
        borderColor: `${color}38`,
        boxShadow: `0 24px 60px -15px rgba(0, 0, 0, 0.92), inset 0 1px 0 0 ${color}28`,
      }}
      className={`relative overflow-hidden rounded-[30px] border bg-[#090612]/95 transition-all duration-500 ${className}`}
    >
      {/* Riflesso superiore statico */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${color}85 50%, transparent 95%)`,
        }}
      />

      {/* Spotlight dinamico o radiale d'angolo */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background: coords.active
            ? `radial-gradient(360px circle at ${coords.x}% ${coords.y}%, ${color}22, transparent 70%)`
            : `radial-gradient(circle at 88% 12%, ${color}1E 0%, transparent 62%)`,
        }}
      />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
