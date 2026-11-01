'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Profumo } from '@/lib/supabase';
import { IndossoItem } from '@/lib/home-logic';
import { rankCollection, pickLocal, OccasioneSel, MomentoSel, Clima } from '@/lib/wear-suggester';
import { BottlePedestal } from '@/components/BottleImage';

interface WearSuggesterProps {
  profumi: Profumo[];
  indossi: IndossoItem[];
  onOpenDetail: (p: Profumo) => void;
}

export function WearSuggester({ profumi, indossi, onOpenDetail }: WearSuggesterProps) {
  const [occasione, setOccasione] = useState<OccasioneSel>('Tutti');
  const [momento, setMomento] = useState<MomentoSel>('Tutti');
  const [clima, setClima] = useState<Clima | null>(null);
  const [nota, setNota] = useState('');
  const [excludeIds, setExcludeIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  const candidates = rankCollection(profumi, indossi, { occasione, momento, clima, nota, excludeIds });

  useEffect(() => {
    if (profumi.length > 0) {
      const local = pickLocal(candidates, { occasione, momento, clima, nota, excludeIds });
      setSuggestion(local);
    }
  }, [profumi, indossi, occasione, momento, clima, excludeIds]);

  async function handleRefresh() {
    if (candidates.length === 0) return;
    const currentIds = suggestion?.picks?.map((p: any) => p.profumoId) || [];
    const newExcludes = [...excludeIds, ...currentIds];
    setExcludeIds(newExcludes);

    const newCandidates = rankCollection(profumi, indossi, { occasione, momento, clima, nota, excludeIds: newExcludes });
    const local = pickLocal(newCandidates, { occasione, momento, clima, nota, excludeIds: newExcludes });
    setSuggestion(local);

    // Chiamata in background a AI re-ranking
    if (newCandidates.length > 0) {
      setLoading(true);
      try {
        const res = await fetch('/api/ai/wear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidates: newCandidates.slice(0, 6),
            ctx: { occasione, momento, clima, nota, excludeIds: newExcludes },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.picks) {
            setSuggestion((prev: any) => ({ ...prev, picks: data.picks, modello: data.modello }));
          }
        }
      } catch {
        // Fallback locale già attivo
      } finally {
        setLoading(false);
      }
    }
  }

  const principalPick = suggestion?.picks?.find((p: any) => p.ruolo === 'principale');
  const principalProfumo = principalPick ? profumi.find(p => p.id === principalPick.profumoId) : candidates[0]?.profumo;

  if (profumi.length === 0) {
    return (
      <div className="rounded-[26px] border border-[#2A203F] bg-[#0E0A16] p-6 text-center text-[#B8A9C9]">
        <p className="font-mono text-xs uppercase tracking-wider">Aggiungi profumi alla collezione per ricevere suggerimenti.</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-[26px] border border-[#2A203F] bg-[#0E0A16] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#2A203F] pb-3">
          <div className="inline-flex items-center gap-2 rounded-md bg-[#161024] border border-[#2A203F] px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-[#C98A3A]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-[#C98A3A]">
              Suggerimento Indossi AI
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="font-mono text-[10px] uppercase tracking-wider text-[#C98A3A] hover:underline"
          >
            {loading ? 'Elaborazione...' : 'Un\'altra proposta ✦'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">Occasione</label>
            <select
              value={occasione}
              onChange={(e) => setOccasione(e.target.value as OccasioneSel)}
              className="w-full rounded-[14px] bg-[#161024] border border-[#2A203F] px-3.5 py-2.5 text-xs text-[#F6EFE4] focus:outline-none"
            >
              <option value="Tutti">Qualsiasi Occasione</option>
              <option value="Ufficio">Ufficio / Lavoro</option>
              <option value="Formale">Riunione formale</option>
              <option value="Tempo libero">Tempo libero</option>
              <option value="Cena">Aperitivo / Cena</option>
              <option value="Serata">Serata speciale</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">Momento</label>
            <select
              value={momento}
              onChange={(e) => setMomento(e.target.value as MomentoSel)}
              className="w-full rounded-[14px] bg-[#161024] border border-[#2A203F] px-3.5 py-2.5 text-xs text-[#F6EFE4] focus:outline-none"
            >
              <option value="Tutti">Automatico ({suggestion?.momentoRisolto || 'Corrente'})</option>
              <option value="Mattina">Mattina</option>
              <option value="Pomeriggio">Pomeriggio</option>
              <option value="Sera">Sera</option>
              <option value="Notte">Notte</option>
            </select>
          </div>
        </div>
      </div>

      {principalProfumo && (
        <div className="flex justify-center pt-2">
          <div
            onClick={() => onOpenDetail(principalProfumo)}
            className="group relative w-full max-w-sm flex flex-col justify-between rounded-[30px] border border-[#2A203F] bg-[#161024]/95 p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-2xl"
          >
            <div className="flex justify-center py-2">
              <BottlePedestal
                src={principalProfumo.url_foto_vetrina || principalProfumo.immagine_url}
                alt={principalProfumo.nome}
                size="lg"
                className="relative z-10 w-full max-w-[140px]"
                showSigil={false}
              />
            </div>
            <div className="mt-4 space-y-2 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#C98A3A]">
                {principalProfumo.brand}
              </p>
              <h3 className="font-serif text-[18px] leading-tight text-[#F6EFE4]">
                {principalProfumo.nome}
              </h3>
              <p className="font-mono text-[10px] text-[#B8A9C9]">
                {principalProfumo.famiglia_olfattiva}
              </p>
              {principalPick?.motivazione && (
                <p className="font-sans text-xs italic text-[#F6EFE4]/80 bg-[#0E0A16] p-3 rounded-[14px] border border-[#2A203F]">
                  &ldquo;{principalPick.motivazione}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
