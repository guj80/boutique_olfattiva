'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Plus,
  Compass,
  Library,
  X,
  Trash2,
  UserCheck,
  Calendar,
  Edit3,
  Check,
  Sun,
  Leaf,
  Snowflake,
  Flower2,
} from 'lucide-react';
import { supabase, Profumo, isCollezioneProfumo, isRadarProfumo } from '@/lib/supabase';
import { formatPerfumeNote } from '@/lib/dictionary';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { resolveAura, useAura } from '@/components/AuraProvider';
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

function getSeasonsForFamily(famiglia?: string | null) {
  if (!famiglia) return { primavera: true, estate: true, autunno: true, inverno: true };
  const f = famiglia.toLowerCase();

  if (f.includes('agrumata') || f.includes('marina') || f.includes('verde')) {
    return { primavera: true, estate: true, autunno: false, inverno: false };
  }
  if (f.includes('ambrata') || f.includes('gourmand') || f.includes('cuoiata') || f.includes('speziata')) {
    return { primavera: false, estate: false, autunno: true, inverno: true };
  }
  if (f.includes('floreale') || f.includes('fruttata') || f.includes('aromatica')) {
    return { primavera: true, estate: true, autunno: true, inverno: false };
  }
  return { primavera: true, estate: false, autunno: true, inverno: true };
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { aura, setAuraFromProfumo } = useAura();
  const { showToast } = useToast();

  useEffect(() => {
    setActiveTab(vistaParam === 'radar' ? 'radar' : 'collezione');
  }, [vistaParam]);

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

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('profumi').delete().eq('id', id);
      if (error) throw error;
      setProfumi((prev) => prev.filter((p) => p.id !== id));
      setSelectedProfumo(null);
      setDeleteConfirmId(null);
      showToast('Flacone rimosso.');
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'eliminazione.", 'error');
    }
  }

  async function handleSaveEdit() {
    if (!selectedProfumo) return;
    try {
      const { error } = await supabase
        .from('profumi')
        .update({
          nome: editForm.nome,
          brand: editForm.brand,
          concentrazione: editForm.concentrazione,
          famiglia_olfattiva: editForm.famiglia_olfattiva,
          naso: editForm.naso || null,
          url_foto_vetrina: editForm.url_foto_vetrina,
          note_testa: editForm.note_testa,
          note_cuore: editForm.note_cuore,
          note_fondo: editForm.note_fondo,
          stato: editForm.stato,
        })
        .eq('id', selectedProfumo.id);

      if (error) throw error;

      showToast('Scheda aggiornata con successo.');
      setIsEditing(false);
      fetchProfumi();
      setSelectedProfumo({ ...selectedProfumo, ...editForm });
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'aggiornamento.", 'error');
    }
  }

  const activeFiltersCount =
    (selectedFamily !== 'Tutte' ? 1 : 0) + (selectedBrand !== 'Tutti' ? 1 : 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-36">
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <Link
            href="/"
            aria-label="Torna alla home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#1E1428]/80 text-[#F6EFE4] transition hover:border-white/40"
          >
            <ArrowLeft style={{ color: aura.primary }} className="h-5 w-5" />
          </Link>
          <Logo className="h-7" />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex rounded-full bg-[#140D1C] p-1 border border-white/10">
            <button
              onClick={() => {
                setActiveTab('collezione');
                router.push('/collezione');
              }}
              style={
                activeTab === 'collezione' ? { backgroundColor: aura.primary } : undefined
              }
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeTab === 'collezione'
                  ? 'text-[#140D1C]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Library className="h-3.5 w-3.5" />
              <span>Collezione ({profumi.filter(isCollezioneProfumo).length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('radar');
                router.push('/collezione?vista=radar');
              }}
              style={activeTab === 'radar' ? { backgroundColor: aura.primary } : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeTab === 'radar'
                  ? 'text-[#140D1C]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Radar ({profumi.filter(isRadarProfumo).length})</span>
            </button>
          </div>

          <Link
            href="/scanner"
            style={{ backgroundColor: aura.primary }}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[#140D1C] transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Acquisisci</span>
          </Link>
        </div>
      </header>

      {/* RICERCA E FILTRI */}
      <section className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A9C9]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtra per maison, creazione o nota olfattiva..."
            className="w-full rounded-[18px] border border-white/10 bg-[#1E1428]/90 pl-11 pr-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:border-white/30 focus:outline-none"
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
          className="flex items-center gap-2.5 rounded-[18px] border border-white/10 bg-[#1E1428]/90 px-5 py-3 text-xs font-semibold text-[#F6EFE4] transition"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtri {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
        </button>
      </section>

      {filterDrawerOpen && (
        <section className="mt-3 rounded-[24px] border border-white/15 bg-[#1E1428] p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3
              style={{ color: aura.primary }}
              className="text-xs font-mono uppercase tracking-widest"
            >
              Selezione per Maison e Famiglia Olfattiva Pura
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
                        ? 'text-[#140D1C] font-bold'
                        : 'bg-[#140D1C] text-[#B8A9C9] border border-white/10 hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-mono uppercase text-[#B8A9C9] mb-2">
                Famiglia Olfattiva Pura
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
                      ? 'text-[#140D1C] font-bold'
                      : 'bg-[#140D1C] text-[#B8A9C9] border border-white/10 hover:text-white'
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
                        ? 'text-[#140D1C] font-bold'
                        : 'bg-[#140D1C] text-[#B8A9C9] border border-white/10 hover:text-white'
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

      {/* GRIGLIA FLACONI (MINIATURE PURE SENZA SIGILLO SOVRAPPOSTO) */}
      <section className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 rounded-[30px] aura-skeleton" />
            ))}
          </div>
        ) : filteredProfumi.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-[#1E1428]/90 p-16 text-center space-y-3">
            <Compass
              style={{ color: aura.primary }}
              className="h-10 w-10 mx-auto opacity-50"
            />
            <h2 className="font-serif text-2xl text-[#F6EFE4]">
              Nessuna creazione trovata
            </h2>
            <p className="text-xs text-[#B8A9C9]">
              Modifica i parametri di ricerca o acquisisci un nuovo flacone.
            </p>
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
                    setEditForm(p);
                    setIsEditing(false);
                  }}
                  style={{ borderColor: `${pAura.primary}40` }}
                  className="group relative flex flex-col justify-between rounded-[30px] border bg-[#1E1428]/95 p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl"
                >
                  <div className="flex justify-center py-2">
                    <div className="relative w-full">
                      <div
                        className="absolute inset-0 rounded-[26px] blur-2xl opacity-35 transition-opacity group-hover:opacity-75"
                        style={{ backgroundColor: pAura.primary }}
                      />
                      {/* showSigil={false} TASSATIVO NELLA GRIGLIA */}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SCHEDA DI DETTAGLIO (MODALE CON SIGILLO D'AUTORE SUL PODIO E PIRAMIDE IN PRIMO PIANO) */}
      {selectedProfumo &&
        (() => {
          const modalAura = resolveAura(
            selectedProfumo.famiglia_olfattiva,
            selectedProfumo.nome
          );
          const seasons = getSeasonsForFamily(selectedProfumo.famiglia_olfattiva);
          const pAny = selectedProfumo as any;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/85 backdrop-blur-md animate-in fade-in duration-200">
              <div
                style={{ borderColor: `${modalAura.primary}55` }}
                className="relative w-full max-w-lg max-h-[86dvh] overflow-y-auto rounded-[32px] border bg-[#1E1428] p-6 sm:p-8 text-[#F6EFE4] space-y-6 shadow-2xl no-scrollbar mb-16"
              >
                <div className="absolute right-5 top-5 flex items-center gap-2 z-20">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    style={{ color: modalAura.primary }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#140D1C] hover:text-white border border-white/10 transition"
                    title="Modifica scheda"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProfumo(null);
                      setIsEditing(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#140D1C] text-[#B8A9C9] hover:text-white border border-white/10 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-4 pt-2">
                    <h3 className="font-serif text-xl text-[#F6EFE4]">
                      Modifica Scheda Tecnica
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                            Maison (Brand)
                          </label>
                          <input
                            type="text"
                            value={editForm.brand || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, brand: e.target.value })
                            }
                            className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                            Nome Creazione
                          </label>
                          <input
                            type="text"
                            value={editForm.nome || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nome: e.target.value })
                            }
                            className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                            Naso (Maître Parfumeur)
                          </label>
                          <input
                            type="text"
                            value={editForm.naso || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, naso: e.target.value })
                            }
                            className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                            Destinazione
                          </label>
                          <select
                            value={editForm.stato || 'collezione'}
                            onChange={(e) =>
                              setEditForm({ ...editForm, stato: e.target.value })
                            }
                            className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                          >
                            <option value="collezione">Collezione (Flacone)</option>
                            <option value="radar">Radar (Sample / Testing)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                          URL Immagine Flacone
                        </label>
                        <input
                          type="text"
                          value={editForm.url_foto_vetrina || editForm.immagine_url || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, url_foto_vetrina: e.target.value })
                          }
                          className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                          Note di Testa
                        </label>
                        <input
                          type="text"
                          value={editForm.note_testa || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, note_testa: e.target.value })
                          }
                          className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                          Note di Cuore
                        </label>
                        <input
                          type="text"
                          value={editForm.note_cuore || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, note_cuore: e.target.value })
                          }
                          className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                          Note di Fondo
                        </label>
                        <input
                          type="text"
                          value={editForm.note_fondo || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, note_fondo: e.target.value })
                          }
                          className="w-full rounded-[14px] bg-[#140D1C] border border-white/10 p-2.5 text-[#F6EFE4]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        style={{ backgroundColor: modalAura.primary }}
                        className="flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-[#140D1C]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Salva</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 1. PIRAMIDE OLFATTIVA SUBITO IN CIMA E IN PRIMO PIANO */}
                    <div className="space-y-2.5 pt-2">
                      <h3
                        style={{ color: modalAura.primary }}
                        className="font-mono text-[10px] uppercase tracking-[0.2em]"
                      >
                        Piramide Olfattiva Certificata
                      </h3>
                      <div className="space-y-2 text-xs">
                        {selectedProfumo.note_testa && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#140D1C] px-4 py-2.5 border border-white/10">
                            <span
                              style={{ color: modalAura.primary }}
                              className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                            >
                              Testa
                            </span>
                            <span className="text-left sm:text-right text-[#F6EFE4]">
                              {formatPerfumeNote(selectedProfumo.note_testa)}
                            </span>
                          </div>
                        )}
                        {selectedProfumo.note_cuore && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#140D1C] px-4 py-2.5 border border-white/10">
                            <span
                              style={{ color: modalAura.primary }}
                              className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                            >
                              Cuore
                            </span>
                            <span className="text-left sm:text-right text-[#F6EFE4]">
                              {formatPerfumeNote(selectedProfumo.note_cuore)}
                            </span>
                          </div>
                        )}
                        {selectedProfumo.note_fondo && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#140D1C] px-4 py-2.5 border border-white/10">
                            <span
                              style={{ color: modalAura.primary }}
                              className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                            >
                              Fondo
                            </span>
                            <span className="text-left sm:text-right text-[#F6EFE4]">
                              {formatPerfumeNote(selectedProfumo.note_fondo)}
                            </span>
                          </div>
                        )}
                        {!selectedProfumo.note_testa &&
                          !selectedProfumo.note_cuore &&
                          !selectedProfumo.note_fondo &&
                          selectedProfumo.note_olfattive && (
                            <div className="rounded-[16px] bg-[#140D1C] p-3.5 border border-white/10 text-center text-[#F6EFE4]">
                              {formatPerfumeNote(selectedProfumo.note_olfattive)}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* 2. PODIO CON SIGILLO D'AUTORE + DATI ANAGRAFICI REALI */}
                    <div className="flex flex-col items-center text-center pt-2">
                      <div className="relative mb-4">
                        <div
                          className="absolute inset-0 rounded-[36px] blur-2xl opacity-55"
                          style={{ backgroundColor: modalAura.primary }}
                        />
                        {/* showSigil={true} ESCLUSIVAMENTE QUI SUL PODIO DEL DETTAGLIO */}
                        <BottlePedestal
                          src={
                            selectedProfumo.url_foto_vetrina ||
                            selectedProfumo.immagine_url
                          }
                          alt={selectedProfumo.nome}
                          size="xl"
                          className="relative z-10"
                          showSigil={true}
                        />
                      </div>

                      <span
                        style={{ color: modalAura.primary }}
                        className="font-mono text-xs uppercase tracking-[0.2em]"
                      >
                        {selectedProfumo.brand}
                      </span>
                      <h2 className="font-serif text-3xl text-[#F6EFE4] mt-1">
                        {selectedProfumo.nome}
                      </h2>
                      <p className="font-mono text-[11px] text-[#B8A9C9] mt-1">
                        {selectedProfumo.concentrazione || 'Extrait de Parfum'} •{' '}
                        {selectedProfumo.famiglia_olfattiva}
                      </p>

                      {/* BADGE NASO E ANNO DI LANCIO */}
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {selectedProfumo.naso && (
                          <div
                            style={{ borderColor: `${modalAura.primary}40` }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#140D1C] px-3.5 py-1.5 border font-mono text-[11px] text-[#F6EFE4]"
                          >
                            <UserCheck
                              style={{ color: modalAura.primary }}
                              className="h-3.5 w-3.5"
                            />
                            <span>Naso: {selectedProfumo.naso}</span>
                          </div>
                        )}
                        {pAny.anno_lancio && (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#140D1C] px-3.5 py-1.5 border border-white/10 font-mono text-[11px] text-[#B8A9C9]">
                            <Calendar
                              style={{ color: modalAura.primary }}
                              className="h-3.5 w-3.5"
                            />
                            <span>Anno: {pAny.anno_lancio}</span>
                          </div>
                        )}
                      </div>

                      {/* 3. LE 4 STAGIONI CON INDICATORI A GRADIENTE VISIVO OGGETTIVO */}
                      <div className="mt-4 w-full grid grid-cols-4 gap-2 rounded-2xl bg-[#140D1C]/90 p-2.5 border border-white/10">
                        <div
                          className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${
                            seasons.primavera
                              ? 'bg-gradient-to-b from-emerald-500/20 to-transparent text-emerald-300 border border-emerald-400/30'
                              : 'opacity-25 text-[#B8A9C9]'
                          }`}
                        >
                          <Flower2 className="h-4 w-4" />
                          <span className="font-mono text-[9px] uppercase tracking-wider">
                            Primavera
                          </span>
                        </div>

                        <div
                          className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${
                            seasons.estate
                              ? 'bg-gradient-to-b from-sky-500/20 to-transparent text-sky-300 border border-sky-400/30'
                              : 'opacity-25 text-[#B8A9C9]'
                          }`}
                        >
                          <Sun className="h-4 w-4" />
                          <span className="font-mono text-[9px] uppercase tracking-wider">
                            Estate
                          </span>
                        </div>

                        <div
                          className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${
                            seasons.autunno
                              ? 'bg-gradient-to-b from-amber-500/20 to-transparent text-amber-300 border border-amber-400/30'
                              : 'opacity-25 text-[#B8A9C9]'
                          }`}
                        >
                          <Leaf className="h-4 w-4" />
                          <span className="font-mono text-[9px] uppercase tracking-wider">
                            Autunno
                          </span>
                        </div>

                        <div
                          className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${
                            seasons.inverno
                              ? 'bg-gradient-to-b from-indigo-500/25 to-transparent text-indigo-300 border border-indigo-400/30'
                              : 'opacity-25 text-[#B8A9C9]'
                          }`}
                        >
                          <Snowflake className="h-4 w-4" />
                          <span className="font-mono text-[9px] uppercase tracking-wider">
                            Inverno
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <button
                        onClick={() => setDeleteConfirmId(selectedProfumo.id)}
                        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Rimuovi</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedProfumo(null);
                          setIsEditing(false);
                        }}
                        style={{ backgroundColor: modalAura.primary }}
                        className="rounded-full px-6 py-2.5 text-xs font-bold text-[#140D1C] transition hover:opacity-90"
                      >
                        Chiudi
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/30 bg-[#1E1428] p-6 text-[#F6EFE4] space-y-4 shadow-2xl">
            <h3 className="font-serif text-xl text-[#F6EFE4]">
              Rimuovere questa creazione?
            </h3>
            <p className="text-xs text-[#B8A9C9]">
              Il flacone verrà rimosso definitivamente dall&apos;Atelier.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-red-500"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
