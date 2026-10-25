'use client';

import React from 'react';
import { useAura } from './AuraProvider';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'original' | 'minimal' | 'glow';
}

export function Logo({ className = 'h-8 w-8', size = 'md', variant = 'original' }: LogoProps) {
  const { aura } = useAura();

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-50"
        style={{ backgroundColor: aura.primary }}
      />
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 h-full w-full drop-shadow-lg"
      >
        <path
          d="M30 20H70V30H30V20Z"
          fill={aura.primary}
          fillOpacity="0.95"
        />
        <path
          d="M45 30H55V40H45V30Z"
          fill={aura.primary}
          fillOpacity="0.8"
        />
        <path
          d="M25 40H75C83.2843 40 90 46.7157 90 55V75C90 83.2843 83.2843 90 75 90H25C16.7157 90 10 83.2843 10 75V55C10 46.7157 16.7157 40 25 40Z"
          stroke={aura.primary}
          strokeWidth="3.5"
          fill="#08060C"
          fillOpacity="0.9"
        />
        <path
          d="M38 52V74H62"
          stroke={aura.primary}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M62 58H52V68H64"
          stroke={aura.primary}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
      <div className="space-y-1">
        <span
          style={{ color: aura.primary }}
          className="font-mono text-[11px] uppercase tracking-[0.25em] font-bold"
        >
          {subtitle}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
          {title}
        </h1>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </header>
  );
}
