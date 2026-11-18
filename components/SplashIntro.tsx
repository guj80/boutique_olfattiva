'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion, type MotionStyle } from 'framer-motion';

const SPLASH_DURATION_MS = 1800;
const EMERALD = '#10B981';

export function SplashIntro() {
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

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
        /* storage non disponibile: nessun problema */
      }
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  const featherMask: MotionStyle = {
    WebkitMaskImage: 'radial-gradient(circle at center, black 58%, transparent 94%)',
    maskImage: 'radial-gradient(circle at center, black 58%, transparent 94%)',
  };

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
                  y: '-14%',
                  transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] },
                }
          }
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#050308] select-none"
        >
          {/* Alone smeraldo che pulsa dietro il logo */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={
              prefersReducedMotion
                ? { opacity: 0.35, scale: 1 }
                : {
                    opacity: [0, 0.55, 0.3, 0.6, 0.35],
                    scale: [0.7, 1.05, 0.95, 1.12, 1],
                  }
            }
            transition={{
              duration: prefersReducedMotion ? 0.4 : 1.6,
              times: prefersReducedMotion ? undefined : [0, 0.3, 0.52, 0.76, 1],
              ease: 'easeInOut',
            }}
            style={{ backgroundColor: EMERALD }}
            className="pointer-events-none absolute h-64 w-64 rounded-full blur-[100px] sm:h-80 sm:w-80"
          />

          {/*
            Il blend `screen` sta sull'elemento animato stesso (non sull'<img>):
            un wrapper con transform/opacity crea un proprio stacking context
            e il blend interno non vedrebbe lo sfondo. Cosi' il nero del JPG
            si fonde con #050308 e resta solo la luce del logo.
          */}
          <motion.div
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1, scale: 1 }
                : {
                    opacity: [0, 1, 1, 1, 1],
                    scale: [0.9, 1, 1.03, 1.05, 1.06],
                    filter: [
                      'brightness(1)',
                      'brightness(1)',
                      'brightness(1.45)',
                      'brightness(1.05)',
                      'brightness(1.3)',
                    ],
                  }
            }
            transition={{
              duration: prefersReducedMotion ? 0.4 : 1.7,
              times: prefersReducedMotion ? undefined : [0, 0.28, 0.5, 0.72, 1],
              ease: [0.16, 1, 0.3, 1],
            }}
            style={featherMask}
            className="relative h-52 w-52 mix-blend-screen sm:h-64 sm:w-64"
          >
            <Image
              src="/LOGO_LG.jpg"
              alt="Atelier LG"
              fill
              sizes="256px"
              className="object-contain brightness-110 contrast-125"
              priority
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
