'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarHeart, Check, X } from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { getLocalIsoDate, getAutoMomento, computePodio } from '@/lib/home-logic';
import { ScentDNA } from '@/components/ScentDNA';
import { AccordWheel } from '@/components/AccordWheel';

export default function HomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDetailProfumo, setSelectedDetailProfumo] = useState<Profumo | null>(null);
  const [podioModalOpen, setPodioModalOpen] = useState(false);

  const [wearModalOpen, setWearModalOpen] = useState(false);
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [wearData, setWearData] = useState<string>(getLocalIsoDate());
  const [wearMomento, setWearMomento] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>(
    getAutoMomento()
  );
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const { aura, setAuraFromProfumo, setCustomAura } = useAura();
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
    fetchHomeData();
  }, [setCustomAura]);

  async function fetchHomeData() {
    setLoading(true);
    try {
      const [profumiRes, indossiRes] = await Promise.all([
        supabase.from('profumi').select('*').order('nome', { ascending: true }),
        supabase.from('indossi').select('*').order('created_at', { ascending: false }),
      ]);

      if (profumiRes.error) throw profumiRes.error;
      if (indossiRes.error) throw indossiRes.error;

      const allProfumi = (profumiRes.data || []) as Profumo[];
      const collezioneOnly = allProfumi.filter(isCollezioneProfumo);
      const pool = collezioneOnly.length > 0 ? collezioneOnly : allProfumi;

      setProfumi(pool);
      if (pool.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(pool[0].id);
      }

      const profumiMap = new Map(allProfumi.map((p) => [p.id, p]));
      const enriched = (indossiRes.data || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));
      setIndossi(enriched);
    } catch (err) {
      console.error('Errore caricamento home:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (savingWear || !selectedProfumoId) return;

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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-8 pb-36 space-y-10">
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

      {/* ATLANTE OLFATTIVO INTERATTIVO (NOTE · ACCORDI · PIRAMIDE) */}
      <AccordWheel
        profumi={profumi}
        indossi={indossi}
        onSelectProfumo={(p) => {
          setSelectedDetailProfumo(p);
          setAuraFromProfumo(p);
        }}
      />

      {/* PROFILO SINTETICO SCENT DNA */}
      <ScentDNA profumi={profumi} indossi={indossi} loading={loading} />

      {/* PODIO COMPATTO IN CHIUSURA */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-2xl text-[#F6EFE4]">I più indossati</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8A9C9]/70">
              Podio
            </span>
          </div>

          {podio.length > 0 && (
            <button
              type="button"
              onClick={() => setPodioModalOpen(true)}
              className="rounded-full border border-white/15 bg-[#0E0A16] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#F6EFE4] transition hover:border-white/35"
            >
              Classifica completa →
            </button>
          )}
        </div>

        {podio.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#0E0A16]/80 p-6 text-center text-xs text-[#B8A9C9]">
            Nessun indosso registrato. Usa il tasto &quot;Indossato oggi&quot; per iniziare.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {podio.slice(0, 3).map(({ count, profumo }, idx) => (
              <button
                key={profumo.id}
                type="button"
                onClick={() => {
                  setSelectedDetailProfumo(profumo);
                  setAuraFromProfumo(profumo);
                }}
                style={{
                  borderColor:
                    idx === 0 ? `${aura.primary}65` : 'rgba(255, 255, 255, 0.1)',
                }}
                className="group flex items-center gap-3.5 rounded-[22px] border bg-[#0E0A16]/90 p-3.5 text-left transition hover:border-white/30 hover:bg-[#140D1C]"
              >
                <span
                  style={{ color: idx === 0 ? aura.primary : '#B8A9C9' }}
                  className="font-mono text-xs font-extrabold w-6 text-center shrink-0"
                >
                  #{idx + 1}
                </span>

                <div className="h-14 w-12 shrink-0 flex items-center justify-center">
                  <BottlePedestal
                    src={profumo.url_foto_vetrina || profumo.immagine_url}
                    alt={profumo.nome}
                    bare={true}
                    className="h-full w-full"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">
                    {profumo.brand}
                  </p>
                  <h3 className="font-serif text-base text-[#F6EFE4] truncate group-hover:text-white">
                    {profumo.nome}
                  </h3>
                  <p className="font-mono text-[10px] text-[#B8A9C9]/75 mt-0.5">
                    {count} {count === 1 ? 'indosso' : 'indossi'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* MODALE CLASSIFICA COMPLETA */}
      {podioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPodioModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08060C]/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: `${aura.primary}60` }}
            className="relative w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-[32px] border bg-[#161024] p-6 text-[#F6EFE4] space-y-4 shadow-2xl no-scrollbar mb-16"
          >
            <div
              style={{ borderColor: `${aura.primary}25` }}
              className="flex items-center justify-between pb-3 border-b"
            >
              <h3 className="font-serif text-2xl text-[#F6EFE4]">
                Classifica Generale Indossi
              </h3>
              <button
                type="button"
                onClick={() => setPodioModalOpen(false)}
                style={{ borderColor: `${aura.primary}40`, color: aura.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] hover:text-white border transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {podio.map(({ count, profumo }, idx) => (
                <div
                  key={profumo.id}
                  onClick={() => {
                    setPodioModalOpen(false);
                    setSelectedDetailProfumo(profumo);
                    setAuraFromProfumo(profumo);
                  }}
                  style={{ borderColor: `${aura.primary}35` }}
                  className="flex items-center justify-between rounded-[18px] border bg-[#0E0A16] p-3.5 cursor-pointer transition hover:opacity-90"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="font-mono text-xs font-extrabold w-7 text-center shrink-0"
                      style={{ color: aura.primary }}
                    >
                      #{idx + 1}
                    </span>
                    <div className="h-12 w-12 flex items-center justify-center shrink-0">
                      <BottlePedestal
                        src={profumo.url_foto_vetrina || profumo.immagine_url}
                        alt={profumo.nome}
                        bare={true}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase text-[#B8A9C9] truncate">
                        {profumo.brand}
                      </p>
                      <h4 className="font-sans text-xs font-extrabold uppercase tracking-wide text-[#F6EFE4] truncate">
                        {profumo.nome}
                      </h4>
                    </div>
                  </div>
                  <span
                    style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
                    className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#161024] border shrink-0 ml-2"
                  >
                    {count} {count === 1 ? 'indosso' : 'indossi'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
            style={{ borderColor: `${aura.primary}60` }}
            className="relative w-full max-w-md rounded-[32px] border bg-[#161024] p-6 sm:p-8 text-[#F6EFE4] space-y-5 shadow-2xl mb-16"
          >
            <div
              style={{ borderColor: `${aura.primary}25` }}
              className="flex items-center justify-between pb-3 border-b"
            >
              <h3 className="font-serif text-2xl text-[#F6EFE4]">Registra Indosso</h3>
              <button
                type="button"
                onClick={() => setWearModalOpen(false)}
                style={{ borderColor: `${aura.primary}40`, color: aura.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] hover:text-white border transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIndosso} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="select-profumo"
                  className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5"
                >
                  Seleziona Fragranza
                </label>
                <select
                  id="select-profumo"
                  value={selectedProfumoId}
                  onChange={(e) => setSelectedProfumoId(e.target.value)}
                  style={{ borderColor: `${aura.primary}35` }}
                  className="w-full rounded-[14px] bg-[#0E0A16] border p-3 text-sm text-[#F6EFE4] focus:outline-none"
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
                  <label
                    htmlFor="input-data"
                    className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5"
                  >
                    Data
                  </label>
                  <input
                    id="input-data"
                    type="date"
                    value={wearData}
                    max={getLocalIsoDate()}
                    onChange={(e) => setWearData(e.target.value)}
                    style={{ borderColor: `${aura.primary}35` }}
                    className="w-full rounded-[14px] bg-[#0E0A16] border p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="select-momento"
                    className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5"
                  >
                    Momento
                  </label>
                  <select
                    id="select-momento"
                    value={wearMomento}
                    onChange={(e) => setWearMomento(e.target.value as any)}
                    style={{ borderColor: `${aura.primary}35` }}
                    className="w-full rounded-[14px] bg-[#0E0A16] border p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
                  >
                    <option value="Mattina">Mattina</option>
                    <option value="Pomeriggio">Pomeriggio</option>
                    <option value="Sera">Sera</option>
                    <option value="Notte">Notte</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-outfit"
                  className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5"
                >
                  Contesto o Outfit (facoltativo)
                </label>
                <input
                  id="input-outfit"
                  type="text"
                  value={wearOutfit}
                  onChange={(e) => setWearOutfit(e.target.value)}
                  placeholder="Es. Ufficio, Cena elegante, Casual..."
                  style={{ borderColor: `${aura.primary}35` }}
                  className="w-full rounded-[14px] bg-[#0E0A16] border p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="input-note"
                  className="block font-mono text-[11px] uppercase text-[#B8A9C9] mb-1.5"
                >
                  Note personali / Sensazioni (facoltativo)
                </label>
                <textarea
                  id="input-note"
                  value={wearNote}
                  onChange={(e) => setWearNote(e.target.value)}
                  placeholder="Come si è comportato sulla pelle?"
                  rows={2}
                  style={{ borderColor: `${aura.primary}35` }}
                  className="w-full rounded-[14px] bg-[#0E0A16] border p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none resize-none"
                />
              </div>

              <div
                style={{ borderColor: `${aura.primary}25` }}
                className="flex justify-end gap-2 pt-3 border-t"
              >
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

      {/* SCHEDA DI DETTAGLIO CONDIVISA */}
      <ProfumoDetailModal
        profumo={selectedDetailProfumo}
        onClose={() => {
          setSelectedDetailProfumo(null);
          setCustomAura(SECTION_THEMES.atelier);
        }}
        onUpdated={(updated) => {
          setSelectedDetailProfumo(updated);
          setProfumi((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          fetchHomeData();
        }}
        onDeleted={(deletedId) => {
          setProfumi((prev) => prev.filter((p) => p.id !== deletedId));
          setSelectedDetailProfumo(null);
          fetchHomeData();
        }}
        onIndossoRegistered={() => {
          fetchHomeData();
        }}
      />
    </main>
  );
}
