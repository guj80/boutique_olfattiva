'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Library, Compass, Sparkles, CalendarHeart } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAura } from './AuraProvider';
import { springSoft, springSnappy } from '@/lib/motion';

export function BottomDock() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { aura } = useAura();
  const prefersReducedMotion = useReducedMotion();

  const isRadarView = searchParams.get('vista') === 'radar';

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

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md"
    >
      <div
        style={{ borderColor: `${aura.primary}40` }}
        className="relative flex items-center justify-around rounded-full border bg-[#0E0A16]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
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
              className="group relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/5"
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
    </nav>
  );
}
