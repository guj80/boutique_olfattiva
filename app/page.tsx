'use client';

import Link from 'next/link';
import { supabase, Profumo } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Camera, Library, Sparkles, TrendingUp, Euro, Compass, PlusCircle } from 'lucide-react';

export default function HomePage() {
  const [latest, setLatest] = useState<Profumo | null>(null);
  const [count, setCount] = useState(0);
  const [radarCount, setRadarCount] = useState(0);
  const [families, setFamilies] = useState<string[]>([]);
  const [avgPrice, setAvgPrice] = useState<string>('—');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Carichiamo i profumi della collezione principale
        const { data } = await supabase
          .from('profumi')
          .select('*')
          .eq('stato', 'collezione')
          .order('created_at', { ascending: false });

        // Carichiamo quanti profumi abbiamo in radar (test in boutique)
        const { count: rCount } = await supabase
          .from('profumi')
          .select('*', { count: 'exact', head: true })
          .eq('stato', 'radar');

        if (rCount) setRadarCount(rCount);

        if (data && data.length > 0) {
          setLatest(data[0] as Profumo);
          setCount(data.length);
          
          const uniqueFamilies = Array.from(
            new Set(
              data
                .map((p: Profumo) => p.famiglia_olfattiva)
                .filter((f): f is string => f !== null)
            )
          );
          setFamilies(uniqueFamilies);

          const prices = data
            .map((p: Profumo) => {
              const match = p.prezzo_stimato_euro?.match(/[\d.,]+/);
              return match ? parseFloat(match[0].replace('.', '').replace(',', '.')) : null;
            })
            .filter((v: number | null): v is number => v !== null && v > 0);

          if (prices.length > 0) {
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            setAvgPrice(`€${Math.round(avg)}`);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento della home:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto flex flex-col justify-between">
      {/* Header Personalizzato */}
      <div>
        <header className="text-center mb-10 animate-fade-in-up">
          <p className="tracking-luxury text-xs text-gold uppercase mb-2">Boutique Olfattiva di</p>
          <h1 className="font-serif text-5xl font-semibold italic text-gold-light">
            Luca
          </h1>
        </header>

        {/* Scent of the Day (Il profumo del giorno) */}
        <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-gold" />
            <h2 className="tracking-wide-luxury text-xs text-gold uppercase font-medium">
              Scent of the Day
            </h2>
          </div>
          {latest ? (
            <div className="glass-gold rounded-2xl p-6 transition-transform hover:scale-[1.01]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">{latest.brand}</p>
                  <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                    {latest.nome}
                  </h3>
                  {latest.famiglia_olfattiva && (
                    <span className="inline-block bg-background/50 border border-gold/20 text-gold text-[10px] tracking-wide-luxury uppercase px-2.5 py-1 rounded-full">
                      {latest.famiglia_olfattiva}
                    </span>
                  )}
                </div>
                {latest.prezzo_stimato_euro && latest.prezzo_stimato_euro !== 'N/D' && (
                  <p className="font-mono text-base text-gold-light">
                    {latest.prezzo_stimato_euro}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nessun profumo in collezione. Inizia ad aggiungere la tua prima essenza.
              </p>
            </div>
          )}
        </section>

        {/* Statistiche della Collezione */}
        {count > 0 && (
          <section className="grid grid-cols-3 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass rounded-xl p-4 text-center">
              <Library className="w-4 h-4 text-gold mx-auto mb-2" />
              <p className="font-serif text-2xl font-semibold text-foreground">{count}</p>
              <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">
                Collezione
              </p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <TrendingUp className="w-4 h-4 text-gold mx-auto mb-2" />
              <p className="font-serif text-2xl font-semibold text-foreground">{families.length}</p>
              <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">
                Famiglie
              </p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Euro className="w-4 h-4 text-gold mx-auto mb-2" />
              <p className="font-mono text-lg font-semibold text-foreground">{avgPrice}</p>
              <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">
                Valore Medio
              </p>
            </div>
          </section>
        )}

        {/* Griglia di Navigazione Principale */}
        <section className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Link
            href="/collezione"
            className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/30 group"
          >
            <Library className="w-7 h-7 text-gold group-hover:scale-110 transition-transform" />
            <div className="text-center">
              <span className="tracking-wide-luxury text-xs uppercase font-medium block">Collezione</span>
              <span className="text-[10px] text-muted-foreground">I tuoi flaconi</span>
            </div>
          </Link>

          <Link
            href="/scanner"
            className="glass-gold rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/50 group"
          >
            <Camera className="w-7 h-7 text-gold group-hover:scale-110 transition-transform" />
            <div className="text-center">
              <span className="tracking-wide-luxury text-xs uppercase font-medium text-gold block">Aggiungi / Scanner</span>
              <span className="text-[10px] text-muted-foreground">AI Zero-Click</span>
            </div>
          </Link>
        </section>

        {/* Accesso Rapido Radar Boutique */}
        <section className="mt-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Link
            href="/radar"
            className="glass rounded-xl p-4 flex items-center justify-between transition-all hover:border-gold/30 group"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-gold group-hover:rotate-45 transition-transform" />
              <div>
                <p className="text-xs uppercase tracking-wide-luxury font-medium text-foreground">Radar Boutique (Test)</p>
                <p className="text-[10px] text-muted-foreground">Profumi provati su pelle o mouche</p>
              </div>
            </div>
            <span className="font-mono text-xs bg-gold/10 text-gold px-2.5 py-1 rounded-full border border-gold/20">
              {radarCount} testati
            </span>
          </Link>
        </section>
      </div>

      {/* Footer minimal */}
      <footer className="mt-12 text-center text-[10px] tracking-widest text-muted-foreground uppercase">
        Boutique Olfattiva • Private Archive
      </footer>
    </div>
  );
}
