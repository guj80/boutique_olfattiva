'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  ScanLine,
  ChevronRight,
  RefreshCw,
  FlaskConical,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';

function PerfumeBottleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="3" rx="1" />
      <path d="M10 5v2h4V5" />
      <rect x="5" y="7" width="14" height="15" rx="3" />
      <path d="M15 4h4" />
      <path d="M18 2l2 2-2 2" />
      <rect x="8.5" y="11" width="7" height="6" rx="1" />
    </svg>
  );
}

function SmartBottleImage({
  src,
  alt,
  className,
  iconSize = 'w-5 h-5',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    return (
      <div className="flex items-center justify-center text-zinc-600">
        <FlaskConical className={`${iconSize} stroke-[1.2]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === 'direct') setStage('proxy');
        else setStage('failed');
      }}
    />
  );
}

export default function BoutiqueHomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [ultimoIndosso, setUltimoIndosso] = useState<Indosso | null>(null);
  const [loading, setLoading] = useState(true);

  const [activePanel, setActivePanel] = useState<'none' | 'ai' | 'collezione' | 'decant'>('none');

  const [meteo, setMeteo] = useState('Fresco Autunnale');
  const [occasione, setOccasione] = useState('Ufficio');
  const [umore, setUmore] = useState('Legnoso / Ambrato / Deciso');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = use
