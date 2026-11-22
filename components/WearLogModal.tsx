'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, X, Plus } from 'lucide-react';
import { supabase, Profumo } from '@/lib/supabase';
import { BottlePedestal } from './BottleImage';
import { resolveAura } from './AuraProvider';
import { useToast } from './Toast';
import { useSpruzzo } from './Spruzzo';
import { getAutoMomento, getLocalIsoDate } from '@/lib/home-logic';

interface WearLogModalProps {
  open: boolean;
  profumi: Profumo[];
  onClose: () => void;
  onSaved: () => void;
}

const MOMENT_OPTIONS = ['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const;

const CONTEXT_CHIPS = [
  'Ufficio',
  'Sera',
  'Tempo Libero',
  'Viaggio',
  'Cerimonia',
  'Casa',
] as const;

const PERFORMANCE_CHIPS = [
  'Scia Intensa',
  'Intimo',
  'Persistente 8h+',
  'Fresco',
  'Avvolgente',
  'Complimenti',
] as const;

export function WearLogModal({
  open,
  profumi,
  onClose,
  onSaved,
}: WearLogModalProps) {
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [wearData, setWearData] = useState(getLocalIsoDate());
  const [momento, setMomento] = useState<(typeof MOMENT_OPTIONS)[number]>(
    getAutoMomento()
  );
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFreeNote, setShowFreeNote] = useState(false);
  const [freeNote, setFreeNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setWearData(getLocalIsoDate());
      setMomento(getAutoMomento());
      setSelectedContext(null);
      setSelectedTags([]);
      setShowFreeNote(false);
      setFreeNote('');
      setQuery('');
      if (profumi.length > 0 && !selectedId) {
        setSelectedId(profumi[0].id);
      }
    }
  }, [open, profumi, selectedId]);

  const filteredProfumi = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profumi;
    return profumi.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.famiglia_olfattiva || '').toLowerCase().includes(q)
    );
  }, [profumi, query]);

  const activeProfumo = useMemo(
    () => profumi.find((p) => p.id === selectedId) || profumi[0] || null,
    [profumi, selectedId]
  );

  if (!open) return null;

  const activeAura = activeProfumo
    ? resolveAura(activeProfumo.famiglia_olfattiva, activeProfumo.nome)
    : resolveAura('Legnosa');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !activeProfumo) return;

    setSaving(true);
    try {
      const customDate = new Date(`${wearData}T12:00:00`);
      const now = new Date();
      customDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const parts = [...selectedTags];
      if (freeNote.trim()) {
        parts.push(freeNote.trim());
      }

      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: activeProfumo.id,
          momento_giornata: momento,
          contesto_outfit: selectedContext || null,
          note_giorno: parts.length > 0 ? parts.join(' · ') : null,
          created_at: customDate.toISOString(),
        },
      ]);

      if (error) throw error;

      triggerSpruzzo();
      showToast(`${activeProfumo.nome} registrato nel Diario.`);
      onClose();
      onSaved();
    } catch (err: any) {
      showToast(err?.message || 'Errore salvataggio indosso.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050308]/88 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: `${activeAura.primary}60` }}
        className="relative w-full max-w-lg rounded-[32px] border bg-[#0E0A16] p-6 sm:p-7 text-[#F6EFE4] shadow-2xl my-6 max-h-[90dvh] overflow-y-auto no-scrollbar mb-16"
      >
        <div
          aria-hidden="true"
          style={{ backgroundColor: activeAura.primary }}
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-80 rounded-full blur-3xl opacity-20 transition-colors duration-500"
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span
              style={{ color: activeAura.primary }}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
            >
              Diario Olfattivo
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#F6EFE4]">
              Registra Indosso
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161024] text-[#B8A9C9] transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 mt-5 space-y-5">
          {/* 1. Selettore Flacone Visivo + Ricerca Rapida */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A9C9]/60" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtra creazione o maison..."
                className="w-full rounded-full border border-white/10 bg-[#161024] pl-9 pr-4 py-2 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:border-white/30 focus:outline-none"
              />
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {filteredProfumi.map((p) => {
                const isSelected = activeProfumo?.id === p.id;
                const pAura = resolveAura(p.famiglia_olfattiva, p.nome);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      borderColor: isSelected
                        ? pAura.primary
                        : 'rgba(255, 255, 255, 0.08)',
                    }}
                    className={`flex w-28 shrink-0 flex-col items-center rounded-2xl border p-2.5 text-center transition ${
                      isSelected
                        ? 'bg-[#161024] shadow-lg'
                        : 'bg-[#08060C]/80 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="h-14 w-14 flex items-center justify-center">
                      <BottlePedestal
                        src={p.url_foto_vetrina || p.immagine_url}
                        alt={p.nome}
                        bare={true}
                        className="h-full w-full"
                      />
                    </div>
                    <p className="mt-1.5 w-full truncate font-mono text-[8.5px] uppercase tracking-wider text-[#B8A9C9]">
                      {p.brand}
                    </p>
                    <p className="w-full truncate font-serif text-xs text-[#F6EFE4]">
                      {p.nome}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Momento + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8 space-y-1.5">
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                Momento
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-[#161024] p-1">
                {MOMENT_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMomento(m)}
                    style={
                      momento === m
                        ? { backgroundColor: activeAura.primary, color: '#050308' }
                        : undefined
                    }
                    className={`rounded-full py-1.5 text-[11px] font-bold transition ${
                      momento === m
                        ? 'shadow-sm'
                        : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label
                htmlFor="wear-date"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]"
              >
                Data
              </label>
              <input
                id="wear-date"
                type="date"
                value={wearData}
                max={getLocalIsoDate()}
                onChange={(e) => setWearData(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-[#161024] px-3 py-1.5 text-xs text-[#F6EFE4] focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Contesto a 1 Tocco */}
          <div className="space-y-2">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
              Contesto
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS.map((ctx) => {
                const active = selectedContext === ctx;
                return (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() =>
                      setSelectedContext((prev) => (prev === ctx ? null : ctx))
                    }
                    style={
                      active
                        ? {
                            borderColor: activeAura.primary,
                            backgroundColor: `${activeAura.primary}22`,
                            color: '#F6EFE4',
                          }
                        : undefined
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'font-semibold'
                        : 'border-white/10 bg-[#161024]/80 text-[#B8A9C9] hover:border-white/25 hover:text-[#F6EFE4]'
                    }`}
                  >
                    {ctx}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Resa sulla Pelle (Multi-selezione) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                Resa sulla pelle
              </span>
              {!showFreeNote && (
                <button
                  type="button"
                  onClick={() => setShowFreeNote(true)}
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-[#B8A9C9] hover:text-[#F6EFE4]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Nota</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PERFORMANCE_CHIPS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={
                      active
                        ? {
                            borderColor: activeAura.primary,
                            backgroundColor: `${activeAura.primary}22`,
                            color: '#F6EFE4',
                          }
                        : undefined
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'font-semibold'
                        : 'border-white/10 bg-[#161024]/80 text-[#B8A9C9] hover:border-white/25 hover:text-[#F6EFE4]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {showFreeNote && (
              <input
                type="text"
                value={freeNote}
                onChange={(e) => setFreeNote(e.target.value)}
                placeholder="Nota libera facoltativa..."
                className="mt-2 w-full rounded-2xl border border-white/15 bg-[#161024] px-4 py-2.5 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:outline-none"
              />
            )}
          </div>

          {/* Azioni */}
          <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9] hover:text-white"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving || !activeProfumo}
              style={{ backgroundColor: activeAura.primary }}
              className="flex items-center gap-1.5 rounded-full px-6 py-2.5 text-xs font-bold text-[#050308] shadow-lg transition hover:opacity-95 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{saving ? 'Salvataggio...' : 'Conferma'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
