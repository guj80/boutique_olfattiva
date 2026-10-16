'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  ScanLine,
  ArrowUpRight,
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
  parsePrezzoEuro,
} from '@/lib/supabase';

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
      <rect x="5" y="7" width="14" height="15" rx="2.5" />
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

export default function BoutiqueHomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [ultimoIndosso, setUltimoIndosso] = useState<Indosso | null>(null);
  const [totaleIndossi, setTotaleIndossi] = useState<number>(0);
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
  const [quickMomento, setQuickMomento] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>('Mattina');
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

      const { data: indossiData, count } = await supabase
        .from('indossi')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (typeof count === 'number') {
        setTotaleIndossi(count);
      }

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

  const valoreCollezione = useMemo(() => {
    return Math.round(collezione.reduce((acc, p) => acc + parsePrezzoEuro(p), 0));
  }, [collezione]);

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

  return (
    <main className="min-h-screen px-4 sm:px-8 py-6 sm:py-10 max-w-5xl mx-auto w-full flex flex-col justify-between gap-6">
      {/* 1. HEADER MINIMALISTA — ZERO ALONI, ZERO BORDI DORATI */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#09090B] border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src="/logo.jpg"
              alt="Boutique Olfattiva"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
              Private Olfactory Vault
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-wide text-zinc-100 mt-0.5">
              BOUTIQUE OLFATTIVA
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end font-mono text-[11px] text-zinc-500">
          <span>ARCHIVIO ATTIVO</span>
          <span className="text-zinc-300">
            {loading ? '...' : `${collezione.length} Flaconi • ${radar.length} Testing`}
          </span>
        </div>
      </header>

      {/* 2. GRIGLIA DI 4 QUADRATI PERFETTI (2x2 SU MOBILE, 4 SU DESKTOP) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* QUADRATO 1: COLLEZIONE PRIVATA */}
        <Link
          href="/collezione"
          className="aspect-square rounded-2xl bg-[#0C0C0E] border border-zinc-800/90 hover:border-zinc-500 p-4 sm:p-6 flex flex-col justify-between group transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              01 / VAULT
            </span>
            <PerfumeBottleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-white transition" />
          </div>

          <div className="my-auto py-2">
            <div className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
              {loading ? '—' : collezione.length}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-1">
              {valoreCollezione > 0 ? `Valore ~ €${valoreCollezione.toLocaleString('it-IT')}` : 'Flaconi in archivio'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="font-serif text-sm sm:text-base text-zinc-200 group-hover:text-white">
              Collezione
            </span>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </div>
        </Link>

        {/* QUADRATO 2: IA SCANNER & ESTRATTORE */}
        <Link
          href="/scanner"
          className="aspect-square rounded-2xl bg-[#0C0C0E] border border-zinc-800/90 hover:border-zinc-500 p-4 sm:p-6 flex flex-col justify-between group transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              02 / AI ENGINE
            </span>
            <ScanLine className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-white transition" />
          </div>

          <div className="my-auto py-2">
            <div className="font-serif text-xl sm:text-2xl text-white leading-snug">
              Acquisizione Rapida
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-1">
              Foto • Link • Ricerca
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="font-serif text-sm sm:text-base text-zinc-200 group-hover:text-white">
              IA Scanner
            </span>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </div>
        </Link>

        {/* QUADRATO 3: RADAR TESTING */}
        <Link
          href="/collezione?vista=radar"
          className="aspect-square rounded-2xl bg-[#0C0C0E] border border-zinc-800/90 hover:border-zinc-500 p-4 sm:p-6 flex flex-col justify-between group transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              03 / LAB
            </span>
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-white transition" />
          </div>

          <div className="my-auto py-2">
            <div className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
              {loading ? '—' : radar.length}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-1">
              Decant &amp; Mouche
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="font-serif text-sm sm:text-base text-zinc-200 group-hover:text-white">
              Radar Testing
            </span>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </div>
        </Link>

        {/* QUADRATO 4: DIARIO INDOSSI */}
        <Link
          href="/diario"
          className="aspect-square rounded-2xl bg-[#0C0C0E] border border-zinc-800/90 hover:border-zinc-500 p-4 sm:p-6 flex flex-col justify-between group transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              04 / LOGBOOK
            </span>
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-white transition" />
          </div>

          <div className="my-auto py-2">
            <div className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
              {loading ? '—' : totaleIndossi}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-1">
              Sessioni registrate
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="font-serif text-sm sm:text-base text-zinc-200 group-hover:text-white">
              Diario Indossi
            </span>
            <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </div>
        </Link>
      </section>

      {/* 3. INDOSSO DEL GIORNO — POSIZIONATO PER ULTIMO IN FONDO */}
      <section className="rounded-2xl bg-[#0C0C0E] border border-zinc-800/90 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#09090B] border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
              {ultimoIndosso?.profumi ? (
                <SmartBottleImage
                  src={
                    ultimoIndosso.profumi.url_foto_vetrina ||
                    ultimoIndosso.profumi.immagine_url
                  }
                  alt={ultimoIndosso.profumi.nome}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <PerfumeBottleIcon className="w-5 h-5 text-zinc-600" />
              )}
            </div>

            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 block">
                Ultimo Indosso del Giorno
              </span>
              {ultimoIndosso && ultimoIndosso.profumi ? (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <h2 className="font-serif text-lg sm:text-xl text-white">
                    {ultimoIndosso.profumi.nome}
                  </h2>
                  <span className="text-xs text-zinc-400 font-mono">
                    — {ultimoIndosso.profumi.brand}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    ({ultimoIndosso.momento_giornata || 'Oggi'}
                    {ultimoIndosso.contesto_outfit
                      ? ` • ${ultimoIndosso.contesto_outfit}`
                      : ''}
                    )
                  </span>
                </div>
              ) : (
                <h2 className="font-serif text-lg text-zinc-300 mt-0.5">
                  Nessun indosso registrato oggi
                </h2>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition-all ${
                activePanel === 'ai'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Consiglio IA</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActivePanel(activePanel === 'collezione' ? 'none' : 'collezione')
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition-all ${
                activePanel === 'collezione'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white'
              }`}
            >
              <PerfumeBottleIcon className="w-3.5 h-3.5" />
              <span>Registra da Collezione</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'decant' ? 'none' : 'decant')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition-all ${
                activePanel === 'decant'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Indossa Decant</span>
            </button>
          </div>
        </div>

        {activePanel === 'ai' && (
          <div className="mt-5 pt-5 border-t border-zinc-800/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Clima / Stagione
                </label>
                <select
                  value={meteo}
                  onChange={(e) => setMeteo(e.target.value)}
                  className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                >
                  <option value="Soleggiato e Caldo">Soleggiato e Caldo</option>
                  <option value="Temperato Primaverile">Temperato Primaverile</option>
                  <option value="Fresco Autunnale">Fresco Autunnale</option>
                  <option value="Piovoso e Umido">Piovoso e Umido</option>
                  <option value="Freddo Invernale">Freddo Invernale</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Contesto
                </label>
                <select
                  value={occasione}
                  onChange={(e) => setOccasione(e.target.value)}
                  className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                >
                  <option value="Ufficio">Ufficio</option>
                  <option value="Aperitivo">Aperitivo</option>
                  <option value="Cena">Cena</option>
                  <option value="Serata">Serata</option>
                  <option value="Evento">Evento</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Profilo Olfattivo
                </label>
                <select
                  value={umore}
                  onChange={(e) => setUmore(e.target.value)}
                  className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                >
                  <option value="Legnoso / Ambrato / Deciso">Legnoso / Ambrato / Deciso</option>
                  <option value="Agrumato / Fresco / Pulito">Agrumato / Fresco / Pulito</option>
                  <option value="Speziato / Boozy / Caldo">Speziato / Boozy / Caldo</option>
                  <option value="Gourmand / Ricco">Gourmand / Ricco</option>
                  <option value="Marino / Aromatizzato">Marino / Aromatizzato</option>
                  <option value="Cuoiato / Incensato / Fumoso">Cuoiato / Incensato / Fumoso</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={askQuickAiEngine}
                disabled={advisorLoading || collezione.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 font-mono text-xs font-semibold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
              >
                {advisorLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Elaborazione...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analizza Collezione</span>
                  </>
                )}
              </button>
            </div>

            {advisorResult && (
              <div className="p-4 rounded-xl bg-[#09090B] border border-zinc-800 space-y-3">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {advisorResult.advice}
                </p>
                {advisorResult.recommended.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {advisorResult.recommended.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#0C0C0E] border border-zinc-800 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[#09090B] border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                            <SmartBottleImage
                              src={p.url_foto_vetrina || p.immagine_url}
                              alt={p.nome}
                              iconSize="w-4 h-4"
                              className="w-full h-full object-contain p-0.5"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 truncate">
                              {p.brand}
                            </p>
                            <p className="font-serif text-base text-white font-medium truncate">
                              {p.nome}
                            </p>
                            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                              {getUnifiedNotes(p) || p.famiglia_olfattiva}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickWearSave(p.id)}
                          className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-mono text-[10px] uppercase tracking-wider transition"
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

        {activePanel === 'collezione' && (
          <div className="mt-5 pt-5 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[10px] uppercase text-zinc-400 mb-1">
                Flacone ({collezione.length})
              </label>
              <select
                value={selectedQuickProfumoId}
                onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white"
              >
                {collezione.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} - {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-zinc-400 mb-1">
                Momento
              </label>
              <select
                value={quickMomento}
                onChange={(e) => setQuickMomento(e.target.value as any)}
                className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white"
              >
                <option value="Mattina">Mattina</option>
                <option value="Pomeriggio">Pomeriggio</option>
                <option value="Sera">Sera</option>
                <option value="Notte">Notte</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-zinc-400 mb-1">
                Contesto
              </label>
              <select
                value={quickContesto}
                onChange={(e) => setQuickContesto(e.target.value)}
                className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white"
              >
                <option value="Ufficio">Ufficio</option>
                <option value="Aperitivo">Aperitivo</option>
                <option value="Cena">Cena</option>
                <option value="Serata">Serata</option>
                <option value="Evento">Evento</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
              disabled={savingQuickWear || !selectedQuickProfumoId}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-semibold transition"
            >
              {savingQuickWear ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        )}

        {activePanel === 'decant' && (
          <div className="mt-5 pt-5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {radar.length > 0 ? (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase text-zinc-400 mb-1">
                    Decant in Test ({radar.length})
                  </label>
                  <select
                    onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                    defaultValue={radar[0]?.id}
                    className="w-full rounded-xl bg-[#09090B] border border-zinc-800 px-3 py-2 text-xs text-white"
                  >
                    {radar.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand} - {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickWearSave(selectedQuickProfumoId || radar[0]?.id)
                  }
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-semibold"
                >
                  Indossa Decant
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Nessun campioncino o profumo attualmente nel Radar Testing.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
