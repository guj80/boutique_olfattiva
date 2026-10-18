'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Library, Sparkles, Plus, Feather } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';

export default function Home() {
  const [profumi, setProfumi] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const { data } = await supabase.from('profumi').select('*').order('id', { ascending: false }).limit(4);
        setProfumi(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHomeData();
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-10 pb-36 space-y-12">
      <header className="flex flex-col items-center text-center space-y-4 pt-6 pb-6 border-b border-[#D8B995]/20">
        <div className="relative p-4">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(216,185,149,0.25)_0%,transparent_70%)] blur-xl" />
          <div className="relative z-10 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 border-[#D8B995]/40 bg-[#1E1428] shadow-2xl">
            <Logo className="h-12 sm:h-14" />
          </div>
        </div>
        
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-wide">L&apos;Aura</h1>
          <p className="font-mono text-xs text-[#D8B995] uppercase tracking-widest">Digital Luxury Perfume Boutique</p>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[28px] border border-[#D8B995]/30 bg-gradient-to-r from-[#1E1428] via-[#241732] to-[#1E1428] p-8 text-center shadow-2xl">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#D8B995]/10 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-[#9B7EDE]/10 blur-3xl" />
        
        <div className="relative z-10 space-y-3 max-w-xl mx-auto">
          <Feather className="h-6 w-6 text-[#D8B995] mx-auto opacity-80" />
          <h2 className="font-serif text-xl sm:text-2xl text-[#F6EFE4] italic">
            &ldquo;Il profumo è l&apos;ombra invisibile che precede e segue ogni presenza.&rdquo;
          </h2>
          <p className="font-mono text-[11px] text-[#B8A9C9] uppercase tracking-widest">— Cabinet de Curiosités olfattive</p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/collezione"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[30px] border border-[#D8B995]/30 bg-gradient-to-b from-[#1E1428] to-[#140D1C] p-6 transition-all duration-300 hover:border-[#D8B995] hover:scale-[1.02] shadow-xl"
        >
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#D8B995]/10 blur-2xl group-hover:bg-[#D8B995]/20 transition-all" />
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D8B995]/10 text-[#D8B995] border border-[#D8B995]/20">
              <Library className="h-6 w-6" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995]/70">Collezione</span>
          </div>
          <div className="mt-8 space-y-1">
            <h2 className="font-serif text-2xl text-[#F6EFE4]">Lo Scaffale</h2>
            <p className="text-xs text-[#B8A9C9]">Esplora i flaconi firmati e la libreria artistica.</p>
          </div>
        </Link>

        <Link
          href="/collezione?vista=radar"
          className="group relative flex flex-col justify-between overflow-hidden rounded-[30px] border border-[#D8B995]/30 bg-gradient-to-b from-[#1E1428] to-[#140D1C] p-6 transition-all duration-300 hover:border-[#D8B995] hover:scale-[1.02] shadow-xl"
        >
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#9B7EDE]/10 blur-2xl group-hover:bg-[#9B7EDE]/20 transition-all" />
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9B7EDE]/10 text-[#9B7EDE] border border-[#9B7EDE]/20">
              <Compass className="h-6 w-6" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#9B7EDE]/70">Testing</span>
          </div>
          <div className="mt-8 space-y-1">
            <h2 className="font-serif text-2xl text-[#F6EFE4]">Il Radar</h2>
            <p className="text-xs text-[#B8A9C9]">Gestisci i campioni, i decant e le scoperte in corso.</p>
          </div>
        </Link>
      </section>

      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D8B995]" />
            <h3 className="font-serif text-xl text-[#F6EFE4]">Ultime Voci dell&apos;Atelier</h3>
          </div>
          <Link href="/collezione" className="text-xs font-mono text-[#D8B995] hover:underline">
            Vedi tutti →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-60 rounded-[24px] aura-skeleton" />
            ))}
          </div>
        ) : profumi.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#1E1428] p-8 text-center text-xs text-[#B8A9C9]">
            Nessun flacone nella boutique. Aggiungi il primo!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {profumi.map((p) => {
              const imgUrl = p.url_foto_vetrina || p.immagine_url;

              return (
                <Link
                  key={p.id}
                  href="/collezione"
                  className="group relative flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-4 transition hover:border-[#D8B995]"
                >
                  <div className="flex justify-center py-2">
                    <BottlePedestal src={imgUrl} alt={p.nome} size="md" className="!h-32 w-full" />
                  </div>
                  <div className="mt-3 space-y-0.5 text-center">
                    <p className="font-mono text-[9px] text-[#D8B995] uppercase truncate">{p.brand}</p>
                    <h4 className="font-serif text-sm text-[#F6EFE4] truncate group-hover:text-[#D8B995] transition-colors">{p.nome}</h4>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex justify-center pt-2">
        <Link
          href="/scanner"
          className="flex items-center gap-2.5 rounded-full bg-[#D8B995] px-8 py-3.5 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e] shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span>Aggiungi Nuovo Flacone</span>
        </Link>
      </section>
    </main>
  );
}
