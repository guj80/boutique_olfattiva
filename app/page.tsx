'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CalendarHeart, Compass, Library, Sparkles, Check, X } from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import {
  getLocalIsoDate,
  getAutoMomento,
  computePodio,
  pickLocalWearSuggestions,
  IndossoItem,
} from '@/lib/home-logic';

const ACCENT = '#C98A3A';

export default function HomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [indossi, setIndossi] = useState<IndossoItem[]>([]);
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

  const [consultantOccasione, setConsultantOccasione] = useState<string>('Tutti');
  const [consultantMomento, setConsultantMomento] = useState<string>('Tutti');
  const [suggestions, setSuggestions] = useState<Profumo[]>([]);

  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    fetchHomeData();
  }, []);

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

      setProfumi(collezioneOnly);
      if (collezioneOnly.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(collezioneOnly[0].id);
      }

      const profumiMap = new Map(allProfumi.map((p) => [p.id, p]));
      const enriched: IndossoItem[] = (indossiRes.data || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));
      setIndossi(enriched);

      if (collezioneOnly.length > 0) {
        setSuggestions(
          pickLocalWearSuggestions(
            collezioneOnly,
            enriched,
            consultantOccasione,
            consultantMomento
          )
        );
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Errore caricamento home:', err);
      showToast('Impossibile caricare i dati della Home.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateConsultant() {
    if (profumi.length === 0) {
      showToast('Aggiungi prima un profumo alla tua collezione.', 'error');
      return;
    }
    const picked = pickLocalWearSuggestions(
      profumi,
      indossi,
      consultantOccasione,
      consultantMomento
    );
    setSuggestions(picked);
    if (picked.length === 0) {
      showToast('Nessun profumo trovato per questi filtri.', 'error');
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
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36 space-y-10">
      <PageHeader
        title="Atelier"
        subtitle="Control Room"
        rightSlot={
          <button
            type="button"
            onClick={() => setWearModalOpen(true)}
            style={{ backgroundColor: ACCENT }}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-95 shadow-xl"
          >
            <CalendarHeart className="h-4 w-4" />
            <span>Indossato oggi</span>
          </button>
        }
      />

      {/* CONSULENTE D'INDOSSO DELLA COLLEZIONE */}
      <section className="mx-auto max-w-5xl space-y-4">
        <div
          style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
          className="rounded-[26px] border bg-[#0E0A16] p-5 shadow-2xl space-y-4"
        >
          <div
            style={{ borderColor: 'rgba(201, 138, 58, 0.2)' }}
            className="flex items-center justify-between border-b pb-3"
          >
            <div
              style={{ borderColor: 'rgba(201, 138, 58, 0.45)' }}
              className="inline-flex items-center gap-2 rounded-md bg-[#161024] border px-2.5 py-1"
            >
              <Sparkles style={{ color: ACCENT }} className="h-3.5 w-3.5" />
              <span
                style={{ color: ACCENT }}
                className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold"
              >
                Consulente d&apos;Indosso
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
              Rotazione Collezione
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="consultant-occasione"
                className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1"
              >
                Occasione / Contesto
              </label>
              <select
                id="consultant-occasione"
                value={consultantOccasione}
                onChange={(e) => setConsultantOccasione(e.target.value)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                className="w-full rounded-[14px] bg-[#161024] border px-3.5 py-2.5 text-xs text-[#F6EFE4] focus:outline-none"
              >
                <option value="Tutti">Qualsiasi Occasione</option>
                <option value="Ufficio">Ufficio / Lavoro</option>
                <option value="Formale">Riunione formale</option>
                <option value="Tempo libero">Tempo libero</option>
                <option value="Cena">Aperitivo / Cena elegante</option>
                <option value="Serata">Serata speciale</option>
              </select>
            </div>

            <div className="flex-1">
              <label
                htmlFor="consultant-momento"
                className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1"
              >
                Momento della giornata
              </label>
              <select
                id="consultant-momento"
                value={consultantMomento}
                onChange={(e) => setConsultantMomento(e.target.value)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                className="w-full rounded-[14px] bg-[#161024] border px-3.5 py-2.5 text-xs text-[#F6EFE4] focus:outline-none"
              >
                <option value="Tutti">Automatico ({getAutoMomento()})</option>
                <option value="Mattina">Mattina</option>
                <option value="Pomeriggio">Pomeriggio</option>
                <option value="Sera">Sera</option>
                <option value="Notte">Notte</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateConsultant}
              title="Aggiorna proposte dalla collezione"
              aria-label="Aggiorna proposte dalla collezione"
              style={{ backgroundColor: ACCENT }}
              className="flex h-[42px] sm:w-[46px] items-center justify-center rounded-[14px] text-[#08060C] transition hover:scale-105 active:scale-95 shadow-lg shrink-0 px-4 sm:px-0"
            >
              <Sparkles className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>

        {!loading && profumi.length === 0 ? (
          <div
            style={{ borderColor: 'rgba(201, 138, 58, 0.25)' }}
            className="rounded-[20px] border bg-[#0E0A16] p-6 text-center text-xs text-[#B8A9C9]"
          >
            Nessun profumo in collezione. Aggiungi un flacone dallo Scanner per ricevere proposte d&apos;indosso.
          </div>
        ) : (
          suggestions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestions.map((s, idx) => {
                const sImg = s.url_foto_vetrina || s.immagine_url || undefined;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedDetailProfumo(s)}
                    style={{ borderColor: 'rgba(201, 138, 58, 0.4)' }}
                    className="group relative flex flex-col justify-between rounded-[24px] border bg-[#161024]/95 p-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl"
                  >
                    <div className="flex justify-center py-1">
                      <div className="relative w-full">
                        <div
                          className="absolute inset-0 rounded-[20px] blur-2xl opacity-30 transition-opacity group-hover:opacity-60"
                          style={{ backgroundColor: ACCENT }}
                        />
                        <BottlePedestal
                          src={sImg}
                          alt={s.nome}
                          size="md"
                          className="relative z-10 mx-auto w-full max-w-[120px]"
                          showSigil={false}
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-center">
                      <p
                        style={{ color: ACCENT }}
                        className="font-mono text-[9px] uppercase tracking-wider truncate"
                      >
                        {s.brand}
                      </p>
                      <h3 className="font-serif text-[14px] leading-tight text-[#F6EFE4] line-clamp-2">
                        {s.nome}
                      </h3>
                      <p className="font-mono text-[9px] text-[#B8A9C9] pt-0.5">
                        {s.famiglia_olfattiva || 'Collezione'}
                      </p>
                    </div>
                    <div className="mt-2 flex justify-center">
                      <span
                        style={{ color: ACCENT }}
                        className="font-mono text-[8px] uppercase tracking-widest"
                      >
                        #{idx + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>

      {/* PODIO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div
            style={{ borderColor: 'rgba(201, 138, 58, 0.4)' }}
            className="inline-block rounded-md bg-[#0E0A16] border px-3 py-1"
          >
            <h2
              style={{ color: ACCENT }}
              className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
            >
              Podio
            </h2>
          </div>
          {podio.length > 0 && (
            <button
              type="button"
              onClick={() => setPodioModalOpen(true)}
              style={{ borderColor: 'rgba(201, 138, 58, 0.45)', color: ACCENT }}
              className="rounded-full bg-[#0E0A16] border px-3.5 py-1.5 font-mono text-[11px] font-bold hover:opacity-85 transition"
            >
              Classifica Completa →
            </button>
          )}
        </div>

        {podio.length === 0 ? (
          <div
            style={{ borderColor: 'rgba(201, 138, 58, 0.25)' }}
            className="rounded-[20px] border bg-[#0E0A16] p-6 text-center text-xs text-[#B8A9C9]"
          >
            Nessun indosso registrato. Usa il tasto &quot;Indossato oggi&quot;.
          </div>
        ) : (
          <div className="mx-auto max-w-2xl grid grid-cols-3 gap-2.5 sm:gap-4 items-end pt-4 pb-2 text-center">
            {podio[1] ? (
              <div
                onClick={() => setSelectedDetailProfumo(podio[1].profumo)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                className="group flex flex-col items-center justify-between cursor-pointer transition hover:scale-[1.03] rounded-[20px] border bg-[#0E0A16] px-2.5 py-3.5 shadow-xl h-48"
              >
                <div className="h-20 w-full flex items-center justify-center">
                  <BottlePedestal
                    src={podio[1].profumo.url_foto_vetrina || podio[1].profumo.immagine_url}
                    alt={podio[1].profumo.nome}
                    bare={true}
                    className="h-full w-full"
                  />
                </div>
                <span className="font-mono text-xs font-extrabold text-[#B8A9C9] tracking-tight">
                  #2
                </span>
                <div className="space-y-0.5 w-full">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">
                    {podio[1].profumo.brand}
                  </p>
                  <h3 className="font-sans text-[11px] font-extrabold uppercase tracking-wide text-[#F6EFE4] leading-tight line-clamp-2 text-center">
                    {podio[1].profumo.nome}
                  </h3>
                </div>
              </div>
            ) : (
              <div />
            )}

            {podio[0] && (
              <div
                onClick={() => setSelectedDetailProfumo(podio[0].profumo)}
                style={{ borderColor: ACCENT }}
                className="group flex flex-col items-center justify-between cursor-pointer transition hover:scale-[1.03] rounded-[22px] border-2 bg-[#0E0A16] px-3 py-4 shadow-2xl h-56 -mt-4"
              >
                <div className="h-24 w-full flex items-center justify-center">
                  <BottlePedestal
                    src={podio[0].profumo.url_foto_vetrina || podio[0].profumo.immagine_url}
                    alt={podio[0].profumo.nome}
                    bare={true}
                    className="h-full w-full"
                  />
                </div>
                <span
                  style={{ color: ACCENT }}
                  className="font-mono text-sm font-extrabold tracking-tight"
                >
                  #1
                </span>
                <div className="space-y-0.5 w-full">
                  <p
                    style={{ color: ACCENT }}
                    className="font-mono text-[9px] uppercase tracking-wider font-bold truncate"
                  >
                    {podio[0].profumo.brand}
                  </p>
                  <h3 className="font-sans text-xs sm:text-[13px] font-extrabold uppercase tracking-wide text-[#F6EFE4] leading-tight line-clamp-2 text-center">
                    {podio[0].profumo.nome}
                  </h3>
                </div>
              </div>
            )}

            {podio[2] ? (
              <div
                onClick={() => setSelectedDetailProfumo(podio[2].profumo)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                className="group flex flex-col items-center justify-between cursor-pointer transition hover:scale-[1.03] rounded-[20px] border bg-[#0E0A16] px-2.5 py-3.5 shadow-xl h-44"
              >
                <div className="h-16 w-full flex items-center justify-center">
                  <BottlePedestal
                    src={podio[2].profumo.url_foto_vetrina || podio[2].profumo.immagine_url}
                    alt={podio[2].profumo.nome}
                    bare={true}
                    className="h-full w-full"
                  />
                </div>
                <span className="font-mono text-xs font-extrabold text-[#B8A9C9] tracking-tight">
                  #3
                </span>
                <div className="space-y-0.5 w-full">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-[#B8A9C9] truncate">
                    {podio[2].profumo.brand}
                  </p>
                  <h3 className="font-sans text-[11px] font-extrabold uppercase tracking-wide text-[#F6EFE4] leading-tight line-clamp-2 text-center">
                    {podio[2].profumo.nome}
                  </h3>
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>
        )}
      </section>

      {/* ACCESSI RAPIDI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/collezione"
          style={{ borderColor: 'rgba(201, 138, 58, 0.4)' }}
          className="group flex items-center justify-between rounded-[24px] border bg-[#0E0A16] p-6 transition hover:scale-[1.01] shadow-xl"
        >
          <div className="space-y-1.5">
            <div
              style={{ borderColor: 'rgba(201, 138, 58, 0.45)' }}
              className="inline-block rounded-md bg-[#161024] border px-2.5 py-0.5"
            >
              <span
                style={{ color: ACCENT }}
                className="font-mono text-[10px] uppercase tracking-widest font-bold block"
              >
                Vetrina
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#F6EFE4]">La mia Collezione</h3>
            <p className="text-xs text-[#B8A9C9]">{profumi.length} creazioni catalogate</p>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(201, 138, 58, 0.14)',
              color: ACCENT,
              borderColor: 'rgba(201, 138, 58, 0.4)',
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border transition group-hover:scale-110"
          >
            <Library className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href="/scanner"
          style={{ borderColor: 'rgba(201, 138, 58, 0.4)' }}
          className="group flex items-center justify-between rounded-[24px] border bg-[#0E0A16] p-6 transition hover:scale-[1.01] shadow-xl"
        >
          <div className="space-y-1.5">
            <div
              style={{ borderColor: 'rgba(201, 138, 58, 0.45)' }}
              className="inline-block rounded-md bg-[#161024] border px-2.5 py-0.5"
            >
              <span
                style={{ color: ACCENT }}
                className="font-mono text-[10px] uppercase tracking-widest font-bold block"
              >
                Acquisizione
              </span>
            </div>
            <h3 className="font-serif text-2xl text-[#F6EFE4]">Scanner &amp; AI</h3>
            <p className="text-xs text-[#B8A9C9]">Aggiungi flaconi o campioni</p>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(201, 138, 58, 0.14)',
              color: ACCENT,
              borderColor: 'rgba(201, 138, 58, 0.4)',
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border transition group-hover:scale-110"
          >
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
            style={{ borderColor: 'rgba(201, 138, 58, 0.5)' }}
            className="relative w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-[32px] border bg-[#161024] p-6 text-[#F6EFE4] space-y-4 shadow-2xl no-scrollbar mb-16"
          >
            <div
              style={{ borderColor: 'rgba(201, 138, 58, 0.25)' }}
              className="flex items-center justify-between pb-3 border-b"
            >
              <h3 className="font-serif text-2xl text-[#F6EFE4]">Classifica Generale Indossi</h3>
              <button
                type="button"
                onClick={() => setPodioModalOpen(false)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.4)', color: ACCENT }}
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
                  }}
                  style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                  className="flex items-center justify-between rounded-[18px] border bg-[#0E0A16] p-3.5 cursor-pointer transition hover:opacity-90"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="font-mono text-xs font-extrabold w-7 text-center shrink-0"
                      style={{ color: ACCENT }}
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
                    style={{ borderColor: 'rgba(201, 138, 58, 0.45)', color: ACCENT }}
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
            style={{ borderColor: 'rgba(201, 138, 58, 0.5)' }}
            className="relative w-full max-w-md rounded-[32px] border bg-[#161024] p-6 sm:p-8 text-[#F6EFE4] space-y-5 shadow-2xl mb-16"
          >
            <div
              style={{ borderColor: 'rgba(201, 138, 58, 0.25)' }}
              className="flex items-center justify-between pb-3 border-b"
            >
              <h3 className="font-serif text-2xl text-[#F6EFE4]">Registra Indosso</h3>
              <button
                type="button"
                onClick={() => setWearModalOpen(false)}
                style={{ borderColor: 'rgba(201, 138, 58, 0.4)', color: ACCENT }}
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
                  style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
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
                    style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
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
                    style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
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
                  style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
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
                  style={{ borderColor: 'rgba(201, 138, 58, 0.35)' }}
                  className="w-full rounded-[14px] bg-[#0E0A16] border p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none resize-none"
                />
              </div>

              <div
                style={{ borderColor: 'rgba(201, 138, 58, 0.25)' }}
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
                  style={{ backgroundColor: ACCENT }}
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
        onClose={() => setSelectedDetailProfumo(null)}
        onUpdated={(updated) => {
          setSelectedDetailProfumo(updated);
          setProfumi((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
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
