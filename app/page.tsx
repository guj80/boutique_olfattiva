'use client';

import Link from 'next/link';
import { supabase, Profumo } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Camera, Library, Sparkles, TrendingUp, Euro } from 'lucide-react';

export default function HomePage() {
  const [latest, setLatest] = useState<Profumo | null>(null);
  const [count, setCount] = useState(0);
  const [families, setFamilies] = useState<string[]>([]);
  const [avgPrice, setAvgPrice] = useState<string>('—');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('profumi')
          .select('*')
          .order('created_at', { ascending: false });

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
        console.error('Errore nel caricamento:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <header className="text-center mb-12 animate-fade-in-up">
        <h1 className="font-serif text-4xl font-semibold gold-gradient-text">
          Boutique
        </h1>
        <p className="tracking-luxury text-xs text-muted-foreground uppercase mt-2">
          Diario Olfattivo
        </p>
      </header>

      {/* Scent of the Day */}
      <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-gold" />
          <h2 className="tracking-wide-luxury text-xs text-gold uppercase font-medium">
            Scent of the Day
          </h2>
        </div>
        {latest ? (
          <div className="glass-gold rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-1">
                  {latest.nome}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {latest.brand}
                </p>
                {latest.famiglia_olfattiva && (
                  <p className="tracking-wide-luxury text-[10px] text-gold uppercase">
                    {latest.famiglia_olfattiva}
                  </p>
                )}
              </div>
              {latest.prezzo_stimato_euro && latest.prezzo_stimato_euro !== 'N/D' && (
                <p className="font-mono text-lg text-gold-light">
                  {latest.prezzo_stimato_euro}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessun profumo in collezione. Scansiona il tuo primo flacone per
              iniziare il tuo diario olfattivo.
            </p>
          </div>
        )}
      </section>

      {/* Stats */}
      {count > 0 && (
        <section className="grid grid-cols-3 gap-3 mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass rounded-xl p-4 text-center">
            <Library className="w-4 h-4 text-gold mx-auto mb-2" />
            <p className="font-serif text-2xl font-semibold text-foreground">{count}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">
              Profumi
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
              Medio
            </p>
          </div>
        </section>
      )}

      {/* Navigation Grid */}
      <section className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Link
          href="/collezione"
          className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/20 group"
        >
          <Library className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
          <span className="tracking-wide-luxury text-xs uppercase font-medium">
            Collezione
          </span>
        </Link>
        <Link
          href="/scanner"
          className="glass-gold rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/30 group"
        >
          <Camera className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
          <span className="tracking-wide-luxury text-xs uppercase font-medium text-gold">
            Scanner
          </span>
        </Link>
      </section>
    </div>
  );
}
