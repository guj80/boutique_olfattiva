'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Link2,
  Camera,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Image as ImageIcon,
  Trash2,
  Search,
  FlaskConical,
} from 'lucide-react';
import { supabase, Profumo, getUnifiedNotes } from '@/lib/supabase';

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

export default function ScannerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'name' | 'photo' | 'url'>('name');

  // Riferimenti separati per Fotocamera e Galleria
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Input per le 3 modalità
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Scheda di Anteprima Editabile (Review Card)
  const [draft, setDraft] = useState<Partial<Profumo> | null>(null);
  const [modelSource, setModelSource] = useState<string>('');
  const [targetStato, setTargetStato] = useState<'collezione' | 'radar'>('collezione');

  // Compressione immagine lato client per evitare errori 413 Payload Too Large su Vercel
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;

        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h >= w && h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
          setImagePreview(compressedDataUrl);
          setImageMime('image/jpeg');
        }
      };
      if (typeof ev.target?.result === 'string') {
        img.src = ev.target.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleExtract(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (mode === 'url' && !inputUrl.trim()) {
      alert('Inserisci un link valido.');
      return;
    }
    if (mode === 'name' && !inputName.trim()) {
      alert('Inserisci Marchio e Nome del profumo.');
      return;
    }
    if (mode === 'photo' && !imagePreview) {
      alert('Scatta una foto o seleziona un\'immagine dalla Galleria.');
      return;
    }

    setExtracting(true);
    setDraft(null);

    try {
      const payload: Record<string, any> = {};
      if (mode === 'url') {
        payload.url = inputUrl.trim();
      } else if (mode === 'name') {
        payload.queryName = inputName.trim();
      } else if (mode === 'photo' && imagePreview) {
        payload.imageBase64 = imagePreview;
        payload.mimeType = imageMime;
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l\'estrazione dei dati.');
      }

      setModelSource(data._modelUsed || 'neural-engine');
      setDraft({
        nome: data.nome || '',
        brand: data.brand || '',
        concentrazione: data.concentrazione || 'Eau de Parfum',
        famiglia_olfattiva: data.famiglia_olfattiva || 'Legnosa',
        note_testa: data.note_testa || '',
        note_cuore: data.note_cuore || '',
        note_fondo: data.note_fondo || '',
        note_olfattive: data.note_olfattive || '',
        descrizione_ai: data.descrizione_ai || '',
        prezzo_stimato_euro: data.prezzo_stimato_euro || '€150',
        formato_ml: Number(data.formato_ml) || 100,
        stagione_ideale: data.stagione_ideale || 'Tutte le stagioni',
        occasione_ideale: data.occasione_ideale || 'Serata',
        voto_longevita: Number(data.voto_longevita) || 8,
        voto_scia: Number(data.voto_scia) || 8,
        voto_proiezione: Number(data.voto_proiezione) || 8,
        voto_complessita: Number(data.voto_complessita) || 8,
        url_foto_vetrina: data.url_foto_vetrina || (mode === 'photo' ? imagePreview : null),
        note_mouche: '',
        note_pelle: '',
      });
    } catch (err: any) {
      alert(err?.message || 'Impossibile completare l\'estrazione.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveToSupabase(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !draft.nome || !draft.brand) {
      alert('Assicurati che Marchio e Nome siano compilati.');
      return;
    }

    setSaving(true);
    try {
      const unifiedNotes =
        draft.note_olfattive ||
        [draft.note_testa, draft.note_cuore, draft.note_fondo]
          .filter(Boolean)
          .join(', ');

      const fullPayload: Record<string, any> = {
        nome: draft.nome.trim(),
        brand: draft.brand.trim(),
        concentrazione: draft.concentrazione || 'Eau de Parfum',
        famiglia_olfattiva: draft.famiglia_olfattiva || 'Legnosa',
        note_testa: draft.note_testa || '',
        note_cuore: draft.note_cuore || '',
        note_fondo: draft.note_fondo || '',
        note_olfattive: unifiedNotes,
        descrizione_ai: draft.descrizione_ai || '',
        prezzo_stimato_euro: draft.prezzo_stimato_euro || '€150',
        formato_ml: Number(draft.formato_ml) || 100,
        stagione_ideale: draft.stagione_ideale || '',
        occasione_ideale: draft.occasione_ideale || '',
        voto_longevita: Number(draft.voto_longevita) || 8,
        voto_scia: Number(draft.voto_scia) || 8,
        voto_proiezione: Number(draft.voto_proiezione) || 8,
        voto_complessita: Number(draft.voto_complessita) || 8,
        url_foto_vetrina: draft.url_foto_vetrina || null,
        stato: targetStato,
        note_mouche: draft.note_mouche || null,
        note_pelle: draft.note_pelle || null,
      };

      const { error } = await supabase.from('profumi').insert([fullPayload]);

      if (error) {
        // Fallback compatibilità colonne base se necessario
        const { error: fallbackErr } = await supabase.from('profumi').insert([
          {
            nome: fullPayload.nome,
            brand: fullPayload.brand,
            famiglia_olfattiva: fullPayload.famiglia_olfattiva,
            note_olfattive: fullPayload.note_olfattive,
            stato: targetStato,
          },
        ]);
        if (fallbackErr) throw fallbackErr;
      }

      router.push(
        targetStato === 'radar' ? '/collezione?vista=radar' : '/collezione'
      );
    } catch (err: any) {
      alert(`Errore nel salvataggio: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-5xl mx-auto w-full">
      {/* HEADER COORDINATO CON MEDAGLIONE LOGO */}
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] border border-[#C5A059]/30 hover:border-[#F7E7CE] hover:scale-105 transition-all"
            title="Torna alla Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="w-12 h-12 rounded-xl bg-[#0B0A09] border border-[#C5A059]/60 p-1 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(197,160,89,0.2)]">
            <img
              src="/logo.jpg"
              alt="Boutique Olfattiva"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#C5A059]">
              Zero-Hallucination Neural Engine
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-white font-semibold">
              IA Scanner &amp; Catalogatore
            </h1>
          </div>
        </div>

        <Link
          href="/collezione"
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#08080A] border border-[#C5A059]/30 text-[#F7E7CE] font-mono text-xs uppercase tracking-wider hover:border-[#F7E7CE] transition"
        >
          <span>Vai a Collezione</span>
        </Link>
      </header>

      {/* SELETTORE 3 MODALITÀ DI ACQUISIZIONE */}
      <section className="mt-6 boutique-glass rounded-2xl p-5 sm:p-6 border border-[#C5A059]/25 space-y-5 animate-fade-in">
        <div className="grid grid-cols-3 gap-2.5 p-1.5 rounded-2xl bg-[#08080A] border border-white/10">
          <button
            type="button"
            onClick={() => setMode('name')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              mode === 'name'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Nome &amp; Brand</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              mode === 'photo'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Foto / Galleria</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              mode === 'url'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Da Link Web</span>
          </button>
        </div>

        {/* MODALITÀ 1: RICERCA PER NOME E BRAND (59.325 DB + NICCHIA LIVE) */}
        {mode === 'name' && (
          <form onSubmit={handleExtract} className="space-y-3 animate-fade-in">
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
              Marchio e Nome del Profumo (Catalogo 59.325 + Nicchia Live)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Es. Orto Parisi Megamare, Ex Nihilo Blue Talisman, Amouage..."
                className="flex-1 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#C5A059]"
              />
              <button
                type="submit"
                disabled={extracting || !inputName.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-bold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 shrink-0"
              >
                {extracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Estrazione...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Estrai Scheda</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODALITÀ 2: FOTO FOTOCAMERA OPPURE GALLERIA TELEFONO */}
        {mode === 'photo' && (
          <div className="space-y-4 animate-fade-in">
            {/* Input nascosto 1: Fotocamera diretta */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Input nascosto 2: Galleria / Libreria Foto (SENZA capture) */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!imagePreview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-6 rounded-2xl bg-[#08080A] border border-[#C5A059]/35 hover:border-[#F7E7CE] flex flex-col items-center justify-center gap-3 group transition-all hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#F7E7CE] group-hover:scale-110 transition">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-serif text-lg text-white font-medium">
                      Scatta Foto
                    </p>
                    <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
                      Usa la fotocamera per inquadrare flacone o campioncino
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-6 rounded-2xl bg-[#08080A] border border-[#C5A059]/35 hover:border-[#F7E7CE] flex flex-col items-center justify-center gap-3 group transition-all hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#F7E7CE] group-hover:scale-110 transition">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-serif text-lg text-white font-medium">
                      Carica da Galleria
                    </p>
                    <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
                      Scegli una foto o uno screenshot salvato sul telefono
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#08080A] border border-[#C5A059]/40">
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview}
                    alt="Anteprima Flacone"
                    className="w-20 h-20 rounded-xl object-contain bg-black border border-white/10 p-1"
                  />
                  <div>
                    <p className="font-serif text-lg text-white">
                      Immagine pronta per l&apos;analisi
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-[#F7E7CE]"
                      >
                        Cambia da Galleria
                      </button>
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-mono"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Rimuovi</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExtract()}
                  disabled={extracting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-bold uppercase tracking-wider hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {extracting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analisi Visiva...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Avvia Riconoscimento</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODALITÀ 3: ESTRAZIONE DA URL / LINK PRODOTTO */}
        {mode === 'url' && (
          <form onSubmit={handleExtract} className="space-y-3 animate-fade-in">
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
              Incolla Link Ufficiale del Brand, Fragrantica o Parfumo
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#C5A059]"
              />
              <button
                type="submit"
                disabled={extracting || !inputUrl.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-bold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 shrink-0"
              >
                {extracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lettura Pagina...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Estrai da Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* SCHEDA DI REVISIONE E SALVATAGGIO */}
      {draft && (
        <section className="mt-6 boutique-glass rounded-2xl p-6 sm:p-7 border border-[#C5A059]/40 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#F7E7CE]/15">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-[#08080A] border border-[#C5A059]/30 flex items-center justify-center overflow-hidden shrink-0">
                {draft.url_foto_vetrina ? (
                  <img
                    src={draft.url_foto_vetrina}
                    alt={draft.nome || 'Flacone'}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <FlaskConical className="w-6 h-6 text-[#C5A059]" />
                )}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/40 text-[10px] font-mono text-[#F7E7CE]">
                  <CheckCircle2 className="w-3 h-3 text-[#C5A059]" />
                  <span>Fonte: {modelSource}</span>
                </div>
                <h2 className="font-serif text-2xl text-white mt-1">
                  {draft.brand} — {draft.nome}
                </h2>
              </div>
            </div>

            {/* DESTINAZIONE: COLLEZIONE O RADAR TESTING */}
            <div className="inline-flex p-1 rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setTargetStato('collezione')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  targetStato === 'collezione'
                    ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>In Collezione</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetStato('radar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  targetStato === 'radar'
                    ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>In Testing / Radar</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveToSupabase} className="space-y-4 mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Marchio Ufficiale
                </label>
                <input
                  type="text"
                  value={draft.brand || ''}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Nome Fragranza
                </label>
                <input
                  type="text"
                  value={draft.nome || ''}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Famiglia Olfattiva Pura
                </label>
                <select
                  value={draft.famiglia_olfattiva || 'Legnosa'}
                  onChange={(e) =>
                    setDraft({ ...draft, famiglia_olfattiva: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs text-white focus:border-[#C5A059]"
                >
                  {PURE_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Concentrazione
                </label>
                <input
                  type="text"
                  value={draft.concentrazione || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, concentrazione: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Prezzo Stimato (€)
                </label>
                <input
                  type="text"
                  value={draft.prezzo_stimato_euro || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, prezzo_stimato_euro: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs font-mono text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  URL Foto Flacone
                </label>
                <input
                  type="text"
                  value={draft.url_foto_vetrina || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, url_foto_vetrina: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 px-3 py-2 text-xs font-mono text-white focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note di Testa Ufficiali
                </label>
                <textarea
                  rows={2}
                  value={draft.note_testa || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, note_testa: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 p-2.5 text-xs text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note di Cuore Ufficiali
                </label>
                <textarea
                  rows={2}
                  value={draft.note_cuore || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, note_cuore: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 p-2.5 text-xs text-white focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note di Fondo Ufficiali
                </label>
                <textarea
                  rows={2}
                  value={draft.note_fondo || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, note_fondo: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-white/15 p-2.5 text-xs text-white focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                Sintesi Tecnica del Profilo Olfattivo
              </label>
              <textarea
                rows={2}
                value={draft.descrizione_ai || ''}
                onChange={(e) =>
                  setDraft({ ...draft, descrizione_ai: e.target.value })
                }
                className="w-full rounded-xl bg-[#08080A] border border-white/15 p-2.5 text-xs text-white focus:border-[#C5A059]"
              />
            </div>

            {targetStato === 'radar' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#08080A]/90 border border-[#C5A059]/30">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Impressioni su Mouche
                  </label>
                  <textarea
                    rows={2}
                    value={draft.note_mouche || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, note_mouche: e.target.value })
                    }
                    placeholder="Appunti olfattivi su mouche..."
                    className="w-full rounded-xl bg-[#0D0D11] border border-white/10 p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                    Impressioni su Pelle
                  </label>
                  <textarea
                    rows={2}
                    value={draft.note_pelle || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, note_pelle: e.target.value })
                    }
                    placeholder="Evoluzione sulla pelle..."
                    className="w-full rounded-xl bg-[#0D0D11] border border-white/10 p-2.5 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F7E7CE]/15">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-xs uppercase"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-bold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {saving
                  ? 'Salvataggio...'
                  : targetStato === 'radar'
                  ? 'Salva nel Radar Testing'
                  : 'Salva in Collezione Privata'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
