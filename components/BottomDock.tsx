'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Library, Compass, Sparkles, CalendarHeart } from 'lucide-react';
import { useAura } from './AuraProvider';

export function BottomDock() {
  const pathname = usePathname();
  const { aura } = useAura();

  const navItems = [
    { href: '/', label: 'Atelier', icon: Home },
    { href: '/collezione', label: 'Collezione', icon: Library },
    { href: '/scanner', label: 'Scanner', icon: Compass },
    { href: '/collezione?vista=radar', label: 'Radar', icon: Sparkles },
    { href: '/diario', label: 'Diario', icon: CalendarHeart },
  ];

  return (
    <nav aria-label="Navigazione principale" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md">
      <div
        style={{ borderColor: `${aura.primary}40` }}
        className="flex items-center justify-around rounded-full border bg-[#0E0A16]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href.includes('radar') && pathname.includes('collezione') && typeof window !== 'undefined' && window.location.search.includes('vista=radar'));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={isActive ? { backgroundColor: aura.primary, color: '#08060C' } : { color: '#B8A9C9' }}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 hover:text-[#F6EFE4] ${
                isActive ? 'font-bold shadow-lg scale-105' : 'hover:bg-white/5'
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
