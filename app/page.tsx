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
  SlidersHorizontal,
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
      <div className="flex items-center justify-center text-[#5A5751]">
        <FlaskConical className={`${iconSize} stroke-[1.1]`} />
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

  // Prende fino a 4 profumi con immagine per creare la vetrina viva nel quadrato Collezione
  const showcaseBottles = useMemo(() => {
    const withImg = collezione.filter((p) => p.url_foto_vetrina || p.immagine_url);
    return (withImg.length >= 3 ? withImg : collezione).slice(0, 4);
  }, [collezione]);

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
    <main className="min-h-screen bg-[#060607] text-[#EDE9E0] px-4 sm:px-8 py-6 sm:py-10 selection:bg-[#E6E1D6] selection:text-[#060607]">
      <div className="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* 1. HEADER EDITORIALE — STILE MAISON PARIGINA (BYREDO / MALLE) */}
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#0B0B0D] border border-white/[0.1] overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/logo.jpg"
                alt="Boutique Olfattiva"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D6CFC2]" />
                <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.32em] text-[#8C867B]">
                  Archive &amp; Olfactory Lab
                </p>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl tracking-[0.04em] text-[#F5F2EB] font-normal mt-0.5">
                BOUTIQUE OLFATTIVA
              </h1>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#6E6A61]">
              STATO COLLEZIONE
            </p>
            <p className="font-mono text-xs text-[#D6CFC2] mt-1">
              {loading
                ? 'Sincronizzazione...'
                : `${collezione.length} Opere • €${valoreCollezione.toLocaleString('it-IT')}`}
            </p>
          </div>
        </header>

        {/* 2. BENTO GRID 4 QUADRATI MUSEALI (2x2 MOBILE & DESKTOP PER PARITÀ VISIVA ASSOLUTA) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          
          {/* QUADRATO 01 — COLLEZIONE PRIVATA (CON VETRINA FLACONI VIVA) */}
          <Link
            href="/collezione"
            className="group relative aspect-square rounded-[22px] bg-gradient-to-b from-[#131316] via-[#0C0C0E] to-[#09090B] border border-white/[0.08] hover:border-white/[0.24] p-4 sm:p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          >
            {/* Luce museale superiore */}
            <div
              className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-28 rounded-full opacity-20 group-hover:opacity-40 transition duration-500 blur-2xl"
              style={{ background: 'radial-gradient(circle, #E6E1D6 0%, transparent 70%)' }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
                N° 01
              </span>
              <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-[#E6E1D6] group-hover:text-[#060607] transition-all duration-300">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Centro del quadrato: Numero + Mini Vetrina Flaconi */}
            <div className="relative z-10 my-auto space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl sm:text-5xl text-[#F5F2EB] font-light tracking-tight leading-none">
                  {loading ? '—' : collezione.length}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8C867B]">
                  Flaconi
                </span>
              </div>

              {/* Micro-galleria reale dei flaconi */}
              {showcaseBottles.length > 0 && (
                <div className="flex items-center -space-x-2 pt-1">
                  {showcaseBottles.map((b) => (
                    <div
                      key={b.id}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#070708] border border-white/[0.14] overflow-hidden flex items-center justify-center shadow-md"
                    >
                      <SmartBottleImage
                        src={b.url_foto_vetrina || b.immagine_url}
                        alt={b.nome}
                        iconSize="w-3.5 h-3.5"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  ))}
                  {collezione.length > 4 && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#16161A] border border-white/[0.12] flex items-center justify-center font-mono text-[9px] text-[#D6CFC2]">
                      +{collezione.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="font-serif text-sm sm:text-base text-[#F5F2EB] tracking-wide">
                  Collezione Privata
                </h2>
                <p className="font-mono text-[9px] text-[#7D786F] truncate">
                  {valoreCollezione > 0
                    ? `Stima €${valoreCollezione.toLocaleString('it-IT')}`
                    : 'Caveau Personale'}
                </p>
              </div>
            </div>
          </Link>

          {/* QUADRATO 02 — IA SCANNER & ESTRATTORE (STILE MIRINO LEICA / LAB) */}
          <Link
            href="/scanner"
            className="group relative aspect-square rounded-[22px] bg-gradient-to-b from-[#131316] via-[#0C0C0E] to-[#09090B] border border-white/[0.08] hover:border-white/[0.24] p-4 sm:p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          >
            <div className="relative z-10 flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
                N° 02
              </span>
              <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-[#E6E1D6] group-hover:text-[#060607] transition-all duration-300">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Mirino ottico minimalista al centro */}
            <div className="relative z-10 my-auto flex flex-col items-start">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#070708] border border-white/[0.1] flex items-center justify-center group-hover:border-[#D6CFC2]/50 transition-all duration-500">
                <span className="absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-[#D6CFC2]/60" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-[#D6CFC2]/60" />
                <span className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b border-l border-[#D6CFC2]/60" />
                <span className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-[#D6CFC2]/60" />
                <ScanLine className="w-5 h-5 text-[#D6CFC2] stroke-[1.3] group-hover:scale-110 transition-transform" />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#8C867B] mt-2.5">
                Vision • Link • 59K DB
              </span>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/[0.06]">
              <h2 className="font-serif text-sm sm:text-base text-[#F5F2EB] tracking-wide">
                IA Scanner
              </h2>
              <p className="font-mono text-[9px] text-[#7D786F] truncate">
                Estrazione Zero-Hallucination
              </p>
            </div>
          </Link>

          {/* QUADRATO 03 — RADAR TESTING (LABORATORIO DECANT & MOUCHE) */}
          <Link
            href="/collezione?vista=radar"
            className="group relative aspect-square rounded-[22px] bg-gradient-to-b from-[#131316] via-[#0C0C0E] to-[#09090B] border border-white/[0.08] hover:border-white/[0.24] p-4 sm:p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          >
            <div className="relative z-10 flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
                N° 03
              </span>
              <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-[#E6E1D6] group-hover:text-[#060607] transition-all duration-300">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="relative z-10 my-auto space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl sm:text-5xl text-[#F5F2EB] font-light tracking-tight leading-none">
                  {loading ? '—' : radar.length}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8C867B]">
                  In Prova
                </span>
              </div>

              {radar.length > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.07] max-w-full">
                  <Compass className="w-3 h-3 text-[#D6CFC2] shrink-0" />
                  <span className="font-mono text-[9px] text-[#D6CFC2] truncate">
                    {radar[0].nome}
                  </span>
                </div>
              ) : (
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6E6A61]">
                  Valutazione Su Pelle
                </p>
              )}
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/[0.06]">
              <h2 className="font-serif text-sm sm:text-base text-[#F5F2EB] tracking-wide">
                Radar Testing
              </h2>
              <p className="font-mono text-[9px] text-[#7D786F] truncate">
                Decant, Mouche &amp; Wishlist
              </p>
            </div>
          </Link>

          {/* QUADRATO 04 — DIARIO INDOSSI (ARCHIVIO STORICO) */}
          <Link
            href="/diario"
            className="group relative aspect-square rounded-[22px] bg-gradient-to-b from-[#131316] via-[#0C0C0E] to-[#09090B] border border-white/[0.08] hover:border-white/[0.24] p-4 sm:p-5 flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          >
            <div className="relative z-10 flex items-center justify-between">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#8C867B]">
                N° 04
              </span>
              <span className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-[#E6E1D6] group-hover:text-[#060607] transition-all duration-300">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="relative z-10 my-auto space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl sm:text-5xl text-[#F5F2EB] font-light tracking-tight leading-none">
                  {loading ? '—' : totaleIndossi}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8C867B]">
                  Sessioni
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.07]">
                <BookOpen className="w-3 h-3 text-[#D6CFC2] shrink-0" />
                <span className="font-mono text-[9px] text-[#D6CFC2]">
                  Cronologia &amp; Statistiche
                </span>
              </div>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/[0.06]">
              <h2 className="font-serif text-sm sm:text-base text-[#F5F2EB] tracking-wide">
                Diario Indossi
              </h2>
              <p className="font-mono text-[9px] text-[#7D786F] truncate">
                Registro Olfattivo Personale
              </p>
            </div>
          </Link>
        </section>

        {/* 3. INDOSSO DEL GIORNO — POSIZIONATO PER ULTIMO COME DOCK SCULTOREO */}
        <section className="relative rounded-[24px] bg-gradient-to-b from-[#121215] to-[#0A0A0C] border border-white/[0.09] p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            
            {/* Parte Sinistra: Flacone e Dettaglio Ultimo Indosso */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#070708] border border-white/[0.1] overflow-hidden flex items-center justify-center shrink-0">
                {ultimoIndosso?.profumi ? (
                  <SmartBottleImage
                    src={
                      ultimoIndosso.profumi.url_foto_vetrina ||
                      ultimoIndosso.profumi.immagine_url
                    }
                    alt={ultimoIndosso.profumi.nome}
                    iconSize="w-6 h-6"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <FlaskConical className="w-6 h-6 text-[#5A5751] stroke-[1.2]" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#8C867B]">
                    SCENT OF THE DAY • INDOSSO ATTUALE
                  </span>
                </div>

                {ultimoIndosso && ultimoIndosso.profumi ? (
                  <div className="mt-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A8A297]">
                      {ultimoIndosso.profumi.brand}
                    </p>
                    <h3 className="font-serif text-xl sm:text-2xl text-[#F5F2EB] tracking-wide truncate">
                      {ultimoIndosso.profumi.nome}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] font-mono text-[10px] text-[#D6CFC2]">
                        {ultimoIndosso.momento_giornata || 'Giornata'}
                      </span>
                      {ultimoIndosso.contesto_outfit && (
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] font-mono text-[10px] text-[#A8A297]">
                          {ultimoIndosso.contesto_outfit}
                        </span>
                      )}
                      {ultimoIndosso.profumi.naso && (
                        <span className="font-mono text-[10px] text-[#7D786F] hidden sm:inline">
                          • Naso: {ultimoIndosso.profumi.naso}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <h3 className="font-serif text-xl text-[#D6CFC2]">
                      Nessuna fragranza selezionata
                    </h3>
                    <p className="font-mono text-[11px] text-[#7D786F] mt-0.5">
                      Scegli un flacone dalla collezione o chiedi al Sommelier IA.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Parte Destra: Azioni Tattili */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider transition-all ${
                  activePanel === 'ai'
                    ? 'bg-[#E6E1D6] text-[#060607] font-semibold'
                    : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-white/[0.25]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sommelier IA</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActivePanel(activePanel === 'collezione' ? 'none' : 'collezione')
                }
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider transition-all ${
                  activePanel === 'collezione'
                    ? 'bg-[#E6E1D6] text-[#060607] font-semibold'
                    : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-white/[0.25]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Scegli Flacone</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'decant' ? 'none' : 'decant')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider transition-all ${
                  activePanel === 'decant'
                    ? 'bg-[#E6E1D6] text-[#060607] font-semibold'
                    : 'bg-white/[0.04] text-[#EDE9E0] border border-white/[0.1] hover:border-white/[0.25]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Decant</span>
              </button>
            </div>
          </div>

          {/* CASSETTO ESPANDIBILE 1: SOMMELIER IA */}
          {activePanel === 'ai' && (
            <div className="mt-5 pt-5 border-t border-white/[0.08] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                    Clima / Stagione
                  </label>
                  <select
                    value={meteo}
                    onChange={(e) => setMeteo(e.target.value)}
                    className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D6CFC2]"
                  >
                    <option value="Soleggiato e Caldo">Soleggiato e Caldo</option>
                    <option value="Temperato Primaverile">Temperato Primaverile</option>
                    <option value="Fresco Autunnale">Fresco Autunnale</option>
                    <option value="Piovoso e Umido">Piovoso e Umido</option>
                    <option value="Freddo Invernale">Freddo Invernale</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                    Contesto
                  </label>
                  <select
                    value={occasione}
                    onChange={(e) => setOccasione(e.target.value)}
                    className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D6CFC2]"
                  >
                    <option value="Ufficio">Ufficio</option>
                    <option value="Aperitivo">Aperitivo</option>
                    <option value="Cena">Cena</option>
                    <option value="Serata">Serata</option>
                    <option value="Evento">Evento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                    Accordo Ricercato
                  </label>
                  <select
                    value={umore}
                    onChange={(e) => setUmore(e.target.value)}
                    className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D6CFC2]"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E6E1D6] text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50"
                >
                  {advisorLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ricerca nel Caveau...</span>
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
                <div className="p-4 rounded-2xl bg-[#070708] border border-white/[0.1] space-y-3.5">
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
                            className="w-full py-2 rounded-lg bg-white/[0.06] hover:bg-[#E6E1D6] hover:text-[#060607] text-[#EDE9E0] font-mono text-[10px] uppercase tracking-widest transition"
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

          {/* CASSETTO ESPANDIBILE 2: SCELTA DIRETTA DA COLLEZIONE */}
          {activePanel === 'collezione' && (
            <div className="mt-5 pt-5 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                  Flacone ({collezione.length})
                </label>
                <select
                  value={selectedQuickProfumoId}
                  onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                  className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB]"
                >
                  {collezione.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                  Momento
                </label>
                <select
                  value={quickMomento}
                  onChange={(e) => setQuickMomento(e.target.value as any)}
                  className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB]"
                >
                  <option value="Mattina">Mattina</option>
                  <option value="Pomeriggio">Pomeriggio</option>
                  <option value="Sera">Sera</option>
                  <option value="Notte">Notte</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                  Contesto
                </label>
                <select
                  value={quickContesto}
                  onChange={(e) => setQuickContesto(e.target.value)}
                  className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB]"
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
                className="px-4 py-2.5 rounded-xl bg-[#E6E1D6] hover:bg-white text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider transition"
              >
                {savingQuickWear ? '...' : 'Registra'}
              </button>
            </div>
          )}

          {/* CASSETTO ESPANDIBILE 3: DECANT IN PROVA */}
          {activePanel === 'decant' && (
            <div className="mt-5 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {radar.length > 0 ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#8C867B] mb-1.5">
                      Decant in Osservazione ({radar.length})
                    </label>
                    <select
                      onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                      defaultValue={radar[0]?.id}
                      className="w-full rounded-xl bg-[#070708] border border-white/[0.1] px-3 py-2.5 text-xs text-[#F5F2EB]"
                    >
                      {radar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand} — {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickWearSave(selectedQuickProfumoId || radar[0]?.id)
                    }
                    className="px-4 py-2.5 rounded-xl bg-[#E6E1D6] hover:bg-white text-[#060607] font-mono text-xs font-semibold uppercase tracking-wider"
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

      </div>
    </main>
  );
}
