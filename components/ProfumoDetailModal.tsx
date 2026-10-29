'use client';

import React, { useState, useEffect } from 'react';
import {
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
  CalendarHeart,
  Link2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { supabase, Profumo, Momento, isRadarProfumo } from '@/lib/supabase';
import { formatPerfumeNote } from '@/lib/dictionary';
import { BottlePedestal } from './BottleImage';
import { useToast } from './Toast';
import { useSpruzzo } from './Spruzzo';

export function getSeasonsForFamily(famiglia?: string | null) {
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

function getDefaultMomento(): Momento {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Mattina';
  if (h >= 12 && h < 18) return 'Pomeriggio';
  if (h >= 18 && h < 23) return 'Sera';
  return 'Notte';
}

interface ProfumoDetailModalProps {
  profumo: Profumo | null;
  onClose: () => void;
  onUpdated?: (updated: Profumo) => void;
  onDeleted?: (deletedId: string) => void;
  onIndossoRegistered?: () => void;
}

export function ProfumoDetailModal({
  profumo,
  onClose,
  onUpdated,
  onDeleted,
  onIndossoRegistered,
}: ProfumoDetailModalProps) {
  const [currentProfumo, setCurrentProfumo] = useState<Profumo | null>(profumo);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Stato per aggiornamento tramite Link ufficiale
  const [enrichUrl, setEnrichUrl] = useState('');
  const [enriching, setEnriching] = useState(false);

  const [wearOpen, setWearOpen] = useState(false);
  const [wearMomento, setWearMomento] = useState<Momento>('Mattina');
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    setCurrentProfumo(profumo);
    if (profumo) {
      setEditForm(profumo);
      setIsEditing(false);
      setWearOpen(false);
      setDeleteConfirmId(null);
      setEnrichUrl('');
    }
  }, [profumo]);

  if (!currentProfumo) return null;

  const modalAccent = '#C98A3A';
  const seasons = getSeasonsForFamily(currentProfumo.famiglia_olfattiva);
  const pAny = currentProfumo as any;
  const isRadarItem = isRadarProfumo(currentProfumo);

  async function handleEnrichViaLink(e: React.FormEvent) {
    e.preventDefault();
    if (!enrichUrl.trim() || !currentProfumo) return;

    setEnriching(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: enrichUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile estrarre i dati dal link.');

      const updatedPayload = {
        nome: data.nome || currentProfumo.nome,
        brand: data.brand || currentProfumo.brand,
        concentrazione: data.concentrazione || currentProfumo.concentrazione,
        famiglia_olfattiva: data.famiglia_olfattiva || currentProfumo.famiglia_olfattiva,
        naso: data.naso || currentProfumo.naso,
        prezzo_stimato_euro: data.prezzo_stimato_euro || currentProfumo.prezzo_stimato_euro,
        note_testa: data.note_testa || currentProfumo.note_testa,
        note_cuore: data.note_cuore || currentProfumo.note_cuore,
        note_fondo: data.note_fondo || currentProfumo.note_fondo,
        url_foto_vetrina: data.url_foto_vetrina || currentProfumo.url_foto_vetrina,
      };

      const { error } = await supabase
        .from('profumi')
        .update(updatedPayload)
        .eq('id', currentProfumo.id);

      if (error) throw error;

      const updated = { ...currentProfumo, ...updatedPayload };
      setCurrentProfumo(updated);
      setEditForm(updated);
      setEnrichUrl('');
      onUpdated?.(updated);
      showToast('Scheda aggiornata con successo dal link ufficiale.');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante l’aggiornamento dal link.', 'error');
    } finally {
      setEnriching(false);
    }
  }

  async function handleSaveEdit() {
    if (!currentProfumo) return;
    try {
      const { error } = await supabase
        .from('profumi')
        .update({
          nome: editForm.nome,
          brand: editForm.brand,
          concentrazione: editForm.concentrazione,
          famiglia_olfattiva: editForm.famiglia_olfattiva,
          naso: editForm.naso || null,
          prezzo_stimato_euro: editForm.prezzo_stimato_euro || null,
          url_foto_vetrina: editForm.url_foto_vetrina,
          note_testa: editForm.note_testa,
          note_cuore: editForm.note_cuore,
          note_fondo: editForm.note_fondo,
          stato: editForm.stato,
        })
        .eq('id', currentProfumo.id);

      if (error) throw error;

      const updated = { ...currentProfumo, ...editForm };
      setCurrentProfumo(updated);
      setIsEditing(false);
      onUpdated?.(updated);
      showToast('Scheda aggiornata.');
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'aggiornamento.", 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('profumi').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirmId(null);
      onDeleted?.(id);
      onClose();
      showToast('Flacone rimosso.');
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'eliminazione.", 'error');
    }
  }

  async function handleSaveIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProfumo) return;
    setSavingWear(true);
    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: currentProfumo.id,
          momento_giornata: wearMomento,
          contesto_outfit: wearOutfit.trim() || null,
          note_giorno: wearNote.trim() || null,
        },
      ]);
      if (error) throw error;
      triggerSpruzzo();
      showToast(`Indosso registrato (${wearMomento}).`);
      setWearOpen(false);
      setWearOutfit('');
      setWearNote('');
      onIndossoRegistered?.();
    } catch (err: any) {
      showToast(err?.message || 'Errore registrazione indosso.', 'error');
    } finally {
      setSavingWear(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08060C]/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ borderColor: '#C98A3A' }}
          className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-[32px] border bg-[#161024] p-6 sm:p-8 text-[#F6EFE4] space-y-6 shadow-2xl no-scrollbar mb-16"
        >
          <div className="absolute right-5 top-5 flex items-center gap-2 z-20">
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{ color: '#C98A3A' }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] hover:text-white border border-white/10 transition"
              title="Modifica scheda"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E0A16] text-[#B8A9C9] hover:text-white border border-white/10 transition"
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
                      Maison
                    </label>
                    <input
                      type="text"
                      value={editForm.brand || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, brand: e.target.value })
                      }
                      className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                      Creazione
                    </label>
                    <input
                      type="text"
                      value={editForm.nome || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nome: e.target.value })
                      }
                      className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                      Naso
                    </label>
                    <input
                      type="text"
                      value={editForm.naso || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, naso: e.target.value })
                      }
                      className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                      Sezione
                    </label>
                    <select
                      value={editForm.stato || 'collezione'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, stato: e.target.value })
                      }
                      className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
                    >
                      <option value="collezione">Collezione</option>
                      <option value="radar">Radar</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1">
                    Prezzi per Formato (≥ 30ml)
                  </label>
                  <input
                    type="text"
                    value={editForm.prezzo_stimato_euro || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        prezzo_stimato_euro: e.target.value,
                      })
                    }
                    placeholder="Es. 50ml: €190 • 100ml: €260"
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
                  />
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
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
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
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
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
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
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
                    className="w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4]"
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
                  style={{ backgroundColor: '#C98A3A' }}
                  className="flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-[#08060C]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Salva</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center pt-2">
                <div className="relative mb-4">
                  <div
                    className="absolute inset-0 rounded-[36px] blur-2xl opacity-55"
                    style={{ backgroundColor: '#C98A3A' }}
                  />
                  <BottlePedestal
                    src={
                      currentProfumo.url_foto_vetrina ||
                      currentProfumo.immagine_url
                    }
                    alt={currentProfumo.nome}
                    size="xl"
                    className="relative z-10"
                    showSigil={false}
                  />
                </div>

                <span
                  style={{ color: '#C98A3A' }}
                  className="font-mono text-xs uppercase tracking-[0.2em]"
                >
                  {currentProfumo.brand}
                </span>
                <h2 className="font-serif text-3xl text-[#F6EFE4] mt-1">
                  {currentProfumo.nome}
                </h2>
                <p className="font-mono text-[11px] text-[#B8A9C9] mt-1">
                  {currentProfumo.concentrazione || 'Extrait de Parfum'} •{' '}
                  {currentProfumo.famiglia_olfattiva}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {currentProfumo.naso && (
                    <div
                      style={{ borderColor: '#C98A3A' }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0E0A16] px-3.5 py-1.5 border font-mono text-[11px] text-[#F6EFE4]"
                    >
                      <UserCheck
                        style={{ color: '#C98A3A' }}
                        className="h-3.5 w-3.5"
                      />
                      <span>Naso: {currentProfumo.naso}</span>
                    </div>
                  )}
                  {pAny.anno_lancio && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0E0A16] px-3.5 py-1.5 border border-white/10 font-mono text-[11px] text-[#B8A9C9]">
                      <Calendar
                        style={{ color: '#C98A3A' }}
                        className="h-3.5 w-3.5"
                      />
                      <span>Anno: {pAny.anno_lancio}</span>
                    </div>
                  )}
                </div>

                {/* Sezione Aggiornamento tramite Link Ufficiale */}
                <div className="mt-5 w-full rounded-2xl bg-[#0E0A16] p-4 border border-white/10 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span
                      style={{ color: '#C98A3A' }}
                      className="font-mono text-[10px] uppercase tracking-wider font-bold"
                    >
                      Aggiorna da Link Ufficiale
                    </span>
                    <span className="font-mono text-[9px] text-[#B8A9C9]">
                      Estrae note, prezzi (≥30ml) e foto
                    </span>
                  </div>
                  <form onSubmit={handleEnrichViaLink} className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A9C9]" />
                      <input
                        type="url"
                        value={enrichUrl}
                        onChange={(e) => setEnrichUrl(e.target.value)}
                        placeholder="Incolla URL pagina ufficiale..."
                        className="w-full rounded-[12px] bg-[#161024] border border-white/10 pl-9 pr-3 py-2 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={enriching || !enrichUrl.trim()}
                      style={{ backgroundColor: '#C98A3A' }}
                      className="inline-flex items-center gap-1.5 rounded-[12px] px-4 py-2 font-mono text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-40"
                    >
                      {enriching ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>{enriching ? 'Lettura...' : 'Aggiorna'}</span>
                    </button>
                  </form>
                </div>

                {/* Mostra Prezzo se presente */}
                {currentProfumo.prezzo_stimato_euro && (
                  <div className="mt-4 w-full rounded-2xl bg-[#0E0A16] p-3.5 border border-white/10 text-center">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9] block mb-1">
                      Listino Ufficiale (≥ 30ml)
                    </span>
                    <span className="font-mono text-xs text-[#F6EFE4] font-bold">
                      {currentProfumo.prezzo_stimato_euro}
                    </span>
                  </div>
                )}

                <div className="mt-5 w-full space-y-2.5 text-left">
                  <h3
                    style={{ color: '#C98A3A' }}
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    Piramide Olfattiva
                  </h3>
                  <div className="space-y-2 text-xs">
                    {currentProfumo.note_testa && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#0E0A16] px-4 py-2.5 border border-white/10">
                        <span
                          style={{ color: '#C98A3A' }}
                          className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                        >
                          Testa
                        </span>
                        <span className="text-left sm:text-right text-[#F6EFE4]">
                          {formatPerfumeNote(currentProfumo.note_testa)}
                        </span>
                      </div>
                    )}
                    {currentProfumo.note_cuore && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#0E0A16] px-4 py-2.5 border border-white/10">
                        <span
                          style={{ color: '#C98A3A' }}
                          className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                        >
                          Cuore
                        </span>
                        <span className="text-left sm:text-right text-[#F6EFE4]">
                          {formatPerfumeNote(currentProfumo.note_cuore)}
                        </span>
                      </div>
                    )}
                    {currentProfumo.note_fondo && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-[16px] bg-[#0E0A16] px-4 py-2.5 border border-white/10">
                        <span
                          style={{ color: '#C98A3A' }}
                          className="font-mono text-[10px] uppercase tracking-wider font-bold shrink-0"
                        >
                          Fondo
                        </span>
                        <span className="text-left sm:text-right text-[#F6EFE4]">
                          {formatPerfumeNote(currentProfumo.note_fondo)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 w-full grid grid-cols-4 gap-2 rounded-2xl bg-[#0E0A16]/90 p-2.5 border border-white/10">
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

              {wearOpen && (
                <form
                  onSubmit={handleSaveIndosso}
                  style={{ borderColor: '#C98A3A' }}
                  className="w-full rounded-2xl bg-[#0E0A16] p-4 border space-y-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{ color: '#C98A3A' }}
                      className="font-mono text-[10px] uppercase tracking-wider font-bold"
                    >
                      Registra nel Diario Olfattivo
                    </span>
                    <button
                      type="button"
                      onClick={() => setWearOpen(false)}
                      className="text-xs text-[#B8A9C9] hover:text-white"
                    >
                      Annulla
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as Momento[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setWearMomento(m)}
                        style={
                          wearMomento === m
                            ? { backgroundColor: '#C98A3A' }
                            : undefined
                        }
                        className={`rounded-xl py-2 text-[11px] font-semibold transition ${
                          wearMomento === m
                            ? 'text-[#08060C] font-bold'
                            : 'bg-[#161024] text-[#B8A9C9] border border-white/10 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <input
                      type="text"
                      value={wearOutfit}
                      onChange={(e) => setWearOutfit(e.target.value)}
                      placeholder="Contesto o outfit (facoltativo)"
                      className="w-full rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={wearNote}
                      onChange={(e) => setWearNote(e.target.value)}
                      placeholder="Sensazioni o note (facoltativo)"
                      className="w-full rounded-[12px] bg-[#161024] border border-white/10 px-3 py-2 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingWear}
                      style={{ backgroundColor: '#C98A3A' }}
                      className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{savingWear ? 'Salvataggio...' : 'Conferma Indosso'}</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => setDeleteConfirmId(currentProfumo.id)}
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Rimuovi</span>
                </button>

                <div className="flex items-center gap-2">
                  {!wearOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setWearMomento(getDefaultMomento());
                        setWearOpen(true);
                      }}
                      style={{ borderColor: '#C98A3A', color: '#C98A3A' }}
                      className="flex items-center gap-1.5 rounded-full border bg-[#0E0A16] px-4 py-2.5 text-xs font-bold transition hover:bg-white/5"
                    >
                      <CalendarHeart className="h-3.5 w-3.5" />
                      <span>Indossato oggi</span>
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    style={{ backgroundColor: '#C98A3A' }}
                    className="rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#08060C]/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/30 bg-[#161024] p-6 text-[#F6EFE4] space-y-4 shadow-2xl">
            <div className="space-y-1.5">
              <h3 className="font-serif text-xl text-[#F6EFE4]">
                Rimuovere questa creazione?
              </h3>
              <p className="text-xs text-[#B8A9C9]">
                Verranno eliminati anche tutti gli indossi registrati nel Diario per questo profumo.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-red-500"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
