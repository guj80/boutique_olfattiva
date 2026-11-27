'use client';

import React from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { SourceLinks } from './SourceLinks';
import { classifyPastedUrl, pickStoredUrls, type StoredSourceUrls } from '@/lib/source-links';

export interface SimiliCardData {
  brand: string;
  nome: string;
  concentrazione: string | null;
  anno: number | null;
  naso: string | null;
  url: string | null;
  famiglia_raw: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  motivo: string;
}

export const similiKey = (c: Pick<SimiliCardData, 'brand' | 'nome'>) =>
  `${c.brand}|${c.nome}`.toLowerCase();

export function similiUrls(c: SimiliCardData): StoredSourceUrls {
  const out: StoredSourceUrls = {};
  if (c.url) {
    const kind = classifyPastedUrl(c.url);
    if (kind) out[kind] = c.url;
  }
  return pickStoredUrls(out);
}

interface Props {
  items: SimiliCardData[];
  color: string; // aura.primary
  addedKeys: Set<string>;
  addingKey: string | null;
  failedKey: string | null;
  onAdd: (item: SimiliCardData) => void;
  /** se presente, mostra i due suggerimenti discreti sotto le schede */
  onFollowUp?: (text: string) => void;
  disabled?: boolean;
}

export function SimiliCards({
  items,
  color,
  addedKeys,
  addingKey,
  failedKey,
  onAdd,
  onFollowUp,
  disabled,
}: Props) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((c) => {
        const key = similiKey(c);
        const added = addedKeys.has(key);
        const adding = addingKey === key;
        return (
          <article
            key={key}
            style={{ borderColor: `${color}25` }}
            className="rounded-2xl border bg-[#0E0A16]/90 p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  style={{ color }}
                  className="truncate font-mono text-[10px] font-bold uppercase tracking-widest"
                >
                  {c.brand}
                </p>
                <h4 className="mt-0.5 font-serif text-lg leading-tight text-[#F6EFE4]">
                  {c.nome}
                  {c.concentrazione ? (
                    <span className="ml-2 font-mono text-[10px] font-normal text-[#B8A9C9]">
                      {c.concentrazione}
                    </span>
                  ) : null}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onAdd(c)}
                disabled={added || adding}
                aria-label={added ? `${c.nome} è nel Radar` : `Aggiungi ${c.nome} al Radar`}
                style={{ borderColor: `${color}40`, color }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition hover:bg-white/5 disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : added ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <span>{added ? 'Nel Radar' : 'Radar'}</span>
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[#B8A9C9]">{c.motivo}</p>

            {failedKey === key && (
              <p className="mt-1.5 text-[11px] text-red-300">
                Non sono riuscita ad aggiungerlo. Riprova.
              </p>
            )}

            <div className="mt-2.5">
              <SourceLinks brand={c.brand} nome={c.nome} urls={similiUrls(c)} color={color} />
            </div>
          </article>
        );
      })}

      {onFollowUp && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFollowUp('Più vicini agli originali')}
            className="font-mono text-[10px] text-[#B8A9C9] underline decoration-white/15 underline-offset-4 transition hover:text-[#F6EFE4] disabled:opacity-50"
          >
            Più vicini
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFollowUp('Più strani, sorprendimi')}
            className="font-mono text-[10px] text-[#B8A9C9] underline decoration-white/15 underline-offset-4 transition hover:text-[#F6EFE4] disabled:opacity-50"
          >
            Più strani
          </button>
        </div>
      )}
    </div>
  );
}
