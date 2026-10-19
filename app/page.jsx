'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Send,
  CloudRain,
  Briefcase,
  Moon,
  Sun,
  ArrowUpRight,
  Compass,
  Library,
  Check,
  Flame,
  Shirt,
} from 'lucide-react';
import {
  supabase,
  isCollezioneProfumo,
  isRadarProfumo,
  getLocalDateISO,
  parsePrezzoEuro,
} from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { GlassCard } from '@/components/GlassCard';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { useAura, resolveAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';

const QUICK_SCENARIOS = [
  {
    label: 'Serata Magnetica',
    query: 'Serata elegante o uscita notturna: cerco scia magnetica, profonda e seducente',
    icon: Moon,
  },
  {
    label: 'Giornata Sartoriale',
    query: 'Impegno professionale o giornata dinamica: cerco classe, pulizia ed eleganza misurata',
    icon: Briefcase,
  },
  {
    label: 'Freddo & Pioggia',
    query: 'Clima freddo, umido o piovoso: cerco calore avvolgente, legni, ambra, spezie o resine',
    icon: CloudRain,
  },
  {
    label: 'Luce & Energia',
    query: 'Giornata luminosa e soleggiata: cerco vibrazioni agrumate, marine, verdi o aromatiche',
    icon: Sun,
  },
];

const MOOD_CHIPS = [
  'Misterioso',
  'Sartoriale',
  'Rilassato',
  'Audace',
];

export default function Home() {
  const [profumi, setProfumi] = useState([]);
  const [recentIndossi, setRecentIndossi] = useState([]);
  const [loading, setLoading] = useState(true);

  const [aiQuery, setAiQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [wornTodayIds, setWornTodayIds] = useState([]);
  const [savingWearId, setSavingWearId] = useState(null);

  const { setCustomAura } = useAura();
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
    async function fetchHomeData() {
      try {
        const [profRes, indRes] = await Promise.all([
          supabase
            .from('profumi')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('indossi')
            .select('id, profumo_id, data_indosso, created_at')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        setProfumi(profRes.data || []);
        setRecentIndossi(indRes.data || []);

        const todayIso = getLocalDateISO();
        const todayIds = (indRes.data || [])
          .filter((i) => (i.data_indosso || (i.created_at || '').slice(0, 10)) === todayIso)
          .map((i) => i.profumo_id);
        setWornTodayIds(todayIds);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHomeData();
  }, [setCustomAura]);

  async function handleAskAi(customQuery) {
    const baseQ = (customQuery ?? aiQuery).trim();
    if (!baseQ || profumi.length === 0) return;

    const fullQuery = selectedMood
      ? `${baseQ} (Mood / Outfit desiderato: ${selectedMood})`
      : baseQ;

    setAiQuery(baseQ);
    setAiLoading(true);
    setAiError('');
    setAiResult(null);

    try {
      const recentWornIds = recentIndossi.slice(0, 5).map((i) => i.profumo_id);
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: fullQuery,
          profumi,
          recentWornIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore analisi olfattiva.');

      const recommendedBottles = (data.recommendedIds || [])
        .map((id) => profumi.find((p) => String(p.id) === String(id)))
        .filter(Boolean);

      setAiResult({
        advice: data.sommelierAdvice,
        motivazioni: data.motivazioniPerProfumo || {},
        bottles: recommendedBottles,
      });
    } catch (e) {
      setAiError(e?.message || 'Impossibile completare la selezione.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleWearToday(perfume) {
    if (!perfume?.id || savingWearId) return;
    setSavingWearId(perfume.id);

    try {
      const hour = new Date().getHours();
      const momento =
        hour < 12 ? 'Mattina' : hour < 18 ? 'Pomeriggio' : hour < 22 ? 'Sera' : 'Notte';

      const payload = {
        profumo_id: perfume.id,
        data_indosso: getLocalDateISO(),
        momento_giornata: momento,
        contesto_outfit: selectedMood || aiQuery.slice(0, 80) || null,
        note_indosso: `Scelto tramite Consulenza Olfattiva (${momento})`,
      };

      const { error } = await supabase.from('indossi').insert([payload]);
      if (error) throw error;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([18, 30, 18]);
      }
      triggerSpruzzo();
      setWornTodayIds((prev) => [...prev, perfume.id]);
      showToast(`${perfume.nome} registrato nel Diario di oggi`, 'success');
    } catch (err) {
      showToast('Impossibile registrare nel Diario.', 'error');
    } finally {
      setSavingWearId(null);
    }
  }

  const collezioneList = profumi.filter(isCollezioneProfumo);
  const radarList = profumi.filter(isRadarProfumo);

  const collezioneCount = collezioneList.length;
  const radarCount = radarList.length;

  // Calcolo famiglie distinte in Collezione per arricchire il portale
  const uniqueFamiliesCount = new Set(
    collezioneList.map((p) => p.famiglia_olfattiva).filter(Boolean)
  ).size;

  const previewCollezione = collezioneList.slice(0, 4);
  const previewRadar = radarList.slice(0, 3);
  const ultimeAcquisizioni = profumi.slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-5 pb-36 space-y-9">
      {/* HEADER: LOGO ORIGINALE BICOLORE IN ASSOLUTO RISALTO SU NERO PROFONDO */}
      <header className="flex flex-col items-center justify-center pt-3 pb-1">
        <Logo variant="original" className="h-32 sm:h-36" />
      </header>

      {/* CONSULENZA OLFATTIVA AVANZATA (CON THINKING ORB & INDOSSALO OGGI) */}
      <GlassCard accentColor="#10B981" className="p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-[#10B981]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-[#F6EFE4] leading-none">
                Consulenza di Oggi
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/70 mt-1">
                Sommelier Dual-AI • Rotazione Intelligente Diario
              </p>
            </div>
          </div>
        </div>

        {/* Scenari Rapidi */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_SCENARIOS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleAskAi(item.query)}
                disabled={aiLoading || profumi.length === 0}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#050308]/90 px-3.5 py-2.5 text-left font-mono text-[11px] text-[#F6EFE4] transition hover:border-emerald-400/50 hover:bg-emerald-950/20 disabled:opacity-40"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selettore Mood / Outfit */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#8E7C9E] shrink-0">
            <Shirt className="h-3 w-3 text-[#10B981]" /> Dress Code:
          </span>
          {MOOD_CHIPS.map((mood) => {
            const active = selectedMood === mood;
            return (
              <button
                key={mood}
                type="button"
                onClick={() => setSelectedMood(active ? '' : mood)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] transition shrink-0 border ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/10 bg-[#050308]/60 text-[#B8A9C9] hover:border-white/25'
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>

        {/* Input Libero */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAi();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Occasione, meteo, temperatura o accordo ricercato..."
            className="flex-1 rounded-[18px] border border-white/10 bg-[#050308] px-4 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#8E7C9E]/60 focus:border-emerald-400/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuery.trim() || profumi.length === 0}
            className="flex items-center justify-center gap-2 rounded-[18px] bg-[#10B981] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[#050308] transition hover:bg-[#34D399] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Analizza</span>
          </button>
        </form>

        {aiLoading && <ThinkingOrb label="Incrocio piramidi olfattive e storico indossi..." />}

        {aiError && <p className="text-xs text-rose-400 font-mono">{aiError}</p>}

        {/* Risposta Sommelier: 1 Scelta Principale + Alternative + Bottone "Indossalo oggi" */}
        {aiResult && !aiLoading && (
          <div className="pt-3 border-t border-white/10 space-y-4">
            <div className="rounded-[20px] border border-emerald-500/25 bg-[#050308]/90 p-4 text-xs sm:text-sm text-[#F6EFE4] leading-relaxed">
              {aiResult.advice}
            </div>

            {aiResult.bottles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {aiResult.bottles.map((b, idx) => {
                  const bAura = resolveAura(b.famiglia_olfattiva, b.nome);
                  const isWorn = wornTodayIds.includes(b.id);
                  const isPrimaryChoice = idx === 0;

                  return (
                    <div
                      key={b.id}
                      style={{ borderColor: isPrimaryChoice ? `${bAura.primary}65` : 'rgba(255,255,255,0.1)' }}
                      className="flex flex-col justify-between rounded-[22px] border bg-[#050308] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            color: bAura.primary,
                            backgroundColor: `${bAura.primary}18`,
                            borderColor: `${bAura.primary}40`,
                          }}
                          className="rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                        >
                          {isPrimaryChoice ? '★ Scelta Principale' : `Alternativa ${idx}`}
                        </span>
                        <span className="font-mono text-[10px] text-[#8E7C9E]">
                          {b.famiglia_olfattiva}
                        </span>
                      </div>

                      <Link href="/collezione" className="flex items-center gap-3 group">
                        <BottlePedestal
                          src={b.url_foto_vetrina || b.immagine_url}
                          alt={b.nome}
                          size="sm"
                          className="!h-20 !w-20 shrink-0"
                          showSigil={isCollezioneProfumo(b)}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            style={{ color: bAura.primary }}
                            className="font-mono text-[10px] uppercase tracking-wider truncate"
                          >
                            {b.brand}
                          </p>
                          <h4 className="font-serif text-lg text-[#F6EFE4] truncate group-hover:underline">
                            {b.nome}
                          </h4>
                          {aiResult.motivazioni[b.id] && (
                            <p className="text-[11px] text-[#B8A9C9] line-clamp-2 mt-1">
                              {aiResult.motivazioni[b.id]}
                            </p>
                          )}
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleWearToday(b)}
                        disabled={isWorn || savingWearId === b.id}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
                          isWorn
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-white/10 text-[#F6EFE4] hover:bg-[#10B981] hover:text-[#050308]'
                        }`}
                      >
                        {isWorn ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Indossato Oggi</span>
                          </>
                        ) : (
                          <>
                            <Flame className="h-3.5 w-3.5" />
                            <span>Indossalo Oggi</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* CONCEPT 3: PORTALI ASIMMETRICI & IMMERSIVI VIVI (COLLEZIONE 7 COLONNE + RADAR 5 COLONNE) */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* PORTALE 1: LA COLLEZIONE (7 COLONNE — AMPIO, SCULTOREO, CON ANTEPRIME REALI DELLE BOCCETTE) */}
        <Link href="/collezione" className="md:col-span-7 group block">
          <GlassCard
            accentColor="#38BDF8"
            interactive
            className="h-full min-h-[275px] p-6 sm:p-7 flex flex-col justify-between transition-transform duration-500 group-hover:scale-[1.01]"
          >
            {/* Griglia Architettonica Sottile + Geometria Flacone Sfaccettato in Filigrana */}
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(56, 189, 248, 0.35) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <svg
              viewBox="0 0 240 240"
              fill="none"
              className="pointer-events-none absolute -right-10 -top-6 h-64 w-64 opacity-[0.14] transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3"
            >
              <polygon points="85,20 155,20 142,48 98,48" stroke="#38BDF8" strokeWidth="2.5" />
              <rect x="105" y="48" width="30" height="16" stroke="#38BDF8" strokeWidth="2.5" />
              <polygon points="55,90 95,64 145,64 185,90 185,205 155,225 85,225 55,205" stroke="#38BDF8" strokeWidth="3" />
              <polygon points="85,105 155,105 155,185 85,185" stroke="#38BDF8" strokeWidth="1.8" strokeDasharray="4 4" />
            </svg>

            {/* Barra Superiore del Portale */}
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 border border-sky-400/40 text-sky-300 shadow-[0_0_25px_rgba(56,189,248,0.25)]">
                  <Library className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-sky-300/80 block">
                    Vault Personale
                  </span>
                  <span className="font-mono text-[11px] text-[#B8A9C9]">
                    {uniqueFamiliesCount} Famiglie Olfattive
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-full bg-[#050308]/90 border border-sky-400/40 px-3.5 py-1.5 shadow-lg">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="font-mono text-xs font-bold text-sky-200">
                  {collezioneCount} Flaconi
                </span>
                <ArrowUpRight className="h-4 w-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Corpo Centrale + Dock Vivo delle Ultime Boccette Reali */}
            <div className="relative z-10 mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
              <div className="space-y-1.5">
                <h2 className="font-serif text-4xl sm:text-5xl text-[#F6EFE4] tracking-tight leading-none">
                  La Collezione
                </h2>
                <p className="text-xs text-sky-200/75 font-mono">
                  Piramide certificata • Flaconi d&apos;autore
                </p>
              </div>

              {/* Miniature Reali delle ultime boccette in Collezione che emergono dal portale */}
              {previewCollezione.length > 0 && (
                <div className="flex items-center -space-x-3 self-start sm:self-end bg-[#050308]/85 border border-sky-400/25 rounded-2xl p-2 pr-3 backdrop-blur-md">
                  {previewCollezione.map((item) => {
                    const img = item.url_foto_vetrina || item.immagine_url;
                    return (
                      <div
                        key={item.id}
                        className="relative h-12 w-12 rounded-xl border border-sky-300/30 bg-[#0A0714] p-1 overflow-hidden shadow-md transition-transform group-hover:translate-y-[-2px]"
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={item.nome}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Logo variant="original" className="h-7" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <span className="pl-4 font-mono text-[10px] uppercase tracking-wider text-sky-300">
                    Apri →
                  </span>
                </div>
              )}
            </div>
          </GlassCard>
        </Link>

        {/* PORTALE 2: IL RADAR (5 COLONNE — SCANSIONE SPERIMENTALE, ONDE SONAR & ANTEPRIME) */}
        <Link href="/collezione?vista=radar" className="md:col-span-5 group block">
          <GlassCard
            accentColor="#C084FC"
            interactive
            className="h-full min-h-[275px] p-6 sm:p-7 flex flex-col justify-between transition-transform duration-500 group-hover:scale-[1.01]"
          >
            {/* Onde Sonar Concentriche in Filigrana */}
            <svg
              viewBox="0 0 220 220"
              fill="none"
              className="pointer-events-none absolute -right-12 -bottom-12 h-60 w-60 opacity-[0.16] transition-transform duration-700 group-hover:scale-110"
            >
              <circle cx="110" cy="110" r="92" stroke="#C084FC" strokeWidth="1.8" strokeDasharray="5 5" />
              <circle cx="110" cy="110" r="64" stroke="#C084FC" strokeWidth="2.2" />
              <circle cx="110" cy="110" r="36" stroke="#C084FC" strokeWidth="2.5" />
              <line x1="110" y1="10" x2="110" y2="210" stroke="#C084FC" strokeWidth="1.2" opacity="0.6" />
              <line x1="10" y1="110" x2="210" y2="110" stroke="#C084FC" strokeWidth="1.2" opacity="0.6" />
              <circle cx="145" cy="78" r="6" fill="#C084FC" />
            </svg>

            {/* Barra Superiore del Portale Radar */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-400/15 border border-purple-400/40 text-purple-300 shadow-[0_0_25px_rgba(192,132,252,0.25)]">
                <Compass className="h-5 w-5" />
              </div>

              <div className="flex items-center gap-1.5 rounded-full bg-[#050308]/90 border border-purple-400/40 px-3.5 py-1.5 shadow-lg">
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                <span className="font-mono text-xs font-bold text-purple-200">
                  {radarCount} In Test
                </span>
                <ArrowUpRight className="h-4 w-4 text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Corpo + Lista Live dei Desideri / Campioni in Valutazione */}
            <div className="relative z-10 mt-6 space-y-4">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-purple-300/80 block">
                  Scouting &amp; Wishlist
                </span>
                <h2 className="font-serif text-4xl text-[#F6EFE4] tracking-tight leading-none">
                  Il Radar
                </h2>
                <p className="text-xs text-purple-200/75 font-mono">
                  Valutazione su pelle &amp; listini ≥ 30ml
                </p>
              </div>

              {/* Pillole Live delle fragranze attualmente sotto esame nel Radar */}
              {previewRadar.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {previewRadar.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-400/30 bg-[#050308]/85 px-2.5 py-1 font-mono text-[10px] text-purple-100"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                      <span className="truncate max-w-[130px]">{r.nome}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[10px] text-purple-300/60">
                  Tocca per esplorare i campioni in prova →
                </p>
              )}
            </div>
          </GlassCard>
        </Link>
      </section>

      {/* ULTIME ACQUISIZIONI */}
      <section className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-2xl text-[#F6EFE4]">Ultime Acquisizioni</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E7C9E]">
              Ordinate per data di ingresso reale
            </p>
          </div>
          <Link
            href="/collezione"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[#10B981] transition hover:bg-emerald-500/20"
          >
            Esplora →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-60 rounded-[24px] aura-skeleton" />
            ))}
          </div>
        ) : ultimeAcquisizioni.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#090612] p-8 text-center text-xs text-[#B8A9C9]">
            Nessun flacone registrato. Usa il tasto + nella barra in basso per iniziare.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ultimeAcquisizioni.map((p) => {
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
              const inCollezione = isCollezioneProfumo(p);

              return (
                <Link
                  key={p.id}
                  href={inCollezione ? '/collezione' : '/collezione?vista=radar'}
                  style={{ borderColor: `${pAura.primary}38` }}
                  className="group relative flex flex-col justify-between rounded-[24px] border bg-[#090612]/95 p-4 transition duration-300 hover:scale-[1.02]"
                >
                  <div className="flex justify-center py-1">
                    <BottlePedestal
                      src={imgUrl}
                      alt={p.nome}
                      size="md"
                      className="!h-32 w-full"
                      showSigil={inCollezione}
                    />
                  </div>
                  <div className="mt-3 space-y-0.5 text-center">
                    <p
                      style={{ color: pAura.primary }}
                      className="font-mono text-[9px] uppercase tracking-wider truncate"
                    >
                      {p.brand}
                    </p>
                    <h4 className="font-serif text-sm text-[#F6EFE4] truncate">
                      {p.nome}
                    </h4>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
