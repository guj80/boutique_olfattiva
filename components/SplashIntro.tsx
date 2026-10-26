'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashIntro() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem('lg_splash_seen');
    if (seen) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('lg_splash_seen', '1');
    }, 1750);
    return () => clearTimeout(timer);
  }, []);

  const featherMask = {
    WebkitMaskImage:
      'radial-gradient(circle at center, black 62%, transparent 96%)',
    maskImage:
      'radial-gradient(circle at center, black 62%, transparent 96%)',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-intro"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050308] overflow-hidden select-none"
        >
          {/* Bagliore atmosferico sinistro (Magenta) */}
          <motion.div
            initial={{ opacity: 0, x: -70, scale: 0.7 }}
            animate={{
              opacity: [0, 0.45, 0.28],
              x: [-70, -18, -10],
              scale: [0.7, 1.08, 1],
            }}
            transition={{ duration: 1.25, ease: 'easeOut' }}
            className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#D946EF] blur-[95px]"
          />

          {/* Bagliore atmosferico destro (Smeraldo) */}
          <motion.div
            initial={{ opacity: 0, x: 70, scale: 0.7 }}
            animate={{
              opacity: [0, 0, 0.45, 0.28],
              x: [70, 70, 18, 10],
              scale: [0.7, 0.7, 1.08, 1],
            }}
            transition={{
              duration: 1.35,
              times: [0, 0.22, 0.72, 1],
              ease: 'easeOut',
            }}
            className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#10B981] blur-[95px]"
          />

          {/* Contenitore centrale che vibra in risonanza una volta unito */}
          <motion.div
            animate={{
              scale: [1, 1, 1.045, 0.99, 1.015, 1],
              filter: [
                'brightness(1)',
                'brightness(1)',
                'brightness(1.35)',
                'brightness(1.05)',
                'brightness(1.2)',
                'brightness(1)',
              ],
            }}
            transition={{
              duration: 1.6,
              times: [0, 0.52, 0.66, 0.78, 0.9, 1],
              ease: 'easeInOut',
            }}
            className="relative h-52 w-52 sm:h-64 sm:w-64"
          >
            {/* 1. LATO SINISTRO (MAGENTA) — Entra per primo da sinistra */}
            <motion.div
              initial={{ x: -48, opacity: 0, scale: 0.92 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{
                duration: 0.52,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                ...featherMask,
                clipPath: 'inset(0 50% 0 0)',
              }}
              className="absolute inset-0 mix-blend-screen"
            >
              <Image
                src="/LOGO_LG.jpg"
                alt="Atelier LG"
                fill
                sizes="256px"
                className="object-contain mix-blend-screen brightness-110 contrast-125"
                priority
              />
            </motion.div>

            {/* 2. LATO DESTRO (SMERALDO) — Entra subito dopo da destra e si fonde */}
            <motion.div
              initial={{ x: 48, opacity: 0, scale: 0.92 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{
                delay: 0.24,
                duration: 0.54,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                ...featherMask,
                clipPath: 'inset(0 0 0 50%)',
              }}
              className="absolute inset-0 mix-blend-screen"
            >
              <Image
                src="/LOGO_LG.jpg"
                alt="Atelier LG"
                fill
                sizes="256px"
                className="object-contain mix-blend-screen brightness-110 contrast-125"
                priority
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
