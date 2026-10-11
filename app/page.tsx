'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase, Profumo } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import {
  Camera,
  Library,
  Sparkles,
  TrendingUp,
  Euro,
  Heart,
  BookOpen,
  BookMarked,
  DollarSign,
} from 'lucide-react';

type Stats = {
  latest: Profumo | null;
  collezione: number;
  wishlist: number;
  daStudiare: number;
  families: number;
  avgPrice: string;
  totalValue: string;
  mostWorn: string | null;
};

export default function HomePage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats>({
    latest: null,
    collezione: 0,
    wishlist: 0,
    daStudiare: 0,
    families: 0,
    avgPrice: '—',
    totalValue: '—',
    mostWorn: null,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profumiData }, { data: indossiData }] = await Promise.all([
        supabase.from('profumi').select('*').order('created_at', { ascending: false }),
        supabase
          .from('indossi')
          .select('profumo_id, profumo:profumi(nome)')
          .order('indossato_il', { ascending: false }),
      ]);

      const all = (profumiData ?? []) as Profumo[];
      const collezioneItems = all.filter((p) => p.categoria === 'collezione');

      const uniqueFamilies = new Set(
        all.map((p) => p.famiglia_olfattiva).filter((f): f is string => !!f && f !== 'N/D')
      );

      const prices = collezioneItems
        .map((p) => {
          const match = p.prezzo_stimato_euro?.match(/[\d.,]+/);
          return match ? parseFloat(match[0].replace('.', '').replace(',', '.')) : null;
        })
        .filter((v): v is number => v !== null && v > 0);

      const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      const total = prices.reduce((a, b) => a + b, 0);

      // Most worn: count per profumo_id in indossi
      let mostWorn: string | null = null;
      if (indossiData && indossiData.length > 0) {
        const counts: Record<string, { count: number; nome: string }> = {};
        for (const row of (indossiData as unknown) as { profumo_id: string; profumo: { nome: string } | null }[]) {
          const pid = row.profumo_id;
          if (!counts[pid]) counts[pid] = { count: 0, nome: row.profumo?.nome ?? '' };
          counts[pid].count++;
        }
        const top = Object.values(counts).sort((a, b) => b.count - a.count)[0];
        if (top) mostWorn = top.nome;
      }

      setStats({
        latest: all[0] ?? null,
        collezione: collezioneItems.length,
        wishlist: all.filter((p) => p.categoria === 'wishlist').length,
        daStudiare: all.filter((p) => p.categoria === 'da_studiare').length,
        families: uniqueFamilies.size,
        avgPrice: avg > 0 ? `€${avg}` : '—',
        totalValue: total > 0 ? `€${Math.round(total).toLocaleString('it-IT')}` : '—',
        mostWorn,
      });
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center max-w-md mx-auto animate-fade-in-up">
          <div className="mb-8">
            <h1 className="font-serif text-5xl font-semibold gold-gradient-text mb-3">Boutique</h1>
            <p className="tracking-luxury text-xs text-muted-foreground uppercase">Diario Olfattivo</p>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10 max-w-xs mx-auto">
            Il tuo Pokédex di lusso dei profumi. Scansiona, ricerca, colleziona
            e studia i tuoi flaconi con l&apos;aiuto dell&apos;intelligenza artificiale.
          </p>
          <div className="space-y-3">
            <Link href="/login" className="block w-full py-4 rounded-xl gold-gradient-bg text-black font-medium text-sm tracking-wide-luxury uppercase text-center transition-transform active:scale-95 hover:opacity-90">
              Accedi
            </Link>
            <Link href="/signup" className="block w-full py-4 rounded-xl glass text-foreground font-medium text-sm tracking-wide-luxury uppercase text-center transition-transform active:scale-95 hover:bg-white/5">
              Crea un Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <header className="text-center mb-10 animate-fade-in-up">
        <h1 className="font-serif text-4xl font-semibold gold-gradient-text">Boutique</h1>
        <p className="tracking-luxury text-xs text-muted-foreground uppercase mt-2">Diario Olfattivo</p>
      </header>

      {/* Scent of the Day */}
      <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold" />
          <h2 className="tracking-wide-luxury text-xs text-gold uppercase font-medium">Scent of the Day</h2>
        </div>
        {stats.latest ? (
          <div className="glass-gold rounded-2xl p-5 overflow-hidden">
            <div className="flex items-start gap-4">
              {stats.latest.url_foto_vetrina && (
                <img
                  src={stats.latest.url_foto_vetrina}
                  alt={stats.latest.nome}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-xl font-semibold text-foreground mb-0.5 truncate">{stats.latest.nome}</h3>
                <p className="text-sm text-muted-foreground mb-2 truncate">{stats.latest.brand}</p>
                {stats.latest.famiglia_olfattiva && (
                  <p className="tracking-wide-luxury text-[10px] text-gold uppercase">{stats.latest.famiglia_olfattiva}</p>
                )}
              </div>
              {stats.latest.prezzo_stimato_euro && stats.latest.prezzo_stimato_euro !== 'N/D' && (
                <p className="font-mono text-lg text-gold-light flex-shrink-0">{stats.latest.prezzo_stimato_euro}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessun profumo. Scansiona il tuo primo flacone o aggiungilo manualmente.
            </p>
          </div>
        )}
      </section>

      {/* Stats row 1 — categories */}
      {(stats.collezione > 0 || stats.wishlist > 0 || stats.daStudiare > 0) && (
        <section className="grid grid-cols-3 gap-3 mb-4 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="glass rounded-xl p-4 text-center">
            <Library className="w-4 h-4 text-gold mx-auto mb-2" />
            <p className="font-serif text-2xl font-semibold text-foreground">{stats.collezione}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Collezione</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <Heart className="w-4 h-4 text-rose-400 mx-auto mb-2" />
            <p className="font-serif text-2xl font-semibold text-foreground">{stats.wishlist}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Wishlist</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <BookOpen className="w-4 h-4 text-amber-400 mx-auto mb-2" />
            <p className="font-serif text-2xl font-semibold text-foreground">{stats.daStudiare}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Da Studiare</p>
          </div>
        </section>
      )}

      {/* Stats row 2 — value metrics */}
      {stats.collezione > 0 && (
        <section className="grid grid-cols-2 gap-3 mb-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass rounded-xl p-4 text-center">
            <Euro className="w-4 h-4 text-gold mx-auto mb-2" />
            <p className="font-mono text-lg font-semibold text-foreground">{stats.avgPrice}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Prezzo Medio</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <DollarSign className="w-4 h-4 text-gold mx-auto mb-2" />
            <p className="font-mono text-lg font-semibold text-foreground">{stats.totalValue}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Valore Totale</p>
          </div>
        </section>
      )}

      {/* Stats row 3 — families + most worn */}
      {stats.collezione > 0 && (
        <section className="grid grid-cols-2 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="glass rounded-xl p-4 text-center">
            <TrendingUp className="w-4 h-4 text-gold mx-auto mb-2" />
            <p className="font-serif text-xl font-semibold text-foreground">{stats.families}</p>
            <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Famiglie Olfattive</p>
          </div>
          {stats.mostWorn && (
            <div className="glass rounded-xl p-4 text-center">
              <BookMarked className="w-4 h-4 text-gold mx-auto mb-2" />
              <p className="font-serif text-sm font-semibold text-foreground line-clamp-2 leading-tight">{stats.mostWorn}</p>
              <p className="tracking-wide-luxury text-[9px] text-muted-foreground uppercase mt-1">Più Indossato</p>
            </div>
          )}
        </section>
      )}

      {/* Navigation Grid */}
      <section className="grid grid-cols-2 gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Link href="/collezione" className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/20 group">
          <Library className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
          <span className="tracking-wide-luxury text-xs uppercase font-medium">Collezione</span>
        </Link>
        <Link href="/scanner" className="glass-gold rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/30 group">
          <Camera className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
          <span className="tracking-wide-luxury text-xs uppercase font-medium text-gold">Scanner</span>
        </Link>
      </section>

      <Link href="/diario" className="glass rounded-2xl p-5 flex items-center justify-center gap-3 transition-all active:scale-95 hover:border-gold/20 group animate-fade-in-up mb-12" style={{ animationDelay: '0.35s' }}>
        <BookMarked className="w-6 h-6 text-gold group-hover:scale-110 transition-transform" />
        <span className="tracking-wide-luxury text-xs uppercase font-medium">Scent Diary</span>
      </Link>

      <footer className="text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="text-[10px] tracking-wide-luxury uppercase text-muted-foreground hover:text-gold transition-colors"
        >
          Esci
        </button>
      </footer>
    </div>
  );
}
