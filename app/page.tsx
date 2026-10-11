'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  ScanLine,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';

function LogoLG({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="8"
        y="8"
        width="184"
        height="184"
        rx="42"
        fill="#08080A"
        stroke="#C5A059"
        strokeWidth="4"
      />
      {/* Collo e Vaporizzatore */}
      <rect
        x="86"
        y="42"
        width="24"
        height="18"
        rx="3"
        stroke="#F7E7CE"
        strokeWidth="4"
      />
      <circle cx="105" cy="51" r="3" fill="#F7E7CE" />
      <rect
        x="80"
        y="60"
        width="36"
        height="7"
        rx="3.5"
        stroke="#C5A059"
        strokeWidth="4"
      />
      <rect
        x="75"
        y="67"
        width="46"
        height="8"
        rx="4"
        stroke="#F7E7CE"
        strokeWidth="4"
      />
      {/* Spalla sinistra e Monogramma L */}
      <path
        d="M80 75 C76 86 64 94 46 96 L52 104 L52 162 L46 170 L102 170"
        stroke="#F7E7CE"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M66 95 L66 156 L98 156"
        stroke="#C5A059"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Spalla destra e Monogramma G */}
      <path
        d="M116 75 C120 84 130 92 146 95"
        stroke="#F7E7CE"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M148 114 C142 98 128 92 115 96 C98 102 92 124 98 146 C104 164 122 172 138 166 C148 162 154 152 154 134 L122 134"
        stroke="#F7E7CE"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Nebulizzazione Spray */}
      <path
        d="M118 48 L168 24 L152 44 L178 38 L156 54 L182 52 L152 64 L172 72 L118 55 Z"
        stroke="#C5A059"
        strokeWidth="2.5"
        fill="#C5A059"
        fillOpacity="0.2"
        strokeLinejoin="round"
      />
      <circle cx="174" cy="28" r="2.5" fill="#F7E7CE" />
      <circle cx="185" cy="45" r="2.5" fill="#F7E7CE" />
      <circle cx="180" cy="64" r="2" fill="#C5A059" />
    </svg>
  );
}

function PerfumeBottleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="3" rx="1" />
      <path d="M10 5v2h4V5" />
      <rect x="5" y="7" width="14" height="15" rx="3" />
      <path d="M15 4h4" />
      <path d="M18 2l2 2-2 2" />
      <rect x="8.5" y="11" width="7" height="6" rx="1" />
    </svg>
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
  const [quickMomento] = useState('Mattina');
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
      alert(err?.message || 'Impossibile consultare il Sommelier AI in questo momento.');
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
      {/* HEADER SOLO CON LOGO LG E TITOLO PRIVATE OLFACTORY */}
      <header className="flex items-center gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <LogoLG className="w-14 h-14 shrink-0" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#C5A059]">
            Archive
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            PRIVATE OLFACTORY
          </h1>
        </div>
      </header>

      {/* SCENT OF THE DAY */}
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
                    - {ultimoIndosso.profumi.brand}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    ({ultimoIndosso.momento_giornata || 'Oggi'}
                    {ultimoIndosso.contesto_outfit ? ` - ${ultimoIndosso.contesto_outfit}` : ''})
                  </span>
                </div>
              ) : (
                <h2 className="font-serif text-xl sm:text-2xl text-white mt-0.5">
                  Selezione del Giorno
                </h2>
              )}
            </div>

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
                <span>Chiedi a AI</span>
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
                <PerfumeBottleIcon className="w-3.5 h-3.5 text-[#C5A059]" />
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
                    <option value="Soleggiato e Caldo">Soleggiato e Caldo</option>
                    <option value="Temperato Primaverile">Temperato Primaverile</option>
                    <option value="Fresco Autunnale">Fresco Autunnale</option>
                    <option value="Piovoso e Umido">Piovoso e Umido</option>
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
                  type="button"
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
                            type="button"
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
                      {p.brand} - {p.nome}
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
                type="button"
                onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
                disabled={savingQuickWear || !selectedQuickProfumoId}
                className="px-4 py-2 rounded-xl bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold hover:bg-[#C5A059] transition"
              >
                {savingQuickWear ? 'Salvataggio...' : 'Conferma Indosso'}
              </button>
            </div>
          )}

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

      {/* I 3 MODULI PRINCIPALI (CON CONTEGGIO DINAMICO E ICONA BOCCETTA PROFUMO NEL BOX 01) */}
      <section className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/collezione"
            className="boutique-glass boutique-glass-hover rounded-2xl p-6 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
                  01 / PRIVATE
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C5A059]/15 border border-[#F7E7CE]/25 font-mono text-[11px] text-[#F7E7CE]">
                  {loading ? '...' : `${collezione.length} FLACONI`}
                </span>
              </div>
              <PerfumeBottleIcon className="w-5 h-5 text-[#F7E7CE] group-hover:scale-105 transition" />
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-3">
              Collezione Privata
            </h3>

            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
              <span>APRI COLLEZIONE</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

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
              AI Scanner e Estrattore
            </h3>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
              <span>AVVIA ACQUISIZIONE</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

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
            <span>{loading ? '...' : radar.length} IN OSSERVAZIONE</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </section>
    </main>
  );
}
