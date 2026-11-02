'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  Bot,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import type { Candidato, FonteUfficiale } from '@/lib/laboratorio-types';

export default function LaboratorioPage() {
  const [fonti, setFonti] = useState<FonteUfficiale[]>([]);
  const [candidati, setCandidati] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingRobots, setCheckingRobots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const { aura, setCustomAura } = useAura();
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Devi essere autenticato per accedere al Laboratorio.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/laboratorio', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante il caricamento del Laboratorio.');
      }
      setFonti(data.fonti || []);
      setCandidati(data.candidati || []);
    } catch (err: any) {
      setError(err?.message || 'Errore imprevisto.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCustomAura(SECTION_THEMES.radar);
    loadData();
  }, [setCustomAura, loadData]);

  async function checkRobots() {
    if (checkingRobots) return;
    setCheckingRobots(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione scaduta, rifai il login.');
      const res = await fetch('/api/laboratorio/check-robots', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore verifica robots.txt.');
      const r = data.riepilogo || { si: 0, no: 0, da_verificare: 0 };
      showToast(`robots.txt: ${r.si} sì, ${r.no} no, ${r.da_verificare} da verificare.`);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Errore imprevisto.', 'error');
    } finally {
      setCheckingRobots(false);
    }
  }

  async function azione(
    candidato: Candidato,
    azioneTipo: 'approva' | 'scarta',
    destinazione?: 'radar' | 'collezione'
  ) {
    if (processing) return;
    setProcessing(candidato.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione scaduta, rifai il login.');
      const res = await fetch('/api/laboratorio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          azione: azioneTipo,
          candidato_id: candidato.id,
          destinazione,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore operazione.');
      showToast(
        azioneTipo === 'approva'
          ? `${candidato.nome} approvato in ${destinazione}.`
          : `${candidato.nome} scartato.`
      );
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Errore imprevisto.', 'error');
    } finally {
      setProcessing(null);
    }
  }

  const inAttesa = candidati.filter(
    (c) => c.stato === 'in_attesa' || c.stato === 'conflitto'
  );
  const processati = candidati.filter(
    (c) => c.stato === 'approvato' || c.stato === 'scartato'
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36 space-y-8">
      <PageHeader
        title="Laboratorio"
        subtitle="SCOUTING"
        rightSlot={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={checkRobots}
              disabled={checkingRobots || loading}
              style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
              className="flex items-center gap-2 rounded-full border bg-[#0E0A16] px-4 py-2 text-xs font-semibold transition hover:opacity-85 disabled:opacity-50"
            >
              <Bot className={`h-3.5 w-3.5 ${checkingRobots ? 'animate-pulse' : ''}`} />
              <span>{checkingRobots ? 'Verifica...' : 'Verifica robots.txt'}</span>
            </button>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
              className="flex items-center gap-2 rounded-full border bg-[#0E0A16] px-4 py-2 text-xs font-semibold transition hover:opacity-85 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Aggiorna</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-[20px] border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* FONTI UFFICIALI */}
      <section className="space-y-4">
        <div
          className="inline-block rounded-md bg-[#0E0A16] border px-3 py-1"
          style={{ borderColor: `${aura.primary}55` }}
        >
          <h2
            className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
            style={{ color: aura.primary }}
          >
            Fonti Ufficiali Monitorate ({fonti.length})
          </h2>
        </div>

        {loading && fonti.length === 0 ? (
          <div
            className="rounded-[22px] border bg-[#0E0A16] p-6"
            style={{ borderColor: `${aura.primary}30` }}
          >
            <ThinkingOrb label="Caricamento fonti..." size="sm" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fonti.map((f) => {
              const permissionColor =
                f.permission_scraping === 'si'
                  ? 'text-emerald-300 border-emerald-400/40'
                  : f.permission_scraping === 'no'
                  ? 'text-red-300 border-red-400/40'
                  : 'text-amber-300 border-amber-400/40';
              const PermissionIcon =
                f.permission_scraping === 'si'
                  ? ShieldCheck
                  : f.permission_scraping === 'no'
                  ? ShieldX
                  : ShieldQuestion;
              return (
                <div
                  key={f.id}
                  style={{ borderColor: `${aura.primary}35` }}
                  className="rounded-[20px] border bg-[#0E0A16] p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-serif text-lg text-[#F6EFE4] truncate">
                        {f.brand}
                      </p>
                      <p className="font-mono text-[10px] uppercase text-[#B8A9C9]">
                        {f.categoria || 'non classificato'} •{' '}
                        {f.note_struttura === 'soggetto_controsoggetto_coda'
                          ? 'Soggetto/Coda'
                          : 'Testa/Cuore/Fondo'}
                      </p>
                    </div>
                    <a
                      href={f.url_sito}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: aura.primary }}
                      className="shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full bg-[#161024] border px-2.5 py-1 font-mono text-[10px] ${permissionColor}`}
                  >
                    <PermissionIcon className="h-3 w-3" />
                    <span>permesso: {f.permission_scraping}</span>
                  </div>
                  {f.ultima_visita && (
                    <p className="font-mono text-[10px] text-[#B8A9C9]">
                      ultima visita:{' '}
                      {new Date(f.ultima_visita).toLocaleString('it-IT')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CODA DI APPROVAZIONE */}
      <section className="space-y-4">
        <div
          className="inline-block rounded-md bg-[#0E0A16] border px-3 py-1"
          style={{ borderColor: `${aura.primary}55` }}
        >
          <h2
            className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
            style={{ color: aura.primary }}
          >
            Coda di Approvazione ({inAttesa.length})
          </h2>
        </div>

        {loading && inAttesa.length === 0 ? (
          <div
            className="rounded-[22px] border bg-[#0E0A16] p-6"
            style={{ borderColor: `${aura.primary}30` }}
          >
            <ThinkingOrb label="Caricamento coda..." size="sm" />
          </div>
        ) : inAttesa.length === 0 ? (
          <div
            style={{ borderColor: `${aura.primary}35` }}
            className="rounded-[22px] border bg-[#0E0A16] p-8 text-center space-y-2"
          >
            <FlaskConical
              style={{ color: aura.primary }}
              className="h-8 w-8 mx-auto opacity-50"
            />
            <p className="font-serif text-lg text-[#F6EFE4]">
              Nessun candidato in attesa
            </p>
            <p className="text-xs text-[#B8A9C9]">
              La coda è vuota. I candidati arriveranno dalla raccolta
              settimanale dalle fonti ufficiali (PASSO 2B.2).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inAttesa.map((c) => (
              <div
                key={c.id}
                style={{
                  borderColor: c.conflitto_note
                    ? '#F59E0B88'
                    : `${aura.primary}45`,
                }}
                className="rounded-[22px] border bg-[#0E0A16] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
                      {c.brand}
                      {c.categoria && ` • ${c.categoria}`}
                    </p>
                    <h3 className="font-serif text-xl text-[#F6EFE4]">
                      {c.nome}
                    </h3>
                    {c.famiglia && (
                      <p className="font-mono text-[10px] text-[#B8A9C9]">
                        Famiglia: {c.famiglia}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.conflitto_note && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/40 px-2.5 py-1 font-mono text-[10px] text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> conflitto note
                      </span>
                    )}
                    {c.note_verificate ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> verificate
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#161024] border border-white/15 px-2.5 py-1 font-mono text-[10px] text-[#B8A9C9]">
                        non verificate
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#161024] border border-white/15 px-2.5 py-1 font-mono text-[10px] text-[#B8A9C9]">
                      confidenza {c.confidenza}
                    </span>
                  </div>
                </div>

                {(c.note_testa ||
                  c.note_cuore ||
                  c.note_fondo ||
                  c.accordi) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {c.note_testa && (
                      <div className="rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2">
                        <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                          Testa
                        </span>
                        {c.note_testa}
                      </div>
                    )}
                    {c.note_cuore && (
                      <div className="rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2">
                        <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                          Cuore
                        </span>
                        {c.note_cuore}
                      </div>
                    )}
                    {c.note_fondo && (
                      <div className="rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2">
                        <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                          Fondo
                        </span>
                        {c.note_fondo}
                      </div>
                    )}
                    {c.accordi && (
                      <div className="rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2">
                        <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                          Accordi
                        </span>
                        {c.accordi}
                      </div>
                    )}
                  </div>
                )}

                {c.perche && (
                  <p
                    className="text-xs text-[#F6EFE4]/90 italic border-l-2 pl-3"
                    style={{ borderColor: aura.primary }}
                  >
                    {c.perche}
                  </p>
                )}

                {c.fonte_url && (
                  <a
                    href={c.fonte_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] underline"
                    style={{ color: aura.primary }}
                  >
                    <ExternalLink className="h-3 w-3" /> Fonte
                  </a>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={() => azione(c, 'approva', 'radar')}
                    style={{
                      borderColor: `${aura.primary}60`,
                      color: aura.primary,
                    }}
                    className="flex items-center gap-1.5 rounded-full border bg-[#161024] px-3.5 py-2 text-xs font-bold transition hover:opacity-85 disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" /> Approva → Radar
                  </button>
                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={() => azione(c, 'approva', 'collezione')}
                    style={{ backgroundColor: aura.primary }}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" /> Approva → Collezione
                  </button>
                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={() => azione(c, 'scarta')}
                    className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-[#161024] px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:opacity-85 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" /> Scarta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* STORICO */}
      {processati.length > 0 && (
        <section className="space-y-4">
          <div
            className="inline-block rounded-md bg-[#0E0A16] border px-3 py-1"
            style={{ borderColor: `${aura.primary}55` }}
          >
            <h2
              className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
              style={{ color: aura.primary }}
            >
              Storico ({processati.length})
            </h2>
          </div>
          <div className="space-y-2">
            {processati.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[#0E0A16] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase text-[#B8A9C9] truncate">
                    {c.brand}
                  </p>
                  <p className="text-sm text-[#F6EFE4] truncate">{c.nome}</p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] uppercase px-2.5 py-1 rounded-full border ${
                    c.stato === 'approvato'
                      ? 'border-emerald-400/40 text-emerald-300'
                      : 'border-red-400/40 text-red-300'
                  }`}
                >
                  {c.stato}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[11px] text-[#B8A9C9] pt-4">
        Prossimo passo (2B.2): estrazione AI vincolata a schema JSON dalle fonti
        con permesso &quot;si&quot;.
      </p>
    </main>
  );
}
