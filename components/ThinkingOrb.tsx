'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useAura } from './AuraProvider';

interface ThinkingOrbProps {
  label?: string;
  size?: 'sm' | 'md';
}

export function ThinkingOrb({
  label = 'Analisi olfattiva Dual-AI in corso...',
  size = 'md',
}: ThinkingOrbProps) {
  const { aura } = useAura();
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-11 w-11';

  return (
    <div className="flex items-center gap-3.5 py-2">
      <div className={`relative flex items-center justify-center ${dim}`}>
        {/* Anello esterno pulsante */}
        <motion.span
          animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0.08, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ backgroundColor: aura.primary }}
          className="absolute inset-0 rounded-full blur-md"
        />
        {/* Anello orbitale */}
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          style={{
            borderColor: `${aura.primary}88`,
            borderTopColor: 'transparent',
          }}
          className="absolute inset-0.5 rounded-full border-2"
        />
        {/* Nucleo energetico */}
        <motion.span
          animate={{ scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: `radial-gradient(circle at 35% 35%, #FFFFFF 0%, ${aura.primary} 65%, #050308 100%)`,
            boxShadow: `0 0 16px ${aura.primary}`,
          }}
          className="relative h-3.5 w-3.5 rounded-full"
        />
      </div>

      {label && (
        <span className="font-mono text-xs tracking-wide text-[#F6EFE4]/90">
          {label}
        </span>
      )}
    </div>
  );
}
