'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Plus,
  Send,
  RefreshCw,
  CloudRain,
  Briefcase,
  Moon,
  Sun,
  ArrowUpRight,
} from 'lucide-react';
import { supabase, isCollezioneProfumo, isRadarProfumo } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { useAura, resolveAura, SECTION_THEMES } from '@/components/AuraProvider';

const QUICK_PROMPTS = [
  {
    label: 'Serata Elegante',
    query: 'Fragranza magnetica e strutturata per una serata elegante o evento formale',
    icon: Moon,
  },
  {
    label: 'Clima Freddo / Pioggia',
    query: 'Fragranza avvolgente, legnosa, speziata o ambrata ideale per clima freddo o piovoso',
    icon: CloudRain,
  },
  {
    label: 'Giornata Professionale',
    query: 'Fragranza pulita, raffinata e misurata ideale per il giorno',
    icon: Briefcase,
  },
  {
    label: 'Luce & Freschezza',
    query: 'Fragranza luminosa, agrumata, aromatica o marina',
    icon: Sun,
  },
];

export default function Home() {
  const [profumi, setProfumi] = useState([]);
  const [loading, setLoading] = useState(true);

  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const { aura, setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
    async function fetchHomeData() {
      try {
        const { data } = await supabase
          .from('profumi')
          .select('*')
          .order('created_at', { ascending: false });
        setProfumi(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHomeData();
  }, [setCustomAura]);

  async function handleAskAi(customQuery) {
    const q = (customQuery ?? aiQuery).trim();
    if (!q || profumi.length === 0) return;

    setAiQuery(q);
    setAiLoading(true);
    setAiError('');
    setAiResult(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, profumi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore analisi olfattiva.');

      const recommendedBottles = (data.recommendedIds || [])
        .map((id) => profumi.find((p) => p.id === id))
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

  const collezioneCount = profumi.filter(isCollezioneProfumo).length;
  const radarCount = profumi.filter(isRadarProfumo).length;
  const ultimeAcquisizioni = profumi.slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-6 pb-36 space-y-10">
      {/* IL TUO LOGO ORIGINALE BICOLORE IN RISALTO ASSOLUTO (NON CAMBIA COL TEMA, ZERO SCRITTE) */}
      <header className="flex flex-col items-center justify-center pt-4 pb-2">
        <Logo variant="bicolor" className="h-32 sm:h-36" />
      </header>

      {/* MOTORE DI SUGGERIMENTI IA AVANZATO */}
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/25 bg-gradient-to-b from-[#161024]/95 to-[#0B0813]/95 p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-[#10B981]" />
            <h2 className="font-serif text-2xl text-[#F6EFE4]">
              Consulenza Olfattiva
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleAskAi(item.query)}
                disabled={aiLoading || profumi.length === 0}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-[#120D1D] px-4 py-2 font-mono text-[11px] text-[#F6EFE4] transition hover:border-emerald-400/50 disabled:opacity-40"
              >
                <Icon className="h-3.5 w-3.5 text-[#10B981]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

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
            placeholder="Occasione, clima o accordo ricercato..."
            className="flex-1 rounded-[18px] border border-white/10 bg-[#0D0915] px-4 py-3.5 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:border-emerald-400/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuery.trim() || profumi.length === 0}
            className="flex items-center justify-center gap-2 rounded-[18px] bg-[#10B981] px-6 py-3.5 text-xs font-bold text-[#08060C] transition hover:bg-[#34D399] disabled:opacity-40"
          >
            {aiLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Analizza</span>
          </button>
        </form>

        {aiError && <p className="text-xs text-red-400 font-mono">{aiError}</p>}

        {aiResult && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-fade-in">
            <p className="text-xs sm:text-sm text-[#F6EFE4] leading-relaxed bg-[#0D0915] p-4 rounded-[18px] border border-white/10">
              {aiResult.advice}
            </p>

            {aiResult.bottles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aiResult.bottles.map((b) => {
                  const bAura = resolveAura(b.famiglia_olfattiva, b.nome);
                  return (
                    <Link
                      key={b.id}
                      href="/collezione"
                      style={{ borderColor: `${bAura.primary}45` }}
                      className="flex items-center gap-4 rounded-[20px] border bg-[#0D0915] p-3.5 transition hover:scale-[1.01]"
                    >
                      <BottlePedestal
                        src={b.url_foto_vetrina || b.immagine_url}
                        alt={b.nome}
                        size="sm"
                        showSigil={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          style={{ color: bAura.primary }}
                          className="font-mono text-[10px] uppercase tracking-wider truncate"
                        >
                          {b.brand}
                        </p>
                        <h4 className="font-serif text-lg text-[#F6EFE4] truncate">
                          {b.nome}
                        </h4>
                        {aiResult.motivazioni[b.id] && (
                          <p className="text-[11px] text-[#B8A9C9] line-clamp-2 mt-0.5">
                            {aiResult.motivazioni[b.id]}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* PORTALI SCENOGRAFICI COLLEZIONE & RADAR CON GRAFICA OLFATTIVA DEDICATA */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* CARD COLLEZIONE */}
        <Link
          href="/collezione"
          className="group relative h-56 overflow-hidden rounded-[32px] border border-sky-400/30 bg-[#0B1528] p-7 flex flex-col justify-between transition-all duration-500 hover:scale-[1.02] hover:border-sky-400/70 shadow-2xl"
        >
          {/* Grafica vettoriale artistica di sottofondo: Flaconi Scultorei & Essenze */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.28)_0%,rgba(11,21,40,0.92)_70%)]" />
          <svg
            viewBox="0 0 220 220"
            fill="none"
            className="pointer-events-none absolute -right-6 -bottom-8 h-52 w-52 opacity-25 transition-transform duration-700 group-hover:scale-110"
          >
            <rect x="65" y="25" width="44" height="18" rx="4" stroke="#38BDF8" strokeWidth="3.5" />
            <path d="M77 43 H97 V58 H77 Z" stroke="#38BDF8" strokeWidth="3.5" />
            <rect x="42" y="58" width="90" height="125" rx="22" stroke="#38BDF8" strokeWidth="4" />
            <circle cx="87" cy="120" r="24" stroke="#38BDF8" strokeWidth="3" strokeDasharray="4 4" />
            <path d="M150 85 C175 65, 195 95, 175 130 C160 155, 145 170, 145 185" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/15 border border-sky-400/40 backdrop-blur-md">
              {/* Icona custom Flacone d'Autore */}
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-sky-300" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 3h6v3H9z" />
                <path d="M10 6h4v2h-4z" />
                <rect x="5" y="8" width="14" height="13" rx="4" />
                <circle cx="12" cy="14.5" r="2.5" />
              </svg>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-sky-400/15 border border-sky-400/30 px-3.5 py-1.5 backdrop-blur-md">
              <span className="font-mono text-xs font-bold text-sky-300">
                {collezioneCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-wide">
              Collezione
            </h2>
          </div>
        </Link>

        {/* CARD RADAR */}
        <Link
          href="/collezione?vista=radar"
          className="group relative h-56 overflow-hidden rounded-[32px] border border-purple-400/30 bg-[#1B0C2E] p-7 flex flex-col justify-between transition-all duration-500 hover:scale-[1.02] hover:border-purple-400/70 shadow-2xl"
        >
          {/* Grafica vettoriale artistica di sottofondo: Onde Olfattive, Molecole & Note */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(192,132,252,0.3)_0%,rgba(27,12,46,0.92)_70%)]" />
          <svg
            viewBox="0 0 220 220"
            fill="none"
            className="pointer-events-none absolute -right-6 -bottom-6 h-52 w-52 opacity-25 transition-transform duration-700 group-hover:scale-110"
          >
            <circle cx="110" cy="110" r="80" stroke="#C084FC" strokeWidth="3" strokeDasharray="6 6" />
            <circle cx="110" cy="110" r="52" stroke="#C084FC" strokeWidth="3.5" />
            <circle cx="110" cy="110" r="22" stroke="#C084FC" strokeWidth="4" />
            <path d="M110 30 L110 190 M30 110 L190 110" stroke="#C084FC" strokeWidth="2.5" opacity="0.6" />
            <circle cx="148" cy="72" r="8" fill="#C084FC" />
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-400/15 border border-purple-400/40 backdrop-blur-md">
              {/* Icona custom Esplorazione Olfattiva / Ampolla */}
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-purple-300" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <polygon points="14.5,9.5 9.5,11.5 11.5,14.5 14.5,9.5" fill="currentColor" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-purple-400/15 border border-purple-400/30 px-3.5 py-1.5 backdrop-blur-md">
              <span className="font-mono text-xs font-bold text-purple-300">
                {radarCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-wide">
              Radar
            </h2>
          </div>
        </Link>
      </section>

      {/* ULTIME ACQUISIZIONI */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-2xl text-[#F6EFE4]">Ultime Acquisizioni</h3>
          <Link
            href="/collezione"
            className="text-xs font-mono uppercase tracking-wider text-[#10B981] hover:underline"
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
          <div className="rounded-[24px] border border-white/10 bg-[#161024] p-8 text-center text-xs text-[#B8A9C9]">
            Nessun flacone registrato.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ultimeAcquisizioni.map((p) => {
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const pAura = resolveAura(p.famiglia_olfattiva, p.nome);

              return (
                <Link
                  key={p.id}
                  href="/collezione"
                  style={{ borderColor: `${pAura.primary}35` }}
                  className="group relative flex flex-col justify-between rounded-[24px] border bg-[#161024]/90 p-4 transition hover:scale-[1.02]"
                >
                  <div className="flex justify-center py-2">
                    <BottlePedestal
                      src={imgUrl}
                      alt={p.nome}
                      size="md"
                      className="!h-32 w-full"
                      showSigil={false}
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
