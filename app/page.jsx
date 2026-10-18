'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Library,
  Sparkles,
  Plus,
  Send,
  RefreshCw,
  CloudRain,
  Briefcase,
  Moon,
  Sun,
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

  const { aura, setAuraFromProfumo, setCustomAura } = useAura();

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

      if (recommendedBottles.length > 0) {
        setAuraFromProfumo(recommendedBottles[0]);
      }

      setAiResult({
        advice: data.sommelierAdvice,
        motivazioni: data.motivazioniPerProfumo || {},
        bottles: recommendedBottles,
      });
    } catch (e) {
      setAiError(e?.message || 'Impossibile completare la consulenza tecnica.');
    } finally {
      setAiLoading(false);
    }
  }

  const collezioneCount = profumi.filter(isCollezioneProfumo).length;
  const radarCount = profumi.filter(isRadarProfumo).length;
  const ultimeAcquisizioni = profumi.slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-8 pb-36 space-y-10">
      {/* IL TUO LOGO LIBERO E IN RISALTO (ZERO GABBIE, ZERO SCRITTE) */}
      <header className="flex flex-col items-center justify-center pt-4 pb-2">
        <Logo className="h-28 sm:h-32" />
      </header>

      {/* MOTORE DI SUGGERIMENTI IA AVANZATO */}
      <section
        style={{ borderColor: `${aura.primary}35` }}
        className="relative overflow-hidden rounded-[28px] border bg-gradient-to-b from-[#1E1428]/95 to-[#140D1C]/95 p-6 sm:p-8 shadow-2xl space-y-5 transition-colors duration-700"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles style={{ color: aura.primary }} className="h-4 w-4" />
            <h2 className="font-serif text-xl sm:text-2xl text-[#F6EFE4]">
              Selezione Olfattiva Su Misura
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
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#140D1C]/90 px-3.5 py-1.5 font-mono text-[11px] text-[#F6EFE4] transition hover:border-white/30 disabled:opacity-40"
              >
                <Icon style={{ color: aura.primary }} className="h-3.5 w-3.5" />
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
            placeholder="Descrivi occasione, meteo o stato d'animo..."
            className="flex-1 rounded-[18px] border border-white/10 bg-[#140D1C] px-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:border-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuery.trim() || profumi.length === 0}
            style={{ backgroundColor: aura.primary }}
            className="flex items-center justify-center gap-2 rounded-[18px] px-6 py-3 text-xs font-bold text-[#140D1C] transition hover:opacity-90 disabled:opacity-40"
          >
            {aiLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Suggerisci</span>
          </button>
        </form>

        {aiError && <p className="text-xs text-red-400 font-mono">{aiError}</p>}

        {aiResult && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-fade-in">
            <p className="text-xs sm:text-sm text-[#F6EFE4] leading-relaxed bg-[#140D1C]/80 p-4 rounded-[18px] border border-white/10">
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
                      className="flex items-center gap-4 rounded-[20px] border bg-[#140D1C]/90 p-3.5 transition hover:scale-[1.01]"
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

      {/* COLLEZIONE E RADAR CON I RISPETTIVI COLORI AMBIENTE */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/collezione"
          style={{ borderColor: `${SECTION_THEMES.collezione.primary}40` }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] border bg-gradient-to-b from-[#1E1428] to-[#140D1C] p-6 transition-all duration-300 hover:scale-[1.01] shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div
              style={{
                color: SECTION_THEMES.collezione.primary,
                borderColor: `${SECTION_THEMES.collezione.primary}35`,
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#140D1C] border"
            >
              <Library className="h-5 w-5" />
            </div>
            <span
              style={{ color: SECTION_THEMES.collezione.primary }}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              {collezioneCount} Flaconi
            </span>
          </div>
          <div className="mt-7 space-y-1">
            <h2 className="font-serif text-2xl text-[#F6EFE4]">Collezione</h2>
            <p className="text-xs text-[#B8A9C9]">
              I flaconi interi custoditi nella tua raccolta.
            </p>
          </div>
        </Link>

        <Link
          href="/collezione?vista=radar"
          style={{ borderColor: `${SECTION_THEMES.radar.primary}40` }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] border bg-gradient-to-b from-[#1E1428] to-[#140D1C] p-6 transition-all duration-300 hover:scale-[1.01] shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div
              style={{
                color: SECTION_THEMES.radar.primary,
                borderColor: `${SECTION_THEMES.radar.primary}35`,
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#140D1C] border"
            >
              <Compass className="h-5 w-5" />
            </div>
            <span
              style={{ color: SECTION_THEMES.radar.primary }}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              {radarCount} In Valutazione
            </span>
          </div>
          <div className="mt-7 space-y-1">
            <h2 className="font-serif text-2xl text-[#F6EFE4]">Radar</h2>
            <p className="text-xs text-[#B8A9C9]">
              Testing, decant e pianificazione acquisti per formato (≥ 30ml).
            </p>
          </div>
        </Link>
      </section>

      {/* ULTIME ACQUISIZIONI */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl text-[#F6EFE4]">Ultime Acquisizioni</h3>
          <Link
            href="/collezione"
            style={{ color: aura.primary }}
            className="text-xs font-mono uppercase tracking-wider hover:underline"
          >
            Vedi tutte →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-60 rounded-[24px] aura-skeleton" />
            ))}
          </div>
        ) : ultimeAcquisizioni.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#1E1428] p-8 text-center text-xs text-[#B8A9C9]">
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
                  style={{ borderColor: `${pAura.primary}30` }}
                  className="group relative flex flex-col justify-between rounded-[24px] border bg-[#1E1428]/90 p-4 transition hover:scale-[1.02]"
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
