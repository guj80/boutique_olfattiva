'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Library, Compass, BookOpen, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/GlassCard';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';

export default function HomePage() {
  const { setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.home);
  }, [setCustomAura]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-12 pb-36 space-y-10">
      {/* HEADER CON LOGO NETTO, SENZA ALCUN RIFLESSO O SFUMATURA */}
      <header className="flex flex-col items-center text-center space-y-3 pt-2">
        <div className="h-16 w-48 flex items-center justify-center">
          <Logo variant="mono" className="h-full w-full object-contain" />
        </div>
        <div className="space-y-1">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
            Boutique Olfattiva
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8E7C9E]">
            Digital Luxury Perfume Boutique
          </p>
        </div>
      </header>

      {/* SEZIONI PRINCIPALI (COLLEZIONE, RADAR, DIARIO) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        {/* COLLEZIONE */}
        <Link href="/collezione" className="group block">
          <GlassCard accentColor="#38BDF8" className="h-full p-6 space-y-4 transition duration-300 group-hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400">
              <Library className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
                Lo Scaffale
              </span>
              <h2 className="font-serif text-xl text-[#F6EFE4]">Collezione</h2>
              <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                Esplora i flaconi firmati e la libreria artistica della tua collezione privata.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1 font-mono text-xs text-sky-400 group-hover:translate-x-1 transition">
              <span>Accedi</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </GlassCard>
        </Link>

        {/* RADAR */}
        <Link href="/collezione?vista=radar" className="group block">
          <GlassCard accentColor="#C084FC" className="h-full p-6 space-y-4 transition duration-300 group-hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-400/30 text-purple-400">
              <Compass className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400">
                Il Radar
              </span>
              <h2 className="font-serif text-xl text-[#F6EFE4]">Testing</h2>
              <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                Gestisci i campioni, i decant e le scoperte in corso d'analisi olfattiva.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1 font-mono text-xs text-purple-400 group-hover:translate-x-1 transition">
              <span>Esplora</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </GlassCard>
        </Link>

        {/* DIARIO */}
        <Link href="/diario" className="group block">
          <GlassCard accentColor="#FB7185" className="h-full p-6 space-y-4 transition duration-300 group-hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-400/30 text-rose-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400">
                Rotazione
              </span>
              <h2 className="font-serif text-xl text-[#F6EFE4]">Diario</h2>
              <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                Traccia gli indossi quotidiani e le impressioni sulla pelle nel tempo.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1 font-mono text-xs text-rose-400 group-hover:translate-x-1 transition">
              <span>Apri Diario</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </GlassCard>
        </Link>
      </section>
    </main>
  );
}
