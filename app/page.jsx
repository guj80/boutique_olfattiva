'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Library, Compass, BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/GlassCard';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';

export default function HomePage() {
  const { setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.home);
  }, [setCustomAura]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-12 pb-36 space-y-12">
      {/* HEADER CON IL LOGO ORIGINALE SMERALDO / MAGENTA E ZERO TESTI RIDONDANTI */}
      <header className="flex flex-col items-center text-center space-y-4 pt-4">
        <div className="h-20 w-56 flex items-center justify-center p-2">
          <Logo variant="default" className="h-full w-full object-contain" />
        </div>
      </header>

      {/* I TRE BOX DELLA HOME: IMMERSIVI, RAFFINATI E CON IDENTITÀ DISTINTA */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* COLLEZIONE */}
        <Link href="/collezione" className="group block">
          <GlassCard accentColor="#38BDF8" className="h-full flex flex-col justify-between p-6 sm:p-7 transition duration-500 group-hover:-translate-y-1.5 shadow-2xl">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400 shadow-inner">
                <Library className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
                  Lo Scaffale
                </span>
                <h2 className="font-serif text-2xl text-[#F6EFE4]">Collezione</h2>
                <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                  Esplora i flaconi firmati, le piramidi olfattive e la libreria artistica della tua collezione privata.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400/80">Vault privato</span>
              <div className="flex items-center gap-1 font-mono text-xs text-sky-400 group-hover:translate-x-1 transition">
                <span>Accedi</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </GlassCard>
        </Link>

        {/* RADAR */}
        <Link href="/collezione?vista=radar" className="group block">
          <GlassCard accentColor="#C084FC" className="h-full flex flex-col justify-between p-6 sm:p-7 transition duration-500 group-hover:-translate-y-1.5 shadow-2xl">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-400/30 text-purple-400 shadow-inner">
                <Compass className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400">
                  Il Radar
                </span>
                <h2 className="font-serif text-2xl text-[#F6EFE4]">Testing</h2>
                <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                  Gestisci i campioni, i decant e le scoperte in corso d'analisi con listini formati dedicati.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400/80">Scouting</span>
              <div className="flex items-center gap-1 font-mono text-xs text-purple-400 group-hover:translate-x-1 transition">
                <span>Esplora</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </GlassCard>
        </Link>

        {/* DIARIO */}
        <Link href="/diario" className="group block">
          <GlassCard accentColor="#FB7185" className="h-full flex flex-col justify-between p-6 sm:p-7 transition duration-500 group-hover:-translate-y-1.5 shadow-2xl">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-400/30 text-rose-400 shadow-inner">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400">
                  Rotazione
                </span>
                <h2 className="font-serif text-2xl text-[#F6EFE4]">Diario</h2>
                <p className="text-xs text-[#8E7C9E] leading-relaxed pt-1">
                  Traccia gli indossi quotidiani, l'evoluzione sulla pelle e le impressioni olfattive nel tempo.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400/80">Memoria</span>
              <div className="flex items-center gap-1 font-mono text-xs text-rose-400 group-hover:translate-x-1 transition">
                <span>Apri Diario</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </GlassCard>
        </Link>
      </section>
    </main>
  );
}
