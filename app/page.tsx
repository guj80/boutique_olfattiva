'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarHeart, Library } from 'lucide-react';
import { supabase, Profumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { WearSuggester } from '@/components/WearSuggester';

export default function HomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDetailProfumo, setSelectedDetailProfumo] = useState<Profumo | null>(null);

  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    fetchHomeData();
  }, []);

  async function fetchHomeData() {
    setLoading(true);
    try {
      const [profumiRes, indossiRes] = await Promise.all([
        supabase.from('profumi').select('*'),
        supabase.from('indossi').select('*, profumi(*)').order('created_at', { ascending: false }).limit(100),
      ]);

      if (profumiRes.data) setProfumi(profumiRes.data);
      if (indossiRes.data) setIndossi(indossiRes.data);
    } catch (err: any) {
      showToast(err?.message || 'Errore caricamento dati.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const collezioneProfumi = profumi.filter(p => {
    const st = (p.stato || '').toLowerCase().trim();
    return st === 'collezione' || st === '';
  });

  return (
    <div className="min-h-screen bg-[#08060C] text-[#F6EFE4] pb-24">
      <header className="mx-auto max-w-5xl px-4 pt-6">
        <PageHeader title="Boutique Olfattiva" subtitle="Collezione Personale & Suggeritore Indossi" />
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 space-y-8">
        {loading ? (
          <div className="text-center font-mono text-xs text-[#B8A9C9] py-12">Caricamento in corso...</div>
        ) : (
          <>
            <WearSuggester
              profumi={collezioneProfumi}
              indossi={indossi}
              onOpenDetail={(p) => setSelectedDetailProfumo(p)}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <Link
                href="/collezione"
                className="flex items-center gap-3 rounded-[20px] border border-[#2A203F] bg-[#0E0A16] p-4 transition hover:border-[#C98A3A]/50"
              >
                <Library className="h-5 w-5 text-[#C98A3A]" />
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#B8A9C9]">Collezione</p>
                  <p className="font-serif text-sm font-bold">{collezioneProfumi.length}</p>
                </div>
              </Link>
              <Link
                href="/diario"
                className="flex items-center gap-3 rounded-[20px] border border-[#2A203F] bg-[#0E0A16] p-4 transition hover:border-[#C98A3A]/50"
              >
                <CalendarHeart className="h-5 w-5 text-[#C98A3A]" />
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#B8A9C9]">Indossi</p>
                  <p className="font-serif text-sm font-bold">{indossi.length}</p>
                </div>
              </Link>
            </div>
          </>
        )}
      </main>

      {selectedDetailProfumo && (
        <ProfumoDetailModal
          profumo={selectedDetailProfumo}
          onClose={() => setSelectedDetailProfumo(null)}
          onUpdated={fetchHomeData}
        />
      )}
    </div>
  );
}
