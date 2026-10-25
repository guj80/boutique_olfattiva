'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CalendarHeart, Compass, Library, Sparkles, Check, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { SmartBottleImage } from '@/components/BottleImage';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { getLocalIsoDate, getAutoMomento, computePodio } from '@/lib/home-logic';

export default function HomePage() {
  const [profumi, setProfumi] = useState<any[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale Classifica Completa
  const [podioModalOpen, setPodioModalOpen] = useState(false);

  // Modale Indosso
  const [wearModalOpen, setWearModalOpen] = useState(false);
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [wearData, setWearData] = useState<string>(getLocalIsoDate());
  const [wearMomento, setWearMomento] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>(getAutoMomento());
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  // Consultant AI Home
  const [consultantOccasione, setConsultantOccasione] = useState<string>('Tutti');
  const [consultantMomento, setConsultantMomento] = useState<string>('Tutti');
  const [generatedRecommendation, setGeneratedRecommendation] = useState<any>(null);

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
      if (profumiList.length > 0 && !generatedRecommendation) {
        setGeneratedRecommendation(profumiList[0]);
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

  function handleGenerateConsultant() {
    if (profumi.length === 0) return;
    const filtered = profumi.filter((p) => {
      if (consultantMomento !== 'Tutti' && p.momento_ideale && !p.momento_ideale.toLowerCase().includes(consultantMomento.toLowerCase())) {
        return false;
      }
      return true;
    });
    const pool = filtered.length > 0 ? filtered : profumi;
    const randomIndex = Math.floor(Math.random() * pool.length);
    setGeneratedRecommendation(pool[randomIndex]);
    showToast('Suggerimento AI generato.');
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
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36 space-y-10">
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

      {/* SUGGERIMENTO AI */}
      <section
        style={{ borderColor: `${aura.primary}40` }}
        className="relative overflow-hidden rounded-[24px] border bg-[#0E0A16]/95 p-6 shadow-2xl space-y-5 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles style={{ color: aura.primary }} className="h-4 w-4" />
            <span style={{ color: aura.primary }} className="font-mono text-[11px] uppercase tracking-widest font-bold">
              Suggerimento AI
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#B8A9C9]">Analisi Collezione</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="consultant-occasione" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">Occasione / Contesto</label>
            <select
              id="consultant-occasione"
              value={consultantOccasione}
              onChange={(e) => setConsultantOccasione(e.target.value)}
              className="w-full rounded-[12px] bg-[#161024] border border-white/15 p-3 text-xs text-[#F6EFE4] focus:outline-none"
            >
              <option value="Tutti">Qualsiasi Occasione</option>
              <option value="Ufficio">Ufficio / Lavoro</option>
              <option value="Formale">Riunione formale</option>
              <option value="Tempo libero">Tempo libero</option>
              <option value="Cena">Aperitivo / Cena elegante</option>
              <option value="Serata">Serata speciale</option>
            </select>
          </div>

          <div>
            <label htmlFor="consultant-momento" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">Momento della giornata</label>
            <select
              id="consultant-momento"
              value={consultantMomento}
              onChange={(e) => setConsultantMomento(e.target.value)}
              className="w-full rounded-[12px] bg-[#161024] border border-white/15 p-3 text-xs text-[#F6EFE4] focus:outline-none"
            >
              <option value="Tutti">Automatico / Tutti</option>
              <option value="Mattina">Mattina</option>
              <option value="Pomeriggio">Pomeriggio</option>
              <option value="Sera">Sera</option>
              <option value="Notte">Notte</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleGenerateConsultant}
            style={{ backgroundColor: aura.primary }}
            className="flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90 shadow-lg"
          >
            <Sparkles className="h-4 w-4 fill-current" />
            <span>Genera Suggerimento</span>
          </button>
        </div>

        {generatedRecommendation && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-white/10 bg-[#161024]/60 p-4 rounded-[16px]">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-[#08060C] p-2 flex items-center justify-center border border-white/10 shrink-0">
                <SmartBottleImage
                  src={generatedRecommendation.url_foto_vetrina || generatedRecommendation.immagine_url}
                  alt={generatedRecommendation.nome}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="space-y-0.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">{generatedRecommendation.brand}</p>
                <h3 className="font-serif text-lg text-[#F6EFE4] font-bold uppercase">{generatedRecommendation.nome}</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProfumoId(generatedRecommendation.id);
                setWearModalOpen(true);
              }}
              style={{ borderColor: `${aura.primary}70`, color: aura.primary }}
              className="inline-flex items-center gap-2 rounded-full border bg-[#08060C] px-5 py-2.5 text-xs font-bold transition hover:bg-white/5 shrink-0"
            >
              <span>Indossa questa creazione</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* PODIO A SCATOLETTE NERE ELEGANTI - NOMI MAIUSCOLO E GRASSETTO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-xl text-[#F6EFE4]">Podio</h2>
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
          <div className="rounded-[20px] border border-white/10 bg-[#0E0A16] p-6 text-center text-xs text-[#B8A9C9]">
            Nessun indosso registrato. Usa il tasto &quot;Indossato oggi&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 items-end pt-4 pb-2 text-center">
            {/* 2° Posto */}
            {podio[1] ? (
              <div
                onClick={() => setPodioModalOpen(true)}
                className="flex flex-col items-center cursor-pointer transition hover:scale-105 rounded-[18px] border border-white/10 bg-[#0E0A16] p-3 shadow-lg space-y-1.5 h-48 justify-between"
              >
                <div className="h-20 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[1].profumo.url_foto_vetrina || podio[1].profumo.immagine_url}
                    alt={podio[1].profumo.nome}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-mono text-xs font-bold text-[#B8A9C9]">#2</span>
                <div className="space-y-0.5 w-full">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">{podio[1].profumo.brand}</p>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-[#F6EFE4] truncate">{podio[1].profumo.nome}</h3>
                </div>
              </div>
            ) : <div />}

            {/* 1° Posto (Centro - Più alto) */}
            {podio[0] && (
              <div
                onClick={() => setPodioModalOpen(true)}
                style={{ borderColor: `${aura.primary}60` }}
                className="flex flex-col items-center cursor-pointer transition hover:scale-105 rounded-[20px] border-2 bg-[#120D1C] p-3.5 shadow-2xl space-y-1.5 h-56 justify-between -mt-4"
              >
                <div className="h-28 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[0].profumo.url_foto_vetrina || podio[0].profumo.immagine_url}
                    alt={podio[0].profumo.nome}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-mono text-xs font-bold" style={{ color: aura.primary }}>#1</span>
                <div className="space-y-0.5 w-full">
                  <p className="font-mono text-[9px] uppercase tracking-wider font-bold truncate" style={{ color: aura.primary }}>{podio[0].profumo.brand}</p>
                  <h3 className="font-sans text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#F6EFE4] leading-tight line-clamp-2">{podio[0].profumo.nome}</h3>
                </div>
              </div>
            )}

            {/* 3° Posto */}
            {podio[2] ? (
              <div
                onClick={() => setPodioModalOpen(true)}
                className="flex flex-col items-center cursor-pointer transition hover:scale-105 rounded-[18px] border border-white/10 bg-[#0E0A16] p-3 shadow-lg space-y-1.5 h-44 justify-between"
              >
                <div className="h-16 w-full flex items-center justify-center">
                  <SmartBottleImage
                    src={podio[2].profumo.url_foto_vetrina || podio[2].profumo.immagine_url}
                    alt={podio[2].profumo.nome}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-mono text-xs font-bold text-[#B8A9C9]">#3</span>
                <div className="space-y-0.5 w-full">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">{podio[2].profumo.brand}</p>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-[#F6EFE4] truncate">{podio[2].profumo.nome}</h3>
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
