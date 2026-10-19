'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Flame,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  supabase,
  getLocalDateISO,
  isCollezioneProfumo,
  Indosso,
  Profumo,
} from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { GlassCard } from '@/components/GlassCard';
import { useAura, resolveAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';

const MOMENTI = [
  { label: 'Mattina', icon: Sunrise },
  { label: 'Pomeriggio', icon: Sun },
  { label: 'Sera', icon: Sunset },
  { label: 'Notte', icon: Moon },
];

export default function DiarioPage() {
  const [indossi, setIndossi] = useState<Indosso[]>([]);
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProfumoId, setSelectedProfumoId] = useState('');
  const [selectedMomento, setSelectedMomento] = useState('Pomeriggio');
  const [noteIndosso, setNoteIndosso] = useState('');
  const [saving, setSaving] = useState(false);

  const { setCustomAura } = useAura();
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.diario);
    fetchDiarioData();
  }, [setCustomAura]);

  async function fetchDiarioData() {
    try {
      const [indRes, profRes] = await Promise.all([
        supabase
          .from('indossi')
          .select('*, profumi(*)')
          .order('created_at', { ascending: false }),
        supabase.from('profumi').select('*').order('nome', { ascending: true }),
      ]);

      setIndossi((indRes.data || []) as Indosso[]);
      setProfumi((profRes.data || []) as Profumo[]);
      if (profRes.data?.[0]) {
        setSelectedProfumoId(profRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumoId || saving) return;
    setSaving(true);

    try {
      const payload = {
        profumo_id: selectedProfumoId,
        data_indosso: getLocalDateISO(),
        momento_giornata: selectedMomento,
        note_indosso: noteIndosso.trim() || null,
      };

      const { error } = await supabase.from('indossi').insert([payload]);
      if (error) throw error;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 40, 20]);
      }
      triggerSpruzzo();
      setNoteIndosso('');
      showToast('Indosso registrato nel Diario', 'success');
      fetchDiarioData();
    } catch (err) {
      showToast('Errore durante la registrazione.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      const { error } = await supabase.from('indossi').delete().eq('id', id);
      if (error) throw error;
      showToast('Voce rimossa dal Diario', 'success');
      setIndossi((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      showToast('Impossibile rimuovere la voce.', 'error');
    }
  }

  const ownedProfumi = profumi.filter(isCollezioneProfumo);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-5 pb-36 space-y-8">
      <header className="flex items-center gap-3 pt-2 pb-2">
        <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 border border-white/10 p-2 shadow-lg">
          <Logo variant="black" className="h-full w-full" />
        </div>
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
            Diario Olfattivo
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E7C9E]">
            Registrazione indossi • Rotazione &amp; Statistiche
          </p>
        </div>
      </header>

      <GlassCard accentColor="#FB7185" className="p-5 sm:p-7 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-400">
            <BookOpen className="h-4 w-4" />
          </div>
          <h2 className="font-serif text-xl text-[#F6EFE4]">Registra Indosso di Oggi</h2>
        </div>

        <form onSubmit={handleAddIndosso} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#8E7C9E]">
                Fragranza
              </label>
              <select
                value={selectedProfumoId}
                onChange={(e) => setSelectedProfumoId(e.target.value)}
                className="w-full rounded-[16px] border border-white/10 bg-[#050308] px-4 py-3 text-xs sm:text-sm text-[#F6EFE4] focus:border-rose-400/50 focus:outline-none"
              >
                {ownedProfumi.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} — {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-[#8E7C9E]">
                Momento della Giornata
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {MOMENTI.map((m) => {
                  const Icon = m.icon;
                  const active = selectedMomento === m.label;
                  return (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => setSelectedMomento(m.label)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 font-mono text-[10px] border transition ${
                        active
                          ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                          : 'border-white/10 bg-[#050308] text-[#8E7C9E] hover:border-white/20'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#8E7C9E]">
              Note sulla pelle o contesto (Opzionale)
            </label>
            <input
              type="text"
              value={noteIndosso}
              onChange={(e) => setNoteIndosso(e.target.value)}
              placeholder="Es. Sillage notevole, ottima persistenza con il calore..."
              className="w-full rounded-[16px] border border-white/10 bg-[#050308] px-4 py-3 text-xs sm:text-sm text-[#F6EFE4] placeholder:text-[#8E7C9E]/50 focus:border-rose-400/50 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || ownedProfumi.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-rose-500 py-3.5 text-xs font-bold uppercase tracking-wider text-[#050308] transition hover:bg-rose-400 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            <span>Registra Indosso</span>
          </button>
        </form>
      </GlassCard>

      <div className="space-y-4">
        <h3 className="font-serif text-2xl text-[#F6EFE4]">Cronologia Indossi</h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-[20px] aura-skeleton" />
            ))}
          </div>
        ) : indossi.length === 0 ? (
          <GlassCard className="p-8 text-center text-xs text-[#8E7C9E]">
            Nessun indosso registrato nel Diario. Inizia a tracciare la tua rotazione quotidiana.
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {indossi.map((item) => {
              const p = item.profumi;
              const pAura = resolveAura(p?.famiglia_olfattiva, p?.nome);

              return (
                <div
                  key={item.id}
                  style={{ borderColor: `${pAura.primary}35` }}
                  className="flex items-center justify-between rounded-[22px] border bg-[#090612]/95 p-4 shadow-lg transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <BottlePedestal
                      src={p?.url_foto_vetrina || p?.immagine_url}
                      alt={p?.nome || 'Fragranza'}
                      size="sm"
                      className="!h-14 !w-14 shrink-0"
                      showSigil={true}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-rose-300">
                          {item.data_indosso || item.created_at?.slice(0, 10)}
                        </span>
                        {item.momento_giornata && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] text-[#B8A9C9]">
                            {item.momento_giornata}
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif text-base text-[#F6EFE4] truncate">
                        {p ? `${p.brand} — ${p.nome}` : 'Fragranza rimossa'}
                      </h4>
                      {item.note_indosso && (
                        <p className="text-xs text-[#8E7C9E] truncate">
                          {item.note_indosso}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteIndosso(item.id)}
                    title="Elimina voce"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8E7C9E] hover:border-rose-400 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
