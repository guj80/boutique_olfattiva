'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sparkles, Library, ScanLine, Compass, CalendarHeart } from 'lucide-react';
import { useAura } from './AuraProvider';

function BottomDockInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { aura, hideDock } = useAura();

  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) return null;
  if (hideDock) return null;

  const vista = searchParams.get('vista');
  const activeKey =
    pathname === '/'
      ? 'atelier'
      : pathname.startsWith('/collezione') && vista === 'radar'
      ? 'radar'
      : pathname.startsWith('/collezione')
      ? 'collezione'
      : pathname.startsWith('/scanner')
      ? 'scanner'
      : pathname.startsWith('/diario')
      ? 'diario'
      : 'atelier';

  const items = [
    { key: 'atelier', label: 'Atelier', href: '/', icon: Sparkles },
    { key: 'collezione', label: 'Collezione', href: '/collezione', icon: Library },
    { key: 'scanner', label: 'Acquisisci', href: '/scanner', icon: ScanLine, center: true },
    { key: 'radar', label: 'Radar', href: '/collezione?vista=radar', icon: Compass },
    { key: 'diario', label: 'Diario', href: '/diario', icon: CalendarHeart },
  ];

  return (
    <nav
      aria-label="Navigazione principale"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
    >
      <div
        style={{ borderColor: `${aura.primary}35` }}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-[#140D1C]/95 px-2.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-colors duration-700"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;

          if (item.center) {
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                style={{ backgroundColor: aura.primary }}
                className="relative mx-1 flex h-13 w-13 p-3.5 items-center justify-center rounded-full text-[#140D1C] shadow-lg transition hover:scale-105"
              >
                <Icon className="relative z-10 h-5 w-5 stroke-[2.2]" />
              </Link>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              style={
                isActive
                  ? { borderColor: `${aura.primary}50`, color: '#F6EFE4' }
                  : undefined
              }
              className={`relative flex min-h-[42px] min-w-[42px] items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#1E1428] border'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Icon
                style={isActive ? { color: aura.primary } : undefined}
                className="h-4 w-4"
              />
              {isActive && <span className="font-mono text-[11px]">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomDock() {
  return (
    <Suspense fallback={null}>
      <BottomDockInner />
    </Suspense>
  );
}
