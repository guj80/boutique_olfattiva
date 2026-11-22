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
  Eye,
  FlaskConical,
  Layers,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  PURE_FAMILIES,
  isCollezioneProfumo,
  isRadarProfumo,
} from '@/lib/supabase';
import { normalizeFamily } from '@/lib/families';
import { suggestNotes } from '@/lib/dictionary';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { resolveAura, useAura, SECTION_THEMES } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';
import {
  collectProposals,
  ownedListForPrompt,
  makeScoutPairKey,
  type ScoutMode,
  type ScoutProposal,
} from '@/lib/scout-logic';

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
  const [selectedFamily, setSelectedFamily] = useState('Tutte');
  const [selectedBrand, setSelectedBrand] = useState('Tutti');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const [scoutMode, setScoutMode] = useState<ScoutMode>('trittico');
  const [scoutFamily, setScoutFamily] = useState('Qualsiasi');
  const [lastResolvedFamily, setLastResolvedFamily] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState<string[]>([]);
  const [currentIncludeInput, setCurrentIncludeInput] = useState('');
  const [includeFocused, setIncludeFocused] = useState(false);
  const [excludeNotes, setExcludeNotes] = useState<string[]>([]);
  const [currentExcludeInput, setCurrentExcludeInput] = useState('');
  const [excludeFocused, setExcludeFocused] = useState(false);
  const [scoutResults, setScoutResults] = useState<ScoutProposal[]>([]);
  const [seenScoutKeys, setSeenScoutKeys] = useState<string[]>([]);
  const [scoutingLoading, setScoutingLoading] = useState(false);

  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);

  const { aura, setAuraFromProfumo, setCustomAura } = useAura();
  const { showToast } = useToast();

  const includeSuggestions = useMemo(
    () =>
      suggestNotes(currentIncludeInput).filter(
        (s) => !includeNotes.some((n) => n.toLowerCase() === s.toLowerCase())
      ),
    [currentIncludeInput, includeNotes]
  );

  const excludeSuggestions = useMemo(
    () =>
      suggestNotes(currentExcludeInput).filter(
        (s) => !excludeNotes.some((n) => n.toLowerCase() === s.toLowerCase())
      ),
    [currentExcludeInput, excludeNotes]
  );

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
      setProfumi((data || []) as Profumo[]);
    } catch {
      showToast('Impossibile caricare la collezione.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function addIncludeNote(rawVal: string) {
    const val = rawVal.trim();
    if (!val) return;
    if (!includeNotes.some((n) => n.toLowerCase() === val.toLowerCase())) {
      setIncludeNotes((prev) => [...prev, val]);
    }
    setCurrentIncludeInput('');
  }

  function addExcludeNote(rawVal: string) {
    const val = rawVal.trim();
    if (!val) return;
    if (!excludeNotes.some((n) => n.toLowerCase() === val.toLowerCase())) {
      setExcludeNotes((prev) => [...prev, val]);
    }
    setCurrentExcludeInput('');
  }

  async function handleRunScout() {
    setScoutingLoading(true);
    setScoutResults([]);
    setIncludeFocused(false);
    setExcludeFocused(false);
    try {
      const pendingInclude = currentIncludeInput.trim();
      const effectiveInclude =
        pendingInclude &&
        !includeNotes.some((n) => n.toLowerCase() === pendingInclude.toLowerCase())
          ? [...includeNotes, pendingInclude]
          : includeNotes;
      if (pendingInclude) {
        setIncludeNotes(effectiveInclude);
        setCurrentIncludeInput('');
      }

      const pendingExclude = currentExcludeInput.trim();
      const effectiveExclude =
        pendingExclude &&
        !excludeNotes.some((n) => n.toLowerCase() === pendingExclude.toLowerCase())
          ? [...excludeNotes, pendingExclude]
          : excludeNotes;
      if (pendingExclude) {
        setExcludeNotes(effectiveExclude);
        setCurrentExcludeInput('');
      }

      const ownedKeys = ownedListForPrompt(profumi);
      const response = await collectProposals(
        {
          mode: scoutMode,
          scoutFamily,
          lastFamily: lastResolvedFamily,
          includeNotes: effectiveInclude,
          excludeNotes: effectiveExclude,
        },
        ownedKeys,
        seenScoutKeys
      );

      setScoutResults(response.proposals);
      if (response.resolvedFamily) {
        setLastResolvedFamily(response.resolvedFamily);
      }
      if (response.proposals.length > 0) {
        const newKeys = response.proposals.map((p) => makeScoutPairKey(p.brand, p.nome));
        setSeenScoutKeys((prev) => Array.from(new Set([...prev, ...newKeys])).slice(-60));
      } else {
        showToast('Nessuna creazione trovata con questi filtri esatti.', 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore durante la ricerca.';
      showToast(message, 'error');
    } finally {
      setScoutingLoading(false);
    }
  }

  async function handleSaveScoutToRadar(item: ScoutProposal) {
    const pairKey = makeScoutPairKey(item.brand, item.nome);
    const alreadyExists = profumi.some(
      (p) => makeScoutPairKey(p.brand, p.nome) === pairKey
    );

    if (alreadyExists) {
      showToast(`${item.brand} — ${item.nome} è già in archivio.`, 'error');
      return;
    }

    try {
      const payload = {
        brand: item.brand,
        nome: item.nome,
        concentrazione: item.concentrazione || null,
        famiglia_olfattiva: normalizeFamily(item.famiglia_olfattiva),
        naso: item.naso || null,
        note_testa: item.note_testa || null,
        note_cuore: item.note_cuore || null,
        note_fondo: item.note_fondo || null,
        url_foto_vetrina: item.url_foto_vetrina || null,
        stato: 'radar',
      };

      const { data, error } = await supabase
        .from('profumi')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      setProfumi((prev) => [...prev, data as Profumo]);
      setScoutResults((prev) =>
        prev.filter((r) => makeScoutPairKey(r.brand, r.nome) !== pairKey)
      );
      showToast(`${item.nome} salvato nel Radar.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore salvataggio.';
      showToast(message, 'error');
    }
  }

  function handlePreviewScoutItem(item: ScoutProposal) {
    const tempProfumo = {
      id: `preview-${Date.now()}`,
      brand: item.brand || 'Maison',
      nome: item.nome || 'Creazione',
      concentrazione: item.concentrazione || null,
      famiglia_olfattiva: item.famiglia_olfattiva || null,
      naso: item.naso || null,
      note_testa: item.note_testa || null,
      note_cuore: item.note_cuore || null,
      note_fondo: item.note_fondo || null,
      url_foto_vetrina: item.url_foto_vetrina || null,
      stato: 'radar',
    } as unknown as Profumo;

    setSelectedProfumo(tempProfumo);
    setAuraFromProfumo(tempProfumo);
  }

  const brands = useMemo(() => {
    const set = new Set(profumi.map((p) => p.brand).filter(Boolean));
    return ['Tutti', ...Array.from(set)];
  }, [profumi]);

  const filteredProfumi = useMemo(() => {
    return profumi.filter((p) => {
      const matchTab =
        activeTab === 'radar' ? isRadarProfumo(p) : isCollezioneProfumo(p);
      if (!matchTab) return false;

      const q = searchQuery.toLowerCase();
      const nomeSafe = (p.nome || '').toLowerCase();
      const brandSafe = (p.brand || '').toLowerCase();
      const noteSafe = (p.note_olfattive || '').toLowerCase();

      const matchSearch =
        !q || nomeSafe.includes(q) || brandSafe.includes(q) || noteSafe.includes(q);
      const matchFamily =
        selectedFamily === 'Tutte' ||
        normalizeFamily(p.famiglia_olfattiva) === selectedFamily ||
        p.famiglia_olfattiva === selectedFamily;
      const matchBrand = selectedBrand === 'Tutti' || p.brand === selectedBrand;

      return matchSearch && matchFamily && matchBrand;
    });
  }, [profumi, activeTab, searchQuery, selectedFamily, selectedBrand]);

  const activeFiltersCount =
    (selectedFamily !== 'Tutte' ? 1 : 0) + (selectedBrand !== 'Tutti' ? 1 : 0);

  const pageTitle = activeTab === 'radar' ? 'Testing Radar' : 'La mia Collezione';
  const tabCount = profumi.filter(
    activeTab === 'radar' ? isRadarProfumo : isCollezioneProfumo
  ).length;

  const headerRightActions = (
    <div className="flex items-center gap-2.5">
      <div
        style={{ borderColor: `${aura.primary}40` }}
        className="flex rounded-full bg-[#0E0A16] p-1 border"
      >
        <button
          type="button"
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
          <Library className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Collezione</span> (
          {profumi.filter(isCollezioneProfumo).length})
        </button>
        <button
          type="button"
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
          <Compass className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Radar</span> (
          {profumi.filter(isRadarProfumo).length})
        </button>
      </div>

      <Link
        href="/scanner"
        title="Acquisisci"
        style={{ backgroundColor: aura.primary }}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#08060C] transition hover:opacity-90 shadow-lg"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
      </Link>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-8 pb-36 space-y-8">
      <PageHeader
        title={pageTitle}
        rightSlot={headerRightActions}
        count={loading ? undefined : tabCount}
      />

      {/* ESPLORAZIONE NEL RADAR: IL TRITTICO & ULTRA-NICCHIA */}
      {activeTab === 'radar' && (
        <section
          style={{ borderColor: `${aura.primary}50` }}
          className="rounded-[28px] border bg-[#0E0A16] p-6 sm:p-7 shadow-2xl space-y-6"
        >
          <div
            style={{ borderColor: `${aura.primary}25` }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
          >
            <div
              style={{ borderColor: `${aura.primary}55` }}
              className="inline-flex items-center gap-2 rounded-md bg-[#161024] border px-3 py-1 w-fit"
            >
              {scoutMode === 'ultranicchia' ? (
                <FlaskConical style={{ color: aura.primary }} className="h-4 w-4" />
              ) : (
                <Sparkles style={{ color: aura.primary }} className="h-4 w-4" />
              )}
              <span
                style={{ color: aura.primary }}
                className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
              >
                {scoutMode === 'ultranicchia' ? 'Ultra-Nicchia' : 'Il Trittico'}
              </span>
            </div>

            <div
              style={{ borderColor: `${aura.primary}35` }}
              className="flex rounded-full bg-[#161024] p-1 border w-fit"
            >
              <button
                type="button"
                onClick={() => {
                  setScoutMode('trittico');
                  setScoutResults([]);
                }}
                style={scoutMode === 'trittico' ? { backgroundColor: aura.primary } : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] transition ${
                  scoutMode === 'trittico'
                    ? 'text-[#08060C] font-bold'
                    : 'text-[#B8A9C9] hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Il Trittico</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScoutMode('ultranicchia');
                  setScoutResults([]);
                }}
                style={
                  scoutMode === 'ultranicchia' ? { backgroundColor: aura.primary } : undefined
                }
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[11px] transition ${
                  scoutMode === 'ultranicchia'
                    ? 'text-[#08060C] font-bold'
                    : 'text-[#B8A9C9] hover:text-white'
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Ultra-Nicchia</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-[#B8A9C9]">
            {scoutMode === 'ultranicchia'
              ? 'Maison radicali e materie prime non convenzionali.'
              : 'Tre interpretazioni della stessa direzione olfattiva: Designer · Nicchia · Artistico.'}
          </p>

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
                <option value="Qualsiasi">Qualsiasi</option>
                {PURE_FAMILIES.map((fam) => (
                  <option key={fam} value={fam}>
                    {fam}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Note da Includere
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentIncludeInput}
                  onFocus={() => setIncludeFocused(true)}
                  onBlur={() => setTimeout(() => setIncludeFocused(false), 160)}
                  onChange={(e) => {
                    setCurrentIncludeInput(e.target.value);
                    setIncludeFocused(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIncludeNote(currentIncludeInput);
                    }
                  }}
                  placeholder={
                    scoutMode === 'ultranicchia'
                      ? 'Es. Sangue, Neve, Castoreo, Benzina...'
                      : 'Es. Iris, Cuoio, Patchouli...'
                  }
                  style={{ borderColor: `${aura.primary}40` }}
                  className="flex-1 rounded-[14px] bg-[#161024] border p-2.5 text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addIncludeNote(currentIncludeInput)}
                  style={{ backgroundColor: aura.primary }}
                  className="px-3.5 py-2 rounded-[14px] text-[#08060C] font-bold transition hover:opacity-90"
                >
                  +
                </button>
              </div>

              {includeFocused && includeSuggestions.length > 0 && (
                <div
                  style={{ borderColor: `${aura.primary}50` }}
                  className="absolute left-0 right-11 top-[66px] z-30 rounded-[14px] border bg-[#0E0A16] py-1.5 shadow-2xl"
                >
                  {includeSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addIncludeNote(sug);
                      }}
                      className="block w-full px-3.5 py-1.5 text-left text-xs text-[#F6EFE4] hover:bg-white/10 transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {includeNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {includeNotes.map((note, idx) => (
                    <span
                      key={idx}
                      style={{ borderColor: `${aura.primary}40` }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#161024] border px-2.5 py-0.5 font-mono text-[10px] text-emerald-300"
                    >
                      {note}
                      <button
                        type="button"
                        onClick={() =>
                          setIncludeNotes(includeNotes.filter((_, i) => i !== idx))
                        }
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Note da Escludere
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentExcludeInput}
                  onFocus={() => setExcludeFocused(true)}
                  onBlur={() => setTimeout(() => setExcludeFocused(false), 160)}
                  onChange={(e) => {
                    setCurrentExcludeInput(e.target.value);
                    setExcludeFocused(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExcludeNote(currentExcludeInput);
                    }
                  }}
                  placeholder="Es. Vaniglia, Muschio..."
                  style={{ borderColor: `${aura.primary}40` }}
                  className="flex-1 rounded-[14px] bg-[#161024] border p-2.5 text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addExcludeNote(currentExcludeInput)}
                  style={{ backgroundColor: aura.primary }}
                  className="px-3.5 py-2 rounded-[14px] text-[#08060C] font-bold transition hover:opacity-90"
                >
                  +
                </button>
              </div>

              {excludeFocused && excludeSuggestions.length > 0 && (
                <div
                  style={{ borderColor: `${aura.primary}50` }}
                  className="absolute left-0 right-11 top-[66px] z-30 rounded-[14px] border bg-[#0E0A16] py-1.5 shadow-2xl"
                >
                  {excludeSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addExcludeNote(sug);
                      }}
                      className="block w-full px-3.5 py-1.5 text-left text-xs text-[#F6EFE4] hover:bg-white/10 transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {excludeNotes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {excludeNotes.map((note, idx) => (
                    <span
                      key={idx}
                      style={{ borderColor: `${aura.primary}40` }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#161024] border px-2.5 py-0.5 font-mono text-[10px] text-red-300"
                    >
                      {note}
                      <button
                        type="button"
                        onClick={() =>
                          setExcludeNotes(excludeNotes.filter((_, i) => i !== idx))
                        }
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {lastResolvedFamily && scoutFamily === 'Qualsiasi' && scoutResults.length > 0 ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
                Direzione: <strong style={{ color: aura.primary }}>{lastResolvedFamily}</strong>
              </span>
            ) : (
              <span />
            )}

            <button
              type="button"
              onClick={handleRunScout}
              disabled={scoutingLoading}
              style={{ backgroundColor: aura.primary }}
              className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              {scoutingLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 fill-current" />
              )}
              <span>
                {scoutingLoading
                  ? 'Ricerca...'
                  : scoutResults.length > 0
                  ? 'Nuova Selezione'
                  : 'Esplora'}
              </span>
            </button>
          </div>

          {scoutResults.length > 0 && (
            <div
              style={{ borderColor: `${aura.primary}25` }}
              className="pt-6 border-t space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {scoutResults.map((item, idx) => (
                  <div
                    key={`${item.brand}-${item.nome}-${idx}`}
                    style={{ borderColor: `${aura.primary}45` }}
                    className="group flex flex-col justify-between rounded-[22px] border bg-[#161024] p-4 space-y-4 shadow-xl"
                  >
                    <div
                      onClick={() => handlePreviewScoutItem(item)}
                      className="space-y-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={{ borderColor: `${aura.primary}35`, color: aura.primary }}
                          className="inline-block font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0E0A16] border"
                        >
                          {item.categoria}
                        </span>
                        {item.famiglia_olfattiva && (
                          <span className="font-mono text-[9px] text-[#B8A9C9]">
                            {item.famiglia_olfattiva}
                          </span>
                        )}
                      </div>

                      <BottlePedestal
                        src={item.url_foto_vetrina}
                        alt={item.nome}
                        brand={item.brand}
                        famiglia={item.famiglia_olfattiva}
                        concentrazione={item.concentrazione}
                        size="md"
                        className="w-full !h-36 my-1"
                      />

                      <p
                        style={{ color: aura.primary }}
                        className="font-mono text-[10px] uppercase tracking-wider truncate"
                      >
                        {item.brand}
                      </p>
                      <h5 className="font-serif text-lg text-[#F6EFE4] leading-tight group-hover:underline">
                        {item.nome}
                      </h5>
                      {item.motivo && (
                        <p className="text-xs leading-relaxed text-[#B8A9C9] pt-0.5">
                          {item.motivo}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handlePreviewScoutItem(item)}
                        style={{ borderColor: `${aura.primary}40` }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full border bg-[#0E0A16] px-3 py-2 text-xs font-semibold text-[#F6EFE4] transition hover:opacity-85"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Scheda</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveScoutToRadar(item)}
                        style={{
                          borderColor: `${aura.primary}60`,
                          color: aura.primary,
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full border bg-[#0E0A16] px-3 py-2 text-xs font-bold transition hover:opacity-85"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Salva</span>
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A9C9]" />
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
              type="button"
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
          <SlidersHorizontal className="h-4 w-4" />
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
              type="button"
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
                    type="button"
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
                  type="button"
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
                    type="button"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 rounded-[24px] aura-skeleton" />
            ))}
          </div>
        ) : filteredProfumi.length === 0 ? (
          <div
            style={{ borderColor: `${aura.primary}35` }}
            className="rounded-[24px] border bg-[#161024]/90 p-16 text-center space-y-3 shadow-xl"
          >
            <Compass
              style={{ color: aura.primary }}
              className="h-10 w-10 mx-auto opacity-50"
            />
            <h2 className="font-serif text-2xl text-[#F6EFE4]">
              Nessuna creazione trovata
            </h2>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
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
                  className="group relative flex flex-col h-full rounded-[24px] border bg-[#161024]/95 p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl"
                >
                  <div className="flex flex-1 items-center justify-center py-2 w-full">
                    <div className="relative w-full">
                      <div
                        className="absolute inset-0 rounded-[26px] blur-2xl opacity-35 transition-opacity group-hover:opacity-75"
                        style={{ backgroundColor: pAura.primary }}
                      />
                      <BottlePedestal
                        src={imgUrl}
                        alt={p.nome}
                        brand={p.brand}
                        famiglia={p.famiglia_olfattiva}
                        concentrazione={p.concentrazione}
                        size="lg"
                        showSigil={false}
                        className="relative z-10 !h-52 w-full"
                      />
                    </div>
                  </div>

                  <div className="mt-4 w-full grid grid-rows-[20px_52px_20px] items-center text-center gap-1.5">
                    <p
                      style={{ color: pAura.primary }}
                      className="font-mono text-[13px] font-medium uppercase tracking-[0.12em] truncate"
                    >
                      {p.brand}
                    </p>
                    <h3 className="font-serif text-[22px] leading-[1.15] text-[#F6EFE4] line-clamp-2 flex items-center justify-center">
                      {p.nome}
                    </h3>
                    <p className="font-mono text-[11px] text-[#B8A9C9] truncate">
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
            activeTab === 'radar' ? SECTION_THEMES.radar : SECTION_THEMES.collezione
          );
        }}
        onUpdated={(updated: Profumo) => {
          setSelectedProfumo(updated);
          setProfumi((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
        }}
        onDeleted={(deletedId: string) => {
          setProfumi((prev) => prev.filter((p) => p.id !== deletedId));
          setSelectedProfumo(null);
        }}
      />
    </main>
  );
}
