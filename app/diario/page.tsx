'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, Indosso, Momento } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import {
  ArrowLeft,
  Loader2,
  BookOpen,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  FlaskConical,
} from 'lucide-react';

const MOMENTI: { key: Momento; label: string; icon: typeof Sun }[] = [
  { key: 'Mattina', label: 'Mattina', icon: Sunrise },
  { key: 'Pomeriggio', label: 'Pomeriggio', icon: Sun },
  { key: 'Sera', label: 'Sera', icon: Sunset },
  { key: 'Notte', label: 'Notte', icon: Moon },
];

function momentoIcon(m: string) {
  const found = MOMENTI.find((x) => x.key === m);
  if (!found) return Sun;
  return found.icon;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(indossi: Indosso[]): { date: string; entries: Indosso[] }[] {
  const map = new Map<string, Indosso[]>();
  for (const i of indossi) {
    const key = new Date(i.indossato_il).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }
  return Array.from(map.entries()).map(([, entries]) => ({
    date: entries[0].indossato_il,
    entries,
  }));
}

export default function DiarioPage() {
  const { user, loading: authLoading } = useAuth();
  const [indossi, setIndossi] = useState<Indosso[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('indossi')
      .select('*, profumo:profumi(nome, brand, famiglia_olfattiva, url_foto_vetrina)')
      .order('indossato_il', { ascending: false });
    setIndossi((data ?? []) as Indosso[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    const { error } = await supabase.from('indossi').delete().eq('id', id);
    if (!error) setIndossi((prev) => prev.filter((i) => i.id !== id));
    setDeleteId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
        <p className="tracking-wide-luxury text-xs uppercase text-muted-foreground mt-4">
          Caricamento diario...
        </p>
      </div>
    );
  }

  const groups = groupByDate(indossi);

  return (
    <div className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-muted-foreground hover:text-gold transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold gold-gradient-text">
          Scent Diary
        </h1>
        <div className="w-5" />
      </header>

      {indossi.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-gold/50" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
            Il diario è vuoto
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
            Premi &ldquo;Indossa Oggi&rdquo; su un profumo in Collezione per
            iniziare a registrare i tuoi indossi.
          </p>
          <Link
            href="/collezione"
            className="py-3 px-8 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95"
          >
            Vai alla Collezione
          </Link>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-8">
          {groups.map(({ date, entries }) => (
            <div key={date} className="animate-fade-in-up">
              <h2 className="tracking-wide-luxury text-[10px] uppercase text-gold font-medium mb-3 capitalize">
                {formatDate(date)}
              </h2>
              <div className="space-y-3">
                {entries.map((entry) => {
                  const MoIcon = momentoIcon(entry.momento);
                  return (
                    <div
                      key={entry.id}
                      className="glass rounded-2xl p-4 flex items-start gap-4 group hover:border-gold/20 transition-all"
                    >
                      {/* Perfume image or placeholder */}
                      <div className="w-14 h-14 rounded-xl bg-secondary/50 flex-shrink-0 overflow-hidden">
                        {entry.profumo?.url_foto_vetrina ? (
                          <img
                            src={entry.profumo.url_foto_vetrina}
                            alt={entry.profumo.nome}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FlaskConical className="w-6 h-6 text-gold/30" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-serif text-base font-semibold text-foreground truncate">
                              {entry.profumo?.nome ?? 'Profumo eliminato'}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.profumo?.brand}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteId === entry.id}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 flex-shrink-0"
                          >
                            {deleteId === entry.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <MoIcon className="w-3 h-3 text-gold/70" />
                            <span className="text-[10px] tracking-wide-luxury uppercase text-gold/70">
                              {entry.momento}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {formatTime(entry.indossato_il)}
                          </span>
                          {entry.profumo?.famiglia_olfattiva && (
                            <span className="text-[10px] text-muted-foreground/60 truncate">
                              {entry.profumo.famiglia_olfattiva}
                            </span>
                          )}
                        </div>

                        {entry.note_personali && (
                          <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed">
                            &ldquo;{entry.note_personali}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
