'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Library, Compass, CalendarHeart, BookOpen } from 'lucide-react';

export function BottomDock() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Atelier', icon: Home },
    { href: '/collezione', label: 'Collezione', icon: Library },
    { href: '/enciclopedia', label: 'Enciclopedia', icon: BookOpen },
    { href: '/scanner', label: 'Scanner', icon: Compass },
    { href: '/diario', label: 'Diario', icon: CalendarHeart },
  ];

  return (
    <nav aria-label="Navigazione principale" className="bottom-dock">
      <div className="bottom-dock-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-dock-item ${isActive ? 'bottom-dock-item--on' : ''}`}
            >
              <Icon className="bottom-dock-icon" />
              <span className="bottom-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
