'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarHeart, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { SmartBottleImage } from '@/components/BottleImage';
import { useToast } from '@/components/Toast';

export default function DiarioPage() {
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { aura, setCustomAura } = useAura();
  const { showToast } = useToast();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.diario);
    fetchDiario();
  }, [setCustomAura]);

  async function fetchDiario() {
    setLoading(true);
    try {
      const { data: indossiData, error: errIndossi } = await supabase
        .from('indossi')
        .select('*')
        .order('created_at', { ascending: false });

      if (errIndossi) throw errIndossi;

      const { data: profumiData, error: errProfumi } = await supabase
        .from('profumi')
        .select('*');

      if (errProfumi) throw errProfumi;

      const profumiMap = new Map((profumiData || []).map((p: any) => [p.id, p]));

      const enriched = (indossiData || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));

      setIndossi(enriched);
    } catch (err: any) {
      console.error('Errore caricamento diario:', err);
      showToast('Impossibile caricare il diario.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      const { error } = await supabase.from('indossi').delete().eq('id', id);
      if (error) throw error;
      setIndossi((prev) => prev.filter((item) => item.id !== id));
      setDeleteId(null);
      showToast('Indosso eliminato dal diario.');
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'eliminazione.", 'error');
    }
  }

  const stats = useMemo(() => {
    if (indossi.length === 0) return { topProfumo: '-', topMomento: '-' };

    const profumiCount: Record<string, number> = {};
    const momentiCount: Record<string, number> = {};

    indossi.forEach((item) => {
      const pName = item.profumi?.nome || 'Sconosciuto';
      profumiCount[pName] = (profumiCount[pName] || 0) + 1;

      const mom = item.momento_giornata || item.momento || 'Mattina';
      momentiCount[mom] = (momentiCount[mom] || 0) + 1;
    });

    const topProfumo =
      Object.entries(profumiCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const topMomento =
      Object.entries(momentiCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { topProfumo, topMomento };
  }, [indossi]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36">
      <PageHeader
        title="Diario Olfattivo"
        subtitle=""
        rightSlot={
          <div
           style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
            className="flex items-center gap-2 rounded-full border bg-[#140D1C] px-4 py-2 font-mono text-xs"
          >
            <CalendarHeart className="h-4 w-4" />
            <span>{indossi.length} Indossi</span>
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-[22px] border border-white/10 bg-[#1E1428]/90 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
            Flacone più indossato
          </p>
          <p className="font-serif text-2xl text-[#F6EFE4] mt-1 truncate">
            {stats.topProfumo}
          </p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-[#1E1428]/90 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
            Momento preferito
          </p>
          <p className="font-serif text-2xl text-[#F6EFE4] mt-1 truncate">
            {stats.topMomento}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-[#1E1428]/90 p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#F6EFE4]">
          Striscia temporale recente
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {indossi.slice(0, 14).map((item) => {
            const pAura = item.profumi
              ? resolveAura(item.profumi.famiglia_olfattiva, item.profumi.nome)
              : null;
            return (
              <div
                key={item.id}
                title={`${item.profumi?.nome || ''} (${item.momento_giornata || item.momento || ''})`}
                style={pAura ? { backgroundColor: pAura.primary } : undefined}
                className="h-8 w-8 shrink-0 rounded-full border border-white/20 bg-[#281B35] shadow-sm transition hover:scale-110"
              />
            );
          })}
          {indossi.length === 0 && (
            <p className="text-xs text-[#B8A9C9]">
              Nessun indosso registrato di recente.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-[#F6EFE4] px-1">
          Timeline Storica
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-[20px] aura-skeleton" />
            ))}
          </div>
        ) : indossi.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-12 text-center space-y-2">
            <p className="font-serif text-xl text-[#F6EFE4]">Il diario è vuoto</p>
            <p className="text-xs text-[#B8A9C9]">
              Registra il tuo primo indosso dalla home o dalla collezione.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {indossi.map((item) => {
              const p = item.profumi;
              const pAura = p
                ? resolveAura(p.famiglia_olfattiva, p.nome)
                : null;
              const dateStr = new Date(item.created_at).toLocaleDateString(
                'it-IT',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }
              );

              return (
                <div
                  key={item.id}
                  style={pAura ? { borderColor: `${pAura.primary}44` } : undefined}
                  className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-[#1E1428]/90 p-4 transition hover:border-white/30"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-[#140D1C] p-1.5 flex items-center justify-center border border-white/10">
                      <SmartBottleImage
                        src={p?.url_foto_vetrina || p?.immagine_url}
                        alt={p?.nome || 'Profumo'}
                        iconSize="w-5 h-5"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        style={{ color: pAura?.primary || aura.primary }}
                        className="font-mono text-[10px] uppercase tracking-wider"
                      >
                        {dateStr} • {item.momento_giornata || item.momento || 'Sera'}{' '}
                        {item.contesto_outfit ? `(${item.contesto_outfit})` : ''}
                      </p>
                      <h3 className="font-serif text-xl text-[#F6EFE4] truncate mt-0.5">
                        {p?.nome || 'Fragranza rimossa'}
                      </h3>
                      {(item.note_giorno || item.note_personali) && (
                        <p className="text-xs text-[#B8A9C9] truncate mt-0.5">
                          &ldquo;{item.note_giorno || item.note_personali}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteId(item.id)}
                    title="Elimina indosso"
                    className="p-2 text-[#B8A9C9] hover:text-red-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/30 bg-[#1E1428] p-6 text-[#F6EFE4] space-y-4 shadow-2xl">
            <h3 className="font-serif text-xl text-[#F6EFE4]">
              Eliminare questo indosso?
            </h3>
            <p className="text-xs text-[#B8A9C9]">
              L&apos;evento verrà rimosso dallo storico del tuo diario.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteIndosso(deleteId)}
                className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-red-500"
              >
                Conferma Eliminazione
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
