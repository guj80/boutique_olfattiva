'use client';

import React, { useState } from 'react';
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
  Upload,
} from 'lucide-react';
import { supabase, Profumo } from '@/lib/supabase';

export default function ScannerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'photo' | 'name'>('url');

  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Partial<Profumo> | null>(null);
  const [targetStato, setTargetStato] = useState<'collezione' | 'radar'>('collezione');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1100;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setImagePreview(compressedDataUrl);
        setImageMime('image/jpeg');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtracting(true);
    setDraft(null);

    try {
      const payload: Record<string, any> = {};
      if (mode === 'url') {
        if (!inputUrl.trim()) throw new Error('Inserisci un URL valido.');
        payload.url = inputUrl.trim();
      } else if (mode === 'name') {
        if (!inputName.trim()) throw new Error('Inserisci Brand e Nome.');
        payload.queryName = inputName.trim();
      } else if (mode === 'photo') {
        if (!imagePreview) throw new Error('Seleziona una foto.');
        payload.imageBase64 = imagePreview;
        payload.mimeType = imageMime;
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore estrazione AI');

      setDraft({
        nome: data.nome || '',
        brand: data.brand || '',
        concentrazione: data.concentrazione || 'Extrait de Parfum',
        famiglia_olfattiva: data.famiglia_olfattiva || '',
        note_testa: data.note_testa || '',
        note_cuore: data.note_cuore || '',
        note_fondo: data.note_fondo || '',
        note_olfattive: data.note_olfattive || '',
        descrizione_ai: data.descrizione_ai || '',
        prezzo_stimato_euro: data.prezzo_stimato_euro || '€180',
        url_foto_vetrina: data.url_foto_vetrina || '',
        stagione_ideale: data.stagione_ideale || '',
        occasione_ideale: data.occasione_ideale || '',
        voto_longevita: Number(data.voto_longevita) || 8,
        voto_scia: Number(data.voto_scia) || 8,
        voto_proiezione: Number(data.voto_proiezione) || 8,
        voto_complessita: Number(data.voto_complessita) || 8,
        note_mouche: '',
        note_pelle: '',
      });
    } catch (err: any) {
      alert(err?.message || 'Impossibile estrarre i dati.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveToVault(e: React.FormEvent) {
    e.preventDefault();
    if (!draft?.nome || !draft?.brand) {
      alert('Brand e Nome sono obbligatori.');
      return;
    }

    setSaving(true);
    try {
      const unified =
        draft.note_olfattive ||
        [draft.note_testa, draft.note_cuore, draft.note_fondo]
          .filter(Boolean)
          .join(', ');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || undefined;

      const fullPayload: Record<string, any> = {
        nome: draft.nome,
        brand: draft.brand,
        concentrazione: draft.concentrazione,
        famiglia_olfattiva: draft.famiglia_olfattiva,
        note_testa: draft.note_testa,
        note_cuore: draft.note_cuore,
        note_fondo: draft.note_fondo,
        note_olfattive: unified,
        descrizione_ai: draft.descrizione_ai,
        prezzo_stimato_euro: draft.prezzo_stimato_euro,
        url_foto_vetrina: draft.url_foto_vetrina || null,
        stagione_ideale: draft.stagione_ideale,
        occasione_ideale: draft.occasione_ideale,
        voto_longevita: draft.voto_longevita,
        voto_scia: draft.voto_scia,
        voto_proiezione: draft.voto_proiezione,
        voto_complessita: draft.voto_complessita,
        note_mouche: draft.note_mouche || null,
        note_pelle: draft.note_pelle || null,
        stato: targetStato,
        ...(userId ? { user_id: userId } : {}),
      };

      const { error } = await supabase.from('profumi').insert([fullPayload]);

      if (error) {
        const minimalPayload: Record<string, any> = {
          nome: draft.nome,
          brand: draft.brand,
          famiglia_olfattiva: draft.famiglia_olfattiva,
          note_olfattive: unified,
          ...(userId ? { user_id: userId } : {}),
        };
        const { error: fallbackErr } = await supabase
          .from('profumi')
          .insert([minimalPayload]);
        if (fallbackErr) throw fallbackErr;
      }

      router.push(
        targetStato === 'radar' ? '/collezione?vista=radar' : '/collezione'
      );
    } catch (err: any) {
      alert(`Errore salvataggio: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-4xl mx-auto w-full">
      {/* HEADER */}
      <div className="flex items-center gap-4 pb-6 border-b border-[#F7E7CE]/15">
        <Link
          href="/"
          className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#C5A059]">
            Boutique Olfattiva di Luca
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl text-white">
            AI Scanner &amp; Estrattore
          </h1>
        </div>
      </div>

      {/* SELETTORE 3 MODALITÀ COMPATTO */}
      <section className="mt-6 boutique-glass rounded-2xl p-6">
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider border transition ${
              mode === 'url'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold border-transparent'
                : 'bg-[#08080A] text-zinc-400 border-[#F7E7CE]/20 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Web</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider border transition ${
              mode === 'photo'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold border-transparent'
                : 'bg-[#08080A] text-zinc-400 border-[#F7E7CE]/20 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Fotocamera</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('name')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider border transition ${
              mode === 'name'
                ? 'bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-semibold border-transparent'
                : 'bg-[#08080A] text-zinc-400 border-[#F7E7CE]/20 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nome</span>
          </button>
        </div>

        <form onSubmit={handleExtract} className="space-y-4">
          {mode === 'url' && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1.5">
                URL Pagina Prodotto
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/25 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#F7E7CE]"
              />
            </div>
          )}

          {mode === 'name' && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mb-1.5">
                Brand e Nome Fragranza
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Es. Lorenzo Pazzaglia Carbonara"
                className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/25 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#F7E7CE]"
              />
            </div>
          )}

          {mode === 'photo' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border border-dashed border-[#F7E7CE]/30 rounded-2xl p-6 cursor-pointer hover:border-[#F7E7CE] transition bg-[#08080A]/60">
                <Upload className="w-6 h-6 text-[#C5A059] mb-1.5" />
                <span className="text-xs font-mono uppercase tracking-wider text-[#F7E7CE]">
                  Scatta foto o carica immagine
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {imagePreview && (
                <div className="flex justify-center">
                  <img
                    src={imagePreview}
                    alt="Anteprima"
                    className="max-h-48 rounded-xl border border-[#F7E7CE]/30 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={extracting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-semibold uppercase tracking-wider shadow-champagne-glow hover:opacity-95 transition disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Estrazione...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Estrai Scheda</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* SCHEDA DI ANTEPRIMA EDITABILE */}
      {draft && (
        <section className="mt-6 boutique-glass rounded-2xl p-6 border-[#C5A059]/40">
          <form onSubmit={handleSaveToVault} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F7E7CE]/15">
              <div className="flex items-center gap-3.5">
                {draft.url_foto_vetrina && (
                  <img
                    src={draft.url_foto_vetrina}
                    alt={draft.nome}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-14 h-14 rounded-xl bg-[#08080A] border border-[#F7E7CE]/25 object-contain p-1"
                  />
                )}
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                    Anteprima Scheda
                  </span>
                  <h2 className="font-serif text-2xl text-white mt-0.5">
                    {draft.nome} — <span className="text-[#C5A059]">{draft.brand}</span>
                  </h2>
                </div>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-[#08080A] border border-[#F7E7CE]/25 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTargetStato('collezione')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs uppercase transition ${
                    targetStato === 'collezione'
                      ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                      : 'text-zinc-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Collezione</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStato('radar')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs uppercase transition ${
                    targetStato === 'radar'
                      ? 'bg-[#F7E7CE] text-[#08080A] font-semibold'
                      : 'text-zinc-400'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Testing</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={draft.brand || ''}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={draft.nome || ''}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Famiglia Olfattiva
                </label>
                <input
                  type="text"
                  value={draft.famiglia_olfattiva || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, famiglia_olfattiva: e.target.value })
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
                  value={draft.prezzo_stimato_euro || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, prezzo_stimato_euro: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                URL Immagine
              </label>
              <input
                type="text"
                value={draft.url_foto_vetrina || ''}
                onChange={(e) =>
                  setDraft({ ...draft, url_foto_vetrina: e.target.value })
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
                <textarea
                  rows={2}
                  value={draft.note_testa || ''}
                  onChange={(e) => setDraft({ ...draft, note_testa: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note di Cuore
                </label>
                <textarea
                  rows={2}
                  value={draft.note_cuore || ''}
                  onChange={(e) => setDraft({ ...draft, note_cuore: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Note di Fondo
                </label>
                <textarea
                  rows={2}
                  value={draft.note_fondo || ''}
                  onChange={(e) => setDraft({ ...draft, note_fondo: e.target.value })}
                  className="w-full rounded-xl bg-[#08080A] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#08080A]/80 border border-[#F7E7CE]/15">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Su Mouche
                </label>
                <textarea
                  rows={2}
                  value={draft.note_mouche || ''}
                  onChange={(e) => setDraft({ ...draft, note_mouche: e.target.value })}
                  className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#C5A059] mb-1">
                  Su Pelle
                </label>
                <textarea
                  rows={2}
                  value={draft.note_pelle || ''}
                  onChange={(e) => setDraft({ ...draft, note_pelle: e.target.value })}
                  className="w-full rounded-xl bg-[#0D0D11] border border-[#F7E7CE]/20 p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F7E7CE] to-[#C5A059] text-[#08080A] font-mono text-xs font-semibold uppercase tracking-wider shadow-champagne-glow hover:opacity-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? '...' : 'Salva'}</span>
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
