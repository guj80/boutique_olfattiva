'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const SPLASH_DURATION_MS = 1950;

export function SplashIntro() {
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const gradId = `splash-platinum-${uid}`;

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
          {/* Alone ambientale calibrato sull'Aura attiva */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={
              prefersReducedMotion
                ? { opacity: 0.3, scale: 1 }
                : {
                    opacity: [0, 0.38, 0.24, 0.34],
                    scale: [0.65, 1.05, 0.96, 1],
                  }
            }
            transition={{ duration: 1.7, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--aura-1, #B7C2CB) 42%, transparent) 0%, color-mix(in srgb, var(--aura-2, #7F8D98) 18%, transparent) 48%, transparent 72%)',
            }}
            className="pointer-events-none absolute h-80 w-80 rounded-full blur-[75px] sm:h-96 sm:w-96"
          />

          {/* Monogramma platino ufficiale che si assembla per piani */}
          <div className="relative h-48 w-40 sm:h-56 sm:w-48">
            <svg
              viewBox="220 205 1216 1455"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="h-full w-full overflow-visible"
            >
              <defs>
                <linearGradient
                  id={gradId}
                  gradientUnits="userSpaceOnUse"
                  x1="300"
                  y1="200"
                  x2="1300"
                  y2="1650"
                >
                  <stop offset="0" stopColor="#F7F9FA" />
                  <stop offset="0.45" stopColor="#B7C2CB" />
                  <stop offset="0.7" stopColor="#EEF2F4" />
                  <stop offset="1" stopColor="#7F8D98" />
                </linearGradient>
              </defs>

              <g fill={`url(#${gradId})`}>
                {/* Spalle laterali */}
                <motion.polygon
                  points="459,675 238,823 459,1520 459,1175 372,865 459,805"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -35 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.65, delay: 0.1, ease: easeLuxury }}
                />
                <motion.polygon
                  points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.65, delay: 0.1, ease: easeLuxury }}
                />

                {/* Lettera L */}
                <motion.polygon
                  points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.22, ease: easeLuxury }}
                />

                {/* Lettera G */}
                <motion.polygon
                  points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.32, ease: easeLuxury }}
                />

                {/* Colletto atomizzatore */}
                <motion.polygon
                  points="680,552 926,553 680,620"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scaleX: 0.4 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.45, delay: 0.48, ease: easeLuxury }}
                />

                {/* Tappo geometrico superiore */}
                <motion.g
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -35 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.55, ease: easeLuxury }}
                >
                  <polygon points="477,343 1184,220 1003,519 1030,343" />
                  <polygon points="477,343 625,452 877,518 587,519" />
                </motion.g>
              </g>
            </svg>
          </div>

          {/* Firma tipografica */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease: easeLuxury }}
            className="mt-6 flex flex-col items-center gap-2"
          >
            <span className="font-serif text-xl tracking-[0.28em] text-[#EEF2F4] uppercase">
              Atelier LG
            </span>
            <span className="h-[1px] w-10 bg-[#B7C2CB]/60" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
