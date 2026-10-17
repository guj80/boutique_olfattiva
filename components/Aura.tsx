'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAura } from './AuraProvider';
import { auraTransition } from '@/lib/motion';

export function Aura() {
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#140D1C]"
    >
      <motion.div
        animate={
          prefersReducedMotion
            ? { backgroundColor: aura.primary }
            : {
                backgroundColor: aura.primary,
                x: ['-6%', '8%', '-4%', '-6%'],
                y: ['-4%', '6%', '-8%', '-4%'],
                scale: [1, 1.12, 0.96, 1],
              }
        }
        transition={{
          backgroundColor: auraTransition,
          x: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 26, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute -top-24 -left-16 h-[340px] w-[340px] sm:h-[460px] sm:w-[460px] rounded-full opacity-35 blur-[80px] will-change-transform"
      />

      <motion.div
        animate={
          prefersReducedMotion
            ? { backgroundColor: aura.secondary }
            : {
                backgroundColor: aura.secondary,
                x: ['8%', '-10%', '4%', '8%'],
                y: ['6%', '-6%', '10%', '6%'],
                scale: [1.05, 0.92, 1.1, 1.05],
              }
        }
        transition={{
          backgroundColor: auraTransition,
          x: { duration: 28, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 24, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 25, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute top-[28%] -right-20 h-[360px] w-[360px] sm:h-[480px] sm:w-[480px] rounded-full opacity-40 blur-[90px] will-change-transform"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[#140D1C]/35 via-[#140D1C]/65 to-[#140D1C]/90" />
      <div className="aura-grain absolute inset-0 opacity-[0.07]" />
    </div>
  );
}
