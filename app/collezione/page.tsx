'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Library,
  Compass,
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  SquareStack,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  supabase,
  isCollezioneProfumo,
  isRadarProfumo,
  parsePrezzoEuro,
  Profumo,
} from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { GlassCard } from '@/components/GlassCard';
import { useAura, resolveAura, SECTION_THEMES } from '@/components/AuraProvider';

export default function CollezionePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState<'grid' | 'vetrina'>('vetrina');
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('tutte');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const { setCustomAura } = useAura();

  useEffect(() => {
    setCustomAura(activeTab === 'collezione' ? SECTION_THEMES.collezione : SECTION_THEMES.radar);

    async function fetchItems() {
      try {
        const { data, error } = await supabase
          .from('profumi')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProfumi((data || []) as Profumo[]);
      } catch (err) {
        console.error('Errore caricamento profumi:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, [activeTab, setCustomAura]);

  const collezioneList = profumi.filter(isCollezioneProfumo);
  const radarList = profumi.filter(isRadarProfumo);
  const currentList = activeTab === 'collezione' ? collezioneList : radarList;

  const availableFamilies = Array.from(
    new Set(currentList.map((p) => p.famiglia_olfattiva).filter(Boolean))
  ) as string[];

  const filteredProfumi = currentList.filter((p) => {
    const matchesSearch =
      (p.nome || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.note_olfattive || '').toLowerCase().includes(searchFilter.toLowerCase());

    const matchesFamily =
      selectedFamily === 'tutte' || p.famiglia_olfattiva === selectedFamily;

    return matchesSearch && matchesFamily;
  });

  const accentColor = activeTab === 'collezione' ? '#38BDF8' : '#C084FC';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-6 pb-36 space-y-8">
      {/* HEADER SENZA BOX FORZATI, LOGO NERO PURO */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 flex items-center justify-center p-1">
            <Logo variant="black" className="h-full w-full" />
          </div>
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
              {activeTab === 'collezione' ? 'Collezione' : 'Radar & Scouting'}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E7C9E] mt-1">
              {activeTab === 'collezione'
                ? `${collezioneList.length} flaconi registrati nel vault`
                : `${radarList.length} campioni in valutazione`}
            </p>
          </div>
        </div>

        {/* CONTROLLI VISTA E TAB */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Switch Griglia / Vetrina */}
          <div className="flex items-center rounded-2xl bg-[#090612] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setViewMode('vetrina')}
              title="Visualizzazione Vetrina"
              className={`p-2 rounded-xl transition ${
                viewMode === 'vetrina'
                  ? 'bg-white/10 text-[#F6EFE4]'
                  : 'text-[#8E7C9E] hover:text-[#F6EFE4]'
              }`}
            >
              <SquareStack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Visualizzazione Griglia"
              className={`p-2 rounded-xl transition ${
                viewMode === 'grid'
                  ? 'bg-white/10 text-[#F6EFE4]'
                  : 'text-[#8E7C9E] hover:text-[#F6EFE4]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DI RICERCA E TASTO FILTRI */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E7C9E]" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Cerca per brand, nome o note..."
            className="w-full rounded-[18px] border border-white/10 bg-[#090612] pl-11 pr-4 py-3.5 text-xs sm:text-sm text-[#F6EFE4] placeholder:text-[#8E7C9E]/60 focus:border-white/35 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFiltersModal(!showFiltersModal)}
          className={`flex items-center gap-2.5 rounded-[18px] border px-5 py-3.5 font-mono text-xs uppercase tracking-wider transition ${
            selectedFamily !== 'tutte' || showFiltersModal
              ? 'border-white/40 bg-white/15 text-[#F6EFE4]'
              : 'border-white/10 bg-[#090612] text-[#8E7C9E] hover:border-white/20'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtri {selectedFamily !== 'tutte' ? `(1)` : ''}</span>
        </button>
      </div>

      {/* PANNELLO FILTRI RAPIDI ESPANDIBILE */}
      {showFiltersModal && availableFamilies.length > 0 && (
        <GlassCard className="p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E7C9E]">
              Filtra per Famiglia Olfattiva
            </span>
            <button
              type="button"
              onClick={() => setSelectedFamily('tutte')}
              className="font-mono text-[10px] text-rose-400 hover:underline"
            >
              Resetta filtri
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedFamily('tutte')}
              className={`rounded-xl px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider transition border ${
                selectedFamily === 'tutte'
                  ? 'border-white/30 bg-white/10 text-[#F6EFE4]'
                  : 'border-white/10 bg-[#050308] text-[#8E7C9E]'
              }`}
            >
              Tutte
            </button>
            {availableFamilies.map((fam) => (
              <button
                key={fam}
                type="button"
                onClick={() => setSelectedFamily(fam)}
                className={`rounded-xl px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider transition border ${
                  selectedFamily === fam
                    ? 'border-white/40 bg-white/20 text-[#F6EFE4]'
                    : 'border-white/10 bg-[#050308] text-[#8E7C9E]'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* CONTENUTO: LISTA O GRIGLIA */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-72 rounded-[26px] aura-skeleton" />
          ))}
        </div>
      ) : filteredProfumi.length === 0 ? (
        <GlassCard className="p-12 text-center space-y-3">
          <p className="font-serif text-xl text-[#F6EFE4]">Nessuna fragranza trovata</p>
          <p className="font-mono text-xs text-[#8E7C9E]">
            Modifica i termini di ricerca o i filtri applicati.
          </p>
        </GlassCard>
      ) : viewMode === 'vetrina' ? (
        /* VISTA VETRINA IMMERSIVA (CARD AMPIE) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProfumi.map((p) => {
            const imgUrl = p.url_foto_vetrina || p.immagine_url;
            const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
            const inCollezione = isCollezioneProfumo(p);

            return (
              <GlassCard
                key={p.id}
                accentColor={pAura.primary}
                className="group relative flex flex-col justify-between p-6 transition duration-500 hover:-translate-y-1"
              >
                <div className="flex gap-5">
                  <BottlePedestal
                    src={imgUrl}
                    alt={p.nome}
                    size="lg"
                    className="!h-48 !w-36 shrink-0"
                    showSigil={inCollezione}
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        style={{ color: pAura.primary }}
                        className="font-mono text-[10px] uppercase tracking-widest truncate"
                      >
                        {p.brand}
                      </span>
                      {p.famiglia_olfattiva && (
                        <span className="font-mono text-[10px] text-[#8E7C9E]">
                          {p.famiglia_olfattiva}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-xl text-[#F6EFE4] leading-snug">
                      {p.nome}
                    </h3>

                    {p.concentrazione && (
                      <p className="font-mono text-xs text-[#B8A9C9]">
                        {p.concentrazione} {p.formato_ml ? `• ${p.formato_ml}ml` : ''}
                      </p>
                    )}

                    <p className="text-xs text-[#8E7C9E] line-clamp-2 pt-1">
                      {p.note_olfattive || p.descrizione_ai || 'Nessuna nota registrata.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="font-mono text-xs text-[#F6EFE4]">
                    {p.prezzo_stimato_euro ? `€${parsePrezzoEuro(p)}` : '—'}
                  </span>

                  <Link
                    href={`/collezione/${p.id}`}
                    className="flex items-center gap-1.5 font-mono text-xs text-[#F6EFE4] hover:text-white transition group-hover:translate-x-1"
                  >
                    <span>Apri Scheda</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        /* VISTA A GRIGLIA COMPATTA */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredProfumi.map((p) => {
            const imgUrl = p.url_foto_vetrina || p.immagine_url;
            const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
            const inCollezione = isCollezioneProfumo(p);

            return (
              <GlassCard
                key={p.id}
                accentColor={pAura.primary}
                className="group flex flex-col justify-between p-4 transition hover:-translate-y-1"
              >
                <div>
                  <BottlePedestal
                    src={imgUrl}
                    alt={p.nome}
                    size="md"
                    className="!h-36 w-full"
                    showSigil={inCollezione}
                  />

                  <div className="mt-3 space-y-1">
                    <span
                      style={{ color: pAura.primary }}
                      className="font-mono text-[9px] uppercase tracking-wider block truncate"
                    >
                      {p.brand}
                    </span>
                    <h3 className="font-serif text-sm text-[#F6EFE4] leading-snug line-clamp-1">
                      {p.nome}
                    </h3>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#F6EFE4]">
                    {p.prezzo_stimato_euro ? `€${parsePrezzoEuro(p)}` : '—'}
                  </span>
                  <Link
                    href={`/collezione/${p.id}`}
                    className="font-mono text-[10px] text-sky-400 hover:underline"
                  >
                    Scheda →
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </main>
  );
}
