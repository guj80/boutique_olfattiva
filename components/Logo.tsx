'use client';

import React from 'react';
import Image from 'next/image';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className = 'h-9 w-9', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}>
      {/* Utilizzo diretto dell'immagine ufficiale del logo con sfumature autentiche */}
      <Image
        src="/LOGO_LG.jpg"
        alt="Boutique Olfattiva Logo"
        fill
        sizes="(max-width: 768px) 40px, 60px"
        className="object-contain rounded-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
        priority
      />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

export function PageHeader({ title, subtitle, rightSlot }: PageHeaderProps) {
  const { aura } = useAura();

  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <div className="flex items-center gap-3.5">
        <Logo size="md" />
        <div className="space-y-0.5">
          <span
            style={{ color: aura.primary }}
            className="font-mono text-[11px] uppercase tracking-[0.25em] font-bold"
          >
            {subtitle}
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#F6EFE4] tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </header>
  );
}
