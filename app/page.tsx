'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  Plus,
  Compass,
  Library,
} from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo, isRadarProfumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';

const PURE_FAMILIES = [
  'Agrumata',
  'Aromatica',
  'Marina',
  'Floreale',
  'Fruttata',
  'Verde',
  'Speziata',
  'Legnosa',
  'Ambrata',
  'Gourmand',
  'Cuoiata',
  'Muschiata',
];

export default function CollezionePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vistaParam = searchParams.get('vista');

  const [activeTab, setActiveTab] = useState<'collezione' | 'radar'>(
    vistaParam === 'radar' ? 'radar' : 'collezione'
  );
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('Tutte');
  const [selectedBrand, setSelectedBrand] = useState<string>('Tutti');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);

  const { aura, setAuraFromProfumo, setCustomAura } = useAura();
  const { showToast } = useToast();

  useEffect(() => {
    const isRadar = vistaParam === 'radar';
    setActiveTab(isRadar ? 'radar' : 'collezione');
    setCustomAura(isRadar ? SECTION_THEMES.radar : SECTION_THEMES.collezione);
  }, [vistaParam, setCustomAura]);

  useEffect(() => {
    fetchProfumi();
  }, []);

  async function fetchProfumi() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      setProfumi(data || []);
    } catch {
      showToast('Impossibile caricare la collezione.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const brands = useMemo(() => {
    const set = new Set(profumi.map((p) => p.brand).filter(Boolean));
    return ['Tutti', ...Array.from(set)];
  }, [profumi]);

  const filteredProfumi = useMemo(() => {
    return profumi.filter((p) => {
      const matchTab = activeTab === 'radar' ? isRadarProfumo(p) : isCollezioneProfumo(p);
      if (!matchTab) return false;

      const q = searchQuery.toLowerCase();
      const nomeSafe = (p.nome || '').toLowerCase();
      const brandSafe = (p.brand || '').toLowerCase();
      const noteSafe = (p.note_olfattive || '').toLowerCase();

      const matchSearch =
        !q || nomeSafe.includes(q) || brandSafe.includes(q) || noteSafe.includes(q);
      const matchFamily = selectedFamily === 'Tutte' || p.famiglia_olfattiva === selectedFamily;
      const matchBrand = selectedBrand === 'Tutti' || p.brand === selectedBrand;

      return matchSearch && matchFamily && matchBrand;
    });
  }, [profumi, activeTab, searchQuery, selectedFamily, selectedBrand]);

  const activeFiltersCount =
    (selectedFamily !== 'Tutte' ? 1 : 0) + (selectedBrand !== 'Tutti' ? 1 : 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36">
      <PageHeader
        title={activeTab === 'radar' ? 'Testing Radar' : 'La mia Collezione'}
        subtitle="VETRINA"
        rightSlot={
          <div className="flex items-center gap-2.5">
            <div className="flex rounded-full bg-[#0E0A16] p-1 border border-white/10">
              <button
                onClick={() => {
                  setActiveTab('collezione');
                  setCustomAura(SECTION_THEMES.collezione);
                  router.push('/collezione');
                }}
                style={
                  activeTab === 'collezione'
                    ? { backgroundColor: SECTION_THEMES.collezione.primary }
                    : undefined
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'collezione'
                    ? 'text-[#08060C]'
                    : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                }`}
              >
                <Library className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Collezione</span> ({profumi.filter(isCollezioneProfumo).length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('radar');
                  setCustomAura(SECTION_THEMES.radar);
                  router.push('/collezione?vista=radar');
                }}
                style={
                  activeTab === 'radar'
                    ? { backgroundColor: SECTION_THEMES.radar.primary }
                    : undefined
                }
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'radar'
                    ? 'text-[#08060C]'
                    : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Radar</span> ({profumi.filter(isRadarProfumo).length})
              </button>
            </div>

            <Link
              href="/scanner"
              style={{ backgroundColor: aura.primary }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#08060C] transition hover:opacity-90 shadow-lg"
              title="Acquisisci"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </Link>
          </div>
        }
      />

      {/* RICERCA E FILTRI */}
      <section className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A9C9]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtra per maison, creazione o nota olfattiva..."
            className="w-full rounded-[18px] border border-white/10 bg-[#161024]/90 pl-11 pr-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:border-white/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#B8A9C9] hover:text-white"
            >
              Cancella
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
          style={
            activeFiltersCount > 0
              ? { borderColor: aura.primary, color: aura.primary }
              : undefined
          }
          className="flex items-center gap-2.5 rounded-[18px] border border-white/10 bg-[#161024]/90 px-5 py-3 text-xs font-semibold text-[#F6EFE4] transition"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtri {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
        </button>
      </section>

      {filterDrawerOpen && (
        <section className="mt-3 rounded-[24px] border border-white/15 bg-[#161024] p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3
              style={{ color: aura.primary }}
              className="text-xs font-mono uppercase tracking-widest"
            >
              Filtra per Maison e Famiglia Olfattiva
            </h3>
            <button
              onClick={() => {
                setSelectedFamily('Tutte');
                setSelectedBrand('Tutti');
              }}
              className="text-xs text-[#B8A9C9] hover:text-[#F6EFE4]"
            >
              Resetta
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-mono uppercase text-[#B8A9C9] mb-2">Maison</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBrand(b)}
                    style={
                      selectedBrand === b ? { backgroundColor: aura.primary } : undefined
                    }
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      selectedBrand === b
                        ? 'text-[#08060C] font-bold'
                        : 'bg-[#0E0A16] text-[#B8A9C9] border border-white/10 hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-mono uppercase text-[#B8A9C9] mb-2">
                Famiglia Olfattiva
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedFamily('Tutte')}
                  style={
                    selectedFamily === 'Tutte'
                      ? { backgroundColor: aura.primary }
                      : undefined
                  }
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selectedFamily === 'Tutte'
                      ? 'text-[#08060C] font-bold'
                      : 'bg-[#0E0A16] text-[#B8A9C9] border border-white/10 hover:text-white'
                  }`}
                >
                  Tutte
                </button>
                {PURE_FAMILIES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFamily(f)}
                    style={
                      selectedFamily === f ? { backgroundColor: aura.primary } : undefined
                    }
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      selectedFamily === f
                        ? 'text-[#08060C] font-bold'
                        : 'bg-[#0E0A16] text-[#B8A9C9] border border-white/10 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GRIGLIA FLACONI */}
      <section className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 rounded-[30px] aura-skeleton" />
            ))}
          </div>
        ) : filteredProfumi.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-[#161024]/90 p-16 text-center space-y-3">
            <Compass
              style={{ color: aura.primary }}
              className="h-10 w-10 mx-auto opacity-50"
            />
            <h2 className="font-serif text-2xl text-[#F6EFE4]">
              Nessuna creazione trovata
            </h2>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {filteredProfumi.map((p) => {
              const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
              const imgUrl = p.url_foto_vetrina || p.immagine_url;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfumo(p);
                    setAuraFromProfumo(p);
                  }}
                  style={{ borderColor: `${pAura.primary}40` }}
                  className="group relative flex flex-col justify-between rounded-[30px] border bg-[#161024]/95 p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl"
                >
                  <div className="flex justify-center py-2">
                    <div className="relative w-full">
                      <div
                        className="absolute inset-0 rounded-[26px] blur-2xl opacity-35 transition-opacity group-hover:opacity-75"
                        style={{ backgroundColor: pAura.primary }}
                      />
                      <BottlePedestal
                        src={imgUrl}
                        alt={p.nome}
                        size="lg"
                        className="relative z-10 !h-52 w-full"
                        showSigil={false}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-center">
                    <p
                      style={{ color: pAura.primary }}
                      className="font-mono text-[10px] uppercase tracking-wider truncate"
                    >
                      {p.brand}
                    </p>
                    <h3 className="font-serif text-[17px] leading-tight text-[#F6EFE4] line-clamp-2">
                      {p.nome}
                    </h3>
                    <p className="font-mono text-[10px] text-[#B8A9C9] pt-0.5">
                      {p.famiglia_olfattiva}
                    </p>

                    {activeTab === 'radar' && p.prezzo_stimato_euro && (
                      <div className="pt-2">
                        <span className="inline-block rounded-full bg-[#0E0A16] border border-purple-400/40 px-2.5 py-1 font-mono text-[10px] text-purple-200 line-clamp-1">
                          {p.prezzo_stimato_euro}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SCHEDA DI DETTAGLIO CONDIVISA */}
      <ProfumoDetailModal
        profumo={selectedProfumo}
        onClose={() => {
          setSelectedProfumo(null);
          setCustomAura(
            activeTab === 'radar'
              ? SECTION_THEMES.radar
              : SECTION_THEMES.collezione
          );
        }}
        onUpdated={(updated) => {
          setSelectedProfumo(updated);
          setProfumi((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }}
        onDeleted={(deletedId) => {
          setProfumi((prev) => prev.filter((p) => p.id !== deletedId));
          setSelectedProfumo(null);
        }}
      />
    </main>
  );
}
