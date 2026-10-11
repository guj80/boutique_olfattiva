'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Compass,
  ScanLine,
  ChevronRight,
  Droplets,
  FlaskConical,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  parsePrezzoEuro,
  getUnifiedNotes,
} from '@/lib/supabase';

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
  const [quickMomento, setQuickMomento] = useState('Mattina');
  const [quickContesto, setQuickContesto] = useState('Ufficio');
  const [savingQuickWear, setSavingQuickWear] = useState(false);

  const [showAllFamiliesModal, setShowAllFamiliesModal] = useState(false);

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

  const stats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    let totalEuro = 0;

    collezione.forEach((p) => {
      const fam = (p.famiglia_olfattiva || '').trim();
      if (fam) {
        familyCounts[fam] = (familyCounts[fam] || 0) + 1;
      }
      const val = parsePrezzoEuro(p);
      if (val > 0) {
        totalEuro += val;
      }
    });

    const allFamiliesSorted = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]);
    const topFamilies = allFamiliesSorted.slice(0, 3);

    return {
      totalFlaconi: collezione.length,
      radarCount: radar.length,
      uniqueFamiliesCount: allFamiliesSorted.length,
      topFamilies,
      allFamiliesSorted,
      totalEuro: Math.round(totalEuro),
    };
  }, [collezione, radar]);

  async function askQuickSommelier() {
    if (collezione.length === 0) return;
    setAdvisorLoading(true);
    setAdvisorResult(null);
    try {
      const query = `Clima: "${meteo}". Contesto: "${occasione}". Stile ricercato: "${umore}". Consigliami in modo sobrio e tecnico 3 profumi della mia collezione adatti a oggi.`;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, profumi: collezione }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore Sommelier');

      const recIds: string[] = data.recommendedIds || [];
      const recProfumi = recIds
        .map((id) => collezione.find((p) => p.id === id))
        .filter(Boolean) as Profumo[];

      setAdvisorResult({
        advice: data.sommelierAdvice,
        recommended: recProfumi.slice(0, 3),
      });
    } catch (err: any) {
      alert(err?.message || 'Impossibile consultare l\'AI in questo momento.');
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
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full">
      {/* 1. HEADER MINIMALISTA */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F7E7CE] to-[#C5A059] p-[1px]">
            <div className="w-full h-full bg-[#08080A] rounded-xl flex items-center justify-center">
              <span className="font-serif text-xl font-bold bg-gradient-to-br from-[#F7E7CE] to-[#C5A059] bg-clip-text text-transparent">
                BL
              </span>
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#C5A059]">
              Private Olfactory Archive
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              BOUTIQUE OLFATTIVA DI LUCA
            </h1>
          </div>
        </div>

        <Link
          href="/collezione"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl boutique-glass text-[#F7E7CE] font-mono text-xs uppercase tracking-wider hover:border-[#F7E7CE]/40 transition self-start sm:self-auto"
        >
          <span>Archivio Profumi</span>
          <span>&rarr;</span>
        </Link>
      </header>

      {/* 2. BARRA COMPATTE SOTD & 3 PULSANTI TECNICI */}
      <section className="mt-6">
        <div className="boutique-glass rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059] block">
                Scent of the Day
              </span>
              {ultimoIndosso && ultimoIndosso.profumi ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <h2 className="font-serif text-xl sm:text-2xl text-white">
                    {ultimoIndosso.profumi.nome}
                  </h2>
                  <span className="text-sm text-[#C5A059] font-mono">
                    — {ultimoIndosso.profumi.brand}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    ({ultimoIndosso.momento_giornata || 'Oggi'}
                    {ultimoIndosso.contesto_outfit ? ` • ${ultimoIndosso.contesto_outfit}` : ''})
                  </span>
                </div>
              ) : (
                <h2 className="font-serif text-xl sm:text-2xl text-white mt-0.5">
                  Selezione del Giorno
                </h2>
              )}
            </div>

            {/* I 3 TASTI COMPATTI E TECNICI */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition ${
                  activePanel === 'ai'
                    ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold'
                    : 'bg-[#F7E7CE]/15 text-[#F7E7CE] border border-[#F7E7CE]/25 hover:bg-[#F7E7CE]/25'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chiedi all&apos;AI</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActivePanel(activePanel === 'collezione' ? 'none' : 'collezione')
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition ${
                  activePanel === 'collezione'
                    ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                    : 'bg-[#08080A] text-zinc-300 border border-[#F7E7CE]/20 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Scegli da Collezione</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanel(activePanel === 'decant' ? 'none' : 'decant')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs transition ${
                  activePanel === 'decant'
                    ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                    : 'bg-[#08080A] text-zinc-300 border border-[#F7E7CE]/20 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>In Prova / Decant</span>
              </button>
            </div>
          </div>

          {/* PANNELLO 1: CHIEDI ALL'AI (CON NUOVO ELENCO CONTESTO SOBRIO) */}
          {activePanel === 'ai' && (
            <div className="mt-5 pt-5 border-t border-[#F7E7CE]/15 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Clima / Stagione
                  </label>
                  <select
                    value={meteo}
                    onChange={(e) => setMeteo(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  >
                    <option value="Soleggiato & Caldo">Soleggiato &amp; Caldo</option>
                    <option value="Temperato Primaverile">Temperato Primaverile</option>
                    <option value="Fresco Autunnale">Fresco Autunnale</option>
                    <option value="Piovoso & Umido">Piovoso &amp; Umido</option>
                    <option value="Freddo Invernale">Freddo Invernale</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Contesto
                  </label>
                  <select
                    value={occasione}
                    onChange={(e) => setOccasione(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  >
                    <option value="Ufficio">Ufficio</option>
                    <option value="Aperitivo">Aperitivo</option>
                    <option value="Cena">Cena</option>
                    <option value="Serata">Serata</option>
                    <option value="Evento">Evento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Profilo Olfattivo
                  </label>
                  <select
                    value={umore}
                    onChange={(e) => setUmore(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
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
                  onClick={askQuickSommelier}
                  disabled={advisorLoading || collezione.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold hover:bg-[#C5A059] transition disabled:opacity-50"
                >
                  {advisorLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Elaborazione...</span>
                    </>
                  ) : (
                    <span>Elabora Proposta</span>
                  )}
                </button>
              </div>

              {advisorResult && (
                <div className="p-4 rounded-xl bg-[#08080A]/90 border border-[#C5A059]/40 space-y-3">
                  <p className="text-xs text-[#F7E7CE] leading-relaxed">
                    {advisorResult.advice}
                  </p>
                  {advisorResult.recommended.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {advisorResult.recommended.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl boutique-glass flex flex-col justify-between gap-2"
                        >
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                              {p.brand}
                            </p>
                            <p className="font-serif text-base text-white font-medium">
                              {p.nome}
                            </p>
                            <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                              {getUnifiedNotes(p) || p.famiglia_olfattiva}
                            </p>
                          </div>
                          <button
                            onClick={() => handleQuickWearSave(p.id)}
                            className="w-full py-1.5 rounded-lg bg-[#C5A059]/20 hover:bg-[#C5A059]/35 text-[#F7E7CE] font-mono text-[10px] uppercase tracking-wider transition"
                          >
                            Seleziona per Oggi
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PANNELLO 2: SCEGLI DA COLLEZIONE */}
          {activePanel === 'collezione' && (
            <div className="mt-5 pt-5 border-t border-[#F7E7CE]/15 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Flacone dalla Collezione ({collezione.length})
                </label>
                <select
                  value={selectedQuickProfumoId}
                  onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                >
                  {collezione.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Contesto
                </label>
                <select
                  value={quickContesto}
                  onChange={(e) => setQuickContesto(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                >
                  <option value="Ufficio">Ufficio</option>
                  <option value="Aperitivo">Aperitivo</option>
                  <option value="Cena">Cena</option>
                  <option value="Serata">Serata</option>
                  <option value="Evento">Evento</option>
                </select>
              </div>
              <button
                onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
                disabled={savingQuickWear || !selectedQuickProfumoId}
                className="px-4 py-2 rounded-xl bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold hover:bg-[#C5A059] transition"
              >
                {savingQuickWear ? 'Salvataggio...' : 'Conferma Indosso'}
              </button>
            </div>
          )}

          {/* PANNELLO 3: IN PROVA / DECANT (CAMPIONCINI / RADAR) */}
          {activePanel === 'decant' && (
            <div className="mt-5 pt-5 border-t border-[#F7E7CE]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {radar.length > 0 ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                      Decant / Campioncini in Test ({radar.length})
                    </label>
                    <select
                      onChange={(e) => setSelectedQuickProfumoId(e.target.value)}
                      defaultValue={radar[0]?.id}
                      className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                    >
                      {radar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand} — {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      handleQuickWearSave(selectedQuickProfumoId || radar[0]?.id)
                    }
                    className="px-4 py-2 rounded-xl bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold"
                  >
                    Indossa Decant Oggi
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">
                  Nessun campioncino o profumo attualmente nel Radar Testing.
                </p>
              )}
              <Link
                href="/collezione?vista=radar"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-[#F7E7CE] hover:underline shrink-0"
              >
                <span>Apri Laboratorio Testing</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 3. IL CUORE DELL'APP (IN MEZZO — SENZA SPIEGAZIONI PROLISSE) */}
      <section className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 01 / PRIVATE */}
          <Link
            href="/collezione"
            className="boutique-glass boutique-glass-hover rounded-2xl p-6 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
                01 / PRIVATE
              </span>
              <FlaskConical className="w-5 h-5 text-[#F7E7CE] group-hover:scale-105 transition" />
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-3">
              Collezione Privata
            </h3>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
              <span>APRI COLLEZIONE</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 02 / ZERO-CLICK NEURAL ENGINE */}
          <Link
            href="/scanner"
            className="boutique-glass boutique-glass-hover rounded-2xl p-6 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
                02 / ZERO-CLICK NEURAL ENGINE
              </span>
              <ScanLine className="w-5 h-5 text-[#F7E7CE] group-hover:scale-105 transition" />
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-3">
              AI Scanner &amp; Estrattore
            </h3>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
              <span>AVVIA ACQUISIZIONE</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* 03 / LABORATORIO DI VALUTAZIONE */}
        <Link
          href="/collezione?vista=radar"
          className="boutique-glass boutique-glass-hover rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[#C5A059]/30 block"
        >
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#C5A059]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
                03 / LABORATORIO DI VALUTAZIONE
              </span>
            </div>
            <h3 className="font-serif text-2xl text-white mt-2">
              RADAR - TESTING
            </h3>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C5A059]/15 border border-[#F7E7CE]/25 font-mono text-xs uppercase tracking-wider text-[#F7E7CE] self-start sm:self-center">
            <span>{stats.radarCount} IN OSSERVAZIONE</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </section>

      {/* 4. STATISTICHE COMPATTE IN BASSO (1 RIGA A 2 BOX CLICCABILI) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Box 1 Cliccabile -> Va alla Collezione */}
        <Link
          href="/collezione"
          className="boutique-glass boutique-glass-hover rounded-2xl p-5 flex items-center justify-between group"
        >
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                Collezione Privata
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-3xl font-semibold text-[#F7E7CE]">
                {loading ? '...' : stats.totalFlaconi}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Flaconi &bull;{' '}
                <span className="text-[#C5A059]">
                  Valore stimato: €{stats.totalEuro.toLocaleString('it-IT')}
                </span>
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-[#F7E7CE] transition" />
        </Link>

        {/* Box 2 Cliccabile -> Apre la Modale con TUTTE le Famiglie Olfattive */}
        <button
          type="button"
          onClick={() => setShowAllFamiliesModal(true)}
          className="boutique-glass boutique-glass-hover rounded-2xl p-5 flex items-center justify-between text-left group w-full"
        >
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-[#C5A059]" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
                Famiglie Olfattive
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2.5">
              <span className="font-mono text-3xl font-semibold text-[#F7E7CE]">
                {loading ? '...' : stats.uniqueFamiliesCount}
              </span>
              <div className="flex flex-wrap gap-1">
                {stats.topFamilies.map(([fam, count]) => (
                  <span
                    key={fam}
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#C5A059]/15 text-[#F7E7CE] border border-[#F7E7CE]/20"
                  >
                    {fam} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-[#F7E7CE] transition shrink-0" />
        </button>
      </section>

      {/* MODALE CON TUTTE LE FAMIGLIE OLFATTIVE CLICCABILI */}
      {showAllFamiliesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-lg w-full p-6 border border-[#F7E7CE]/30 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#F7E7CE]/15">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                  Mappa Olfattiva del Vault
                </p>
                <h3 className="font-serif text-2xl text-white">
                  Tutte le Famiglie Olfattive ({stats.uniqueFamiliesCount})
                </h3>
              </div>
              <button
                onClick={() => setShowAllFamiliesModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1">
              {stats.allFamiliesSorted.map(([fam, count]) => (
                <Link
                  key={fam}
                  href={`/collezione?search=${encodeURIComponent(fam)}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#08080A] border border-[#F7E7CE]/15 hover:border-[#F7E7CE]/45 transition"
                >
                  <span className="text-sm text-white font-medium">{fam}</span>
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-xs bg-[#C5A059]/20 text-[#F7E7CE]">
                    {count} {count === 1 ? 'flacone' : 'flaconi'} &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
