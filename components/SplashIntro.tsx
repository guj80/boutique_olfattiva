'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './Logo';

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
    }, 950);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050308]"
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* APERTURA ASSOLUTA APP: LOGO COLORE ORIGINALE CENTRATO E NON TAGLIATO */}
            <Logo variant="original" className="h-44 sm:h-52" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
