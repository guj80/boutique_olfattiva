'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const SPLASH_DURATION_MS = 1950;

export function SplashIntro() {
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const gradBodyId = `splash-body-${uid}`;
  const gradCapId = `splash-cap-${uid}`;

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = sessionStorage.getItem('lg_splash_seen');
    } catch {
      seen = null;
    }

    if (seen) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem('lg_splash_seen', '1');
      } catch {
        /* storage non disponibile */
      }
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  const easeLuxury = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-intro"
          role="presentation"
          initial={{ opacity: 1, y: 0 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0, transition: { duration: 0.25 } }
              : {
                  opacity: 0,
                  y: '-8%',
                  transition: { duration: 0.65, ease: [0.76, 0, 0.24, 1] },
                }
          }
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#050308] select-none"
        >
          {/* Bagliore radiale calibrato sull'Aura attiva e oro caldo */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={
              prefersReducedMotion
                ? { opacity: 0.32, scale: 1 }
                : {
                    opacity: [0, 0.42, 0.28, 0.38],
                    scale: [0.65, 1.05, 0.96, 1],
                  }
            }
            transition={{ duration: 1.7, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--aura-1, #D4AF37) 45%, transparent) 0%, color-mix(in srgb, var(--aura-2, #8B5CF6) 20%, transparent) 45%, transparent 72%)',
            }}
            className="pointer-events-none absolute h-80 w-80 rounded-full blur-[70px] sm:h-96 sm:w-96"
          />

          {/* Monogramma vettoriale che si assembla per piani */}
          <div className="relative h-44 w-44 sm:h-52 sm:w-52">
            <svg
              viewBox="0 0 200 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="h-full w-full overflow-visible"
            >
              <defs>
                <linearGradient id={gradBodyId} x1="30" y1="58" x2="170" y2="205" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" style={{ stopColor: 'var(--aura-1, #D4AF37)' }} />
                  <stop
                    offset="55%"
                    style={{
                      stopColor: 'color-mix(in srgb, var(--aura-1, #D4AF37) 55%, #F6EFE4)',
                    }}
                  />
                  <stop
                    offset="100%"
                    style={{
                      stopColor: 'color-mix(in srgb, var(--aura-2, #A855F7) 70%, var(--aura-1, #D4AF37))',
                    }}
                  />
                </linearGradient>

                <linearGradient id={gradCapId} x1="60" y1="14" x2="148" y2="54" gradientUnits="userSpaceOnUse">
                  <stop
                    offset="0%"
                    style={{
                      stopColor: 'color-mix(in srgb, var(--aura-1, #D4AF37) 70%, #F6EFE4)',
                    }}
                  />
                  <stop offset="100%" style={{ stopColor: 'var(--aura-1, #D4AF37)' }} />
                </linearGradient>
              </defs>

              {/* Spalle laterali del flacone */}
              <motion.polygon
                points="54,67 54,82 40,95 57,178 30,93"
                fill={`url(#${gradBodyId})`}
                initial={prefersReducedMotion ? { opacity: 0.92 } : { opacity: 0, x: -14 }}
                animate={{ opacity: 0.92, x: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: easeLuxury }}
              />
              <motion.polygon
                points="146,67 170,93 143,178 160,95 146,82"
                fill={`url(#${gradBodyId})`}
                initial={prefersReducedMotion ? { opacity: 0.92 } : { opacity: 0, x: 14 }}
                animate={{ opacity: 0.92, x: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: easeLuxury }}
              />

              {/* Lettera L */}
              <motion.polygon
                points="64,67 79,67 79,179 134,179 144,193 64,193"
                fill={`url(#${gradBodyId})`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.22, ease: easeLuxury }}
              />

              {/* Lettera G */}
              <motion.polygon
                points="89,67 141,67 127,81 104,81 104,132 146,184 146,133 128,133 116,120 159,120 159,195 148,195 89,137"
                fill={`url(#${gradBodyId})`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.32, ease: easeLuxury }}
              />

              {/* Colletto atomizzatore */}
              <motion.polygon
                points="87,51 118,51 87,59"
                fill={`url(#${gradCapId})`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scaleX: 0.4 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.45, delay: 0.48, ease: easeLuxury }}
              />

              {/* Tappo inclinato che si posa dall'alto */}
              <motion.path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M61 28 L145 14 L132 46 L124 44 L131 24 L76 33 L103 44 L91 49 L61 28 Z"
                fill={`url(#${gradCapId})`}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -16, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.7, delay: 0.55, ease: easeLuxury }}
              />
            </svg>
          </div>

          {/* Firma tipografica sobria */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease: easeLuxury }}
            className="mt-5 flex flex-col items-center gap-1.5"
          >
            <span className="font-serif text-xl tracking-[0.28em] text-[#F6EFE4] uppercase">
              Atelier LG
            </span>
            <span
              style={{ backgroundColor: 'var(--aura-1, #D4AF37)' }}
              className="h-[1px] w-10 opacity-60"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
