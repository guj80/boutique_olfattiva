'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Library, Compass, BookOpen, ChevronRight, ScanLine } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/GlassCard';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';

export default function HomePage() {
  const { setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
  }, [setCustomAura]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-10 pb-36 space-y-10">
      {/* HEADER PULITO */}
      <header className="flex flex-col items-center text-center space-y-3 pt-2">
        <div className="h-20 w-56 flex items-center justify-center p-2">
          <Logo variant="original" className="h-full w-full object-contain" />
        </div>
      </header>

      {/* HERO VETRINA SCULTOREA (ISPIRAZIONE BESGIN: FLACONE PROTAGONISTA & INTERAZIONE) */}
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#120A1A] p-8 sm:p-12 text-center shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.14)_0%,transparent_75%)] pointer-events-none" />
        
        <div className="relative z-10 max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#34F5A6]">
              Atelier Olfattivo
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4]">
              Collezione Privata
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scanner"
              onClick={() => setCustomAura(SECTION_THEMES.scanner)}
              className="flex items-center gap-2 rounded-full bg-[#34F5A6] px-6 py-3 font-mono text-xs font-bold text-[#08060C] transition hover:scale-105 shadow-lg"
            >
              <ScanLine className="h-4 w-4 stroke-[2.5]" />
              <span>Scannerizza</span>
            </Link>
            <Link
              href="/collezione"
              onClick={() => setCustomAura(SECTION_THEMES.collezione)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-[#1A1126] px-6 py-3 font-mono text-xs font-semibold text-[#F6EFE4] transition hover:border-white/40"
            >
              <Library className="h-4 w-4 text-sky-400" />
              <span>Esplora Vault</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ACCESSI RAPIDI AI TRE REPARTI */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLLEZIONE */}
        <Link href="/collezione" className="group block">
          <GlassCard accentColor="#38BDF8" className="h-full flex flex-col justify-between p-6 sm:p-7 transition duration-500 group-hover:-translate-y-1.5 shadow-2xl">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400 shadow-inner">
                <Library className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
                  Vault
                </span>
                <h3 className="font-serif text-2xl text-[#F6EFE4]">Collezione</h3>
                <p className="text-xs text-[#8E7C9E] leading-relaxed">
                  Libreria flaconi e piramidi olfattive.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400/80">Archivio</span>
              <div className="flex items-center gap-1 font-mono text-xs text-sky-400 group-hover:translate-x-1 transition">
                <span>Apri</span>
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
                  Scouting
                </span>
                <h3 className="font-serif text-2xl text-[#F6EFE4]">Testing</h3>
                <p className="text-xs text-[#8E7C9E] leading-relaxed">
                  Campioni e decant in fase d'analisi.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400/80">Radar</span>
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
                  Memoria
                </span>
                <h3 className="font-serif text-2xl text-[#F6EFE4]">Diario</h3>
                <p className="text-xs text-[#8E7C9E] leading-relaxed">
                  Registro indossi e rotazione stagionale.
                </p>
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/10 mt-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400/80">Storico</span>
              <div className="flex items-center gap-1 font-mono text-xs text-rose-400 group-hover:translate-x-1 transition">
                <span>Apri</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </GlassCard>
        </Link>
      </section>
    </main>
  );
}
