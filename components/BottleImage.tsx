'use client';

import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

export function SmartBottleImage({
  src,
  alt,
  className = 'w-full h-full object-contain',
  iconSize = 'w-6 h-6',
  blend = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
  blend?: boolean;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    const placeholderColor = blend ? 'text-[#3A2A5E]' : 'text-[#D8B995]/75';
    return (
      <div className={`flex h-full w-full items-center justify-center ${placeholderColor}`}>
        <FlaskConical className={`${iconSize} stroke-[1.4]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  const imgClass = blend ? `${className} mix-blend-multiply` : className;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={imgClass}
      onError={() => {
        if (stage === 'direct') setStage('proxy');
        else setStage('failed');
      }}
    />
  );
}

export function BottlePedestal({
  src,
  alt,
  size = 'lg',
  className = '',
}: {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-14 h-14 rounded-[16px] p-2',
    md: 'w-24 h-24 rounded-[22px] p-3',
    lg: 'w-48 h-56 rounded-[36px] p-5',
    xl: 'w-60 h-72 rounded-[44px] p-6',
  }[size];

  const iconDimension = size === 'sm' ? 'w-5 h-5' : 'w-10 h-10';

  return (
    <div
      className={`relative aspect-[5/6] flex items-center justify-center overflow-hidden select-none pedestal-surface ${sizeClasses} ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 bottom-2 h-4 rounded-full bg-black/15 blur-md"
      />
      <SmartBottleImage
        src={src}
        alt={alt}
        blend={true}
        iconSize={iconDimension}
        className="relative z-10 h-full w-full object-contain transition-transform duration-500"
      />
    </div>
  );
}
