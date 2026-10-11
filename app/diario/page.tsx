'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Sparkles,
  Trash2,
  Plus,
  X,
  Wine,
} from 'lucide-react';
import {
  supabase,
  Indosso,
  Momento,
  Profumo,
  isCollezioneProfumo,
} from '@/lib/supabase';

export default function DiarioOlfattivoPage() {
  const [indossi, setIndossi] = useState<Indosso[]>([]);
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale nuovo indosso dal Diario
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedProfumoId, setSelectedProfumoId] = useState('');
  const [momento, setMomento] = useState<Momento>('Sera');
  const [contesto, setContesto] = useState('');
  const [noteGiorno, setNoteGiorno] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDiario = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profumiData } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });

      const allProfumi = (profumiData || []) as Profumo[];
      const colProfumi = allProfumi.filter(isCollezioneProfumo);
      setProfumi(colProfumi);
      if (colProfumi.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(colProfumi[0].id);
      }

      const { data: indossiData } = await supabase
        .from('indossi')
        .select('*')
        .order('created_at', { ascending: false });

      const mapped = ((indossiData || []) as Indosso[]).map((ind) => ({
        ...ind,
        profumi: allProfumi.find((p) => p.id === ind.profumo_id) || null,
      }));
      setIndossi(mapped);
    } catch (err) {
      console.error('Errore caricamento diario:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProfumoId]);

  useEffect(() => {
    fetchDiario();
  }, [fetchDiario]);

  async function handleAddIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumoId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: selectedProfumoId,
          momento_giornata: momento,
          contesto_outfit: contesto || null,
          note_giorno: noteGiorno || null,
        },
      ]);
      if (error) throw error;
      setShowNewModal(false);
      setContesto('');
      setNoteGiorno('');
      await fetchDiario();
    } catch (err: any) {
      alert(err?.message || 'Errore salvataggio indosso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      await supabase.from('indossi').delete().eq('id', id);
      setIndossi((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#C5A059]">
              Scent Tracker &amp; Cronologia
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-white">
              Diario Olfattivo di Luca ({indossi.length})
            </h1>
          </div>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-xs font-mono uppercase tracking-wider shadow-champagne-glow"
        >
          <Plus className="w-4 h-4" />
          <span>Registra Indosso</span>
        </button>
      </div>

      <section className="mt-8 space-y-4">
        {loading ? (
          <div className="p-12 text-center font-mono text-sm text-[#F7E7CE]">
            Caricamento del Diario Olfattivo...
          </div>
        ) : indossi.length === 0 ? (
          <div className="boutique-glass rounded-2xl p-12 text-center space-y-3">
            <Calendar className="w-8 h-8 text-[#C5A059] mx-auto" />
            <h2 className="font-serif text-2xl text-white">
              Nessun indosso ancora registrato
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Clicca su &ldquo;Registra Indosso&rdquo; qui sopra o sul pulsante &ldquo;⌚ Indossa&rdquo; dentro la tua Collezione per tenere traccia delle tue fragranze del giorno.
            </p>
          </div>
        ) : (
          indossi.map((item) => {
            const p = item.profumi;
            const mom = item.momento_giornata || item.momento || 'Giornata';
            const note = item.note_giorno || item.note || '';
            const dateStr = item.data_indosso || item.created_at || '';

            return (
              <div
                key={item.id}
                className="boutique-glass boutique-glass-hover rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#C5A059]/20 text-[#F7E7CE] border border-[#F7E7CE]/25">
                      {mom}
                    </span>
                    {dateStr && (
                      <span className="font-mono text-xs text-zinc-400">
                        {new Date(dateStr).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    {item.contesto_outfit && (
                      <span className="text-xs text-[#C5A059] font-mono">
                        • {item.contesto_outfit}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif text-xl sm:text-2xl text-white">
                    {p ? p.nome : 'Fragranza del Vault'}{' '}
                    {p?.brand && (
                      <span className="text-[#C5A059] text-lg font-normal">
                        — {p.brand}
                      </span>
                    )}
                  </h3>

                  {note && (
                    <p className="text-sm text-zinc-300 italic">&ldquo;{note}&rdquo;</p>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteIndosso(item.id)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition self-end sm:self-center"
                  title="Elimina voce dal diario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </section>

      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-[#F7E7CE]/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl text-white">Nuovo Indosso</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddIndosso} className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Seleziona Profumo dalla Collezione
                </label>
                <select
                  value={selectedProfumoId}
                  onChange={(e) => setSelectedProfumoId(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2.5 text-sm text-white"
                >
                  {profumi.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Momento della Giornata
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMomento(m)}
                      className={`py-2 rounded-xl font-mono text-xs border transition ${
                        momento === m
                          ? 'bg-[#F7E7CE] text-[#08080A] border-[#F7E7CE] font-semibold'
                          : 'bg-[#08080A] text-zinc-400 border-[#F7E7CE]/20'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Contesto / Outfit
                </label>
                <input
                  type="text"
                  value={contesto}
                  onChange={(e) => setContesto(e.target.value)}
                  placeholder="Es. Cena, Ufficio, Evento serale..."
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Note del Giorno
                </label>
                <textarea
                  rows={3}
                  value={noteGiorno}
                  onChange={(e) => setNoteGiorno(e.target.value)}
                  placeholder="Evoluzione sulla pelle oggi, spruzzi, complimenti..."
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-3 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm"
                >
                  {saving ? 'Salvataggio...' : 'Salva nel Diario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
