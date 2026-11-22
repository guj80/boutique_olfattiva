'use client';

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Profumo } from '@/lib/supabase';
import { BottlePedestal } from './BottleImage';
import { resolveAura } from './AuraProvider';
import { computePodio, IndossoItem } from '@/lib/home-logic';

interface AtelierPodioProps {
  indossi: IndossoItem[];
  onSelectProfumo: (profumo: Profumo) => void;
}

export function AtelierPodio({ indossi, onSelectProfumo }: AtelierPodioProps) {
  const [timeframe, setTimeframe] = useState<'all' | 'month'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const podio = useMemo(
    () => computePodio(indossi, timeframe),
    [indossi, timeframe]
  );

  const slots = [
    { rank: 2, entry: podio[1] || null, heightClass: 'h-56 sm:h-64' },
    { rank: 1, entry: podio[0] || null, heightClass: 'h-64 sm:h-72 -mt-4' },
    { rank: 3, entry: podio[2] || null, heightClass: 'h-52 sm:h-60' },
  ];

  return (
    <section className="space-y-5 pt-2">
      {/* Testata con Toggle Temporale Questo Mese vs Sempre */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl sm:text-3xl text-[#F6EFE4]">
            Podio
          </h2>

          <div className="inline-flex rounded-full border border-white/10 bg-[#0E0A16] p-0.5">
            <button
              type="button"
              onClick={() => setTimeframe('month')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                timeframe === 'month'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Questo Mese
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition ${
                timeframe === 'all'
                  ? 'bg-[#EEF2F4] text-[#050308]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              Sempre
            </button>
          </div>
        </div>

        {podio.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full border border-white/15 bg-[#0E0A16] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#F6EFE4] transition hover:border-white/35"
          >
            Classifica →
          </button>
        )}
      </div>

      {podio.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-[#0E0A16]/85 p-8 text-center text-xs text-[#B8A9C9]">
          {timeframe === 'month'
            ? 'Nessun indosso registrato in questo mese.'
            : 'Nessun indosso registrato.'}
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2.5 sm:gap-5 pt-4">
          {slots.map(({ rank, entry, heightClass }) => {
            if (!entry) {
              return <div key={`empty-${rank}`} />;
            }

            const pAura = resolveAura(
              entry.profumo.famiglia_olfattiva,
              entry.profumo.nome
            );
            const telemetry = [entry.topContesto, entry.topSensazione]
              .filter(Boolean)
              .join(' · ');

            return (
              <button
                key={entry.profumo.id}
                type="button"
                onClick={() => onSelectProfumo(entry.profumo)}
                style={{
                  borderColor:
                    rank === 1 ? `${pAura.primary}85` : `${pAura.primary}32`,
                }}
                className={`group relative flex flex-col items-center justify-between overflow-hidden rounded-[26px] border bg-[#0E0A16]/95 px-2.5 py-4 sm:px-4 sm:py-5 text-center shadow-2xl transition duration-300 hover:-translate-y-1 ${heightClass}`}
              >
                {/* Bagliore Aura dietro il flacone */}
                <div
                  aria-hidden="true"
                  style={{ backgroundColor: pAura.primary }}
                  className={`pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-full blur-2xl transition-opacity ${
                    rank === 1
                      ? 'h-24 w-24 opacity-28 group-hover:opacity-40'
                      : 'h-16 w-16 opacity-16 group-hover:opacity-28'
                  }`}
                />

                {/* Badge posizione + contatore */}
                <div className="relative z-10 flex w-full items-center justify-between px-1">
                  <span
                    style={{ color: rank === 1 ? pAura.primary : '#B8A9C9' }}
                    className="font-mono text-[11px] font-extrabold"
                  >
                    #{rank}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#F6EFE4]/80">
                    {entry.count}×
                  </span>
                </div>

                {/* Flacone scontornato */}
                <div
                  className={`relative z-10 flex w-full items-center justify-center ${
                    rank === 1 ? 'h-28 sm:h-32' : 'h-20 sm:h-24'
                  }`}
                >
                  <BottlePedestal
                    src={
                      entry.profumo.url_foto_vetrina ||
                      entry.profumo.immagine_url
                    }
                    alt={entry.profumo.nome}
                    bare={true}
                    className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Piedistallo tipografico + Telemetria */}
                <div className="relative z-10 w-full space-y-1 border-t border-white/10 pt-2.5">
                  <p
                    style={{ color: pAura.primary }}
                    className="truncate font-mono text-[8.5px] sm:text-[9px] font-bold uppercase tracking-[0.16em]"
                  >
                    {entry.profumo.brand}
                  </p>
                  <h3 className="line-clamp-1 font-serif text-sm sm:text-base text-[#F6EFE4]">
                    {entry.profumo.nome}
                  </h3>
                  <p className="truncate font-mono text-[8.5px] text-[#B8A9C9]/75">
                    {telemetry || entry.profumo.famiglia_olfattiva}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modale Classifica Completa */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050308]/88 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-[32px] border border-white/15 bg-[#0E0A16] p-6 text-[#F6EFE4] space-y-4 shadow-2xl no-scrollbar mb-16"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-serif text-2xl text-[#F6EFE4]">
                  Classifica Indossi
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                  {timeframe === 'month' ? 'Questo Mese' : 'Storico Completo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#161024] text-[#B8A9C9] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {podio.map((entry, idx) => {
                const pAura = resolveAura(
                  entry.profumo.famiglia_olfattiva,
                  entry.profumo.nome
                );
                const telemetry = [entry.topContesto, entry.topSensazione]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <button
                    key={entry.profumo.id}
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      onSelectProfumo(entry.profumo);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161024]/80 p-3 text-left transition hover:border-white/25"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        style={{ color: idx === 0 ? pAura.primary : '#B8A9C9' }}
                        className="w-6 shrink-0 text-center font-mono text-xs font-extrabold"
                      >
                        #{idx + 1}
                      </span>
                      <div className="h-11 w-10 shrink-0 flex items-center justify-center">
                        <BottlePedestal
                          src={
                            entry.profumo.url_foto_vetrina ||
                            entry.profumo.immagine_url
                          }
                          alt={entry.profumo.nome}
                          bare={true}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[9px] uppercase text-[#B8A9C9]">
                          {entry.profumo.brand}
                        </p>
                        <p className="truncate font-serif text-base text-[#F6EFE4]">
                          {entry.profumo.nome}
                        </p>
                        {telemetry && (
                          <p className="truncate font-mono text-[9px] text-[#B8A9C9]/70">
                            {telemetry}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        borderColor: `${pAura.primary}45`,
                        color: pAura.primary,
                      }}
                      className="shrink-0 rounded-full border bg-[#0E0A16] px-3 py-1 font-mono text-xs font-bold"
                    >
                      {entry.count}×
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
