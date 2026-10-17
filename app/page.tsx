'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Compass,
  ScanLine,
  RefreshCw,
  Library,
  CalendarHeart,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';
import { useAura, resolveAura } from '@/components/AuraProvider';
import { BottlePedestal, SmartBottleImage } from '@/components/BottleImage';
import { Logo } from '@/components/Logo';
import { Sheet } from '@/components/Sheet';
import { useSpruzzo } from '@/components/Spruzzo';
import { useToast } from '@/components/Toast';
import { springSnappy, springSoft } from '@/lib/motion';

const METEO = [
  'Soleggiato e Caldo',
  'Temperato Primaverile',
  'Fresco Autunnale',
  'Piovoso e Umido',
  'Freddo Invernale',
];
const CONTESTI = ['Ufficio', 'Aperitivo', 'Cena', 'Serata', 'Evento'];
const PROFILI = [
  'Legnoso / Ambrato / Deciso',
  'Agrumato / Fresco / Pulito',
  'Speziato / Boozy / Caldo',
  'Gourmand / Ricco',
  'Marino / Aromatizzato',
  'Cuoiato / Incensato / Fumoso',
];
const MOMENTI = ['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const;

const CONTESTO_FRASE: Record<string, string> = {
  Ufficio: 'in ufficio',
  Aperitivo: "all'aperitivo",
  Cena: 'a cena',
  Serata: 'in serata',
  Evento: 'a un evento',
};

function formatWearLine(indosso: Indosso | null): string {
  if (!indosso) return '';
  const mom = (indosso.momento_giornata || 'Oggi').toLowerCase();
  const ctxRaw = indosso.contesto_outfit || '';
  const ctx = CONTESTO_FRASE[ctxRaw] || (ctxRaw ? `per ${ctxRaw.toLowerCase()}` : '');
  const text = ctx ? `${mom}, ${ctx}` : mom;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getNotesPreview(p: Profumo): string {
  const parts = [p.note_testa, p.note_cuore, p.note_fondo]
    .filter(Boolean)
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.slice(0, 4).join(', ');
  return getUnifiedNotes(p) || p.famiglia_olfattiva || '';
}

function ChipRow({
  label,
  options,
  value,
  onChange,
  bleed = '-mx-5 px-5',
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  bleed?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-[#B8A9C9]">{label}</p>
      <div className={`no-scrollbar flex gap-2 overflow-x-auto pb-1 ${bleed}`}>
        {options.map((opt) => {
          const active = value === opt;
          const btnClass = active
            ? 'font-semibold shadow-sm'
            : 'border-white/10 bg-[#281B35]/70 text-[#F6EFE4] hover:border-[#D8B995]/40';
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              style={
                active
                  ? {
                      backgroundColor: 'var(--aura-1)',
                      color: '#140D1C',
                      borderColor: 'var(--aura-1)',
                    }
                  : undefined
              }
              className={`shrink-0 rounded-[14px] border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B995] ${btnClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BoutiqueHomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [ultimoIndosso, setUltimoIndosso] = useState<Indosso | null>(null);
  const [ultimiSette, setUltimiSette] = useState<Indosso[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'collezione' | 'decant' | 'ai'>('collezione');

  const [meteo, setMeteo] = useState('Fresco Autunnale');
  const [occasione, setOccasione] = useState('Ufficio');
  const [umore, setUmore] = useState('Legnoso / Ambrato / Deciso');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<{
    advice: string;
    recommended: Profumo[];
  } | null>(null);

  const [selectedQuickProfumoId, setSelectedQuickProfumoId] = useState('');
  const [selectedDecantId, setSelectedDecantId] = useState('');
  const [quickMomento, setQuickMomento] = useState<(typeof MOMENTI)[number]>('Mattina');
  const [quickContesto, setQuickContesto] = useState('Ufficio');
  const [savingQuickWear, setSavingQuickWear] = useState(false);

  const heroBottleRef = useRef<HTMLDivElement | null>(null);
  const { setAuraFromProfumo } = useAura();
  const { triggerSpruzzo } = useSpruzzo();
  const { showToast } = useToast();

  useEffect(() => {
    const h = new Date().getHours();
    const initialMomento =
      h >= 5 && h < 12
        ? 'Mattina'
        : h >= 12 && h < 18
        ? 'Pomeriggio'
        : h >= 18 && h < 23
        ? 'Sera'
        : 'Notte';
    setQuickMomento(initialMomento);
    fetchVaultData(false);
  }, []);

  async function fetchVaultData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const { data: profumiData } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });

      const allProfumi = (profumiData || []) as Profumo[];
      setProfumi(allProfumi);

      const firstCol = allProfumi.find(isCollezioneProfumo);
      if (firstCol) {
        setSelectedQuickProfumoId((prev) => prev || firstCol.id);
      }

      const firstDecant = allProfumi.find(isRadarProfumo);
      if (firstDecant) {
        setSelectedDecantId((prev) => prev || firstDecant.id);
      }

      const { data: indossiData } = await supabase
        .from('indossi')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(7);

      if (indossiData && indossiData.length > 0) {
        const enriched = (indossiData as Indosso[]).map((item) => ({
          ...item,
          profumi: allProfumi.find((p) => p.id === item.profumo_id) || null,
        }));
        setUltimoIndosso(enriched[0]);
        setUltimiSette(enriched);
        setAuraFromProfumo(enriched[0].profumi || firstCol || null);
      } else {
        setUltimoIndosso(null);
        setUltimiSette([]);
        setAuraFromProfumo(firstCol || null);
      }
    } catch (e) {
      console.error('Errore caricamento collezione:', e);
      showToast('Non riesco a caricare i flaconi. Riprova tra poco.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const collezione = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radar = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);

  async function askQuickAiEngine() {
    if (collezione.length === 0) {
      showToast('Aggiungi almeno un flacone in collezione per chiedere consiglio.', 'error');
      return;
    }
    setAdvisorLoading(true);
    setAdvisorResult(null);
    try {
      const query = `Clima: "${meteo}". Contesto: "${occasione}". Stile ricercato: "${umore}". Seleziona in modo tecnico e oggettivo 3 profumi della mia collezione adatti a oggi basandoti solo sulle loro note reali.`;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, profumi: collezione }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore IA');

      const recIds: string[] = data.recommendedIds || [];
      const recProfumi = recIds
        .map((id) => collezione.find((p) => p.id === id))
        .filter(Boolean) as Profumo[];

      setAdvisorResult({
        advice: data.sommelierAdvice,
        recommended: recProfumi.slice(0, 3),
      });
    } catch (err: any) {
      showToast(err?.message || 'Non riesco a consultare il sommelier in questo momento.', 'error');
    } finally {
      setAdvisorLoading(false);
    }
  }

  async function handleQuickWearSave(
    profumoIdToWear: string,
    anchorEl?: HTMLElement | null
  ) {
    if (!profumoIdToWear) return;
    setSavingQuickWear(true);
    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: profumoIdToWear,
          momento_giornata: quickMomento,
          contesto_outfit: quickContesto,
        },
      ]);
      if (error) throw error;

      const worn = profumi.find((p) => p.id === profumoIdToWear) || null;
      if (worn) setAuraFromProfumo(worn);

      setSheetOpen(false);
      triggerSpruzzo(anchorEl || heroBottleRef);
      showToast(worn ? `Oggi indossi ${worn.nome}.` : 'Indosso registrato.');
      await fetchVaultData(true);
    } catch (err: any) {
      showToast(err?.message || "Non sono riuscito a salvare l'indosso.", 'error');
    } finally {
      setSavingQuickWear(false);
    }
  }

  const last = ultimoIndosso?.profumi || null;
  const lastImg = last ? last.url_foto_vetrina || last.immagine_url : null;
  const wearLine = formatWearLine(ultimoIndosso);

  return (
    <main className="mx-auto w-full max-w-[460px] px-5 pt-4 pb-12">
      {/* 1. PRIMO SCHERMO: AURA E PROFUMO DEL GIORNO */}
      <section className="flex min-h-[calc(100dvh-7.5rem)] flex-col justify-between py-2">
        <header className="flex items-center justify-between">
          <Logo className="h-7" />
          <Link
            href="/scanner"
            aria-label="Apri scanner"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8B995]/25 bg-[#1E1428]/80 text-[#F6EFE4] transition hover:border-[#D8B995]"
          >
            <ScanLine className="h-5 w-5 text-[#D8B995]" />
          </Link>
        </header>

        <div className="my-auto flex flex-col items-center text-center py-6">
          {loading ? (
            <div className="flex flex-col items-center gap-5 w-full">
              <div className="h-72 w-60 rounded-[44px] aura-skeleton" />
              <div className="h-10 w-56 rounded-2xl aura-skeleton" />
              <div className="h-5 w-36 rounded-xl aura-skeleton" />
            </div>
          ) : last ? (
            <>
              <motion.div
                ref={heroBottleRef}
                key={last.id}
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={springSoft}
              >
                <BottlePedestal src={lastImg} alt={last.nome} size="xl" />
              </motion.div>

              <div className="mt-6 max-w-[36ch] space-y-1.5">
                <p className="text-[15px] font-medium text-[#D8B995]">{last.brand}</p>
                <h1 className="font-serif text-[clamp(2.4rem,8vw,3.5rem)] leading-[1.04] text-[#F6EFE4]">
                  {last.nome}
                </h1>
                {wearLine && (
                  <p className="text-[14px] text-[#B8A9C9] pt-1">{wearLine}</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5 py-6">
              <div ref={heroBottleRef}>
                <BottlePedestal src={null} alt="Nessun profumo indossato" size="lg" />
              </div>
              <div className="space-y-2 max-w-[30ch]">
                <h1 className="font-serif text-[clamp(2.5rem,8vw,3.5rem)] leading-[1.05] text-[#F6EFE4]">
                  Oggi chi sei?
                </h1>
                <p className="text-[15px] text-[#B8A9C9]">
                  {collezione.length === 0
                    ? 'Lo scaffale è vuoto: aggiungi il primo flacone.'
                    : 'Scegli cosa indossare o lascia fare al sommelier.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setSheetMode('collezione');
              setSheetOpen(true);
            }}
            style={{
              backgroundColor: 'var(--aura-1)',
              color: '#140D1C',
              boxShadow: '0 14px 34px -8px color-mix(in srgb, var(--aura-1) 50%, transparent)',
            }}
            className="min-h-[52px] w-full rounded-[20px] px-6 py-3.5 text-[16px] font-bold tracking-[-0.02em] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F6EFE4]"
          >
            {last ? 'Cambia profumo' : 'Scegli il profumo di oggi'}
          </button>
        </div>
      </section>

      {/* 2. SCHEDA CONSIGLIO IA */}
      <section className="mt-8 rounded-[28px] border border-[#D8B995]/20 bg-[#1E1428]/90 p-5 aura-shadow space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[21px] font-bold tracking-[-0.03em] text-[#F6EFE4]">
              Ispirazione del giorno
            </h2>
            <p className="text-[14px] text-[#B8A9C9]">
              Tocca clima, contesto e carattere per tre proposte su misura.
            </p>
          </div>
          <Sparkles
            className="h-5 w-5 shrink-0 mt-1"
            style={{ color: 'var(--aura-1)' }}
          />
        </div>

        <div className="space-y-4">
          <ChipRow label="Clima" options={METEO} value={meteo} onChange={setMeteo} />
          <ChipRow
            label="Contesto"
            options={CONTESTI}
            value={occasione}
            onChange={(v) => {
              setOccasione(v);
              setQuickContesto(v);
            }}
          />
          <ChipRow
            label="Carattere olfattivo"
            options={PROFILI}
            value={umore}
            onChange={setUmore}
          />
        </div>

        <button
          type="button"
          onClick={askQuickAiEngine}
          disabled={advisorLoading || collezione.length === 0}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#D8B995]/40 bg-[#281B35] px-5 py-3 text-[15px] font-semibold text-[#F6EFE4] transition hover:border-[#D8B995] disabled:opacity-50"
        >
          {advisorLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-[#D8B995]" />
              <span>Cerco tra i tuoi flaconi...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-[#D8B995]" />
              <span>Consigliami tre profumi</span>
            </>
          )}
        </button>

        {advisorLoading && (
          <div className="space-y-3 pt-2">
            <div className="h-16 w-full rounded-[18px] aura-skeleton" />
            <div className="flex gap-3 overflow-hidden">
              <div className="h-44 w-64 shrink-0 rounded-[22px] aura-skeleton" />
              <div className="h-44 w-64 shrink-0 rounded-[22px] aura-skeleton" />
            </div>
          </div>
        )}

        {advisorResult && (
          <div className="space-y-4 pt-2 border-t border-white/10">
            <p className="font-serif text-[17px] leading-[1.45] text-[#F6EFE4]">
              {advisorResult.advice}
            </p>

            {advisorResult.recommended.length > 0 && (
              <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-2">
                {advisorResult.recommended.map((p) => {
                  const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
                  const pImg = p.url_foto_vetrina || p.immagine_url;
                  return (
                    <div
                      key={p.id}
                      style={{ borderColor: `${pAura.primary}44` }}
                      className="flex w-[250px] shrink-0 snap-center flex-col justify-between rounded-[22px] border bg-[#281B35]/90 p-4 gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <BottlePedestal src={pImg} alt={p.nome} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-[#D8B995]">
                            {p.brand}
                          </p>
                          <p className="truncate font-serif text-[20px] leading-tight text-[#F6EFE4]">
                            {p.nome}
                          </p>
                          <p className="line-clamp-1 text-[12px] text-[#B8A9C9] mt-0.5">
                            {getNotesPreview(p)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={savingQuickWear}
                        onClick={(e) => handleQuickWearSave(p.id, e.currentTarget)}
                        style={{
                          backgroundColor: pAura.primary,
                          color: '#140D1C',
                        }}
                        className="min-h-[44px] w-full rounded-[14px] py-2.5 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                      >
                        Indosso oggi
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. ACCESSI RAPIDI */}
      <section className="mt-6 space-y-3.5">
        <div className="grid grid-cols-5 gap-3.5">
          <Link
            href="/collezione"
            className="col-span-3 flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-5 transition hover:border-[#D8B995]/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#F6EFE4]">Collezione</span>
              <Library className="h-4 w-4 text-[#D8B995]" />
            </div>
            <div className="mt-5">
              <span className="font-serif text-[44px] leading-none text-[#F6EFE4]">
                {loading ? '—' : collezione.length}
              </span>
              <p className="text-[13px] text-[#B8A9C9] mt-1">Flaconi sullo scaffale</p>
            </div>
          </Link>

          <Link
            href="/collezione?vista=radar"
            className="col-span-2 flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#281B35]/80 p-5 transition hover:border-[#D8B995]/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#F6EFE4]">Radar</span>
              <Compass className="h-4 w-4 text-[#D8B995]" />
            </div>
            <div className="mt-5">
              <span className="font-serif text-[38px] leading-none text-[#F6EFE4]">
                {loading ? '—' : radar.length}
              </span>
              <p className="text-[13px] text-[#B8A9C9] mt-1">Decant in prova</p>
            </div>
          </Link>
        </div>

        <Link
          href="/diario"
          className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-[#1E1428]/90 px-5 py-4 transition hover:border-[#D8B995]/50"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarHeart className="h-4 w-4 text-[#D8B995]" />
              <span className="text-[15px] font-semibold text-[#F6EFE4]">Diario olfattivo</span>
            </div>
            <p className="text-[13px] text-[#B8A9C9]">
              {ultimiSette.length > 0
                ? `Gli ultimi ${ultimiSette.length} indossi registrati`
                : 'Nessun indosso ancora registrato'}
            </p>
          </div>

          <div className="flex items-center gap-1.5" aria-label="Ultimi sette indossi">
            {Array.from({ length: 7 }).map((_, idx) => {
              const item = ultimiSette[idx];
              const dotAura = item?.profumi
                ? resolveAura(item.profumi.famiglia_olfattiva, item.profumi.nome)
                : null;
              const dotClass = dotAura
                ? 'h-3.5 w-3.5 rounded-full'
                : 'h-3.5 w-3.5 rounded-full border border-white/15 bg-[#281B35]';
              return (
                <span
                  key={idx}
                  title={item?.profumi?.nome || 'Vuoto'}
                  style={
                    dotAura
                      ? {
                          backgroundColor: dotAura.primary,
                          boxShadow: `0 0 10px ${dotAura.primary}88`,
                        }
                      : undefined
                  }
                  className={dotClass}
                />
              );
            })}
          </div>
        </Link>
      </section>

      {/* 4. SHEET CAMBIA PROFUMO */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Cosa indossi oggi?"
        subtitle="Scegli il momento, il contesto e il profumo."
        initialSnap="full"
      >
        <div className="space-y-6">
          <div
            role="tablist"
            aria-label="Modalità di scelta"
            className="grid grid-cols-3 gap-1.5 rounded-[16px] bg-[#140D1C] p-1.5"
          >
            {[
              { id: 'collezione', label: 'Collezione' },
              { id: 'decant', label: 'Decant' },
              { id: 'ai', label: 'Consiglio IA' },
            ].map((tab) => {
              const active = sheetMode === tab.id;
              const tabColor = active
                ? 'text-[#140D1C]'
                : 'text-[#B8A9C9] hover:text-[#F6EFE4]';
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSheetMode(tab.id as 'collezione' | 'decant' | 'ai')}
                  className={`relative min-h-[40px] rounded-[12px] text-[13px] font-semibold transition-colors ${tabColor}`}
                >
                  {active && (
                    <motion.span
                      layoutId="sheet-mode-pill"
                      transition={springSnappy}
                      style={{ backgroundColor: 'var(--aura-1)' }}
                      className="absolute inset-0 rounded-[12px]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4 rounded-[20px] bg-[#281B35]/60 p-4">
            <ChipRow
              label="Momento della giornata"
              options={MOMENTI}
              value={quickMomento}
              onChange={(v) => setQuickMomento(v as (typeof MOMENTI)[number])}
              bleed="-mx-4 px-4"
            />
            <ChipRow
              label="Contesto"
              options={CONTESTI}
              value={quickContesto}
              onChange={setQuickContesto}
              bleed="-mx-4 px-4"
            />
          </div>

          {sheetMode === 'collezione' && (
            <div className="space-y-4">
              {collezione.length > 0 ? (
                <>
                  <div className="max-h-[34dvh] space-y-2 overflow-y-auto pr-1">
                    {collezione.map((p) => {
                      const selected = selectedQuickProfumoId === p.id;
                      const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
                      const pImg = p.url_foto_vetrina || p.immagine_url;
                      const rowStyle = selected
                        ? 'shadow-sm'
                        : 'border-white/10 bg-[#140D1C]/60 hover:border-white/25';
                      const dotBorder = selected ? 'border-transparent' : 'border-white/30';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedQuickProfumoId(p.id)}
                          style={
                            selected
                              ? {
                                  borderColor: pAura.primary,
                                  backgroundColor: '#281B35',
                                }
                              : undefined
                          }
                          className={`flex w-full items-center gap-3.5 rounded-[18px] border p-3 text-left transition ${rowStyle}`}
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[#F6EFE4] p-1.5 flex items-center justify-center">
                            <SmartBottleImage
                              src={pImg}
                              alt={p.nome}
                              blend={true}
                              iconSize="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-[#D8B995]">{p.brand}</p>
                            <p className="truncate font-serif text-[19px] leading-tight text-[#F6EFE4]">
                              {p.nome}
                            </p>
                          </div>
                          <span
                            style={
                              selected ? { backgroundColor: pAura.primary } : undefined
                            }
                            className={`h-4 w-4 shrink-0 rounded-full border ${dotBorder}`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={savingQuickWear || !selectedQuickProfumoId}
                    onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
                    style={{ backgroundColor: 'var(--aura-1)', color: '#140D1C' }}
                    className="min-h-[50px] w-full rounded-[18px] py-3 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {savingQuickWear ? 'Registro...' : 'Indosso oggi'}
                  </button>
                </>
              ) : (
                <p className="text-center text-[14px] text-[#B8A9C9] py-6">
                  Lo scaffale è vuoto: aggiungi il primo flacone dallo scanner.
                </p>
              )}
            </div>
          )}

          {sheetMode === 'decant' && (
            <div className="space-y-4">
              {radar.length > 0 ? (
                <>
                  <div className="max-h-[34dvh] space-y-2 overflow-y-auto pr-1">
                    {radar.map((p) => {
                      const currentDecantId = selectedDecantId || radar[0]?.id || '';
                      const selected = currentDecantId === p.id;
                      const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
                      const pImg = p.url_foto_vetrina || p.immagine_url;
                      const rowStyle = selected
                        ? 'shadow-sm'
                        : 'border-white/10 bg-[#140D1C]/60 hover:border-white/25';
                      const dotBorder = selected ? 'border-transparent' : 'border-white/30';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedDecantId(p.id)}
                          style={
                            selected
                              ? {
                                  borderColor: pAura.primary,
                                  backgroundColor: '#281B35',
                                }
                              : undefined
                          }
                          className={`flex w-full items-center gap-3.5 rounded-[18px] border p-3 text-left transition ${rowStyle}`}
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[#F6EFE4] p-1.5 flex items-center justify-center">
                            <SmartBottleImage
                              src={pImg}
                              alt={p.nome}
                              blend={true}
                              iconSize="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-[#D8B995]">{p.brand}</p>
                            <p className="truncate font-serif text-[19px] leading-tight text-[#F6EFE4]">
                              {p.nome}
                            </p>
                          </div>
                          <span
                            style={
                              selected ? { backgroundColor: pAura.primary } : undefined
                            }
                            className={`h-4 w-4 shrink-0 rounded-full border ${dotBorder}`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={savingQuickWear}
                    onClick={() =>
                      handleQuickWearSave(selectedDecantId || radar[0]?.id || '')
                    }
                    style={{ backgroundColor: 'var(--aura-1)', color: '#140D1C' }}
                    className="min-h-[50px] w-full rounded-[18px] py-3 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {savingQuickWear ? 'Registro...' : 'Indosso questo decant'}
                  </button>
                </>
              ) : (
                <p className="text-center text-[14px] text-[#B8A9C9] py-6">
                  Nessun campioncino o decant attualmente in osservazione nel Radar.
                </p>
              )}
            </div>
          )}

          {sheetMode === 'ai' && (
            <div className="space-y-4">
              <ChipRow
                label="Clima"
                options={METEO}
                value={meteo}
                onChange={setMeteo}
                bleed="-mx-6 px-6"
              />
              <ChipRow
                label="Carattere olfattivo"
                options={PROFILI}
                value={umore}
                onChange={setUmore}
                bleed="-mx-6 px-6"
              />

              <button
                type="button"
                onClick={askQuickAiEngine}
                disabled={advisorLoading || collezione.length === 0}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#D8B995]/40 bg-[#281B35] px-5 py-3 text-[15px] font-semibold text-[#F6EFE4] disabled:opacity-50"
              >
                {advisorLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#D8B995]" />
                    <span>Cerco tra i tuoi flaconi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-[#D8B995]" />
                    <span>Consigliami tre profumi</span>
                  </>
                )}
              </button>

              {advisorResult && (
                <div className="space-y-3 pt-2">
                  <p className="font-serif text-[16px] text-[#F6EFE4]">
                    {advisorResult.advice}
                  </p>
                  <div className="space-y-2">
                    {advisorResult.recommended.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[#140D1C]/70 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-[#D8B995]">{p.brand}</p>
                          <p className="truncate font-serif text-[18px] text-[#F6EFE4]">
                            {p.nome}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={savingQuickWear}
                          onClick={() => handleQuickWearSave(p.id)}
                          style={{ backgroundColor: 'var(--aura-1)', color: '#140D1C' }}
                          className="shrink-0 rounded-[12px] px-3.5 py-2 text-[13px] font-bold"
                        >
                          Indosso oggi
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Sheet>
    </main>
  );
}
