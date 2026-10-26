'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: string;
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-16 w-16',
    xl: 'h-44 w-44 sm:h-52 sm:w-52',
  };

  return (
    <div
      style={{
        WebkitMaskImage:
          'radial-gradient(circle at center, black 64%, transparent 98%)',
        maskImage:
          'radial-gradient(circle at center, black 64%, transparent 98%)',
      }}
      className={`relative flex items-center justify-center shrink-0 select-none ${sizeClasses[size]} ${className}`}
    >
      <Image
        src="/LOGO_LG.jpg"
        alt="Atelier LG"
        fill
        sizes="(max-width: 768px) 180px, 240px"
        className="object-contain mix-blend-screen brightness-110 contrast-125"
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
    <header
      style={{ borderColor: `${aura.primary}30` }}
      className="flex items-center justify-between border-b pb-5"
    >
      <div className="flex items-center gap-3.5">
        <Link
          href="/"
          title="Torna alla Home"
          className="group relative flex items-center justify-center transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          <div
            style={{ backgroundColor: aura.primary }}
            className="absolute inset-0 rounded-full blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-35"
          />
          <Logo size="md" />
        </Link>

        <div className="space-y-1">
          <div
            style={{
              borderColor: `${aura.primary}55`,
              backgroundColor: '#0E0A16',
            }}
            className="inline-block rounded-md border px-2.5 py-0.5 shadow-sm"
          >
            <span
              style={{ color: aura.primary }}
              className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold block"
            >
              {subtitle}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#F6EFE4] tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </header>
  );
}
