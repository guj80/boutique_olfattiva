'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashIntro() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem('splash_seen');
    if (seen) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('splash_seen', '1');
    }, 1750);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#140D1C] overflow-hidden select-none"
        >
          <motion.div
            initial={{ opacity: 0, x: -70, scale: 0.7 }}
            animate={{ opacity: [0, 0.4, 0.25], x: [-70, -18, -8], scale: [0.7, 1.07, 1] }}
            transition={{ duration: 1.25, ease: 'easeOut' }}
            className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#C98A3A] blur-[95px]"
          />
          <motion.div
            initial={{ opacity: 0, x: 70, scale: 0.7 }}
            animate={{ opacity: [0, 0, 0.4, 0.25], x: [70, 70, 18, 8], scale: [0.7, 0.7, 1.07, 1] }}
            transition={{ duration: 1.35, times: [0, 0.22, 0.72, 1], ease: 'easeOut' }}
            className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#C789BB] blur-[95px]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
