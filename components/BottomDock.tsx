'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Library, Compass, Sparkles, CalendarHeart } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { useAura } from './AuraProvider';
import { springSoft, springSnappy } from '@/lib/motion';

const SCROLL_IDLE_MS = 220;

function BottomDockInner() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { aura, hideDock } = useAura();
  const prefersReducedMotion = useReducedMotion();

  const isRadarView = searchParams?.get('vista') === 'radar';
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

  const [isScrolling, setIsScrolling] = useState(false);
  const { scrollY } = useScroll();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mentre si scrolla la pillola si attenua (60%) e si rimpicciolisce di poco (0.97).
  // Quando lo scroll si ferma torna al 100%. Non cambia mai forma.
  useMotionValueEvent(scrollY, 'change', () => {
    setIsScrolling(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsScrolling(false), SCROLL_IDLE_MS);
  });

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const navItems = [
    { href: '/', label: 'Atelier', icon: Home, match: (p: string) => p === '/' },
    {
      href: '/collezione',
      label: 'Collezione',
      icon: Library,
      match: (p: string) => p === '/collezione' && !isRadarView,
    },
    { href: '/scanner', label: 'Scanner', icon: Compass, match: (p: string) => p === '/scanner' },
    {
      href: '/collezione?vista=radar',
      label: 'Radar',
      icon: Sparkles,
      match: (p: string) => p === '/collezione' && isRadarView,
    },
    { href: '/diario', label: 'Diario', icon: CalendarHeart, match: (p: string) => p === '/diario' },
  ];

  const showDock = !hideDock && !isAuthRoute;

  return (
    <AnimatePresence>
      {showDock && (
        <motion.div
          key="bottom-dock"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
        >
          {/* Wrapper di centratura separato: lo scale di Framer non entra in conflitto con il posizionamento */}
          <motion.nav
            aria-label="Navigazione principale"
            initial={false}
            animate={{
              opacity: isScrolling ? 0.6 : 1,
              scale: isScrolling && !prefersReducedMotion ? 0.97 : 1,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
            }
            className="pointer-events-auto w-full max-w-md"
          >
            <div
              style={{ borderColor: `${aura.primary}40` }}
              className="flex items-center justify-around rounded-full border bg-[#0E0A16]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.match(pathname);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className="group relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/5 motion-reduce:transition-none"
                  >
                    {isActive && (
                      <motion.span
                        layoutId="dock-active-indicator"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: aura.primary }}
                        transition={prefersReducedMotion ? { duration: 0 } : springSoft}
                      />
                    )}
                    <motion.span
                      className="relative z-10 flex items-center justify-center"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
                      transition={springSnappy}
                    >
                      <Icon
                        className={`h-5 w-5 transition-colors motion-reduce:transition-none ${
                          isActive
                            ? 'text-[#08060C]'
                            : 'text-[#B8A9C9] group-hover:text-[#F6EFE4]'
                        }`}
                      />
                    </motion.span>
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BottomDock() {
  return (
    <Suspense fallback={null}>
      <BottomDockInner />
    </Suspense>
  );
}
