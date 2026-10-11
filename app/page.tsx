'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Compass,
  ScanLine,
  Award,
  TrendingUp,
  Clock,
  ChevronRight,
  Flame,
  Droplets,
  Wine,
  RefreshCw,
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

  // Stato per il Quick Sommelier Advisor nella Home
  const [showQuickAdvisor, setShowQuickAdvisor] = useState(false);
  const [meteo, setMeteo] = useState('Fresco Autunnale');
  const [occasione, setOccasione] = useState('Serata Elegante');
  const [umore, setUmore] = useState('Magnetico & Deciso');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<{
    advice: string;
    recommended: Profumo[];
  } | null>(null);

  useEffect(() => {
    fetchVaultData();
  }, []);

  async function fetchVaultData() {
    setLoading(true);
    try {
      // 1. Scarichiamo TUTTI i profumi senza filtri SQL restrittivi su 'stato'
      const { data: profumiData, error: profumiErr } = await supabase
        .from('profumi')
        .select('*')
        .order('created_at', { ascending: false });

      if (profumiErr) {
        console.error('Errore lettura profumi:', profumiErr);
      }

      const allProfumi = (profumiData || []) as Profumo[];
      setProfumi(allProfumi);

      // 2. Scarichiamo l'ultimo indosso registrato (se la tabella indossi è popolata)
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

  // Calcoli KPI con filtro Zero-Trust (i record con stato NULL sono al 100% nella Collezione!)
  const collezione = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radar = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);

  const stats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    let totalEuro = 0;
    let pricedCount = 0;

    collezione.forEach((p) => {
      const fam = (p.famiglia_olfattiva || '').trim();
      if (fam) {
        familyCounts[fam] = (familyCounts[fam] || 0) + 1;
      }
      const val = parsePrezzoEuro(p);
      if (val > 0) {
        totalEuro += val;
        pricedCount++;
      }
    });

    const topFamilies = Object.entries(familyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const uniqueFamiliesCount = Object.keys(familyCounts).length;
    const avgEuro = pricedCount > 0 ? Math.round(totalEuro / pricedCount) : 0;

    return {
      totalFlaconi: collezione.length,
      radarCount: radar.length,
      uniqueFamiliesCount,
      topFamilies,
      totalEuro: Math.round(totalEuro),
      avgEuro,
    };
  }, [collezione, radar]);

  async function askQuickSommelier() {
    if (collezione.length === 0) return;
    setAdvisorLoading(true);
    setAdvisorResult(null);
    try {
      const query = `Oggi il meteo è "${meteo}", l'occasione è "${occasione}" e il mio stato d'animo è "${umore}". Quale profumo della mia collezione mi consigli di indossare oggi e perché?`;
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
      alert(err?.message || 'Impossibile consultare il Sommelier in questo momento.');
    } finally {
      setAdvisorLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">
      {/* HEADER ISTITUZIONALE DELLA BOUTIQUE */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-[#F7E7CE]/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F7E7CE] to-[#C5A059] p-[1px] shadow-champagne-glow">
            <div className="w-full h-full bg-[#08080A] rounded-2xl flex items-center justify-center">
              <span className="font-serif text-2xl font-bold bg-gradient-to-br from-[#F7E7CE] to-[#C5A059] bg-clip-text text-transparent">
                BL
              </span>
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#C5A059]">
              Private Olfactory Archive &amp; AI Sommelier
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-0.5">
              BOUTIQUE OLFATTIVA DI LUCA
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/scanner"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm shadow-champagne-glow hover:opacity-95 transition"
          >
            <ScanLine className="w-4 h-4" />
            <span>AI Scanner &amp; Estrattore</span>
          </Link>
          <Link
            href="/collezione"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl boutique-glass text-[#F7E7CE] font-medium text-sm hover:border-[#F7E7CE]/40 transition"
          >
            <span>Entra nel Vault ({stats.totalFlaconi})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* SEZIONE 1: SCENT OF THE DAY & SOMMELIER DEL GIORNO */}
      <section className="mt-8">
        <div className="boutique-glass rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/15 border border-[#F7E7CE]/20 text-[#F7E7CE] text-xs font-mono uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Scent of the Day &amp; Concierge</span>
              </div>

              {ultimoIndosso && ultimoIndosso.profumi ? (
                <div className="pt-1">
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Ultimo Indosso Registrato ({ultimoIndosso.momento_giornata || 'Giornata'})
                  </p>
                  <h2 className="font-serif text-2xl sm:text-3xl text-white mt-1">
                    {ultimoIndosso.profumi.nome}{' '}
                    <span className="text-[#C5A059] font-normal text-xl">
                      — {ultimoIndosso.profumi.brand}
                    </span>
                  </h2>
                  {ultimoIndosso.note_giorno && (
                    <p className="text-sm text-zinc-300 italic mt-1">
                      &ldquo;{ultimoIndosso.note_giorno}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-1">
                  <h2 className="font-serif text-2xl sm:text-3xl text-white">
                    Quale capolavoro indosserai oggi, Luca?
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Consulta il tuo Sommelier AI sui {stats.totalFlaconi} profumi del tuo Vault privato oppure registra l&apos;indosso del giorno.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowQuickAdvisor((prev) => !prev)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm shadow-champagne-glow hover:opacity-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {showQuickAdvisor
                    ? 'Chiudi Concierge AI'
                    : '✨ Chiedi al Sommelier cosa indossare oggi'}
                </span>
              </button>
            </div>
          </div>

          {/* MINI-SELETTORE SOMMELIER DEL GIORNO */}
          {showQuickAdvisor && (
            <div className="mt-6 pt-6 border-t border-[#F7E7CE]/15 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#C5A059] mb-2">
                    1. Clima / Meteo
                  </label>
                  <select
                    value={meteo}
                    onChange={(e) => setMeteo(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#F7E7CE]"
                  >
                    <option value="Soleggiato & Caldo">Soleggiato &amp; Caldo</option>
                    <option value="Primaverile Ventilato">Primaverile Ventilato</option>
                    <option value="Fresco Autunnale">Fresco Autunnale</option>
                    <option value="Piovoso & Umido">Piovoso &amp; Umido</option>
                    <option value="Freddo Invernale">Freddo Invernale</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#C5A059] mb-2">
                    2. Contesto / Occasione
                  </label>
                  <select
                    value={occasione}
                    onChange={(e) => setOccasione(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#F7E7CE]"
                  >
                    <option value="Serata Elegante">Serata Elegante / Cena</option>
                    <option value="Signature Quotidiano">Signature Quotidiano / Business</option>
                    <option value="Incontro Intimo">Incontro Intimo / Notturno</option>
                    <option value="Evento Artistico Esclusivo">Evento Artistico Esclusivo</option>
                    <option value="Relax & Meditazione Personale">Relax &amp; Piacere Personale</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-[#C5A059] mb-2">
                    3. Aura &amp; Carattere
                  </label>
                  <select
                    value={umore}
                    onChange={(e) => setUmore(e.target.value)}
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#F7E7CE]"
                  >
                    <option value="Magnetico & Deciso (Legnoso/Ambrato/Boozy)">
                      Magnetico &amp; Deciso (Legnoso/Ambrato/Boozy)
                    </option>
                    <option value="Luminoso & Sofisticato (Agrumato/Fiorito/Pulito)">
                      Luminoso &amp; Sofisticato (Agrumato/Pulito)
                    </option>
                    <option value="Ipnotico & Gourmand">Ipnotico &amp; Gourmand</option>
                    <option value="Misterioso, Cuoiato o Incensato">
                      Misterioso, Cuoiato o Incensato
                    </option>
                    <option value="Marino, Salmastro & Potente">
                      Marino, Salmastro &amp; Potente
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={askQuickSommelier}
                  disabled={advisorLoading || collezione.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F7E7CE] text-[#08080A] font-semibold text-sm hover:bg-[#C5A059] transition disabled:opacity-50"
                >
                  {advisorLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analisi dei {stats.totalFlaconi} profumi in corso...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Trova i 3 Candidati Perfetti</span>
                    </>
                  )}
                </button>
              </div>

              {advisorResult && (
                <div className="p-5 rounded-xl bg-[#08080A]/90 border border-[#C5A059]/40 space-y-4">
                  <p className="text-sm text-[#F7E7CE] leading-relaxed italic">
                    &ldquo;{advisorResult.advice}&rdquo;
                  </p>
                  {advisorResult.recommended.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {advisorResult.recommended.map((p) => (
                        <Link
                          key={p.id}
                          href={`/collezione?search=${encodeURIComponent(p.nome)}`}
                          className="p-3.5 rounded-xl boutique-glass hover:border-[#F7E7CE]/50 transition block"
                        >
                          <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                            {p.brand}
                          </p>
                          <p className="font-serif text-lg text-white font-medium mt-0.5">
                            {p.nome}
                          </p>
                          <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                            {getUnifiedNotes(p) || p.famiglia_olfattiva || 'Vedi nel Vault'}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* SEZIONE 2: KPI CARDS IN VETRO E CHAMPAGNE */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Card 1: Collezione Privata */}
        <div className="boutique-glass boutique-glass-hover rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              Collezione Privata
            </span>
            <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-4xl sm:text-5xl font-semibold text-[#F7E7CE]">
              {loading ? '...' : stats.totalFlaconi}
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Flaconi Custoditi
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Archivio protetto e sincronizzato in tempo reale con il tuo database Supabase.
          </p>
        </div>

        {/* Card 2: Famiglie Olfattive */}
        <div className="boutique-glass boutique-glass-hover rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              Famiglie Esplorate
            </span>
            <Droplets className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-4xl sm:text-5xl font-semibold text-[#F7E7CE]">
              {loading ? '...' : stats.uniqueFamiliesCount}
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Territori Olfattivi
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {stats.topFamilies.length > 0 ? (
              stats.topFamilies.map(([fam, count]) => (
                <span
                  key={fam}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#C5A059]/15 text-[#F7E7CE] border border-[#F7E7CE]/20"
                >
                  {fam} ({count})
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-500">
                Usa &ldquo;✨ Arricchisci con AI&rdquo; nel Vault per classificare le famiglie
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Valore Stimato Vault */}
        <div className="boutique-glass boutique-glass-hover rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              Valore Stimato Vault
            </span>
            <Award className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-4xl sm:text-5xl font-semibold text-[#F7E7CE]">
              {loading ? '...' : `€${stats.totalEuro.toLocaleString('it-IT')}`}
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-3">
            Valore Medio per Flacone:{' '}
            <span className="text-[#F7E7CE]">€{stats.avgEuro}</span>
          </p>
        </div>
      </section>

      {/* SEZIONE 3: PORTALI DI NAVIGAZIONE PRINCIPALI */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Link
          href="/collezione"
          className="boutique-glass boutique-glass-hover rounded-2xl p-7 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                01 / Private Vault
              </span>
              <Wine className="w-5 h-5 text-[#F7E7CE] group-hover:translate-x-1 transition" />
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-3">
              La Collezione Privata ({stats.totalFlaconi})
            </h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Esplora i tuoi {stats.totalFlaconi} profumi d&apos;autore, arricchisci le piramidi olfattive con un click tramite AI, interroga il Sommelier Semantico e registra i tuoi indossi.
            </p>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
            <span>Apri l&apos;Archivio Completo</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/scanner"
          className="boutique-glass boutique-glass-hover rounded-2xl p-7 flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                02 / Zero-Click Neural Engine
              </span>
              <ScanLine className="w-5 h-5 text-[#F7E7CE] group-hover:scale-110 transition" />
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-3">
              AI Scanner &amp; Estrattore
            </h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Incolla un link di Fragrantica o del Brand, scatta una foto al flacone/campioncino oppure scrivi solo il nome: l&apos;AI compila piramide olfattiva, metriche e prezzo in 2 secondi.
            </p>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#F7E7CE]">
            <span>Avvia Acquisizione Neurale</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </section>

      {/* SEZIONE 4: BANNER RADAR BOUTIQUE (DUAL-TEST MOUCHE VS PELLE) */}
      <section className="mt-6">
        <Link
          href="/collezione?vista=radar"
          className="boutique-glass boutique-glass-hover rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[#C5A059]/30 block"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#C5A059]" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                03 / Laboratorio di Valutazione Sensoriale
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl text-white">
              Radar Boutique — Dual-Testing (Mouche vs. Pelle)
            </h3>
            <p className="text-sm text-zinc-400">
              Un profumo su cartoncino mente; sulla pelle svela la sua vera chimica. Confronta apertura su Mouche ed evoluzione su Pelle prima di promuovere un flacone nella tua Collezione.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="px-3.5 py-1.5 rounded-full bg-[#C5A059]/20 border border-[#F7E7CE]/30 font-mono text-xs text-[#F7E7CE]">
              {stats.radarCount} in Osservazione
            </span>
            <ChevronRight className="w-5 h-5 text-[#F7E7CE]" />
          </div>
        </Link>
      </section>
    </main>
  );
}
