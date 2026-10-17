'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAura } from './AuraProvider';

export type SpruzzoAnchor =
  | DOMRect
  | HTMLElement
  | React.RefObject<HTMLElement | null>
  | null
  | undefined;

interface Particle {
  id: number;
  dx: number;
  dy: number;
  size: number;
  delay: number;
}

interface BurstState {
  key: number;
  x: number;
  y: number;
}

interface SpruzzoContextValue {
  triggerSpruzzo: (anchor?: SpruzzoAnchor) => void;
}

const SpruzzoContext = createContext<SpruzzoContextValue>({
  triggerSpruzzo: () => {},
});

const PARTICLES: Particle[] = Array.from({ length: 22 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i - 11) / 11) * (Math.PI * 0.55);
  const distance = 70 + (i % 5) * 32;
  return {
    id: i,
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance - 20,
    size: 5 + (i % 4) * 3,
    delay: (i % 6) * 0.025,
  };
});

function resolveAnchorOrigin(anchor?: SpruzzoAnchor): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const fallback = {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.36,
  };
  if (!anchor) return fallback;

  let rect: DOMRect | null = null;
  if ('current' in anchor) {
    rect = anchor.current ? anchor.current.getBoundingClientRect() : null;
  } else if (typeof (anchor as HTMLElement).getBoundingClientRect === 'function') {
    rect = (anchor as HTMLElement).getBoundingClientRect();
  } else if ('left' in anchor && 'top' in anchor && 'width' in anchor && 'height' in anchor) {
    rect = anchor as DOMRect;
  }

  if (!rect || (rect.width === 0 && rect.height === 0)) return fallback;

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height * 0.16,
  };
}

export function SpruzzoProvider({ children }: { children: React.ReactNode }) {
  const [burst, setBurst] = useState<BurstState | null>(null);
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();

  const triggerSpruzzo = useCallback((anchor?: SpruzzoAnchor) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
    const origin = resolveAnchorOrigin(anchor);
    setBurst({ key: Date.now(), x: origin.x, y: origin.y });
    setTimeout(() => {
      setBurst(null);
    }, 920);
  }, []);

  return (
    <SpruzzoContext.Provider value={{ triggerSpruzzo }}>
      {children}
      <AnimatePresence>
        {burst && !prefersReducedMotion && (
          <div
            key={burst.key}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[75] overflow-hidden"
          >
            <div
              style={{
                left: `${burst.x}px`,
                top: `${burst.y}px`,
              }}
              className="absolute"
            >
              {PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 0.95 }}
                  animate={{
                    x: p.dx,
                    y: p.dy,
                    scale: 1.6,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.85,
                    delay: p.delay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.id % 2 === 0 ? aura.primary : '#F6EFE4',
                    boxShadow: `0 0 12px ${aura.primary}`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform"
                />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
    </SpruzzoContext.Provider>
  );
}

export function useSpruzzo() {
  return useContext(SpruzzoContext);
}
