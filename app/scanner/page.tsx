
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
import { supabase, Profumo } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
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
      showToast('Inserisci un link valido.', 'error');
      return;
    }
    if (mode === 'name' && !inputName.trim()) {
      showToast('Inserisci Marchio e Nome del profumo.', 'error');
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
      showToast('Scheda estratta con successo.');
    } catch (err: any) {
      showToast(err?.message || "Impossibile completare l'estrazione.", 'error');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveToSupabase(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !draft.nome || !draft.brand) {
      showToast('Assicurati che Marchio e Nome siano compilati.', 'error');
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
        nome: draft.nome!.trim(),
        brand: draft.brand!.trim(),
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

      showToast('Profumo salvato correttamente.');
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
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-8 pb-28">
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-[#D8B995]/20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Torna alla home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8B995]/30 bg-[#1E1428]/80 text-[#F6EFE4] transition hover:border-[#D8B995]"
          >
            <ArrowLeft className="h-5 w-5 text-[#D8B995]" />
          </Link>
          <Logo className="h-7" />
        </div>
        <Link
          href="/collezione"
          className="rounded-full border border-[#D8B995]/30 bg-[#1E1428] px-4 py-2 text-xs font-semibold text-[#F6EFE4] transition hover:border-[#D8B995]"
        >
          Vai a Collezione
        </Link>
      </header>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-[#1E1428]/90 p-5 sm:p-6 aura-shadow space-y-5">
        <div className="grid grid-cols-3 gap-2 rounded-full bg-[#140D1C] p-1.5 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('name')}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'name' ? 'bg-[#D8B995] text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Nome</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'photo' ? 'bg-[#D8B995] text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Foto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
              mode === 'url' ? 'bg-[#D8B995] text-[#140D1C]' : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Link</span>
          </button>
        </div>

        {mode === 'name' && (
          <form onSubmit={handleExtract} className="space-y-3">
            <label className="block text-xs font-medium text-[#B8A9C9]">
              Marchio e Nome del Profumo
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Es. Orto Parisi Megamare, Byredo Gypsy Water..."
                className="flex-1 rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-3 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:border-[#D8B995] focus:outline-none"
              />
              <button
                type="submit"
                disabled={extracting || !inputName.trim()}
                className="flex items-center justify-center gap-2 rounded-[16px] bg-[#D8B995] px-6 py-3 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e] disabled:opacity-40"
              >
                {extracting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Estrai</span>
              </button>
            </div>
          </form>
        )}

        {mode === 'photo' && (
          <div className="space-y-4">
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

            {!imagePreview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-[#140D1C] p-6 transition hover:border-[#D8B995]/50"
                >
                  <Camera className="h-6 w-6 text-[#D8B995]" />
                  <span className="text-sm font-semibold text-[#F6EFE4]">Scatta Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-[#140D1C] p-6 transition hover:border-[#D8B995]/50"
                >
                  <ImageIcon className="h-6 w-6 text-[#D8B995]" />
                  <span className="text-sm font-semibold text-[#F6EFE4]">Carica da Galleria</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[20px] bg-[#140D1C] p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <img src={imagePreview} alt="Anteprima" className="h-16 w-16 rounded-xl object-contain bg-black p-1" />
                  <div>
                    <p className="text-sm font-semibold text-[#F6EFE4]">Immagine pronta</p>
                    <button type="button" onClick={() => setImagePreview(null)} className="text-xs text-red-400 mt-1">Rimuovi</button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleExtract()}
                  disabled={extracting}
                  className="rounded-full bg-[#D8B995] px-6 py-3 text-xs font-bold text-[#140D1C]"
                >
                  {extracting ? 'Analisi...' : 'Avvia Riconoscimento'}
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'url' && (
          <form onSubmit={handleExtract} className="space-y-3">
            <label className="block text-xs font-medium text-[#B8A9C9]">Incolla Link Ufficiale</label>
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
                className="rounded-[16px] bg-[#D8B995] px-6 py-3 text-xs font-bold text-[#140D1C]"
              >
                {extracting ? 'Lettura...' : 'Estrai'}
              </button>
            </div>
          </form>
        )}
      </section>

      {draft && (
        <section className="mt-6 rounded-[28px] border border-[#D8B995]/40 bg-[#1E1428]/95 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#140D1C] border border-white/10">
                {draft.url_foto_vetrina ? (
                  <img src={draft.url_foto_vetrina} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <FlaskConical className="h-5 w-5 text-[#D8B995]" />
                )}
              </div>
              <div>
                <span className="font-mono text-[10px] text-[#D8B995]">Fonte: {modelSource}</span>
                <h2 className="font-serif text-2xl text-[#F6EFE4]">{draft.brand} — {draft.nome}</h2>
              </div>
            </div>

            <div className="flex rounded-full bg-[#140D1C] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setTargetStato('collezione')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  targetStato === 'collezione' ? 'bg-[#D8B995] text-[#140D1C]' : 'text-[#B8A9C9]'
                }`}
              >
                Collezione
              </button>
              <button
                type="button"
                onClick={() => setTargetStato('radar')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  targetStato === 'radar' ? 'bg-[#D8B995] text-[#140D1C]' : 'text-[#B8A9C9]'
                }`}
              >
                Radar
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveToSupabase} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#D8B995] mb-1">Marchio</label>
                <input
                  type="text"
                  value={draft.brand || ''}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#D8B995] mb-1">Nome</label>
                <input
                  type="text"
                  value={draft.nome || ''}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#D8B995] mb-1">Famiglia</label>
                <select
                  value={draft.famiglia_olfattiva || 'Legnosa'}
                  onChange={(e) => setDraft({ ...draft, famiglia_olfattiva: e.target.value })}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                >
                  {PURE_FAMILIES.map((f) => (
                    <option key={f} value={f} className="bg-[#140D1C]">{f}</option>
                  ))}
                </select>
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
                className="rounded-full bg-[#D8B995] px-6 py-2 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e] disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Conferma e Salva'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
