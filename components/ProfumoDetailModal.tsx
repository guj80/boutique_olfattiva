'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Pencil,
  Trash2,
  Check,
  Sparkles,
  User,
  Droplets,
  Calendar,
  Tag,
  Camera,
  Link2,
  Sliders,
  Loader2,
  BookmarkCheck,
  Globe,
  Wand2,
} from 'lucide-react';
import { supabase, Profumo, PURE_FAMILIES } from '@/lib/supabase';
import { normalizeFamily } from '@/lib/families';
import { apiFetch } from '@/lib/api-fetch';
import { BottlePedestal } from './BottleImage';
import { resolveAura } from './AuraProvider';
import { useToast } from './Toast';
import { processBottleImage, uploadProcessedBottle } from '@/lib/bottle-pipeline';
import { PerfumeChord } from './PerfumeChord';
import { SourceLinks } from './SourceLinks';
import { classifyPastedUrl, pickStoredUrls, StoredSourceUrls } from '@/lib/source-links';

interface ProfumoDetailModalProps {
  profumo: Profumo | null;
  onClose: () => void;
  onUpdated?: (updated: Profumo) => void;
  onDeleted?: (deletedId: string) => void;
  onIndossoRegistered?: () => void;
  onBottleApplied?: (brand: string, nome: string, publicUrl: string) => void;
}

function getCurrentMoment(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Mattina';
  if (h >= 12 && h < 18) return 'Pomeriggio';
  if (h >= 18 && h < 23) return 'Sera';
  return 'Notte';
}

export function ProfumoDetailModal({
  profumo,
  onClose,
  onUpdated,
  onDeleted,
  onIndossoRegistered,
  onBottleApplied,
}: ProfumoDetailModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loggingWear, setLoggingWear] = useState(false);

  const [brand, setBrand] = useState('');
  const [nome, setNome] = useState('');
  const [concentrazione, setConcentrazione] = useState('');
  const [annoLancio, setAnnoLancio] = useState('');
  const [naso, setNaso] = useState('');
  const [famigliaOlfattiva, setFamigliaOlfattiva] = useState('');
  const [noteTesta, setNoteTesta] = useState('');
  const [noteCuore, setNoteCuore] = useState('');
  const [noteFondo, setNoteFondo] = useState('');
  const [stato, setStato] = useState<'collezione' | 'radar'>('collezione');
  const [prezzoStimato, setPrezzoStimato] = useState('');
  const [immagineUrl, setImmagineUrl] = useState('');

  // Arricchimento scheda da URL (Sito Ufficiale / Parfumo / Fragrantica)
  const [sourceUrlInput, setSourceUrlInput] = useState('');
  const [enrichingFromSource, setEnrichingFromSource] = useState(false);
  const [foundUrls, setFoundUrls] = useState<StoredSourceUrls>({});

  // Studio Isolamento Flacone
  const [bottleStudioOpen, setBottleStudioOpen] = useState(false);
  const [rawImageSource, setRawImageSource] = useState<File | string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [tolerance, setTolerance] = useState(36);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processingBottle, setProcessingBottle] = useState(false);
  const [uploadingBottle, setUploadingBottle] = useState(false);

  useEffect(() => {
    if (profumo) {
      setFoundUrls({});
      setBrand(profumo.brand || '');
      setNome(profumo.nome || '');
      setConcentrazione(profumo.concentrazione || '');
      setAnnoLancio(profumo.anno_lancio ? String(profumo.anno_lancio) : '');
      setNaso(profumo.naso || '');
      setFamigliaOlfattiva(profumo.famiglia_olfattiva || 'Legnosa');
      setNoteTesta(profumo.note_testa || '');
      setNoteCuore(profumo.note_cuore || '');
      setNoteFondo(profumo.note_fondo || '');
      setStato(
        (profumo.stato || '').toLowerCase() === 'radar' ? 'radar' : 'collezione'
      );
      setPrezzoStimato(profumo.prezzo_stimato_euro || '');
      setImmagineUrl(profumo.url_foto_vetrina || profumo.immagine_url || '');
      setSourceUrlInput('');
      setEnrichingFromSource(false);
      setIsEditing(false);
      setConfirmDelete(false);
      setBottleStudioOpen(false);
      setRawImageSource(null);
      setImageUrlInput('');
      setProcessedPreview(null);
      setProcessedBlob(null);
      setTolerance(36);
    }
  }, [profumo]);

  useEffect(() => {
    if (!rawImageSource) return;
    let cancelled = false;

    async function runIsolation() {
      setProcessingBottle(true);
      try {
        const res = await processBottleImage(rawImageSource!, { tolerance });
        if (!cancelled) {
          setProcessedPreview(res.previewDataUrl);
          setProcessedBlob(res.blob);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Errore elaborazione immagine.';
          showToast(msg, 'error');
          setRawImageSource(null);
        }
      } finally {
        if (!cancelled) setProcessingBottle(false);
      }
    }

    const timer = setTimeout(runIsolation, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawImageSource, tolerance, showToast]);

  useEffect(() => {
    if (!profumo || !bottleStudioOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            setRawImageSource(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [profumo, bottleStudioOpen]);

  if (!profumo) return null;

  const isPreview = String(profumo.id).startsWith('preview-');
  const aura = resolveAura(
    isEditing ? famigliaOlfattiva : profumo.famiglia_olfattiva,
    isEditing ? nome : profumo.nome
  );
  const currentImg =
    processedPreview ||
    immagineUrl ||
    profumo.url_foto_vetrina ||
    profumo.immagine_url;

  async function syncBottleToStorage(
    blob: Blob,
    targetBrand: string,
    targetNome: string
  ): Promise<string> {
    const publicUrl = await uploadProcessedBottle(blob, targetBrand, targetNome);
    await supabase
      .from('ultranicchia_import')
      .update({ immagine_url: publicUrl })
      .ilike('brand', targetBrand)
      .ilike('nome', targetNome);

    if (onBottleApplied) {
      onBottleApplied(targetBrand, targetNome, publicUrl);
    }
    return publicUrl;
  }

  async function handleEnrichMetadata() {
    const link = sourceUrlInput.trim();
    const queryText = `${brand.trim()} ${nome.trim()}`.trim();

    if (!link && !queryText) {
      showToast('Inserisci un link o indica Maison e Nome.', 'error');
      return;
    }

    setEnrichingFromSource(true);
    try {
      const bodyPayload = link ? { url: link } : { query: queryText };
      const res = await apiFetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'Impossibile estrarre i dati dalla fonte.');
      }

      if (data.brand) setBrand(String(data.brand));
      if (data.nome) setNome(String(data.nome));
      if (data.concentrazione) setConcentrazione(String(data.concentrazione));
      if (data.anno_lancio) setAnnoLancio(String(data.anno_lancio));
      if (data.naso) setNaso(String(data.naso));
      if (data.famiglia_olfattiva) {
        const canonical = normalizeFamily(String(data.famiglia_olfattiva));
        if (canonical) setFamigliaOlfattiva(canonical);
      }
      if (data.note_testa) setNoteTesta(String(data.note_testa));
      if (data.note_cuore) setNoteCuore(String(data.note_cuore));
      if (data.note_fondo) setNoteFondo(String(data.note_fondo));

      // Memorizza i link trovati (e quello incollato) per salvarli con la scheda
      const incoming: StoredSourceUrls = {
        url_sito_ufficiale: data.url_sito_ufficiale,
        url_parfumo: data.url_parfumo,
        url_fragrantica: data.url_fragrantica,
      };
      const pastedKind = link ? classifyPastedUrl(link) : null;
      if (pastedKind && !incoming[pastedKind]) incoming[pastedKind] = link;
      setFoundUrls((prev) => ({ ...prev, ...pickStoredUrls(incoming) }));

      showToast('Dati importati nei campi. Controlla e premi Salva Modifiche.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore importazione dati.';
      showToast(msg, 'error');
    } finally {
      setEnrichingFromSource(false);
    }
  }

  async function handleQuickWear() {
    if (!profumo || isPreview || loggingWear) return;
    setLoggingWear(true);
    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: profumo.id,
          momento_giornata: getCurrentMoment(),
        },
      ]);
      if (error) throw error;
      showToast(`Indosso registrato: ${profumo.nome}.`);
      if (onIndossoRegistered) onIndossoRegistered();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore registrazione indosso.';
      showToast(msg, 'error');
    } finally {
      setLoggingWear(false);
    }
  }

  async function handleConfirmIsolatedBottle() {
    if (!processedBlob || !profumo) return;
    setUploadingBottle(true);
    try {
      const cleanBrand = (isEditing ? brand : profumo.brand) || 'Maison';
      const cleanNome = (isEditing ? nome : profumo.nome) || 'Creazione';
      const publicUrl = await syncBottleToStorage(processedBlob, cleanBrand, cleanNome);

      setImmagineUrl(publicUrl);

      if (!isPreview) {
        const { data, error } = await supabase
          .from('profumi')
          .update({ url_foto_vetrina: publicUrl })
          .eq('id', profumo.id)
          .select()
          .single();

        if (error) throw error;
        if (onUpdated && data) onUpdated(data as Profumo);
      }

      setBottleStudioOpen(false);
      setRawImageSource(null);
      setProcessedPreview(null);
      setProcessedBlob(null);
      showToast('Flacone salvato nel bucket Storage.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore salvataggio flacone.';
      showToast(msg, 'error');
    } finally {
      setUploadingBottle(false);
    }
  }

  async function handleSave() {
    if (!profumo) return;
    if (!brand.trim() || !nome.trim()) {
      showToast('Brand e nome della creazione sono obbligatori.', 'error');
      return;
    }

    setSaving(true);
    try {
      let finalBottleUrl = immagineUrl.trim() || null;

      if (processedBlob) {
        finalBottleUrl = await syncBottleToStorage(
          processedBlob,
          brand.trim(),
          nome.trim()
        );
        setImmagineUrl(finalBottleUrl);
        setProcessedBlob(null);
        setProcessedPreview(null);
        setRawImageSource(null);
        setBottleStudioOpen(false);
      }

      const payload = {
        brand: brand.trim(),
        nome: nome.trim(),
        concentrazione: concentrazione.trim() || null,
        anno_lancio: annoLancio.trim() ? Number(annoLancio.trim()) || null : null,
        naso: naso.trim() || null,
        famiglia_olfattiva: famigliaOlfattiva,
        note_testa: noteTesta.trim() || null,
        note_cuore: noteCuore.trim() || null,
        note_fondo: noteFondo.trim() || null,
        stato,
        prezzo_stimato_euro: stato === 'radar' ? prezzoStimato.trim() || null : null,
        url_foto_vetrina: finalBottleUrl,
      };

      const linkFields = pickStoredUrls(foundUrls);
      const hasLinks = Object.keys(linkFields).length > 0;

      if (isPreview) {
        let { data, error } = await supabase
          .from('profumi')
          .insert([{ ...payload, ...linkFields }])
          .select()
          .single();

        // Colonne link non ancora presenti nel DB: salva comunque la scheda
        if (error && hasLinks) {
          ({ data, error } = await supabase
            .from('profumi')
            .insert([payload])
            .select()
            .single());
        }

        if (error) throw error;
        showToast(`${nome.trim()} salvato nel Radar.`);
        if (onUpdated && data) onUpdated(data as Profumo);
        onClose();
        return;
      }

      let { data, error } = await supabase
        .from('profumi')
        .update({ ...payload, ...linkFields })
        .eq('id', profumo.id)
        .select()
        .single();

      if (error && hasLinks) {
        ({ data, error } = await supabase
          .from('profumi')
          .update(payload)
          .eq('id', profumo.id)
          .select()
          .single());
      }

      if (error) throw error;

      showToast('Scheda creazione aggiornata.');
      setIsEditing(false);
      if (onUpdated && data) {
        onUpdated(data as Profumo);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore salvataggio.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!profumo || isPreview) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profumi').delete().eq('id', profumo.id);
      if (error) throw error;

      showToast(`${profumo.nome} rimosso dall'archivio.`);
      if (onDeleted) onDeleted(profumo.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore eliminazione.';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: `${aura.primary}55` }}
        className="relative w-full max-w-2xl rounded-[32px] border bg-[#161024] p-6 sm:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full blur-3xl opacity-30"
          style={{ backgroundColor: aura.primary }}
        />

        {/* Top Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span
              style={{
                borderColor: `${aura.primary}45`,
                color: aura.primary,
                backgroundColor: '#0E0A16',
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
            >
              <Sparkles className="h-3 w-3" />
              {isPreview
                ? 'Anteprima'
                : stato === 'radar'
                ? 'Testing Radar'
                : 'Collezione'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <>
                {!isPreview && (
                  <button
                    type="button"
                    onClick={handleQuickWear}
                    disabled={loggingWear}
                    style={{ backgroundColor: aura.primary }}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    <span>{loggingWear ? 'Salvataggio...' : 'Indossa ora'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBottleStudioOpen((v) => !v)}
                  style={{ borderColor: `${aura.primary}45`, color: aura.primary }}
                  className="flex items-center gap-1.5 rounded-full border bg-[#0E0A16] px-3.5 py-2 text-xs font-semibold transition hover:opacity-90"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Isola flacone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{ borderColor: `${aura.primary}45` }}
                  className="flex items-center gap-1.5 rounded-full border bg-[#0E0A16] px-3.5 py-2 text-xs font-semibold text-[#F6EFE4] transition hover:opacity-90"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>{isPreview ? 'Salva nel Radar' : 'Modifica'}</span>
                </button>
                {!isPreview && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/30 bg-[#0E0A16] text-red-300 transition hover:bg-red-500/20"
                    title="Elimina creazione"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: aura.primary }}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{saving ? 'Salvataggio...' : 'Salva'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0E0A16] text-[#B8A9C9] transition hover:text-white"
              title="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Studio Isolamento Flacone */}
        {bottleStudioOpen && (
          <div
            style={{ borderColor: `${aura.primary}50` }}
            className="relative z-10 mt-4 rounded-2xl border bg-[#0E0A16] p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span
                style={{ color: aura.primary }}
                className="font-mono text-[10px] font-bold uppercase tracking-widest"
              >
                Studio Flacone Puro (PNG trasparente)
              </span>
              <button
                type="button"
                onClick={() => {
                  setBottleStudioOpen(false);
                  setRawImageSource(null);
                  setProcessedPreview(null);
                }}
                className="font-mono text-[10px] text-[#B8A9C9] hover:text-white"
              >
                Chiudi
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setRawImageSource(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderColor: `${aura.primary}45` }}
                className="flex items-center justify-center gap-2 rounded-xl border bg-[#161024] px-3.5 py-2.5 text-xs font-semibold text-[#F6EFE4] hover:border-white/40 transition"
              >
                <Camera className="h-4 w-4" />
                <span>Carica foto o incolla (Ctrl+V)</span>
              </button>

              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A9C9]" />
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Incolla link immagine..."
                    style={{ borderColor: `${aura.primary}40` }}
                    className="w-full rounded-xl border bg-[#161024] pl-8 pr-2.5 py-2 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (imageUrlInput.trim()) setRawImageSource(imageUrlInput.trim());
                  }}
                  style={{ backgroundColor: aura.primary }}
                  className="rounded-xl px-3 py-2 text-xs font-bold text-[#08060C]"
                >
                  Isola
                </button>
              </div>
            </div>

            {rawImageSource && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <Sliders className="h-3.5 w-3.5 text-[#B8A9C9]" />
                  <span className="font-mono text-[10px] uppercase text-[#B8A9C9]">
                    Sensibilità sfondo: {tolerance}
                  </span>
                  <input
                    type="range"
                    min={12}
                    max={75}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="flex-1 accent-amber-400"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRawImageSource(null);
                      setProcessedPreview(null);
                      setProcessedBlob(null);
                    }}
                    className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-[#B8A9C9]"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={!processedBlob || processingBottle || uploadingBottle}
                    onClick={handleConfirmIsolatedBottle}
                    style={{ backgroundColor: aura.primary }}
                    className="flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-bold text-[#08060C] disabled:opacity-50"
                  >
                    {uploadingBottle || processingBottle ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {uploadingBottle
                        ? 'Salvataggio...'
                        : processingBottle
                        ? 'Elaborazione...'
                        : 'Applica flacone'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conferma Eliminazione */}
        {confirmDelete && (
          <div className="relative z-10 mt-4 rounded-2xl border border-red-400/40 bg-red-950/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-red-200">
              Rimuovere definitivamente <strong>{profumo.nome}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-white"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white"
              >
                {deleting ? 'Rimozione...' : 'Elimina'}
              </button>
            </div>
          </div>
        )}

        {/* Contenuto Principale */}
        {!isEditing ? (
          <div className="relative z-10 mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              <div className="sm:col-span-5 flex flex-col items-center">
                <BottlePedestal
                  src={currentImg}
                  alt={profumo.nome}
                  brand={profumo.brand}
                  famiglia={profumo.famiglia_olfattiva}
                  concentrazione={profumo.concentrazione}
                  size="xl"
                  className="w-full !h-72"
                />
              </div>

              <div className="sm:col-span-7 space-y-5">
                <div>
                  <p
                    style={{ color: aura.primary }}
                    className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
                  >
                    {profumo.brand}
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] leading-tight mt-1">
                    {profumo.nome}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#B8A9C9]">
                    {profumo.famiglia_olfattiva && (
                      <span
                        style={{ borderColor: `${aura.primary}40` }}
                        className="inline-flex items-center gap-1 rounded-full border bg-[#0E0A16] px-3 py-1 font-mono text-[11px] text-[#F6EFE4]"
                      >
                        <Droplets style={{ color: aura.primary }} className="h-3 w-3" />
                        {profumo.famiglia_olfattiva}
                      </span>
                    )}
                    {profumo.concentrazione && (
                      <span className="rounded-full border border-white/10 bg-[#0E0A16] px-3 py-1 font-mono text-[11px]">
                        {profumo.concentrazione}
                      </span>
                    )}
                    {profumo.anno_lancio && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0E0A16] px-3 py-1 font-mono text-[11px]">
                        <Calendar className="h-3 w-3" />
                        {profumo.anno_lancio}
                      </span>
                    )}
                  </div>
                </div>

                {profumo.naso && (
                  <div className="flex items-center gap-2 text-xs text-[#B8A9C9]">
                    <User style={{ color: aura.primary }} className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Naso: <strong className="text-[#F6EFE4]">{profumo.naso}</strong>
                    </span>
                  </div>
                )}

                <div
                  style={{ borderColor: `${aura.primary}30` }}
                  className="rounded-2xl border bg-[#0E0A16]/90 p-4 space-y-3"
                >
                  <p
                    style={{ color: aura.primary }}
                    className="font-mono text-[10px] font-bold uppercase tracking-widest"
                  >
                    Piramide Olfattiva
                  </p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                        Testa
                      </span>
                      <p className="text-[#F6EFE4]">{profumo.note_testa || '—'}</p>
                    </div>
                    <div className="border-t border-white/5 pt-2">
                      <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                        Cuore
                      </span>
                      <p className="text-[#F6EFE4]">{profumo.note_cuore || '—'}</p>
                    </div>
                    <div className="border-t border-white/5 pt-2">
                      <span className="font-mono text-[10px] uppercase text-[#B8A9C9] block">
                        Fondo
                      </span>
                      <p className="text-[#F6EFE4]">{profumo.note_fondo || '—'}</p>
                    </div>
                  </div>
                  <SourceLinks
                    brand={profumo.brand}
                    nome={profumo.nome}
                    urls={profumo}
                    color={aura.primary}
                  />
                </div>

                {profumo.prezzo_stimato_euro && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-[#0E0A16] px-3.5 py-1.5 font-mono text-xs text-purple-200">
                    <Tag className="h-3.5 w-3.5" />
                    <span>{profumo.prezzo_stimato_euro}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Anatomia degli Accordi del Singolo Flacone */}
            <PerfumeChord profumo={profumo} />
          </div>
        ) : (
          /* MODALITÀ MODIFICA & ARRICCHIMENTO DA URL */
          <div className="relative z-10 mt-6 space-y-4 text-xs">
            {/* Barra Importazione da Sito Ufficiale / Parfumo / Fragrantica */}
            <div
              style={{ borderColor: `${aura.primary}45` }}
              className="rounded-2xl border bg-[#0E0A16] p-4 space-y-2.5"
            >
              <label
                style={{ color: aura.primary }}
                className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Aggiorna scheda da URL (Ricerca web, Parfumo, Fragrantica)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={sourceUrlInput}
                  onChange={(e) => setSourceUrlInput(e.target.value)}
                  placeholder="https://www.fragrantica.it/... oppure link sito ufficiale della maison"
                  style={{ borderColor: `${aura.primary}40` }}
                  className="flex-1 rounded-xl border bg-[#161024] px-3 py-2.5 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleEnrichMetadata}
                  disabled={enrichingFromSource}
                  style={{ backgroundColor: aura.primary }}
                  className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
                >
                  {enrichingFromSource ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {enrichingFromSource
                      ? 'Lettura...'
                      : sourceUrlInput.trim()
                      ? 'Importa da Link'
                      : 'Completa Dati'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Maison *
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Nome Creazione *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Famiglia Olfattiva
                </label>
                <select
                  value={famigliaOlfattiva}
                  onChange={(e) => setFamigliaOlfattiva(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                >
                  {PURE_FAMILIES.map((fam) => (
                    <option key={fam} value={fam}>
                      {fam}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Concentrazione
                </label>
                <input
                  type="text"
                  value={concentrazione}
                  onChange={(e) => setConcentrazione(e.target.value)}
                  placeholder="Es. Extrait de Parfum"
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Destinazione
                </label>
                <select
                  value={stato}
                  onChange={(e) =>
                    setStato(e.target.value === 'radar' ? 'radar' : 'collezione')
                  }
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                >
                  <option value="collezione">Collezione</option>
                  <option value="radar">Testing Radar</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Naso
                </label>
                <input
                  type="text"
                  value={naso}
                  onChange={(e) => setNaso(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Anno di Lancio
                </label>
                <input
                  type="text"
                  value={annoLancio}
                  onChange={(e) => setAnnoLancio(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-3 text-[#F6EFE4] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Note di Testa
                </label>
                <input
                  type="text"
                  value={noteTesta}
                  onChange={(e) => setNoteTesta(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-2.5 text-[#F6EFE4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Note di Cuore
                </label>
                <input
                  type="text"
                  value={noteCuore}
                  onChange={(e) => setNoteCuore(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-2.5 text-[#F6EFE4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Note di Fondo
                </label>
                <input
                  type="text"
                  value={noteFondo}
                  onChange={(e) => setNoteFondo(e.target.value)}
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-2.5 text-[#F6EFE4] focus:outline-none"
                />
              </div>
            </div>

            {stato === 'radar' && (
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                  Riferimento Formato / Prezzo
                </label>
                <input
                  type="text"
                  value={prezzoStimato}
                  onChange={(e) => setPrezzoStimato(e.target.value)}
                  placeholder="Es. 50ml — € 180"
                  style={{ borderColor: `${aura.primary}40` }}
                  className="w-full rounded-xl border bg-[#0E0A16] p-2.5 text-[#F6EFE4] focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-full border border-white/15 px-5 py-2.5 text-xs text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: aura.primary }}
                className="rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C]"
              >
                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
