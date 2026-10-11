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
  CheckCircle2,
  RefreshCw,
  Compass,
  ShieldCheck,
  X,
  Award,
  Flame,
  Wind,
  Layers,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';

function CollezioneContent() {
  const searchParams = useSearchParams();
  const initialVista = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';
  const initialSearch = searchParams.get('search') || '';

  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'collezione' | 'radar'>(initialVista);

  // Ricerca Istantanea & Sommelier AI
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[] | null>(null);
  const [aiMotivazioni, setAiMotivazioni] = useState<Record<string, string>>({});

  // Stato per "✨ Arricchisci con AI" su singolo profumo
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // Modale Scheda Tecnica / Dual-Test (Mouche vs Pelle)
  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  // Modale Scent Tracker ("Indossa Oggi")
  const [wearProfumo, setWearProfumo] = useState<Profumo | null>(null);
  const [momentoGiornata, setMomentoGiornata] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>('Sera');
  const [contestoOutfit, setContestoOutfit] = useState('');
  const [noteGiorno, setNoteGiorno] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  // Modale Eliminazione elegante
  const [deleteTarget, setDeleteTarget] = useState<Profumo | null>(null);

  // Banner celebrativo promozione Radar -> Collezione
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);

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
      // ZERO-TRUST FETCH: Scarichiamo tutti i record senza .eq('stato', 'collezione')
      // così i 40 profumi con stato NULL sono SEMPRE visibili!
      const { data, error } = await supabase
        .from('profumi')
        .select('*')
        .order('created_at', { ascending: false });

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

  const filteredList = useMemo(() => {
    let base = activeList;

    // Se è attivo un filtro del Sommelier AI, mostriamo i consigliati nell'ordine suggerito
    if (aiRecommendedIds && aiRecommendedIds.length > 0) {
      const map = new Map(base.map((p) => [p.id, p]));
      const ordered = aiRecommendedIds.map((id) => map.get(id)).filter(Boolean) as Profumo[];
      if (ordered.length > 0) return ordered;
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter((p) => {
      const haystack = [
        p.nome,
        p.brand,
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
  }, [activeList, searchQuery, aiRecommendedIds]);

  // Chiamata al Sommelier AI Semantico (/api/search)
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
      if (!res.ok) throw new Error(data.error || 'Errore Sommelier AI');

      setAiAdvice(data.sommelierAdvice || null);
      setAiRecommendedIds(data.recommendedIds || []);
      setAiMotivazioni(data.motivazioniPerProfumo || {});
    } catch (err: any) {
      alert(err?.message || 'Errore durante la consultazione del Sommelier AI.');
    } finally {
      setAiLoading(false);
    }
  }

  function resetAiFilter() {
    setAiAdvice(null);
    setAiRecommendedIds(null);
    setAiMotivazioni({});
  }

  // Pulsante "✨ Arricchisci / Correggi con AI" per i 40 profumi già presenti
  async function handleEnrichWithAI(p: Profumo) {
    setEnrichingId(p.id);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: p.brand, nome: p.nome }),
      });
      const aiData = await res.json();
      if (!res.ok) throw new Error(aiData.error || 'Errore arricchimento AI');

      const updatePayload: Partial<Profumo> = {
        concentrazione: aiData.concentrazione || p.concentrazione,
        famiglia_olfattiva: aiData.famiglia_olfattiva || p.famiglia_olfattiva,
        note_testa: aiData.note_testa || p.note_testa,
        note_cuore: aiData.note_cuore || p.note_cuore,
        note_fondo: aiData.note_fondo || p.note_fondo,
        note_olfattive: aiData.note_olfattive || p.note_olfattive,
        descrizione_ai: aiData.descrizione_ai || p.descrizione_ai,
        prezzo_stimato_euro: aiData.prezzo_stimato_euro || p.prezzo_stimato_euro,
        stagione_ideale: aiData.stagione_ideale || p.stagione_ideale,
        occasione_ideale: aiData.occasione_ideale || p.occasione_ideale,
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
        // Fallback ultra-sicuro se alcune colonne estese non sono ancora state aggiunte via SQL
        await supabase
          .from('profumi')
          .update({
            famiglia_olfattiva: updatePayload.famiglia_olfattiva,
            note_olfattive: updatePayload.note_olfattive,
          })
          .eq('id', p.id);
      }

      setProfumi((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...updatePayload } : item))
      );
      setCelebrationMsg(`✨ "${p.nome}" arricchito con successo dal Sommelier AI!`);
      setTimeout(() => setCelebrationMsg(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Errore durante l\'arricchimento AI.');
    } finally {
      setEnrichingId(null);
    }
  }

  // Salvataggio modifiche dalla Modale Scheda Tecnica (Mouche vs Pelle, Metriche, Prezzo)
  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumo) return;
    setSavingDetail(true);

    try {
      const payload = {
        nome: selectedProfumo.nome,
        brand: selectedProfumo.brand,
        concentrazione: selectedProfumo.concentrazione,
        famiglia_olfattiva: selectedProfumo.famiglia_olfattiva,
        note_testa: selectedProfumo.note_testa,
        note_cuore: selectedProfumo.note_cuore,
        note_fondo: selectedProfumo.note_fondo,
        note_olfattive:
          selectedProfumo.note_olfattive || getUnifiedNotes(selectedProfumo),
        descrizione_ai: selectedProfumo.descrizione_ai,
        prezzo_stimato_euro: selectedProfumo.prezzo_stimato_euro,
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
    } catch (err: any) {
      alert(
        `Errore salvataggio: ${err?.message}. Assicurati di aver eseguito lo script SQL dello Step 4 su Supabase.`
      );
    } finally {
      setSavingDetail(false);
    }
  }

  // Promozione istantanea dal Radar alla Collezione Privata
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
      setCelebrationMsg(
        `🥂 Complimenti Luca! "${p.nome}" di ${p.brand} è stato promosso nella tua Collezione Privata!`
      );
      setTimeout(() => setCelebrationMsg(null), 5000);
    } catch (err: any) {
      alert(err?.message || 'Errore durante la promozione del profumo.');
    }
  }

  // Registrazione Indosso del Giorno (Scent Tracker)
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

      setCelebrationMsg(
        `⌚ Scent of the Day registrato: "${wearProfumo.nome}" (${momentoGiornata}).`
      );
      setWearProfumo(null);
      setContestoOutfit('');
      setNoteGiorno('');
      setTimeout(() => setCelebrationMsg(null), 4000);
    } catch (err: any) {
      alert(
        `Errore registrazione indosso: ${err?.message}. Esegui lo script SQL dello Step 4 per abilitare la tabella indossi.`
      );
    } finally {
      setSavingWear(false);
    }
  }

  // Eliminazione confermata
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
      {/* TOP BAR & SWITCHER COLLEZIONE / RADAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 transition"
            title="Torna alla Hall"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#C5A059]">
              Boutique Olfattiva di Luca
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-white">
              {vista === 'collezione'
                ? `Private Olfactory Vault (${collezioneList.length})`
                : `Radar Boutique — Mouche vs. Pelle (${radarList.length})`}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Switcher Dual-World: Collezione vs Radar */}
          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20">
            <button
              onClick={() => {
                setVista('collezione');
                resetAiFilter();
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                vista === 'collezione'
                  ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Collezione ({collezioneList.length})</span>
            </button>
            <button
              onClick={() => {
                setVista('radar');
                resetAiFilter();
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                vista === 'radar'
                  ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Radar Test ({radarList.length})</span>
            </button>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-xs font-mono uppercase tracking-wider shadow-champagne-glow hover:opacity-95 transition"
          >
            <ScanLine className="w-4 h-4" />
            <span>+ Aggiungi con AI</span>
          </Link>
        </div>
      </div>

      {/* BANNER CELEBRATIVO */}
      {celebrationMsg && (
        <div className="mt-6 p-4 rounded-xl bg-[#C5A059]/20 border border-[#F7E7CE]/50 text-[#F7E7CE] flex items-center justify-between text-sm">
          <span>{celebrationMsg}</span>
          <button onClick={() => setCelebrationMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BARRA DI RICERCA DUAL-MODE (ISTANTANEA + SOMMELIER AI SEMANTICO) */}
      <section className="mt-6 boutique-glass rounded-2xl p-4 sm:p-5">
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
              placeholder="Cerca per nome/nota (es. 'Pazzaglia', 'Oud') oppure descrivi l'occasione al Sommelier AI (es. 'Cena d'autunno in abito scuro, voglio qualcosa di magnetico')..."
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#F7E7CE]"
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
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm shadow-champagne-glow hover:opacity-95 transition disabled:opacity-40 shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Il Sommelier riflette...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>✨ Chiedi al Sommelier AI</span>
              </>
            )}
          </button>
        </div>

        {/* RISPOSTA DEL SOMMELIER AI */}
        {aiAdvice && (
          <div className="mt-4 p-5 rounded-xl bg-[#08080A]/95 border border-[#C5A059]/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Consiglio del Sommelier Olfattivo
              </span>
              <button
                onClick={resetAiFilter}
                className="text-xs font-mono text-zinc-400 hover:text-[#F7E7CE]"
              >
                Mostra tutti ({activeList.length})
              </button>
            </div>
            <p className="text-sm text-[#F7E7CE] leading-relaxed italic">
              &ldquo;{aiAdvice}&rdquo;
            </p>
          </div>
        )}
      </section>

      {/* GRIGLIA DELLE FRAGRANZE */}
      <section className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-72 rounded-2xl boutique-glass animate-pulse p-6"
              />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="boutique-glass rounded-2xl p-12 text-center space-y-4">
            <p className="font-serif text-2xl text-white">
              {vista === 'collezione'
                ? 'Nessun profumo corrisponde ai filtri attuali'
                : 'Il tuo Radar Boutique è pronto per nuovi test su Mouche e Pelle'}
            </p>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {vista === 'collezione'
                ? 'Prova a cancellare il testo di ricerca oppure aggiungi una nuova fragranza con lo Scanner AI.'
                : 'Quando provi un profumo in boutique, salvalo nel Radar per annotare l\'apertura su Mouche e l\'evoluzione su Pelle.'}
            </p>
            <Link
              href="/scanner"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm"
            >
              <ScanLine className="w-4 h-4" />
              <span>Aggiungi Profumo con AI</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((p) => {
              const unifiedNotes = getUnifiedNotes(p);
              const aiReason = aiMotivazioni[p.id];
              const isEnriching = enrichingId === p.id;

              return (
                <article
                  key={p.id}
                  className="boutique-glass boutique-glass-hover rounded-2xl p-6 flex flex-col justify-between relative group"
                >
                  <div>
                    {/* Top Row: Brand & Prezzo/Concentrazione */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] font-medium">
                        {p.brand || 'Maison Artistica'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.concentrazione && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 border border-white/10">
                            {p.concentrazione}
                          </span>
                        )}
                        {p.prezzo_stimato_euro && (
                          <span className="px-2.5 py-0.5 rounded font-mono text-xs bg-[#C5A059]/20 text-[#F7E7CE] border border-[#F7E7CE]/25">
                            {String(p.prezzo_stimato_euro).startsWith('€')
                              ? p.prezzo_stimato_euro
                              : `€${p.prezzo_stimato_euro}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nome Fragranza in Serif */}
                    <h2 className="font-serif text-2xl text-white font-semibold mt-1.5 tracking-tight">
                      {p.nome}
                    </h2>

                    {/* Badge Famiglia & Stagione */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {p.famiglia_olfattiva && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#F7E7CE]/10 text-[#F7E7CE] border border-[#F7E7CE]/20">
                          {p.famiglia_olfattiva}
                        </span>
                      )}
                      {p.stagione_ideale && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 text-zinc-400 border border-white/10">
                          {p.stagione_ideale}
                        </span>
                      )}
                    </div>

                    {/* Motivazione Sommelier AI (se attivo filtro AI) */}
                    {aiReason && (
                      <div className="mt-3 p-3 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-xs text-[#F7E7CE] italic">
                        ✨ {aiReason}
                      </div>
                    )}

                    {/* Piramide Olfattiva o Note Unificate */}
                    <div className="mt-4 space-y-1.5 text-xs">
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
                      ) : (
                        <p className="text-zinc-500 italic py-2">
                          Piramide olfattiva non ancora completata. Clicca su &ldquo;✨ AI&rdquo; qui sotto per compilarla automaticamente!
                        </p>
                      )}
                    </div>

                    {/* Box Dual-Testing Mouche vs Pelle (se compilato o in vista Radar) */}
                    {(vista === 'radar' || p.note_mouche || p.note_pelle) && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-[#F7E7CE]/15">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059] block">
                            Su Mouche (Carta)
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_mouche || 'Non annotato'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-[#F7E7CE]/15">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059] block">
                            Su Pelle (Chimica)
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_pelle || 'Non annotato'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Mini Barre Performance (Longevità / Scia / Proiezione) */}
                    {(p.voto_longevita || p.voto_scia || p.voto_proiezione) && (
                      <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-[#F7E7CE]/10">
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>LONG</span>
                            <span className="text-[#F7E7CE]">{p.voto_longevita || '-'}</span>
                          </div>
                          <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#C5A059] to-[#F7E7CE]"
                              style={{ width: `${(p.voto_longevita || 0) * 10}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>SCIA</span>
                            <span className="text-[#F7E7CE]">{p.voto_scia || '-'}</span>
                          </div>
                          <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#C5A059] to-[#F7E7CE]"
                              style={{ width: `${(p.voto_scia || 0) * 10}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>PROIEZ</span>
                            <span className="text-[#F7E7CE]">{p.voto_proiezione || '-'}</span>
                          </div>
                          <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#C5A059] to-[#F7E7CE]"
                              style={{ width: `${(p.voto_proiezione || 0) * 10}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AZIONI SULLA CARD */}
                  <div className="mt-5 pt-3 border-t border-[#F7E7CE]/15 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* 1. Pulsante Arricchisci con AI */}
                      <button
                        onClick={() => handleEnrichWithAI(p)}
                        disabled={isEnriching}
                        title="Completa o arricchisci automaticamente piramide olfattiva, prezzo e metriche con l'AI"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C5A059]/15 hover:bg-[#C5A059]/30 text-[#F7E7CE] border border-[#F7E7CE]/25 font-mono text-[11px] transition"
                      >
                        {isEnriching ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                        )}
                        <span>{isEnriching ? 'AI...' : '✨ AI'}</span>
                      </button>

                      {/* 2. Pulsante Scheda Tecnica / Mouche & Pelle */}
                      <button
                        onClick={() => setSelectedProfumo({ ...p })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] transition"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Scheda / Test</span>
                      </button>

                      {/* 3. Pulsante Indossa Oggi */}
                      <button
                        onClick={() => setWearProfumo(p)}
                        title="Registra Indosso del Giorno"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] transition"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Indossa</span>
                      </button>
                    </div>

                    {/* 4. Elimina */}
                    <button
                      onClick={() => setDeleteTarget(p)}
                      title="Rimuovi dal Vault"
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

      {/* MODALE 1: SCHEDA TECNICA COMPLETA & DUAL-TEST (MOUCHE VS PELLE) */}
      {selectedProfumo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="boutique-glass rounded-2xl max-w-2xl w-full p-6 sm:p-8 border border-[#F7E7CE]/30 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#F7E7CE]/15">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-[#C5A059]">
                  Laboratorio Sensoriale &amp; Archivio
                </p>
                <h3 className="font-serif text-2xl text-white mt-0.5">
                  {selectedProfumo.nome} — {selectedProfumo.brand}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProfumo(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDetails} className="space-y-5 mt-5">
              {/* Se è nel Radar, bottone rapido per promuoverlo in Collezione */}
              {isRadarProfumo(selectedProfumo) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#C5A059]/20 to-[#F7E7CE]/10 border border-[#F7E7CE]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#F7E7CE]">
                      Questo profumo è attualmente nel Radar Test
                    </p>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Hai acquistato il flacone? Promuovilo nel tuo Vault principale!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePromoteToCollection(selectedProfumo)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-xs font-mono uppercase tracking-wider shrink-0"
                  >
                    🥂 Promuovi in Collezione
                  </button>
                </div>
              )}

              {/* Dati Base */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                    Brand / Maison
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.brand || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, brand: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                    Nome Profumo
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.nome || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, nome: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                    Prezzo Stimato (€)
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
                    placeholder="es. €185"
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                    Famiglia Olfattiva
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.famiglia_olfattiva || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        famiglia_olfattiva: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
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
                    placeholder="Extrait de Parfum"
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                    Posizione
                  </label>
                  <select
                    value={isRadarProfumo(selectedProfumo) ? 'radar' : 'collezione'}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, stato: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-sm text-white"
                  >
                    <option value="collezione">Collezione Privata (Posseduto)</option>
                    <option value="radar">Radar Boutique (In Test / Wishlist)</option>
                  </select>
                </div>
              </div>

              {/* DUAL-TESTING: MOUCHE VS PELLE */}
              <div className="p-4 rounded-xl bg-[#08080A]/90 border border-[#C5A059]/30 space-y-4">
                <p className="font-mono text-xs uppercase tracking-widest text-[#F7E7CE]">
                  🔬 Dual-Testing: Impressione su Mouche vs. Evoluzione su Pelle
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] text-[#C5A059] mb-1">
                      Su Mouche (Cartoncino — Apertura Tecnica)
                    </label>
                    <textarea
                      rows={3}
                      value={selectedProfumo.note_mouche || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_mouche: e.target.value,
                        })
                      }
                      placeholder="Impressione iniziale, pulizia delle note di testa..."
                      className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-[#C5A059] mb-1">
                      Su Pelle (Drydown dopo 4h+ — Reazione col tuo pH)
                    </label>
                    <textarea
                      rows={3}
                      value={selectedProfumo.note_pelle || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_pelle: e.target.value,
                        })
                      }
                      placeholder="Come evolve col calore della tua pelle, persistenza reale..."
                      className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-3 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* SLIDER METRICHE PERFORMANCE (1-10) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#08080A]/70 border border-[#F7E7CE]/15">
                {[
                  { key: 'voto_longevita', label: 'Longevità' },
                  { key: 'voto_scia', label: 'Scia (Sillage)' },
                  { key: 'voto_proiezione', label: 'Proiezione' },
                  { key: 'voto_complessita', label: 'Complessità' },
                ].map(({ key, label }) => {
                  const val = Number((selectedProfumo as any)[key] ?? 8);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-zinc-400">{label}</span>
                        <span className="text-[#F7E7CE]">{val}/10</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={val}
                        onChange={(e) =>
                          setSelectedProfumo({
                            ...selectedProfumo,
                            [key]: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#C5A059]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Piramide Olfattiva Editabile */}
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

              <div className="flex justify-end gap-3 pt-4 border-t border-[#F7E7CE]/15">
                <button
                  type="button"
                  onClick={() => setSelectedProfumo(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-zinc-300 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm shadow-champagne-glow"
                >
                  {savingDetail ? 'Salvataggio...' : 'Salva Scheda nel Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE 2: SCENT TRACKER ("⌚ INDOSSA OGGI") */}
      {wearProfumo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-[#F7E7CE]/30 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                  Diario Olfattivo &amp; Scent Tracker
                </p>
                <h3 className="font-serif text-2xl text-white mt-0.5">
                  Indossa {wearProfumo.nome}
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
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-2">
                  Momento della Giornata
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
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Contesto / Outfit
                </label>
                <input
                  type="text"
                  value={contestoOutfit}
                  onChange={(e) => setContestoOutfit(e.target.value)}
                  placeholder="Es. Cena elegante, Giacca scura, Aperitivo in centro..."
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-[#C5A059] mb-1">
                  Sensazioni &amp; Note del Giorno
                </label>
                <textarea
                  rows={3}
                  value={noteGiorno}
                  onChange={(e) => setNoteGiorno(e.target.value)}
                  placeholder="Quanti spruzzi, reazione sulla pelle oggi, complimenti ricevuti..."
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-3 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWearProfumo(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingWear}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold text-sm"
                >
                  {savingWear ? 'Registrazione...' : '⌚ Registra Indosso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE 3: CONFERMA ELIMINAZIONE ELEGANTE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-red-500/30 space-y-4">
            <h3 className="font-serif text-xl text-white">
              Rimuovere &ldquo;{deleteTarget.nome}&rdquo; dal Vault?
            </h3>
            <p className="text-sm text-zinc-400">
              Stai per eliminare definitivamente <strong>{deleteTarget.nome}</strong> di{' '}
              <strong>{deleteTarget.brand}</strong> dal tuo archivio.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm"
              >
                Elimina Definitivamente
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
        <div className="min-h-screen flex items-center justify-center text-[#F7E7CE] font-mono text-sm">
          Apertura del Private Olfactory Vault in corso...
        </div>
      }
    >
      <CollezioneContent />
    </Suspense>
  );
}
