'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CalendarHeart, Compass, Library, Sparkles, Check, X, ArrowRight, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { SmartBottleImage } from '@/components/BottleImage';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { getLocalIsoDate, getAutoMomento, computePodio } from '@/lib/home-logic';

export default function HomePage() {
  const [profumi, setProfumi] = useState<any[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale Podio Completo
  const [podioModalOpen, setPodioModalOpen] = useState(false);

  // Modale Indosso
  const [wearModalOpen, setWearModalOpen] = useState(false);
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [wearData, setWearData] = useState<string>(getLocalIsoDate());
  const [wearMomento, setWearMomento] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>(getAutoMomento());
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const { aura, setCustomAura } = useAura();
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

  // Calcolo Podio (esclude rigorosamente i profumi con 0 indossi, ordinati per frequenza e data recente)
  const podio = useMemo(() => computePodio(indossi), [indossi]);

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

      {/* PODIO A GRADINI REALE (SOLO PROFUMI VISSUTI) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: aura.primary }} />
            <h2 className="font-serif text-xl text-[#F6EFE4]">Podio Storico</h2>
          </div>
          {podio.length > 0 && (
            <button
              type="button"
              onClick={() => setPodioModalOpen(true)}
              className="text-xs text-[#B8A9C9] hover:text-[#F6EFE4] transition underline"
            >
              Classifica Completa →
            </button>
          )}
        </div>

        {podio.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#161024]/90 p-8 text-center space-y-2">
            <p className="text-xs text-[#B8A9C9]">Nessun indosso registrato. Usa il tasto &quot;Indossato oggi&quot; per popolare il podio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 items-end pt-6 pb-2">
            {/* 2° Posto (Sinistra - Più basso) */}
            {podio[1] ? (
              <div
                onClick={() => setPodioModalOpen(true)}
                className="flex flex-col items-center rounded-[22px] border border-white/10 bg-[#161024]/90 p-4 text-center cursor-pointer transition hover:scale-105 shadow-lg h-56 justify-between"
              >
                <span className="font-mono text-xs font-bold text-[#B8A9C9]">#2</span>
                <div className="h-24 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[1].profumo.url_foto_vetrina || podio[1].profumo.immagine_url}
                    alt={podio[1].profumo.nome}
                    iconSize="w-5 h-5"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="w-full space-y-0.5">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">{podio[1].profumo.brand}</p>
                  <h3 className="font-serif text-xs text-[#F6EFE4] truncate">{podio[1].profumo.nome}</h3>
                  <p className="font-mono text-[10px]" style={{ color: aura.primary }}>{podio[1].count} indossi</p>
                </div>
              </div>
            ) : <div />}

            {/* 1° Posto (Centro - Il più alto) */}
            {podio[0] && (
              <div
                onClick={() => setPodioModalOpen(true)}
                style={{ borderColor: `${aura.primary}50` }}
                className="flex flex-col items-center rounded-[24px] border-2 bg-gradient-to-b from-[#1E1428] to-[#120D1C] p-4 text-center cursor-pointer transition hover:scale-105 shadow-2xl h-64 justify-between -mt-4"
              >
                <span className="font-mono text-sm font-bold" style={{ color: aura.primary }}>#1</span>
                <div className="h-32 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[0].profumo.url_foto_vetrina || podio[0].profumo.immagine_url}
                    alt={podio[0].profumo.nome}
                    iconSize="w-6 h-6"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="w-full space-y-0.5">
                  <p className="font-mono text-[10px] uppercase tracking-wider truncate" style={{ color: aura.primary }}>{podio[0].profumo.brand}</p>
                  <h3 className="font-serif text-sm text-[#F6EFE4] truncate font-bold">{podio[0].profumo.nome}</h3>
                  <p className="font-mono text-[11px] text-[#B8A9C9]">{podio[0].count} indossi</p>
                </div>
              </div>
            )}

            {/* 3° Posto (Destra) */}
            {podio[2] ? (
              <div
                onClick={() => setPodioModalOpen(true)}
                className="flex flex-col items-center rounded-[22px] border border-white/10 bg-[#161024]/90 p-4 text-center cursor-pointer transition hover:scale-105 shadow-lg h-52 justify-between"
              >
                <span className="font-mono text-xs font-bold text-[#B8A9C9]">#3</span>
                <div className="h-20 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[2].profumo.url_foto_vetrina || podio[2].profumo.immagine_url}
                    alt={podio[2].profumo.nome}
                    iconSize="w-5 h-5"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="w-full space-y-0.5">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">{podio[2].profumo.brand}</p>
                  <h3 className="font-serif text-xs text-[#F6EFE4] truncate">{podio[2].profumo.nome}</h3>
                  <p className="font-mono text-[10px]" style={{ color: aura.primary }}>{podio[2].count} indossi</p>
                </div>
              </div>
            ) : <div />}
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
            style={{ borderColor: `${aura.primary}55` }}
            className="relative w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-[32px] border bg-[#161024] p-6 text-[#F6EFE4] space-y-4 shadow-2xl no-scrollbar mb-16"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif text-2xl text-[#F6EFE4]">Classifica Generale Indossi</h3>
              <button
                type="button"
                onClick={() => setPodioModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] text-[#B8A9C9] hover:text-white border border-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {podio.map(({ count, profumo }, idx) => (
                <div
                  key={profumo.id}
                  className="flex items-center justify-between rounded-[18px] border border-white/10 bg-[#0E0A16] p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold w-6 text-center" style={{ color: aura.primary }}>
                      #{idx + 1}
                    </span>
                    <div className="h-10 w-10 overflow-hidden rounded-xl bg-[#161024] p-1 flex items-center justify-center border border-white/5">
                      <SmartBottleImage
                        src={profumo.url_foto_vetrina || profumo.immagine_url}
                        alt={profumo.nome}
                        iconSize="w-4 h-4"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-serif text-sm text-[#F6EFE4]">{profumo.nome}</h4>
                      <p className="font-mono text-[10px] uppercase text-[#B8A9C9]">{profumo.brand}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    {count} indossi
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
                    Data
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
