'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  ScanLine,
  ChevronRight,
  RefreshCw,
  FlaskConical,
  BookOpen,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';

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

function PerfumeBottleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="3" rx="1" />
      <path d="M10 5v2h4V5" />
      <rect x="5" y="7" width="14" height="15" rx="3" />
      <rect x="8.5" y="11" width="7" height="6" rx="1" />
    </svg>
  );
}

function SmartBottleImage({
  src,
  alt,
  className,
  iconSize = 'w-5 h-5',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    return (
      <div className="flex items-center justify-center text-zinc-600">
        <FlaskConical className={`${iconSize} stroke-[1.2]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === 'direct') setStage('proxy');
        else setStage('failed');
      }}
    />
  );
}

type Opt = string | { value: string; label: string };

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}) {
  return (
    <div className="space-y-1">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B]">
        {label}
      </label>
      <select
        className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB] focus:outline-none focus:border-[#22543d]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          const { value: v, label: l } = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={v} value={v} className="bg-[#09090B] text-white">
              {l}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default function BoutiqueHomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [ultimoIndosso, setUltimoIndosso] = useState<Indosso | null>(null);
  const [loading, setLoading] = useState(true);

  const [activePanel, setActivePanel] = useState<'none' | 'ai' | 'collezione' | 'decant'>('none');

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

  useEffect(() => {
    fetchVaultData();
  }, []);

  async function fetchVaultData() {
    setLoading(true);
    try {
      const { data: profumiData } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });

      const allProfumi = (profumiData || []) as Profumo[];
      setProfumi(allProfumi);

      const firstCol = allProfumi.find(isCollezioneProfumo);
      if (firstCol) setSelectedQuickProfumoId(firstCol.id);

      const firstDecant = allProfumi.find(isRadarProfumo);
      if (firstDecant) setSelectedDecantId(firstDecant.id);

      const { data: indossiData } = await supabase
        .from('indossi')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (indossiData && indossiData.length > 0) {
        const last = indossiData[0] as Indosso;
        const matchedProfumo = allProfumi.find((p) => p.id === last.profumo_id) || null;
        setUltimoIndosso({ ...last, profumi: matchedProfumo });
      }
    } catch (e) {
      console.error('Errore caricamento Vault:', e);
    } finally {
      setLoading(false);
    }
  }

  const collezione = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radar = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);

  async function askQuickAiEngine() {
    if (collezione.length === 0) return;
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
      alert(err?.message || "Impossibile consultare l'IA in questo momento.");
    } finally {
      setAdvisorLoading(false);
    }
  }

  async function handleQuickWearSave(profumoIdToWear: string) {
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
      await fetchVaultData();
      setActivePanel('none');
    } catch (err: any) {
      alert(err?.message || 'Errore registrazione indosso.');
    } finally {
      setSavingQuickWear(false);
    }
  }

  const last = ultimoIndosso?.profumi || null;
  const toggle = (p: 'ai' | 'collezione' | 'decant') =>
    setActivePanel(activePanel === p ? 'none' : p);

  return (
    <main className="min-h-screen bg-[#060607] text-[#EDE9E0] px-4 sm:px-8 lg:px-12 py-8 max-w-5xl mx-auto w-full selection:bg-[#22543d] selection:text-white">
      
      {/* 1. HERO HEADER MONUMENTALE CON LOGO CENTRALE E RIFLESSI VERDI/FLOU */}
      <header className="relative rounded-[24px] bg-gradient-to-b from-[#111115] via-[#0A0A0C] to-[#070708] border border-[#22543d]/40 p-6 sm:p-8 overflow-hidden shadow-[0_0_40px_rgba(34,84,61,0.2)]">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-25 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #22543d 0%, #10b981 30%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group shrink-0">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-[#22543d]/60 via-[#10b981]/30 to-transparent opacity-75 blur-md group-hover:opacity-100 transition duration-500" />
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#09090B] border border-[#22543d]/80 shadow-2xl p-1.5 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.jpg"
                  alt="Boutique Olfattiva"
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition duration-500"
                />
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8C867B]">
                Private Olfactory Vault &amp; Atelier
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-wide text-[#F5F2EB] mt-1">
                BOUTIQUE OLFATTIVA
              </h1>
            </div>
          </div>

          <Link
            href="/diario"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[#EDE9E0] hover:border-[#22543d] hover:bg-white/[0.08] font-mono text-xs uppercase tracking-wider transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Diario Indossi</span>
          </Link>
        </div>
      </header>

      {/* 2. SFERA CENTRALE: INDOSSO DEL GIORNO (SCENT OF THE DAY) */}
      <section className="mt-8 relative rounded-[24px] bg-gradient-to-b from-[#121215] to-[#0A0A0C] border border-white/[0.09] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#070708] border border-white/[0.12] overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
              {last ? (
                <SmartBottleImage
                  src={last.url_foto_vetrina || last.immagine_url}
                  alt={last.nome}
                  iconSize="w-8 h-8"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <PerfumeBottleIcon className="w-8 h-8 text-[#5A5751] stroke-[1.2]" />
              )}
            </div>

            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#10b981]">
                SCENT OF THE DAY • ULTIMO INDOSSO
              </span>
              {last ? (
                <div className="mt-1">
                  <h2 className="font-serif text-2xl sm:text-3xl text-[#F5F2EB] tracking-wide truncate">
                    {last.nome}
                  </h2>
                  <p className="font-mono text-xs text-[#8C867B] mt-0.5">
                    {last.brand}
                    <span className="text-zinc-400">
                      {' '}
                      • {(ultimoIndosso?.momento_giornata || 'oggi').toLowerCase()}
                      {ultimoIndosso?.contesto_outfit
                        ? ` (${ultimoIndosso.contesto_outfit})`
                        : ''}
                    </span>
                  </p>
                </div>
              ) : (
                <h2 className="font-serif text-2xl sm:text-3xl text-[#F5F2EB] tracking-wide mt-1">
                  Cosa indossi oggi?
                </h2>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggle('ai')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
                activePanel === 'ai'
                  ? 'bg-[#10b981] text-[#060607] font-semibold'
                  : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-[#10b981]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sommelier IA</span>
            </button>

            <button
              type="button"
              onClick={() => toggle('collezione')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
                activePanel === 'collezione'
                  ? 'bg-[#10b981] text-[#060607] font-semibold'
                  : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-[#10b981]'
              }`}
            >
              <PerfumeBottleIcon className="w-3.5 h-3.5" />
              <span>Scegli Flacone</span>
            </button>

            <button
              type="button"
              onClick={() => toggle('decant')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
                activePanel === 'decant'
                  ? 'bg-[#10b981] text-[#060607] font-semibold'
                  : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-[#10b981]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Decant</span>
            </button>
          </div>
        </div>

        {/* PANNELLO 1: SOMMELIER IA */}
        {activePanel === 'ai' && (
          <div className="mt-6 pt-6 border-t border-white/[0.08] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Clima / Stagione" value={meteo} onChange={setMeteo} options={METEO} />
              <Field label="Contesto" value={occasione} onChange={setOccasione} options={CONTESTI} />
              <Field label="Profilo Olfattivo" value={umore} onChange={setUmore} options={PROFILI} />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={askQuickAiEngine}
                disabled={advisorLoading || collezione.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider hover:bg-[#34d399] transition disabled:opacity-50"
              >
                {advisorLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analisi nel Caveau...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Trova i 3 Ideali</span>
                  </>
                )}
              </button>
            </div>

            {advisorResult && (
              <div className="p-4 rounded-xl bg-[#070708] border border-white/[0.1] space-y-3.5">
                <p className="text-xs text-[#D6CFC2] leading-relaxed">
                  {advisorResult.advice}
                </p>
                {advisorResult.recommended.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {advisorResult.recommended.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-lg bg-[#070708] border border-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                            <SmartBottleImage
                              src={p.url_foto_vetrina || p.immagine_url}
                              alt={p.nome}
                              iconSize="w-4 h-4"
                              className="w-full h-full object-contain p-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8C867B] truncate">
                              {p.brand}
                            </p>
                            <p className="font-serif text-base text-[#F5F2EB] truncate">
                              {p.nome}
                            </p>
                            <p className="text-[11px] text-[#7D786F] line-clamp-1 mt-0.5">
                              {getUnifiedNotes(p) || p.famiglia_olfattiva}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickWearSave(p.id)}
                          disabled={savingQuickWear}
                          className="w-full py-2 rounded-lg bg-white/[0.06] hover:bg-[#10b981] hover:text-[#060607] text-[#EDE9E0] font-mono text-[10px] uppercase tracking-widest transition"
                        >
                          Indossa Oggi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PANNELLO 2: SCELTA DA COLLEZIONE */}
        {activePanel === 'collezione' && (
          <div className="mt-6 pt-6 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2">
              <Field
                label={`Flacone ({collezione.length})`}
                value={selectedQuickProfumoId}
                onChange={setSelectedQuickProfumoId}
                options={collezione.map((p) => ({
                  value: p.id,
                  label: `${p.brand} — ${p.nome}`,
                }))}
              />
            </div>
            <Field
              label="Momento"
              value={quickMomento}
              onChange={(v) => setQuickMomento(v as (typeof MOMENTI)[number])}
              options={[...MOMENTI]}
            />
            <Field
              label="Contesto"
              value={quickContesto}
              onChange={setQuickContesto}
              options={CONTESTI}
            />
            <button
              type="button"
              onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
              disabled={savingQuickWear || !selectedQuickProfumoId}
              className="px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider transition"
            >
              {savingQuickWear ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        )}

        {/* PANNELLO 3: DECANT IN PROVA */}
        {activePanel === 'decant' && (
          <div className="mt-6 pt-6 border-t border-white/[0.08]">
            {radar.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <Field
                    label={`Decant in Osservazione (${radar.length})`}
                    value={selectedDecantId || radar[0]?.id || ''}
                    onChange={setSelectedDecantId}
                    options={radar.map((p) => ({
                      value: p.id,
                      label: `${p.brand} — ${p.nome}`,
                    }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickWearSave(selectedDecantId || radar[0]?.id)}
                  disabled={savingQuickWear}
                  className="px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider transition"
                >
                  Indossa Decant
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#8C867B] font-mono">
                Nessun campioncino o profumo attualmente nel Radar Testing.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3. ACCESSI RAPIDI A GRIGLIA (COLLEZIONE, SCANNER, RADAR) */}
      <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* COLLEZIONE PRIVATA */}
        <Link
          href="/collezione"
          className="group rounded-[22px] bg-gradient-to-b from-[#131316] to-[#09090B] border border-white/[0.08] hover:border-[#10b981]/50 p-6 flex flex-col justify-between transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
              01 / VAULT
            </span>
            <PerfumeBottleIcon className="w-5 h-5 text-[#10b981]" />
          </div>
          <div className="my-6">
            <span className="font-serif text-4xl text-[#F5F2EB] font-light">
              {loading ? '—' : collezione.length}
            </span>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8C867B] mt-1">
              Flaconi in archivio
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <span className="font-serif text-base text-[#F5F2EB]">Collezione Privata</span>
            <ChevronRight className="w-4 h-4 text-[#8C867B] group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* IA SCANNER & ESTRATTORE */}
        <Link
          href="/scanner"
          className="group rounded-[22px] bg-gradient-to-b from-[#131316] to-[#09090B] border border-white/[0.08] hover:border-[#10b981]/50 p-6 flex flex-col justify-between transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
              02 / AI ENGINE
            </span>
            <ScanLine className="w-5 h-5 text-[#10b981]" />
          </div>
          <div className="my-6">
            <div className="font-serif text-xl text-[#F5F2EB]">Acquisizione</div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8C867B] mt-1">
              Foto • Link • 59K DB
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <span className="font-serif text-base text-[#F5F2EB]">IA Scanner</span>
            <ChevronRight className="w-4 h-4 text-[#8C867B] group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* RADAR TESTING */}
        <Link
          href="/collezione?vista=radar"
          className="group rounded-[22px] bg-gradient-to-b from-[#131316] to-[#09090B] border border-white/[0.08] hover:border-[#10b981]/50 p-6 flex flex-col justify-between transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
              03 / LAB
            </span>
            <Compass className="w-5 h-5 text-[#10b981]" />
          </div>
          <div className="my-6">
            <span className="font-serif text-4xl text-[#F5F2EB] font-light">
              {loading ? '—' : radar.length}
            </span>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8C867B] mt-1">
              Decant &amp; Mouche
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <span className="font-serif text-base text-[#F5F2EB]">Radar Testing</span>
            <ChevronRight className="w-4 h-4 text-[#8C867B] group-hover:translate-x-1 transition" />
          </div>
        </Link>

      </section>

    </main>
  );
}
