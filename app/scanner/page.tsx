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
  Image as ImageIcon,
  Search,
  FlaskConical,
  UserCheck,
} from 'lucide-react';
import { supabase, Profumo } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { useAura, resolveAura } from '@/components/AuraProvider';
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
] as const;

export default function ScannerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'name' | 'photo' | 'url'>('name');

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Partial<Profumo> | null>(null);
  const [modelSource, setModelSource] = useState<string>('');
  const [targetStato, setTargetStato] = useState<'collezione' | 'radar'>('collezione');

  const { aura, setCustomAura } = useAura();
  const { showToast } = useToast();

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
      showToast('Inserisci un link ufficiale valido.', 'error');
      return;
    }
    if (mode === 'name' && !inputName.trim()) {
      showToast('Inserisci Maison e Nome della creazione.', 'error');
      return;
    }
    if (mode === 'photo' && !imagePreview) {
      showToast("Scatta una foto o seleziona un'immagine.", 'error');
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
        throw new Error(data.error || "Errore durante l'estrazione dei dati.");
      }

      const extractedDraft: Partial<Profumo> = {
        nome: data.nome || '',
        brand: data.brand || '',
        concentrazione: data.concentrazione || 'Extrait de Parfum',
        famiglia_olfattiva: data.famiglia_olfattiva || 'Legnosa',
        naso: data.naso || '',
        note_testa: data.note_testa || '',
        note_cuore: data.note_cuore || '',
        note_fondo: data.note_fondo || '',
        note_olfattive: data.note_olfattive || '',
        descrizione_ai: '',
        prezzo_stimato_euro: data.prezzo_stimato_euro || '€150',
        formato_ml: Number(data.formato_ml) || 100,
        stagione_ideale: data.stagione_ideale || '',
        occasione_ideale: data.occasione_ideale || '',
        voto_longevita: Number(data.voto_longevita) || 8,
        voto_scia: Number(data.voto_scia) || 8,
        voto_proiezione: Number(data.voto_proiezione) || 8,
        voto_complessita: Number(data.voto_complessita) || 8,
        url_foto_vetrina: data.url_foto_vetrina || (mode === 'photo' ? imagePreview : null),
        note_mouche: '',
        note_pelle: '',
      };

      setModelSource(data._modelUsed || 'neural-engine');
      setDraft(extractedDraft);
      setCustomAura(resolveAura(extractedDraft.famiglia_olfattiva, extractedDraft.nome));
      showToast('Scheda tecnica acquisita.');
    } catch (err: any) {
      showToast(err?.message || "Impossibile completare l'estrazione.", 'error');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveToSupabase(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !draft.nome || !draft.brand) {
      showToast('Assicurati che Maison e Nome siano compilati.', 'error');
      return;
    }

    setSaving(true);
    try {
      const unifiedNotes =
        draft.note_olfattive ||
        [draft.note_testa, draft.note_cuore, draft.note_fondo]
          .filter(Boolean)
          .join(', ');

      // Mappatura rigorosa sulla colonna "naso" della tabella "profumi"
      const fullPayload: Record<string, any> = {
        nome: draft.nome.trim(),
        brand: draft.brand.trim(),
        concentrazione: draft.concentrazione || 'Extrait de Parfum',
        famiglia_olfattiva: draft.famiglia_olfattiva || 'Legnosa',
        naso: draft.naso && draft.naso.trim() ? draft.naso.trim() : null,
        note_testa: draft.note_testa || '',
        note_cuore: draft.note_cuore || '',
        note_fondo: draft.note_fondo || '',
        note_olfattive: unifiedNotes,
        descrizione_ai: '',
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
        const { error: fallbackErr } = await supabase.from('profumi').insert([
          {
            nome: fullPayload.nome,
            brand: fullPayload.brand,
            famiglia_olfattiva: fullPayload.famiglia_olfattiva,
            naso: fullPayload.naso,
            note_olfattive: fullPayload.note_olfattive,
            stato: targetStato,
          },
        ]);
        if (fallbackErr) throw fallbackErr;
      }

      showToast('Creazione registrata nell\'Atelier.');
      router.push(
        targetStato === 'radar' ? '/collezione?vista=radar' : '/collezione'
      );
    } catch (err: any) {
      showToast(`Errore nel salvataggio: ${err?.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-8 pb-36">
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Torna alla home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#1E1428]/80 text-[#F6EFE4] transition hover:border-white/40"
          >
            <ArrowLeft style={{ color: aura.primary }} className="h-5 w-5" />
          </Link>
          <Logo className="h-7" />
        </div>
        <Link
          href="/collezione"
          style={{ borderColor: `${aura.primary}40` }}
          className="rounded-full border bg-[#1E1428] px-4 py-2 text-xs font-semibold text-[#F6EFE4] transition hover:border-white/40"
        >
          La Collezione
        </Link>
      </header>

      <section
        style={{ borderColor: `${aura.primary}30` }}
        className="mt-6 rounded-[28px] border bg-[#1E1428]/90 p-5 sm:p-6 aura-shadow space-y-5"
      >
        <div className="grid grid-cols-3 gap-2 rounded-full bg-[#140D1C] p-1.5 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('name')}
            style={mode === 'name' ? { backgroundColor: aura.primary } : undefined}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'name' ? 'text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Ricerca</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            style={mode === 'photo' ? { backgroundColor: aura.primary } : undefined}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'photo' ? 'text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Flacone</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            style={mode === 'url' ? { backgroundColor: aura.primary } : undefined}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'url' ? 'text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Link</span>
          </button>
        </div>

        {mode === 'name' && (
          <form onSubmit={handleExtract} className="space-y-3">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
              Maison e Nome della Creazione
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Es. Ex Nihilo Blue Talisman, Xerjoff Naxos..."
                className="flex-1 rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={extracting || !inputName.trim()}
                style={{ backgroundColor: aura.primary }}
                className="flex items-center justify-center gap-2 rounded-[16px] px-6 py-3 text-xs font-bold text-[#140D1C] transition hover:opacity-90 disabled:opacity-40"
              >
                {extracting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>Cataloga</span>
              </button>
            </div>
          </form>
        )}

        {mode === 'photo' && (
          <div className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
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
                  className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-[#140D1C] p-6 transition hover:border-white/30"
                >
                  <Camera style={{ color: aura.primary }} className="h-6 w-6" />
                  <span className="text-sm font-semibold text-[#F6EFE4]">Scatta Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-[#140D1C] p-6 transition hover:border-white/30"
                >
                  <ImageIcon style={{ color: aura.primary }} className="h-6 w-6" />
                  <span className="text-sm font-semibold text-[#F6EFE4]">
                    Seleziona da Libreria
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[20px] bg-[#140D1C] p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview}
                    alt="Anteprima"
                    className="h-16 w-16 rounded-xl object-contain bg-transparent p-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#F6EFE4]">
                      Acquisizione visiva pronta
                    </p>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="text-xs text-red-400 mt-1"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleExtract()}
                  disabled={extracting}
                  style={{ backgroundColor: aura.primary }}
                  className="rounded-full px-6 py-3 text-xs font-bold text-[#140D1C]"
                >
                  {extracting ? 'Analisi...' : 'Avvia Riconoscimento'}
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'url' && (
          <form onSubmit={handleExtract} className="space-y-3">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
              URL Pagina Ufficiale della Maison
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-3 text-sm text-[#F6EFE4]"
              />
              <button
                type="submit"
                disabled={extracting || !inputUrl.trim()}
                style={{ backgroundColor: aura.primary }}
                className="rounded-[16px] px-6 py-3 text-xs font-bold text-[#140D1C]"
              >
                {extracting ? 'Lettura...' : 'Estrai'}
              </button>
            </div>
          </form>
        )}
      </section>

      {draft && (
        <section
          style={{ borderColor: `${aura.primary}45` }}
          className="mt-6 rounded-[28px] border bg-[#1E1428]/95 p-6 space-y-5 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#140D1C] border border-white/10">
                {draft.url_foto_vetrina ? (
                  <img
                    src={draft.url_foto_vetrina}
                    alt=""
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <FlaskConical style={{ color: aura.primary }} className="h-5 w-5" />
                )}
              </div>
              <div>
                <span
                  style={{ color: aura.primary }}
                  className="font-mono text-[10px] uppercase tracking-wider"
                >
                  Fonte: {modelSource}
                </span>
                <h2 className="font-serif text-2xl text-[#F6EFE4]">
                  {draft.brand} — {draft.nome}
                </h2>
              </div>
            </div>

            <div className="flex rounded-full bg-[#140D1C] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setTargetStato('collezione')}
                style={
                  targetStato === 'collezione'
                    ? { backgroundColor: aura.primary }
                    : undefined
                }
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  targetStato === 'collezione' ? 'text-[#140D1C]' : 'text-[#B8A9C9]'
                }`}
              >
                Collezione
              </button>
              <button
                type="button"
                onClick={() => setTargetStato('radar')}
                style={
                  targetStato === 'radar' ? { backgroundColor: aura.primary } : undefined
                }
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  targetStato === 'radar' ? 'text-[#140D1C]' : 'text-[#B8A9C9]'
                }`}
              >
                Radar
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveToSupabase} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label
                  style={{ color: aura.primary }}
                  className="block text-[10px] font-mono uppercase mb-1"
                >
                  Maison
                </label>
                <input
                  type="text"
                  value={draft.brand || ''}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label
                  style={{ color: aura.primary }}
                  className="block text-[10px] font-mono uppercase mb-1"
                >
                  Creazione
                </label>
                <input
                  type="text"
                  value={draft.nome || ''}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label
                  style={{ color: aura.primary }}
                  className="block text-[10px] font-mono uppercase mb-1"
                >
                  Famiglia Pura
                </label>
                <select
                  value={draft.famiglia_olfattiva || 'Legnosa'}
                  onChange={(e) => {
                    const nextFam = e.target.value;
                    setDraft({ ...draft, famiglia_olfattiva: nextFam });
                    setCustomAura(resolveAura(nextFam, draft.nome));
                  }}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                >
                  {PURE_FAMILIES.map((f) => (
                    <option key={f} value={f} className="bg-[#140D1C]">
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{ color: aura.primary }}
                  className="block text-[10px] font-mono uppercase mb-1"
                >
                  Naso (Maître Parfumeur)
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A9C9]" />
                  <input
                    type="text"
                    value={draft.naso || ''}
                    onChange={(e) => setDraft({ ...draft, naso: e.target.value })}
                    placeholder="Non dichiarato"
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] pl-8 pr-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#B8A9C9] mb-1">
                  Note di Testa
                </label>
                <input
                  type="text"
                  value={draft.note_testa || ''}
                  onChange={(e) => setDraft({ ...draft, note_testa: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#B8A9C9] mb-1">
                  Note di Cuore
                </label>
                <input
                  type="text"
                  value={draft.note_cuore || ''}
                  onChange={(e) => setDraft({ ...draft, note_cuore: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#B8A9C9] mb-1">
                  Note di Fondo
                </label>
                <input
                  type="text"
                  value={draft.note_fondo || ''}
                  onChange={(e) => setDraft({ ...draft, note_fondo: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ backgroundColor: aura.primary }}
                className="rounded-full px-6 py-2 text-xs font-bold text-[#140D1C] transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Registrazione...' : 'Conferma e Custodisci'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
