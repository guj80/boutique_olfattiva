'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Profumo } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { ArrowLeft, Camera, Loader2, Trash2, FlaskConical } from 'lucide-react';

export default function CollezionePage() {
  const { user, loading: authLoading } = useAuth();
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profumi')
        .select('*')
        .order('created_at', { ascending: false });

      setProfumi((data ?? []) as Profumo[]);
      setLoading(false);
    })();
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    const { error } = await supabase.from('profumi').delete().eq('id', id);
    if (!error) {
      setProfumi((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <p className="tracking-wide-luxury text-xs uppercase text-muted-foreground mt-4">
          Caricamento collezione...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-xl font-semibold gold-gradient-text">
          Collezione
        </h1>
        <Link
          href="/scanner"
          className="text-muted-foreground hover:text-gold transition-colors"
        >
          <Camera className="w-5 h-5" />
        </Link>
      </header>

      {/* Count */}
      {profumi.length > 0 && (
        <p className="tracking-wide-luxury text-[10px] text-muted-foreground uppercase mb-6">
          {profumi.length} {profumi.length === 1 ? 'Profumo' : 'Profumi'}
        </p>
      )}

      {/* Empty State */}
      {profumi.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
            <FlaskConical className="w-8 h-8 text-gold/50" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
            Nessun profumo in cassaforte
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs">
            La tua collezione è vuota. Scansiona il tuo primo flacone per
            iniziare il diario olfattivo.
          </p>
          <Link
            href="/scanner"
            className="py-3 px-8 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95"
          >
            Scansiona
          </Link>
        </div>
      )}

      {/* Grid */}
      {profumi.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profumi.map((profumo, idx) => (
            <div
              key={profumo.id}
              className="glass rounded-2xl p-5 animate-fade-in-up hover:border-gold/20 transition-colors group"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg font-semibold text-foreground truncate">
                    {profumo.nome}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {profumo.brand}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(profumo.id)}
                  disabled={deleteId === profumo.id}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 disabled:opacity-50"
                  aria-label="Elimina"
                >
                  {deleteId === profumo.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {profumo.famiglia_olfattiva && (
                <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-3">
                  {profumo.famiglia_olfattiva}
                </p>
              )}

              {profumo.prezzo_stimato_euro &&
                profumo.prezzo_stimato_euro !== 'N/D' && (
                  <p className="font-mono text-base text-gold-light">
                    {profumo.prezzo_stimato_euro}
                  </p>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
