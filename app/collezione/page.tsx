'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Search,
  ScanLine,
  SlidersHorizontal,
  Clock,
  Trash2,
  RefreshCw,
  Compass,
  ShieldCheck,
  X,
  LayoutGrid,
  List,
  FlaskConical,
  Globe,
  Droplets,
  Check,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
  parsePrezzoEuro,
} from '@/lib/supabase';

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
] as const;

function normalizeToPureFamily(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Non classificata';
  for (const pure of PURE_FAMILIES) {
    if (s === pure.toLowerCase()) return pure;
  }
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('pulit') || s.includes('talc') || s.includes('mineral')) return 'Muschiata';
  if (s.includes('speziat')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('esperid')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('oriental') || s.includes('incens') || s.includes('resin')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger') || s.includes('fougèr')) return 'Aromatica';
  if (s.includes('legnos') || s.includes('bois') || s.includes('chypre') || s.includes('oud')) return 'Legnosa';
  return 'Legnosa';
}

function CollezioneContent() {
  const searchParams = useSearchParams();
  const initialVista = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';
  const initialSearch = searchParams.get('search') || '';

  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'collezione' | 'radar'>(initialVista);
  const [layoutMode, setLayoutMode] = useState<'dettagli' | 'vetrina'>('dettagli');

  const [selectedFamily, setSelectedFamily] = useState<string>('Tutte');
  const [normalizingDb, setNormalizingDb] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[] | null>(null);
  const [aiMotivazioni, setAiMotivazioni] = useState<Record<string, string>>({});

  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);
  const [officialUrlInput, setOfficialUrlInput] = useState('');
  const [modalExtracting, setModalExtracting] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  const [wearProfumo, setWearProfumo] = useState<Profumo | null>(null);
  const [momentoGiornata, setMomentoGiornata] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>('Mattina');
  const [contestoOutfit, setContestoOutfit] = useState('Ufficio');
  const [noteGiorno, setNoteGiorno] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Profumo | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    const savedLayout = localStorage.getItem('boutique_layout_mode');
    if (savedLayout === 'vetrina' || savedLayout === 'dettagli') {
      setLayoutMode(savedLayout);
    }
  }, []);

  function changeLayoutMode(mode: 'dettagli' | 'vetrina') {
    setLayoutMode(mode);
    localStorage.setItem('boutique_layout_mode', mode);
  }

  useEffect(() => {
    const v = searchParams.get('vista');
    if (v === 'radar') setVista('radar');
    else if (v === 'collezione') setVista('collezione');
  }, [searchParams]);

  useEffect(() => {
    fetchProfumi();
  }, []);

  async function fetchProfumi() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profumi')
        .select('*')
        .order('brand', { ascending: true });

      if (error) throw error;
      setProfumi((data || []) as Profumo[]);
    } catch (err) {
      console.error('Errore caricamento collezione:', err);
    } finally {
      setLoading(false);
    }
  }

  const collezioneList = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radarList = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);
  const activeList = vista === 'collezione' ? collezioneList : radarList;

  // Statistiche interne della vista attiva (Valore stimato + Conteggio per le 12 Famiglie Pure)
  const archiveStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalEuro = 0;
    let hasLegacyLabels = false;

    activeList.forEach((p) => {
      const rawFam = (p.famiglia_olfattiva || '').trim();
      const pure = normalizeToPureFamily(rawFam);
      if (rawFam && !(PURE_FAMILIES as readonly string[]).includes(rawFam)) {
        hasLegacyLabels = true;
      }
      counts[pure] = (counts[pure] || 0) + 1;

      const val = parsePrezzoEuro(p);
      if (val > 0) totalEuro += val;
    });

    const sortedPureFamilies = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return {
      totalEuro: Math.round(totalEuro),
      sortedPureFamilies,
      hasLegacyLabels,
    };
  }, [activeList]);

  // Allinea definitivamente su Supabase le vecchie 36 etichette alle 12 Famiglie Pure con 1 click
  async function handleNormalizeAllDatabaseFamilies() {
    setNormalizingDb(true);
    try {
      const updates = profumi.map(async (p) => {
        const pure = normalizeToPureFamily(p.famiglia_olfattiva);
        if (p.famiglia_olfattiva !== pure) {
          await supabase
            .from('profumi')
            .update({ famiglia_olfattiva: pure })
            .eq('id', p.id);
        }
        return { ...p, famiglia_olfattiva: pure };
      });

      const updatedList = await Promise.all(updates);
      setProfumi(updatedList);
      setStatusBanner('Tutte le fragranze sono state allineate alle 12 Famiglie Pure.');
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore normalizzazione famiglie.');
    } finally {
      setNormalizingDb(false);
    }
  }

  const filteredList = useMemo(() => {
    let base = activeList;

    if (selectedFamily !== 'Tutte') {
      base = base.filter(
        (p) => normalizeToPureFamily(p.famiglia_olfattiva) === selectedFamily
      );
    }

    if (aiRecommendedIds && aiRecommendedIds.length > 0) {
      const map = new Map(base.map((p) => [p.id, p]));
      const ordered = aiRecommendedIds.map((id) => map.get(id)).filter(Boolean) as Profumo[];
      if (ordered.length > 0) return ordered;
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter((p) => {
      const pureFam = normalizeToPureFamily(p.famiglia_olfattiva);
      const haystack = [
        p.nome,
        p.brand,
        pureFam,
        p.famiglia_olfattiva,
        p.note_testa,
        p.note_cuore,
        p.note_fondo,
        p.note_olfattive,
        p.stagione_ideale,
        p.occasione_ideale,
        p.note_mouche,
        p.note_pelle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeList, selectedFamily, searchQuery, aiRecommendedIds]);

  async function handleAskSommelier() {
    if (!searchQuery.trim()) return;
    setAiLoading(true);
    setAiAdvice(null);
    setAiRecommendedIds(null);
    setAiMotivazioni({});

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          profumi: activeList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore ricerca AI');

      setAiAdvice(data.sommelierAdvice || null);
      setAiRecommendedIds(data.recommendedIds || []);
      setAiMotivazioni(data.motivazioniPerProfumo || {});
    } catch (err: any) {
      alert(err?.message || 'Errore durante la consultazione AI.');
    } finally {
      setAiLoading(false);
    }
  }

  function resetAiFilter() {
    setAiAdvice(null);
    setAiRecommendedIds(null);
    setAiMotivazioni({});
  }

  async function handleEnrichWithAI(p: Profumo) {
    setEnrichingId(p.id);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: p.brand, nome: p.nome }),
      });
      const aiData = await res.json();
      if (!res.ok) throw new Error(aiData.error || 'Errore verifica AI');

      const pureFam = normalizeToPureFamily(aiData.famiglia_olfattiva || p.famiglia_olfattiva);

      const updatePayload: Partial<Profumo> = {
        nome: aiData.nome || p.nome,
        brand: aiData.brand || p.brand,
        concentrazione: aiData.concentrazione || p.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: aiData.note_testa || p.note_testa,
        note_cuore: aiData.note_cuore || p.note_cuore,
        note_fondo: aiData.note_fondo || p.note_fondo,
        note_olfattive: aiData.note_olfattive || p.note_olfattive,
        descrizione_ai: aiData.descrizione_ai || p.descrizione_ai,
        prezzo_stimato_euro: aiData.prezzo_stimato_euro || p.prezzo_stimato_euro,
        stagione_ideale: aiData.stagione_ideale || p.stagione_ideale,
        occasione_ideale: aiData.occasione_ideale || p.occasione_ideale,
        url_foto_vetrina: p.url_foto_vetrina || aiData.url_foto_vetrina || null,
        voto_longevita: p.voto_longevita ?? aiData.voto_longevita,
        voto_scia: p.voto_scia ?? aiData.voto_scia,
        voto_proiezione: p.voto_proiezione ?? aiData.voto_proiezione,
        voto_complessita: p.voto_complessita ?? aiData.voto_complessita,
      };

      const { error } = await supabase
        .from('profumi')
        .update(updatePayload)
        .eq('id', p.id);

      if (error) {
        await supabase
          .from('profumi')
          .update({
            nome: updatePayload.nome,
            brand: updatePayload.brand,
            famiglia_olfattiva: pureFam,
            note_olfattive: updatePayload.note_olfattive,
          })
          .eq('id', p.id);
      }

      setProfumi((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...updatePayload } : item))
      );
      setStatusBanner(`Aggiornato: ${updatePayload.brand} - ${updatePayload.nome}`);
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore verifica AI.');
    } finally {
      setEnrichingId(null);
    }
  }

  async function handleModalExtractFromOfficial() {
    if (!selectedProfumo) return;
    setModalExtracting(true);
    try {
      const payload = officialUrlInput.trim().startsWith('http')
        ? { url: officialUrlInput.trim() }
        : { brand: selectedProfumo.brand, nome: selectedProfumo.nome };

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const aiData = await res.json();
      if (!res.ok) throw new Error(aiData.error || 'Errore estrazione dati');

      const pureFam = normalizeToPureFamily(
        aiData.famiglia_olfattiva || selectedProfumo.famiglia_olfattiva
      );

      setSelectedProfumo({
        ...selectedProfumo,
        nome: aiData.nome || selectedProfumo.nome,
        brand: aiData.brand || selectedProfumo.brand,
        concentrazione: aiData.concentrazione || selectedProfumo.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: aiData.note_testa || selectedProfumo.note_testa,
        note_cuore: aiData.note_cuore || selectedProfumo.note_cuore,
        note_fondo: aiData.note_fondo || selectedProfumo.note_fondo,
        note_olfattive: aiData.note_olfattive || selectedProfumo.note_olfattive,
        descrizione_ai: aiData.descrizione_ai || selectedProfumo.descrizione_ai,
        prezzo_stimato_euro: aiData.prezzo_stimato_euro || selectedProfumo.prezzo_stimato_euro,
        stagione_ideale: aiData.stagione_ideale || selectedProfumo.stagione_ideale,
        occasione_ideale: aiData.occasione_ideale || selectedProfumo.occasione_ideale,
        url_foto_vetrina: aiData.url_foto_vetrina || selectedProfumo.url_foto_vetrina,
        voto_longevita: aiData.voto_longevita ?? selectedProfumo.voto_longevita,
        voto_scia: aiData.voto_scia ?? selectedProfumo.voto_scia,
        voto_proiezione: aiData.voto_proiezione ?? selectedProfumo.voto_proiezione,
        voto_complessita: aiData.voto_complessita ?? selectedProfumo.voto_complessita,
      });
      setOfficialUrlInput('');
    } catch (err: any) {
      alert(err?.message || 'Impossibile estrarre i dati.');
    } finally {
      setModalExtracting(false);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumo) return;
    setSavingDetail(true);

    try {
      const pureFam = normalizeToPureFamily(selectedProfumo.famiglia_olfattiva);
      const payload = {
        nome: selectedProfumo.nome,
        brand: selectedProfumo.brand,
        concentrazione: selectedProfumo.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: selectedProfumo.note_testa,
        note_cuore: selectedProfumo.note_cuore,
        note_fondo: selectedProfumo.note_fondo,
        note_olfattive:
          selectedProfumo.note_olfattive || getUnifiedNotes(selectedProfumo),
        descrizione_ai: selectedProfumo.descrizione_ai,
        prezzo_stimato_euro: selectedProfumo.prezzo_stimato_euro,
        url_foto_vetrina: selectedProfumo.url_foto_vetrina || null,
        stato: selectedProfumo.stato || 'collezione',
        note_mouche: selectedProfumo.note_mouche,
        note_pelle: selectedProfumo.note_pelle,
        voto_longevita: selectedProfumo.voto_longevita,
        voto_scia: selectedProfumo.voto_scia,
        voto_proiezione: selectedProfumo.voto_proiezione,
        voto_complessita: selectedProfumo.voto_complessita,
        stagione_ideale: selectedProfumo.stagione_ideale,
        occasione_ideale: selectedProfumo.occasione_ideale,
      };

      const { error } = await supabase
        .from('profumi')
        .update(payload)
        .eq('id', selectedProfumo.id);

      if (error) throw error;

      setProfumi((prev) =>
        prev.map((item) =>
          item.id === selectedProfumo.id ? { ...item, ...payload } : item
        )
      );
      setSelectedProfumo(null);
      setStatusBanner(`Salvato: ${payload.brand} - ${payload.nome}`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(`Errore salvataggio: ${err?.message}`);
    } finally {
      setSavingDetail(false);
    }
  }

  async function handlePromoteToCollection(p: Profumo) {
    try {
      const { error } = await supabase
        .from('profumi')
        .update({ stato: 'collezione' })
        .eq('id', p.id);

      if (error) throw error;

      setProfumi((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, stato: 'collezione' } : item))
      );
      setSelectedProfumo(null);
      setVista('collezione');
      setStatusBanner(`${p.nome} spostato in Collezione.`);
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore spostamento.');
    }
  }

  async function handleRecordWear(e: React.FormEvent) {
    e.preventDefault();
    if (!wearProfumo) return;
    setSavingWear(true);

    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: wearProfumo.id,
          momento_giornata: momentoGiornata,
          contesto_outfit: contestoOutfit || null,
          note_giorno: noteGiorno || null,
        },
      ]);

      if (error) throw error;

      setStatusBanner(`Indosso registrato: ${wearProfumo.nome}`);
      setWearProfumo(null);
      setNoteGiorno('');
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(`Errore registrazione: ${err?.message}`);
    } finally {
      setSavingWear(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('profumi')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setProfumi((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err?.message || 'Errore eliminazione.');
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">
      {/* HEADER CON PRIVATE OLFACTORY + VALORE STIMATO DISCRETO */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 transition"
            title="Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#C5A059]">
              Private Olfactory
            </p>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl text-white">
                {vista === 'collezione'
                  ? `Collezione Privata (${collezioneList.length})`
                  : `Radar - Testing (${radarList.length})`}
              </h1>
              {vista === 'collezione' && archiveStats.totalEuro > 0 && (
                <span className="font-mono text-xs text-[#C5A059]">
                  Valore stimato: €{archiveStats.totalEuro.toLocaleString('it-IT')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20">
            <button
              type="button"
              onClick={() => changeLayoutMode('dettagli')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                layoutMode === 'dettagli'
                  ? 'bg-[#F7E7CE]/20 text-[#F7E7CE] border border-[#F7E7CE]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dettagli</span>
            </button>
            <button
              type="button"
              onClick={() => changeLayoutMode('vetrina')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                layoutMode === 'vetrina'
                  ? 'bg-[#F7E7CE]/20 text-[#F7E7CE] border border-[#F7E7CE]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vetrina</span>
            </button>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20">
            <button
              type="button"
              onClick={() => {
                setVista('collezione');
                setSelectedFamily('Tutte');
                resetAiFilter();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                vista === 'collezione'
                  ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Collezione ({collezioneList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVista('radar');
                setSelectedFamily('Tutte');
                resetAiFilter();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                vista === 'radar'
                  ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Testing ({radarList.length})</span>
            </button>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-xs font-mono uppercase tracking-wider shadow-champagne-glow hover:opacity-95 transition"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>+ Aggiungi</span>
          </Link>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-5 p-3 rounded-xl bg-[#C5A059]/20 border border-[#F7E7CE]/40 text-[#F7E7CE] flex items-center justify-between text-xs font-mono">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BARRA DI RICERCA + FILTRO PER LE 12 FAMIGLIE OLFATTIVE PURE */}
      <section className="mt-6 boutique-glass rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) resetAiFilter();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.split(' ').length >= 3) {
                  handleAskSommelier();
                }
              }}
              placeholder="Cerca profumo, brand, nota o chiedi a AI..."
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#F7E7CE]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  resetAiFilter();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleAskSommelier}
            disabled={aiLoading || !searchQuery.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-semibold uppercase tracking-wider hover:opacity-95 transition disabled:opacity-40 shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Ricerca...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chiedi a AI</span>
              </>
            )}
          </button>
        </div>

        {/* BARRA INTERATTIVA DELLE FAMIGLIE OLFATTIVE PURE */}
        {archiveStats.sortedPureFamilies.length > 0 && (
          <div className="pt-2 border-t border-[#F7E7CE]/10 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mr-1">
                <Droplets className="w-3 h-3" />
                <span>Famiglie ({archiveStats.sortedPureFamilies.length}):</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedFamily('Tutte')}
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition ${
                  selectedFamily === 'Tutte'
                    ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                    : 'bg-[#08080A] text-zinc-400 border border-[#F7E7CE]/15 hover:text-white'
                }`}
              >
                Tutte ({activeList.length})
              </button>

              {archiveStats.sortedPureFamilies.map(([fam, count]) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() =>
                    setSelectedFamily(selectedFamily === fam ? 'Tutte' : fam)
                  }
                  className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition ${
                    selectedFamily === fam
                      ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                      : 'bg-[#08080A] text-zinc-300 border border-[#F7E7CE]/15 hover:border-[#F7E7CE]/40'
                  }`}
                >
                  {fam} ({count})
                </button>
              ))}
            </div>

            {archiveStats.hasLegacyLabels && (
              <button
                type="button"
                onClick={handleNormalizeAllDatabaseFamilies}
                disabled={normalizingDb}
                title="Salva nel database le 12 Famiglie Pure al posto delle 36 vecchie combinazioni"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C5A059]/15 text-[#F7E7CE] border border-[#C5A059]/30 font-mono text-[10px] uppercase hover:bg-[#C5A059]/30 transition shrink-0"
              >
                {normalizingDb ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 text-[#C5A059]" />
                )}
                <span>Allinea DB (12 Famiglie)</span>
              </button>
            )}
          </div>
        )}

        {aiAdvice && (
          <div className="p-4 rounded-xl bg-[#08080A]/95 border border-[#C5A059]/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                Selezione AI
              </span>
              <button
                onClick={resetAiFilter}
                className="text-xs font-mono text-zinc-400 hover:text-[#F7E7CE]"
              >
                Mostra tutti ({activeList.length})
              </button>
            </div>
            <p className="text-xs text-[#F7E7CE] leading-relaxed">{aiAdvice}</p>
          </div>
        )}
      </section>

      {/* GRIGLIA FRAGRANZE */}
      <section className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 rounded-2xl boutique-glass animate-pulse p-6" />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="boutique-glass rounded-2xl p-12 text-center">
            <p className="font-serif text-xl text-white">Nessun profumo trovato</p>
          </div>
        ) : layoutMode === 'vetrina' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((p) => {
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfumo({
                      ...p,
                      famiglia_olfattiva: normalizeToPureFamily(p.famiglia_olfattiva),
                    });
                    setOfficialUrlInput('');
                  }}
                  className="boutique-glass boutique-glass-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between group text-center"
                >
                  <div className="w-full aspect-square rounded-xl bg-[#08080A] border border-[#F7E7CE]/10 flex items-center justify-center overflow-hidden relative mb-4">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.nome}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-600 group-hover:text-[#C5A059] transition">
                        <FlaskConical className="w-10 h-10 stroke-[1.2]" />
                      </div>
                    )}
                    {p.prezzo_stimato_euro && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded font-mono text-[10px] bg-[#08080A]/90 text-[#F7E7CE] border border-[#F7E7CE]/20">
                        {String(p.prezzo_stimato_euro).startsWith('€')
                          ? p.prezzo_stimato_euro
                          : `€${p.prezzo_stimato_euro}`}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059] truncate">
                      {p.brand}
                    </p>
                    <h2 className="font-serif text-lg text-white font-medium mt-0.5 line-clamp-1">
                      {p.nome}
                    </h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredList.map((p) => {
              const unifiedNotes = getUnifiedNotes(p);
              const aiReason = aiMotivazioni[p.id];
              const isEnriching = enrichingId === p.id;
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const pureFamily = normalizeToPureFamily(p.famiglia_olfattiva);

              return (
                <article
                  key={p.id}
                  className="boutique-glass boutique-glass-hover rounded-2xl p-5 flex flex-col justify-between relative group"
                >
                  <div>
                    <div className="flex items-start gap-3.5">
                      {imgUrl && (
                        <div
                          onClick={() => {
                            setSelectedProfumo({
                              ...p,
                              famiglia_olfattiva: pureFamily,
                            });
                            setOfficialUrlInput('');
                          }}
                          className="w-14 h-14 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer"
                        >
                          <img
                            src={imgUrl}
                            alt={p.nome}
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059] truncate">
                            {p.brand || 'Maison'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {p.concentrazione && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 border border-white/10">
                                {p.concentrazione}
                              </span>
                            )}
                            {p.prezzo_stimato_euro && (
                              <span className="px-2 py-0.5 rounded font-mono text-xs bg-[#C5A059]/20 text-[#F7E7CE] border border-[#F7E7CE]/25">
                                {String(p.prezzo_stimato_euro).startsWith('€')
                                  ? p.prezzo_stimato_euro
                                  : `€${p.prezzo_stimato_euro}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <h2 className="font-serif text-xl sm:text-2xl text-white font-semibold mt-1 tracking-tight">
                          {p.nome}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#F7E7CE]/10 text-[#F7E7CE] border border-[#F7E7CE]/20">
                        {pureFamily}
                      </span>
                      {p.stagione_ideale && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 text-zinc-400 border border-white/10">
                          {p.stagione_ideale}
                        </span>
                      )}
                    </div>

                    {aiReason && (
                      <div className="mt-3 p-2.5 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-xs text-[#F7E7CE]">
                        {aiReason}
                      </div>
                    )}

                    <div className="mt-3.5 text-xs">
                      {p.note_testa || p.note_cuore || p.note_fondo ? (
                        <div className="space-y-1 bg-[#08080A]/60 p-3 rounded-xl border border-[#F7E7CE]/10">
                          {p.note_testa && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#C5A059] mr-1.5">
                                Testa:
                              </span>
                              {p.note_testa}
                            </p>
                          )}
                          {p.note_cuore && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#C5A059] mr-1.5">
                                Cuore:
                              </span>
                              {p.note_cuore}
                            </p>
                          )}
                          {p.note_fondo && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#C5A059] mr-1.5">
                                Fondo:
                              </span>
                              {p.note_fondo}
                            </p>
                          )}
                        </div>
                      ) : unifiedNotes ? (
                        <p className="text-zinc-300 bg-[#08080A]/60 p-3 rounded-xl border border-[#F7E7CE]/10 line-clamp-3">
                          <span className="font-mono text-[10px] uppercase text-[#C5A059] mr-1.5">
                            Note:
                          </span>
                          {unifiedNotes}
                        </p>
                      ) : null}
                    </div>

                    {(vista === 'radar' || p.note_mouche || p.note_pelle) && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-[#F7E7CE]/15">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059] block">
                            Su Mouche
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_mouche || '-'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-[#F7E7CE]/15">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059] block">
                            Su Pelle
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_pelle || '-'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F7E7CE]/15 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEnrichWithAI(p)}
                        disabled={isEnriching}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#C5A059]/15 hover:bg-[#C5A059]/30 text-[#F7E7CE] border border-[#F7E7CE]/25 font-mono text-[11px] transition"
                      >
                        {isEnriching ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                        )}
                        <span>{isEnriching ? '...' : 'AI'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfumo({
                            ...p,
                            famiglia_olfattiva: pureFamily,
                          });
                          setOfficialUrlInput('');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] transition"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Scheda</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWearProfumo(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] transition"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Indossa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      title="Elimina"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALE 1: SCHEDA TECNICA CON SELETTORE DELLE 12 FAMIGLIE PURE */}
      {selectedProfumo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="boutique-glass rounded-2xl max-w-2xl w-full p-6 sm:p-7 border border-[#F7E7CE]/30 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#F7E7CE]/15">
              <div className="flex items-center gap-3.5">
                {selectedProfumo.url_foto_vetrina && (
                  <img
                    src={selectedProfumo.url_foto_vetrina}
                    alt={selectedProfumo.nome}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-14 h-14 rounded-xl bg-[#08080A] border border-[#F7E7CE]/25 object-contain p-1"
                  />
                )}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                    Scheda Tecnica
                  </p>
                  <h3 className="font-serif text-2xl text-white mt-0.5">
                    {selectedProfumo.nome} - {selectedProfumo.brand}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfumo(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-[#08080A] border border-[#C5A059]/30">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1.5">
                Aggiorna da Link
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={officialUrlInput}
                  onChange={(e) => setOfficialUrlInput(e.target.value)}
                  placeholder="URL pagina prodotto..."
                  className="flex-1 rounded-lg bg-[#0D0D11] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleModalExtractFromOfficial}
                  disabled={modalExtracting}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold hover:bg-[#C5A059] transition shrink-0"
                >
                  {modalExtracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Estrai</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDetails} className="space-y-4 mt-4">
              {isRadarProfumo(selectedProfumo) && (
                <div className="p-3 rounded-xl bg-[#C5A059]/15 border border-[#F7E7CE]/35 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-[#F7E7CE]">
                    In Testing
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePromoteToCollection(selectedProfumo)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F7E7CE] text-[#08080A] font-mono text-xs font-semibold uppercase"
                  >
                    Sposta in Collezione
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.brand || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, brand: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.nome || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, nome: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Prezzo (€)
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.prezzo_stimato_euro || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        prezzo_stimato_euro: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Famiglia Olfattiva (12 Pure)
                  </label>
                  <select
                    value={normalizeToPureFamily(selectedProfumo.famiglia_olfattiva)}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        famiglia_olfattiva: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  >
                    {PURE_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Concentrazione
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.concentrazione || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        concentrazione: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Archivio
                  </label>
                  <select
                    value={isRadarProfumo(selectedProfumo) ? 'radar' : 'collezione'}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, stato: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  >
                    <option value="collezione">Collezione Privata</option>
                    <option value="radar">Radar - Testing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  URL Immagine
                </label>
                <input
                  type="text"
                  value={selectedProfumo.url_foto_vetrina || ''}
                  onChange={(e) =>
                    setSelectedProfumo({
                      ...selectedProfumo,
                      url_foto_vetrina: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Note di Testa
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_testa || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_testa: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Note di Cuore
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_cuore || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_cuore: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Note di Fondo
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_fondo || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_fondo: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#08080A]/90 border border-[#C5A059]/25 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#F7E7CE]">
                  Test Olfattivo
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-[#C5A059] mb-1">
                      Su Mouche
                    </label>
                    <textarea
                      rows={2}
                      value={selectedProfumo.note_mouche || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_mouche: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[#C5A059] mb-1">
                      Su Pelle
                    </label>
                    <textarea
                      rows={2}
                      value={selectedProfumo.note_pelle || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_pelle: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#08080A]/70 border border-[#F7E7CE]/15">
                {[
                  { key: 'voto_longevita', label: 'Durata' },
                  { key: 'voto_scia', label: 'Scia' },
                  { key: 'voto_proiezione', label: 'Proiezione' },
                  { key: 'voto_complessita', label: 'Complessita' },
                ].map(({ key, label }) => {
                  const val = Number((selectedProfumo as any)[key] ?? 8);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="text-zinc-300">{label}</span>
                        <span className="text-[#F7E7CE] font-semibold">{val}/10</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() =>
                              setSelectedProfumo({
                                ...selectedProfumo,
                                [key]: step,
                              })
                            }
                            className={`h-2.5 rounded-sm transition ${
                              step <= val
                                ? step >= 8
                                  ? 'bg-[#F7E7CE]'
                                  : 'bg-[#C5A059]'
                                : 'bg-zinc-800 hover:bg-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#F7E7CE]/15">
                <button
                  type="button"
                  onClick={() => setSelectedProfumo(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs font-mono uppercase"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-semibold uppercase shadow-champagne-glow"
                >
                  {savingDetail ? '...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE 2: SCENT TRACKER */}
      {wearProfumo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-[#F7E7CE]/30 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                  Indosso
                </p>
                <h3 className="font-serif text-2xl text-white mt-0.5">
                  {wearProfumo.nome}
                </h3>
              </div>
              <button
                onClick={() => setWearProfumo(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordWear} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1.5">
                  Momento
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMomentoGiornata(m)}
                      className={`py-2 rounded-xl font-mono text-xs border transition ${
                        momentoGiornata === m
                          ? 'bg-[#F7E7CE] text-[#08080A] border-[#F7E7CE] font-semibold'
                          : 'bg-[#08080A] text-zinc-400 border-[#F7E7CE]/20'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Contesto
                </label>
                <select
                  value={contestoOutfit}
                  onChange={(e) => setContestoOutfit(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                >
                  <option value="Ufficio">Ufficio</option>
                  <option value="Aperitivo">Aperitivo</option>
                  <option value="Cena">Cena</option>
                  <option value="Serata">Serata</option>
                  <option value="Evento">Evento</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note
                </label>
                <textarea
                  rows={2}
                  value={noteGiorno}
                  onChange={(e) => setNoteGiorno(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWearProfumo(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs font-mono"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingWear}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-semibold"
                >
                  {savingWear ? '...' : 'Conferma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE 3: ELIMINAZIONE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-red-500/30 space-y-4">
            <h3 className="font-serif text-xl text-white">
              Eliminare {deleteTarget.nome}?
            </h3>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs font-mono"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CollezionePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#F7E7CE] font-mono text-xs">
          Caricamento...
        </div>
      }
    >
      <CollezioneContent />
    </Suspense>
  );
}
