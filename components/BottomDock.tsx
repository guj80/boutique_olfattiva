'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Library, Compass, Sparkles, CalendarHeart } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useAura } from './AuraProvider';
import { springSoft, springSnappy } from '@/lib/motion';

export function BottomDock() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { aura, hideDock } = useAura(); 
  const prefersReducedMotion = useReducedMotion();

  const isRadarView = searchParams.get('vista') === 'radar';
  const [isExpanded, setIsExpanded] = useState(true);
  const { scrollY } = useScroll();

  // Logica di scroll: giù = si restringe, su = si espande
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setIsExpanded(false);
    } else if (latest < previous) {
      setIsExpanded(true);
    }
  });

  const navItems = [
    { href: '/', label: 'Atelier', icon: Home, match: (p: string) => p === '/' },
    { href: '/collezione', label: 'Collezione', icon: Library, match: (p: string) => p === '/collezione' && !isRadarView },
    { href: '/scanner', label: 'Scanner', icon: Compass, match: (p: string) => p === '/scanner' },
    { href: '/collezione?vista=radar', label: 'Radar', icon: Sparkles, match: (p: string) => p === '/collezione' && isRadarView },
    { href: '/diario', label: 'Diario', icon: CalendarHeart, match: (p: string) => p === '/diario' },
  ];

  const activeItem = navItems.find(item => item.match(pathname)) || navItems[0];
  const ActiveIcon = activeItem.icon;

  // Se il modale è aperto, la dock scompare del tutto per non coprire i pulsanti
  if (hideDock) return null;

  return (
    <motion.nav
      initial={false}
      animate={{
        width: isExpanded ? '92%' : '56px',
        borderRadius: isExpanded ? '999px' : '28px',
      }}
      transition={prefersReducedMotion ? { duration: 0 } : springSoft}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md overflow-hidden"
    >
      <div
        style={{ borderColor: `${aura.primary}40` }}
        className="relative flex items-center justify-around bg-[#0E0A16]/95 shadow-2xl backdrop-blur-xl border h-14"
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            // VISTA ESPANSA: Tutte le icone
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex w-full items-center justify-around px-2"
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
                    className="group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5"
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
                        className={`h-5 w-5 transition-colors ${
                          isActive ? 'text-[#08060C]' : 'text-[#B8A9C9] group-hover:text-[#F6EFE4]'
                        }`}
                      />
                    </motion.span>
                  </Link>
                );
              })}
            </motion.div>
          ) : (
            // VISTA COMPATTA: Solo l'icona attiva
            <motion.button
              key="collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsExpanded(true)}
              className="flex h-full w-full items-center justify-center"
              aria-label="Espandi menu"
            >
              <motion.span
                whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: aura.primary }}
              >
                <ActiveIcon className="h-5 w-5 text-[#08060C]" />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
