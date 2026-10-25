'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CalendarHeart, Compass, Library, Sparkles, Check, X, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { SmartBottleImage } from '@/components/BottleImage';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { getLocalIsoDate, getAutoMomento, computePodio, getSmartConsultantSuggestions } from '@/lib/home-logic';

export default function HomePage() {
  const [profumi, setProfumi] = useState<any[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [wearModalOpen, setWearModalOpen] = useState(false);
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [wearData, setWearData] = useState<string>(getLocalIsoDate());
  const [wearMomento, setWearMomento] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>(getAutoMomento());
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const [consultantIndex, setConsultantIndex] = useState(0);

  const { aura, setCustomAura } = useAura();
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
    fetchHomeData();
  }, [setCustomAura]);

  async function fetchHomeData() {
    setLoading(true);
    setLoadError(false);
    try {
      const [profumiRes, indossiRes] = await Promise.all([
        supabase.from('profumi').select('*').order('nome', { ascending: true }),
        supabase.from('indossi').select('*').order('created_at', { ascending: false })
      ]);

      if (profumiRes.error) throw profumiRes.error;
      if (indossiRes.error) throw indossiRes.error;

      const profumiList = profumiRes.data || [];
      setProfumi(profumiList);
      if (profumiList.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(profumiList[0].id);
      }

      const profumiMap = new Map(profumiList.map((p: any) => [p.id, p]));
      const enriched = (indossiRes.data || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));
      setIndossi(enriched);
    } catch (err) {
      console.error('Errore caricamento home:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  // Salvataggio sicuro con protezione doppio invio e validazione data futura
  async function handleSaveIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (savingWear || !selectedProfumoId) return;

    const todayStr = getLocalIsoDate();
    if (wearData > todayStr) {
      showToast('Non puoi registrare indossi nel futuro.', 'error');
      return;
    }

    setSavingWear(true);
    try {
      const customDate = new Date(`${wearData}T12:00:00`);
      const now = new Date();
      customDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: selectedProfumoId,
          momento_giornata: wearMomento,
          contesto_outfit: wearOutfit.trim() || null,
          note_giorno: wearNote.trim() || null,
          created_at: customDate.toISOString(),
        },
      ]);
      if (error) throw error;

      triggerSpruzzo();
      showToast('Indosso registrato nel Diario.');
      setWearModalOpen(false);
      setWearOutfit('');
      setWearNote('');
      fetchHomeData();
    } catch (err: any) {
      showToast(err?.message || 'Errore salvataggio indosso.', 'error');
    } finally {
      setSavingWear(false);
    }
  }

  const podio = useMemo(() => computePodio(indossi), [indossi]);
  const smartSuggestions = useMemo(() => getSmartConsultantSuggestions(profumi, indossi), [profumi, indossi]);
  const currentSuggestion = smartSuggestions[consultantIndex % (smartSuggestions.length || 1)] || null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36 space-y-8">
      <PageHeader
        title="Atelier"
        subtitle="Control Room"
        rightSlot={
          <button
            type="button"
            onClick={() => setWearModalOpen(true)}
            style={{ backgroundColor: aura.primary }}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-95 shadow-xl"
          >
            <CalendarHeart className="h-4 w-4" />
            <span>Indossato oggi</span>
          </button>
        }
      />

      {loadError && (
        <div className="rounded-[22px] border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between text-xs text-red-200">
          <span>Errore di caricamento dei dati.</span>
          <button onClick={fetchHomeData} className="underline font-bold flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Riprova
          </button>
        </div>
      )}

      {/* AI CONSULTANT BASATO SU DATI REALI */}
      {currentSuggestion && (
        <section
          style={{ borderColor: `${aura.primary}45` }}
          className="relative overflow-hidden rounded-[30px] border bg-gradient-to-br from-[#161024] to-[#0E0A16] p-6 sm:p-8 shadow-2xl"
        >
          <div className="absolute right-4 top-4 opacity-10">
            <Sparkles style={{ color: aura.primary }} className="h-32 w-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span style={{ color: aura.primary }} className="font-mono text-[11px] uppercase tracking-widest font-bold">
                Consultant Olfattivo • Selezione Mirata
              </span>
              {smartSuggestions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setConsultantIndex((prev) => prev + 1)}
                  className="text-[11px] font-mono text-[#B8A9C9] hover:text-white underline transition"
                >
                  Altro suggerimento ({consultantIndex + 1}/{smartSuggestions.length})
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h3 className="font-serif text-2xl sm:text-3xl text-[#F6EFE4]">
                  {currentSuggestion.brand} — {currentSuggestion.nome}
                </h3>
                <p className="font-mono text-[11px] text-[#B8A9C9]">
                  Famiglia: <span style={{ color: aura.primary }}>{currentSuggestion.famiglia_olfattiva || 'Nisba'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProfumoId(currentSuggestion.id);
                  setWearModalOpen(true);
                }}
                style={{ borderColor: `${aura.primary}70`, color: aura.primary }}
                className="inline-flex items-center gap-2 rounded-full border bg-[#08060C] px-5 py-3 text-xs font-bold transition hover:bg-white/5 shrink-0"
              >
                <span>Indossa questa creazione</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* PODIO DEGLI INDOSSI */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-xl text-[#F6EFE4]">Il Podio Storico</h2>
          <Link href="/diario" className="text-xs text-[#B8A9C9] hover:text-[#F6EFE4] transition">
            Vedi tutto il Diario →
          </Link>
        </div>

        {podio.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#161024]/90 p-8 text-center space-y-2">
            <p className="text-xs text-[#B8A9C9]">Nessun indosso registrato. Usa il tasto &quot;Indossato oggi&quot; per iniziare.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {podio.slice(0, 4).map(({ count, profumo }, idx) => {
              const pAura = resolveAura(profumo.famiglia_olfattiva, profumo.nome);
              return (
                <div
                  key={profumo.id}
                  style={{ borderColor: `${pAura.primary}40` }}
                  className="group relative flex flex-col items-center rounded-[24px] border bg-[#161024]/90 p-4 text-center transition hover:scale-105 shadow-lg"
                >
                  <span
                    style={{ backgroundColor: pAura.primary }}
                    className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-[#08060C]"
                  >
                    #{idx + 1}
                  </span>
                  <div className="h-28 w-full flex items-center justify-center py-2">
                    <SmartBottleImage
                      src={profumo.url_foto_vetrina || profumo.immagine_url}
                      alt={profumo.nome}
                      iconSize="w-6 h-6"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="mt-2 w-full space-y-0.5">
                    <p style={{ color: pAura.primary }} className="font-mono text-[10px] uppercase tracking-wider truncate">
                      {profumo.brand}
                    </p>
                    <h3 className="font-serif text-sm text-[#F6EFE4] truncate">{profumo.nome}</h3>
                    <p className="font-mono text-[11px] text-[#B8A9C9]">{count} indossi</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ACCESSI RAPIDI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/collezione"
          className="group flex items-center justify-between rounded-[24px] border border-white/10 bg-[#161024]/90 p-6 transition hover:border-white/30 shadow-xl"
        >
          <div className="space-y-1">
            <span style={{ color: aura.primary }} className="font-mono text-[11px] uppercase tracking-widest font-bold">
              Vetrina
            </span>
            <h3 className="font-serif text-2xl text-[#F6EFE4]">La mia Collezione</h3>
            <p className="text-xs text-[#B8A9C9]">{profumi.length} creazioni catalogate</p>
          </div>
          <div style={{ backgroundColor: `${aura.primary}20`, color: aura.primary }} className="flex h-12 w-12 items-center justify-center rounded-full transition group-hover:scale-110">
            <Library className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href="/scanner"
          className="group flex items-center justify-between rounded-[24px] border border-white/10 bg-[#161024]/90 p-6 transition hover:border-white/30 shadow-xl"
        >
          <div className="space-y-1">
            <span style={{ color: aura.primary }} className="font-mono text-[11px] uppercase tracking-widest font-bold">
              Acquisizione
            </span>
            <h3 className="font-serif text-2xl text-[#F6EFE4]">Scanner & AI</h3>
            <p className="text-xs text-[#B8A9C9]">Aggiungi flaconi o campioni</p>
          </div>
          <div style={{ backgroundColor: `${aura.primary}20`, color: aura.primary }} className="flex h-12 w-12 items-center justify-center rounded-full transition group-hover:scale-110">
            <Compass className="h-5 w-5" />
          </div>
        </Link>
      </section>

      {/* MODALE INDOSSATO OGGI */}
      {wearModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setWearModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08060C]/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: `${aura.primary}55` }}
            className="relative w-full max-w-md rounded-[32px] border bg-[#161024] p-6 sm:p-8 text-[#F6EFE4] space-y-5 shadow-2xl mb-16"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif text-2xl text-[#F6EFE4]">Registra Indosso</h3>
              <button
                type="button"
                onClick={() => setWearModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] text-[#B8A9C9] hover:text-white border border-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIndosso} className="space-y-4 text-xs">
              <div>
                <label htmlFor="select-profumo" className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5">
                  Seleziona Fragranza
                </label>
                <select
                  id="select-profumo"
                  value={selectedProfumoId}
                  onChange={(e) => setSelectedProfumoId(e.target.value)}
                  className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-3 text-sm text-[#F6EFE4] focus:outline-none"
                >
                  {profumi.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#161024]">
                      {p.brand} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-data" className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5">
                    Data (a ritroso)
                  </label>
                  <input
                    id="input-data"
                    type="date"
                    value={wearData}
                    max={getLocalIsoDate()}
                    onChange={(e) => setWearData(e.target.value)}
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="select-momento" className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5">
                    Momento
                  </label>
                  <select
                    id="select-momento"
                    value={wearMomento}
                    onChange={(e) => setWearMomento(e.target.value as any)}
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
                  >
                    <option value="Mattina">Mattina</option>
                    <option value="Pomeriggio">Pomeriggio</option>
                    <option value="Sera">Sera</option>
                    <option value="Notte">Notte</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="input-outfit" className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5">
                  Contesto o Outfit (facoltativo)
                </label>
                <input
                  id="input-outfit"
                  type="text"
                  value={wearOutfit}
                  onChange={(e) => setWearOutfit(e.target.value)}
                  placeholder="Es. Ufficio, Cena elegante, Casual..."
                  className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="input-note" className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5">
                  Note personali / Sensazioni (facoltativo)
                </label>
                <textarea
                  id="input-note"
                  value={wearNote}
                  onChange={(e) => setWearNote(e.target.value)}
                  placeholder="Come si è comportato sulla pelle?"
                  rows={2}
                  className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWearModalOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingWear}
                  style={{ backgroundColor: aura.primary }}
                  className="flex items-center gap-1.5 rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{savingWear ? 'Salvataggio...' : 'Conferma Indosso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
