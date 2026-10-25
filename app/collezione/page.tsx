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
  Sparkles,
  RefreshCw,
  Check,
} from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo, isRadarProfumo } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import {
  collectProposals,
  filterNewProposals,
  ownedListForPrompt,
} from '@/lib/scout-logic';

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

  // Stati per il Consultant di Scouting (Radar)
  const [scoutFamily, setScoutFamily] = useState<string>('Qualsiasi');
  const [includeNotes, setIncludeNotes] = useState<string[]>([]);
  const [currentIncludeInput, setCurrentIncludeInput] = useState('');
  const [excludeNotes, setExcludeNotes] = useState<string[]>([]);
  const [currentExcludeInput, setCurrentExcludeInput] = useState('');
  const [scoutResults, setScoutResults] = useState<any[]>([]);
  const [scoutingLoading, setScoutingLoading] = useState(false);

  const [selectedProfumo, setSelectedProfumo] = useState<Profumo null |>(null);

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

  function handleAddIncludeNote() {
    if (!currentIncludeInput.trim()) return;
    if (!includeNotes.includes(currentIncludeInput.trim())) {
      setIncludeNotes([...includeNotes, currentIncludeInput.trim()]);
    }
    setCurrentIncludeInput('');
  }

  function handleAddExcludeNote() {
    if (!currentExcludeInput.trim()) return;
    if (!excludeNotes.includes(currentExcludeInput.trim())) {
      setExcludeNotes([...excludeNotes, currentExcludeInput.trim()]);
    }
    setCurrentExcludeInput('');
  }

  async function handleRunScout() {
    setScoutingLoading(true);
    setScoutResults([]);
    try {
      const ownedNames = ownedListForPrompt(profumi);
      const proposals = await collectProposals(
        { scoutFamily, includeNotes, excludeNotes },
        ownedNames
      );
      const filtered = filterNewProposals(proposals, ownedNames);
      setScoutResults(filtered);
      showToast('Proposte generate con successo.');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante lo scouting.', 'error');
    } finally {
      setScoutingLoading(false);
    }
  }

  async function handleSaveScoutToRadar(item: any) {
    try {
      const payload = {
        brand: item.brand,
        nome: item.nome,
        concentrazione: item.concentrazione || 'Extrait de Parfum',
        famiglia_olfattiva: item.famiglia_olfattiva || 'Ambrata',
        naso: item.naso || null,
        note_testa: item.note_testa || null,
        note_cuore: item.note_cuore || null,
        note_fondo: item.note_fondo || null,
        url_foto_vetrina: item.url_foto_vetrina || null,
        stato: 'radar',
      };

      const { data, error } = await supabase.from('profumi').insert([payload]).select().single();
      if (error) throw error;

      setProfumi((prev) => [...prev, data]);
      showToast(`${item.nome} aggiunto al Testing Radar.`);
    } catch (err: any) {
      showToast(err?.message || 'Errore salvataggio nel Radar.', 'error');
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
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36 space-y-8">
      <PageHeader 'La 'Testing 'radar' : <div ? Collezione'} Radar' className="flex items-center gap-2.5" mia rightSlot="{" subtitle="VETRINA" title="{activeTab">
            <div
              style={{ borderColor: `${aura.primary}40` }}
              className="flex rounded-full bg-[#0E0A16] p-1 border"
            >
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
                    ? 'text-[#08060C] font-bold'
                    : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                }`}
              >
                <Library className="h-3.5 w-3.5"/>
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
                    ? 'text-[#08060C] font-bold'
                    : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                }`}
              >
                <Compass className="h-3.5 w-3.5"/>
                <span className="hidden sm:inline">Radar</span> ({profumi.filter(isRadarProfumo).length})
              </button>
            </div>

            <Link aura.primary backgroundColor: className="flex h-10 w-10 items-center justify-center rounded-full text-[#08060C] transition hover:opacity-90 shadow-lg" href="/scanner" style="{{" title="Acquisisci" }}>
              <Plus className="h-4 w-4 stroke-[2.5]"/>
            </Link>
          </div>
        }
      />

      {/* SEZIONE SPECIALE: CONSULTANT DI SCOUTING NEL RADAR */}
      {activeTab === 'radar' && (
        <section
          style={{ borderColor: `${aura.primary}50` }}
          className="rounded-[28px] border bg-[#0E0A16] p-6 sm:p-7 shadow-2xl space-y-6"
        >
          <div
            style={{ borderColor: `${aura.primary}25` }}
            className="flex items-center justify-between border-b pb-3"
          >
            <div
              style={{ borderColor: `${aura.primary}55` }}
              className="inline-flex items-center gap-2 rounded-md bg-[#161024] border px-3 py-1"
            >
              <Sparkles aura.primary className="h-4 w-4" color: style="{{" }}/>
              <span
                style={{ color: aura.primary }}
                className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
              >
                Consultant & Scouting AI
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase text-[#B8A9C9]">
              Ricerca Alta Profumeria
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Famiglia Olfattiva
              </label>
              <select
                value={scoutFamily}
                onChange={(e) => setScoutFamily(e.target.value)}
                style={{ borderColor: `${aura.primary}40` }}
                className="w-full rounded-[14px] bg-[#161024] border p-3 text-[#F6EFE4] focus:outline-none"
              >
                <option value="Qualsiasi">Qualsiasi Famiglia</option>
                {PURE_FAMILIES.map((fam) => (
                  <option key={fam} value={fam}>{fam}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Note da Includere (+)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentIncludeInput}
                  onChange={(e) => setCurrentIncludeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIncludeNote(); } }}
                  placeholder="Es. Iris, Cuoio..."
                  style={{ borderColor: `${aura.primary}40` }}
                  className="flex-1 rounded-[14px] bg-[#161024] border p-2.5 text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddIncludeNote}
                  style={{ backgroundColor: aura.primary }}
                  className="px-3 py-2 rounded-[14px] text-[#08060C] font-bold transition hover:opacity-90"
                >
                  +
                </button>
              </div>
              {includeNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {includeNotes.map((note, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full bg-[#161024] border border-white/15 px-2.5 py-0.5 font-mono text-[10px] text-emerald-300"
                    >
                      {note}
                      <button onClick={() => setIncludeNotes(includeNotes.filter((_, i) => i !== idx))} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Note da Escludere (+)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentExcludeInput}
                  onChange={(e) => setCurrentExcludeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExcludeNote(); } }}
                  placeholder="Es. Vaniglia, Muschio..."
                  style={{ borderColor: `${aura.primary}40` }}
                  className="flex-1 rounded-[14px] bg-[#161024] border p-2.5 text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddExcludeNote}
                  style={{ backgroundColor: aura.primary }}
                  className="px-3 py-2 rounded-[14px] text-[#08060C] font-bold transition hover:opacity-90"
                >
                  +
                </button>
              </div>
              {excludeNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {excludeNotes.map((note, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full bg-[#161024] border border-white/15 px-2.5 py-0.5 font-mono text-[10px] text-red-300"
                    >
                      {note}
                      <button onClick={() => setExcludeNotes(excludeNotes.filter((_, i) => i !== idx))} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleRunScout}
              disabled={scoutingLoading}
              style={{ backgroundColor: aura.primary }}
              className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              {scoutingLoading ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4 fill-current"/>}
              <span>{scoutingLoading ? 'Ricerca in corso...' : 'Avvia Scouting AI'}</span>
            </button>
          </div>

          {/* Risultati Scouting */}
          {scoutResults.length > 0 && (
            <div className="pt-6 border-t border-white/15 space-y-4">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[#F6EFE4] font-bold">
                Risultati Scouting
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {scoutResults.map((item, idx) => (
                  <div
                    key={idx}
                    style={{ borderColor: `${aura.primary}45` }}
                    className="flex flex-col justify-between rounded-[22px] border bg-[#161024] p-4 space-y-3 shadow-xl"
                  >
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-[#B8A9C9] border border-white/10">
                        {item.categoria || 'Nicchia'}
                      </span>
                      <p style={{ color: aura.primary }} className="font-mono text-[10px] uppercase tracking-wider pt-1 truncate">
                        {item.brand}
                      </p>
                      <h5 className="font-serif text-base text-[#F6EFE4] leading-tight">
                        {item.nome}
                      </h5>
                      <p className="font-mono text-[10px] text-[#B8A9C9]">
                        {item.famiglia_olfattiva}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProfumo(item as Profumo)}
                        style={{ borderColor: `${aura.primary}40`, color: '#F6EFE4' }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-full border bg-[#0E0A16] px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                      >
                        Anteprima
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveScoutToRadar(item)}
                        style={{ borderColor: `${aura.primary}60`, color: aura.primary }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-full border bg-[#0E0A16] px-3 py-2 text-xs font-bold transition hover:bg-white/5"
                      >
                        <Check className="h-3.5 w-3.5"/>
                        <span>Radar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* RICERCA E FILTRI */}
      <section className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A9C9]"/>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtra per maison, creazione o nota olfattiva..."
            style={{ borderColor: `${aura.primary}35` }}
            className="w-full rounded-[18px] border bg-[#161024]/90 pl-11 pr-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:outline-none"
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
              : { borderColor: `${aura.primary}35` }
          }
          className="flex items-center gap-2.5 rounded-[18px] border bg-[#161024]/90 px-5 py-3 text-xs font-semibold text-[#F6EFE4] transition"
        >
          <SlidersHorizontal className="h-4 w-4"/>
          <span>Filtri {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
        </button>
      </section>

      {filterDrawerOpen && (
        <section
          style={{ borderColor: `${aura.primary}50` }}
          className="rounded-[24px] border bg-[#161024] p-5 space-y-4 shadow-xl"
        >
          <div
            style={{ borderColor: `${aura.primary}25` }}
            className="flex items-center justify-between pb-3 border-b"
          >
            <h3
              style={{ color: aura.primary }}
              className="text-xs font-mono uppercase tracking-widest font-bold"
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
                      selectedBrand === b
                        ? { backgroundColor: aura.primary }
                        : { borderColor: `${aura.primary}35` }
                    }
                    className={`rounded-full px-3 py-1 text-xs transition border ${
                      selectedBrand === b
                        ? 'text-[#08060C] font-bold border-transparent'
                        : 'bg-[#0E0A16] text-[#B8A9C9] hover:text-white'
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
                      : { borderColor: `${aura.primary}35` }
                  }
                  className={`rounded-full px-3 py-1 text-xs transition border ${
                    selectedFamily === 'Tutte'
                      ? 'text-[#08060C] font-bold border-transparent'
                      : 'bg-[#0E0A16] text-[#B8A9C9] hover:text-white'
                  }`}
                >
                  Tutte
                </button>
                {PURE_FAMILIES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFamily(f)}
                    style={
                      selectedFamily === f
                        ? { backgroundColor: aura.primary }
                        : { borderColor: `${aura.primary}35` }
                    }
                    className={`rounded-full px-3 py-1 text-xs transition border ${
                      selectedFamily === f
                        ? 'text-[#08060C] font-bold border-transparent'
                        : 'bg-[#0E0A16] text-[#B8A9C9] hover:text-white'
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
      <section>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 rounded-[30px] aura-skeleton" />
            ))}
          </div>
        ) : filteredProfumi.length === 0 ? (
          <div
            style={{ borderColor: `${aura.primary}35` }}
            className="rounded-[28px] border bg-[#161024]/90 p-16 text-center space-y-3 shadow-xl"
          >
            <Compass aura.primary className="h-10 w-10 mx-auto opacity-50" color: style="{{" }}/>
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
                      <BottlePedestal alt="{p.nome}" className="relative z-10 !h-52 w-full" showSigil="{false}" size="lg" src="{imgUrl}"/>
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
      <ProfumoDetailModal onClose="{()" profumo="{selectedProfumo}"> {
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
