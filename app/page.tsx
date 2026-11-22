'use client';

import React, { useEffect, useState } from 'react';
import { CalendarHeart } from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { ScentDNA } from '@/components/ScentDNA';
import { AccordWheel } from '@/components/AccordWheel';
import { WearLogModal } from '@/components/WearLogModal';
import { AtelierPodio } from '@/components/AtelierPodio';

export default function HomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDetailProfumo, setSelectedDetailProfumo] = useState<Profumo | null>(null);
  const [wearModalOpen, setWearModalOpen] = useState(false);

  const { aura, setAuraFromProfumo, setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(SECTION_THEMES.atelier);
    fetchHomeData();
  }, [setCustomAura]);

  async function fetchHomeData() {
    setLoading(true);
    try {
      const [profumiRes, indossiRes] = await Promise.all([
        supabase.from('profumi').select('*').order('nome', { ascending: true }),
        supabase.from('indossi').select('*').order('created_at', { ascending: false }),
      ]);

      if (profumiRes.error) throw profumiRes.error;
      if (indossiRes.error) throw indossiRes.error;

      const allProfumi = (profumiRes.data || []) as Profumo[];
      const collezioneOnly = allProfumi.filter(isCollezioneProfumo);
      const pool = collezioneOnly.length > 0 ? collezioneOnly : allProfumi;

      setProfumi(pool);

      const profumiMap = new Map(allProfumi.map((p) => [p.id, p]));
      const enriched = (indossiRes.data || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));
      setIndossi(enriched);
    } catch (err) {
      console.error('Errore caricamento home:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-8 pb-36 space-y-10">
      <PageHeader
        title="Atelier"
        subtitle="Control Room"
        rightSlot={
          <button
            type="button"
            onClick={() => setWearModalOpen(true)}
            style={{ backgroundColor: aura.primary }}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-95 shadow-xl"
          >
            <CalendarHeart className="h-4 w-4" />
            <span>Indossato oggi</span>
          </button>
        }
      />

      <AccordWheel
        profumi={profumi}
        indossi={indossi}
        onSelectProfumo={(p) => {
          setSelectedDetailProfumo(p);
          setAuraFromProfumo(p);
        }}
      />

      <ScentDNA profumi={profumi} indossi={indossi} loading={loading} />

      <AtelierPodio
        indossi={indossi}
        onSelectProfumo={(p) => {
          setSelectedDetailProfumo(p);
          setAuraFromProfumo(p);
        }}
      />

      <WearLogModal
        open={wearModalOpen}
        profumi={profumi}
        onClose={() => setWearModalOpen(false)}
        onSaved={fetchHomeData}
      />

      <ProfumoDetailModal
        profumo={selectedDetailProfumo}
        onClose={() => {
          setSelectedDetailProfumo(null);
          setCustomAura(SECTION_THEMES.atelier);
        }}
        onUpdated={(updated) => {
          setSelectedDetailProfumo(updated);
          setProfumi((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          fetchHomeData();
        }}
        onDeleted={(deletedId) => {
          setProfumi((prev) => prev.filter((p) => p.id !== deletedId));
          setSelectedDetailProfumo(null);
          fetchHomeData();
        }}
        onIndossoRegistered={() => {
          fetchHomeData();
        }}
      />
    </main>
  );
}
