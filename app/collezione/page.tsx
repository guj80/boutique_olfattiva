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

/**
 * COMPONENTE CORAZZato ANTI-CORS & ANTI-HOTLINK (3 LIVELLI)
 * 1. Tenta il caricamento diretto con referrerPolicy="no-referrer" (SENZA crossOrigin che innesca blocchi CORS).
 * 2. Se il server originale blocca comunque (es. Cloudflare/Fragrantica), passa automaticamente
 *    attraverso il tunnel proxy CDN globale wsrv.nl che aggira ogni blocco su mobile e PC.
 * 3. Se l'URL è proprio inesistente (404), mostra l'icona del flacone elegante.
 */
function SmartBottleImage({
  src,
  alt,
  className,
  iconSize = 'w-10 h-10',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center text-zinc-600 group-hover:text-[#C5A059] transition duration-300">
        <FlaskConical className={`${iconSize} stroke-[1.2]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === 'direct') {
          setStage('proxy');
        } else {
          setStage('failed');
        }
      }}
    />
  );
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
      setStatusBanner(`Aggiornato: ${updatePayload.brand} -${updatePayload.nome}`);
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
      const cleanImg = selectedProfumo.url_foto_vetrina?.trim() || null;

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
        url_foto_vetrina: cleanImg,
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
      setStatusBanner(`Salvato: ${payload.brand} -${payload.nome}`);
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
      if (selectedProfumo?.id === deleteTarget.id) {
        setSelectedProfumo(null);
      }
      setDeleteTarget(null);
      setStatusBanner(`Eliminato con successo.`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Errore eliminazione.');
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 hover:scale-105 active:scale-95 transition-all duration-200"
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
          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-white/10">
            <button
              type="button"
              onClick={() => changeLayoutMode('dettagli')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                layoutMode === 'dettagli'
                  ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dettagli</span>
            </button>
            <button
              type="button"
              onClick={() => changeLayoutMode('vetrina')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                layoutMode === 'vetrina'
                  ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vetrina</span>
            </button>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setVista('collezione');
                setSelectedFamily('Tutte');
                resetAiFilter();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                vista === 'collezione'
                  ? 'bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold'
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                vista === 'radar'
                  ? 'bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Testing ({radarList.length})</span>
            </button>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold text-xs font-mono uppercase tracking-wider shadow-champagne-glow hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>+ Aggiungi</span>
          </Link>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-5 p-3 rounded-xl bg-[#C5A059]/20 border border-[#F7E7CE]/40 text-[#F7E7CE] flex items-center justify-between text-xs font-mono animate-slide-up">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="hover:scale-110 transition-transform">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <section className="mt-6 boutique-glass rounded-2xl p-4 space-y-3.5 animate-fade-in delay-75">
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
              placeholder="Cerca un brand, una nota o descrivi un'atmosfera..."
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-[#08080A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF2A95] transition-all"
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Elaborazione...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chiedi al Sommelier</span>
              </>
            )}
          </button>
        </div>

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
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-
