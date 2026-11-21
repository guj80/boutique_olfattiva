'use client';

import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  Tag,
  Wind,
  Heart,
  Anchor,
  ChevronDown,
  Wrench,
} from 'lucide-react';
import { supabase, Profumo, Momento } from '@/lib/supabase';
import { apiFetch } from '@/lib/api-fetch';
import { formatPerfumeNote } from '@/lib/dictionary';
import { BottlePedestal } from './BottleImage';
import { resolveAura, useAura } from './AuraProvider';
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
  const { setHideDock } = useAura();
  const prefersReducedMotion = useReducedMotion();

  // Stato per aggiornamento tramite Link ufficiale
  const [toolsOpen, setToolsOpen] = useState(false);
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
      setHideDock(true);
      setEditForm(profumo);
      setIsEditing(false);
      setWearOpen(false);
      setDeleteConfirmId(null);
      setToolsOpen(false);
      setEnrichUrl('');
    } else {
      setHideDock(false);
    }

    // Cleanup: se il modale si chiude in modo anomalo, la dock torna visibile
    return () => setHideDock(false);
  }, [profumo, setHideDock]);

  if (!currentProfumo) return null;

  const modalAura = resolveAura(currentProfumo.famiglia_olfattiva, currentProfumo.nome);
  const seasons = getSeasonsForFamily(currentProfumo.famiglia_olfattiva);
  const pAny = currentProfumo as any;
  // Le proposte dello scouting hanno un id temporaneo: non esistono ancora nel DB
  const isPreview = String(currentProfumo.id).startsWith('preview-');

  const pyramid = [
    { key: 'testa', label: 'Testa', icon: Wind, value: currentProfumo.note_testa, width: 'w-[90%]' },
    { key: 'cuore', label: 'Cuore', icon: Heart, value: currentProfumo.note_cuore, width: 'w-[95%]' },
    { key: 'fondo', label: 'Fondo', icon: Anchor, value: currentProfumo.note_fondo, width: 'w-full' },
  ].filter((layer) => (layer.value || '').trim().length > 0);

  const fallbackNotes = (currentProfumo.note_olfattive || '').trim();

  async function handleEnrichViaLink(e: React.FormEvent) {
    e.preventDefault();
    if (!enrichUrl.trim() || !currentProfumo) return;

    setEnriching(true);
    try {
      const res = await apiFetch('/api/extract', {
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

  const fieldClass =
    'w-full rounded-[14px] bg-[#0E0A16] border border-white/10 p-2.5 text-[#F6EFE4] focus:outline-none focus:border-white/30';

  return (
    <>
      {/* Barra di scorrimento visibile, colorata con l'aura del profumo */}
      <style>{`
        .aura-modal-scroll { scrollbar-width: thin; scrollbar-color: var(--modal-aura) rgba(255,255,255,0.06); }
        .aura-modal-scroll::-webkit-scrollbar { width: 9px; }
        .aura-modal-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 999px; margin: 22px 0; }
        .aura-modal-scroll::-webkit-scrollbar-thumb { background: var(--modal-aura); border-radius: 999px; border: 2px solid #161024; }
        .aura-modal-scroll::-webkit-scrollbar-thumb:hover { filter: brightness(1.2); }
      `}</style>

      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08060C]/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={
            {
              borderColor: `${modalAura.primary}55`,
              '--modal-aura': modalAura.primary,
              '--aura-1': modalAura.primary,
            } as React.CSSProperties
          }
          className="aura-modal-scroll relative w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-[32px] border bg-[#161024] p-6 sm:p-8 text-[#F6EFE4] space-y-7 shadow-2xl"
        >
          <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0E0A16]/80 p-1.5 shadow-lg backdrop-blur-md">
            {!isPreview && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                style={{ color: modalAura.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0E0A16] transition hover:text-white"
                title="Modifica scheda"
                aria-label="Modifica scheda"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0E0A16] text-[#B8A9C9] transition hover:text-white"
              title="Chiudi"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4 pt-2">
              <h3 className="font-serif text-xl text-[#F6EFE4]">Modifica Scheda Tecnica</h3>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                      Maison
                    </label>
                    <input
                      type="text"
                      value={editForm.brand || ''}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                      Creazione
                    </label>
                    <input
                      type="text"
                      value={editForm.nome || ''}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                      Naso
                    </label>
                    <input
                      type="text"
                      value={editForm.naso || ''}
                      onChange={(e) => setEditForm({ ...editForm, naso: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                      Sezione
                    </label>
                    <select
                      value={editForm.stato || 'collezione'}
                      onChange={(e) => setEditForm({ ...editForm, stato: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="collezione">Collezione</option>
                      <option value="radar">Radar</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                    Prezzi per Formato (≥ 30ml)
                  </label>
                  <input
                    type="text"
                    value={editForm.prezzo_stimato_euro || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, prezzo_stimato_euro: e.target.value })
                    }
                    placeholder="Es. 50ml: €190 • 100ml: €260"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                    URL Immagine Flacone
                  </label>
                  <input
                    type="text"
                    value={editForm.url_foto_vetrina || editForm.immagine_url || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, url_foto_vetrina: e.target.value })
                    }
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                    Note di Testa
                  </label>
                  <input
                    type="text"
                    value={editForm.note_testa || ''}
                    onChange={(e) => setEditForm({ ...editForm, note_testa: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                    Note di Cuore
                  </label>
                  <input
                    type="text"
                    value={editForm.note_cuore || ''}
                    onChange={(e) => setEditForm({ ...editForm, note_cuore: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase text-[#B8A9C9]">
                    Note di Fondo
                  </label>
                  <input
                    type="text"
                    value={editForm.note_fondo || ''}
                    onChange={(e) => setEditForm({ ...editForm, note_fondo: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(currentProfumo);
                    setIsEditing(false);
                  }}
                  className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold text-[#B8A9C9] transition hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  style={{ backgroundColor: modalAura.primary }}
                  className="inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Salva</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ───────── 1. IDENTITÀ: boccetta, brand, nome, naso, prezzo ───────── */}
              <section className="flex flex-col items-center pt-2 text-center">
                <div className="relative mb-5">
                  <div
                    className="absolute inset-0 rounded-[36px] opacity-55 blur-2xl"
                    style={{ backgroundColor: modalAura.primary }}
                  />
                  <BottlePedestal
                    src={currentProfumo.url_foto_vetrina || currentProfumo.immagine_url}
                    alt={currentProfumo.nome}
                    size="xl"
                    className="relative z-10"
                    showSigil={false}
                  />
                </div>

                <span
                  style={{ color: modalAura.primary }}
                  className="font-mono text-xs uppercase tracking-[0.2em]"
                >
                  {currentProfumo.brand}
                </span>
                <h2 className="mt-1 font-serif text-3xl text-[#F6EFE4]">
                  {currentProfumo.nome}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-[#B8A9C9]">
                  {currentProfumo.concentrazione || 'Extrait de Parfum'}
                  {currentProfumo.famiglia_olfattiva
                    ? ` • ${currentProfumo.famiglia_olfattiva}`
                    : ''}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {currentProfumo.naso && (
                    <div
                      style={{ borderColor: `${modalAura.primary}40` }}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-[#0E0A16] px-3.5 py-1.5 font-mono text-[11px] text-[#F6EFE4]"
                    >
                      <UserCheck style={{ color: modalAura.primary }} className="h-3.5 w-3.5" />
                      <span>Naso: {currentProfumo.naso}</span>
                    </div>
                  )}
                  {pAny.anno_lancio && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0E0A16] px-3.5 py-1.5 font-mono text-[11px] text-[#B8A9C9]">
                      <Calendar style={{ color: modalAura.primary }} className="h-3.5 w-3.5" />
                      <span>{pAny.anno_lancio}</span>
                    </div>
                  )}
                  {currentProfumo.prezzo_stimato_euro && (
                    <div
                      title="Listino ufficiale (≥ 30ml)"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-[#0E0A16] px-3.5 py-1.5 font-mono text-[11px] text-[#B8A9C9]"
                    >
                      <Tag style={{ color: modalAura.primary }} className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-left">{currentProfumo.prezzo_stimato_euro}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* ───────── 2. PIRAMIDE OLFATTIVA: protagonista ───────── */}
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: `${modalAura.primary}55` }}
                    className="h-px flex-1"
                  />
                  <h3
                    style={{ color: modalAura.primary }}
                    className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]"
                  >
                    Piramide Olfattiva
                  </h3>
                  <span
                    style={{ backgroundColor: `${modalAura.primary}55` }}
                    className="h-px flex-1"
                  />
                </div>

                {pyramid.length > 0 ? (
                  <div className="flex flex-col items-center gap-2.5">
                    {pyramid.map((layer, index) => {
                      const Icon = layer.icon;
                      return (
                        <motion.div
                          key={layer.key}
                          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.4,
                            delay: prefersReducedMotion ? 0 : index * 0.08,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          style={{
                            borderColor: `${modalAura.primary}55`,
                            background: `linear-gradient(135deg, ${modalAura.primary}26 0%, #0E0A16 62%)`,
                            boxShadow: `0 12px 32px -18px ${modalAura.primary}`,
                          }}
                          className={`${layer.width} rounded-[22px] border p-4`}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              style={{
                                backgroundColor: `${modalAura.primary}22`,
                                color: modalAura.primary,
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full"
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span
                              style={{ color: modalAura.primary }}
                              className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
                            >
                              {layer.label}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-[#F6EFE4]">
                            {formatPerfumeNote(layer.value as string)}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : fallbackNotes ? (
                  <div
                    style={{
                      borderColor: `${modalAura.primary}55`,
                      background: `linear-gradient(135deg, ${modalAura.primary}26 0%, #0E0A16 62%)`,
                    }}
                    className="rounded-[22px] border p-4"
                  >
                    <span
                      style={{ color: modalAura.primary }}
                      className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
                    >
                      Note
                    </span>
                    <p className="text-sm leading-relaxed text-[#F6EFE4]">
                      {formatPerfumeNote(fallbackNotes)}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-[22px] border border-white/10 bg-[#0E0A16] p-4 text-center text-xs text-[#B8A9C9]">
                    Piramide non ancora disponibile per questa creazione.
                  </p>
                )}

                {/* Stagioni: dato secondario, volutamente discreto */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[
                    {
                      key: 'primavera',
                      label: 'Primavera',
                      icon: Flower2,
                      on: seasons.primavera,
                      tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
                    },
                    {
                      key: 'estate',
                      label: 'Estate',
                      icon: Sun,
                      on: seasons.estate,
                      tone: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
                    },
                    {
                      key: 'autunno',
                      label: 'Autunno',
                      icon: Leaf,
                      on: seasons.autunno,
                      tone: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
                    },
                    {
                      key: 'inverno',
                      label: 'Inverno',
                      icon: Snowflake,
                      on: seasons.inverno,
                      tone: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10',
                    },
                  ].map((s) => {
                    const SeasonIcon = s.icon;
                    return (
                      <div
                        key={s.key}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-2 ${
                          s.on ? s.tone : 'border-transparent text-[#B8A9C9] opacity-25'
                        }`}
                      >
                        <SeasonIcon className="h-3.5 w-3.5" />
                        <span className="font-mono text-[9px] uppercase tracking-wider">
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ───────── 3. STRUMENTI TECNICI: zona separata e discreta ───────── */}
              {!isPreview && (
                <section className="border-t border-dashed border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setToolsOpen(!toolsOpen)}
                    aria-expanded={toolsOpen}
                    className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left text-[#B8A9C9] transition hover:text-[#F6EFE4]"
                  >
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                      <Wrench className="h-3.5 w-3.5" />
                      Strumenti tecnici
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform motion-reduce:transition-none ${
                        toolsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {toolsOpen && (
                    <div className="mt-3 space-y-2.5 rounded-2xl border border-white/10 bg-[#0E0A16]/70 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">
                          Aggiorna da link ufficiale
                        </span>
                        <span className="text-right font-mono text-[9px] text-[#B8A9C9]/70">
                          Note, prezzi (≥30ml) e foto
                        </span>
                      </div>
                      <form onSubmit={handleEnrichViaLink} className="flex gap-2">
                        <div className="relative flex-1">
                          <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8A9C9]" />
                          <input
                            type="url"
                            value={enrichUrl}
                            onChange={(e) => setEnrichUrl(e.target.value)}
                            placeholder="Incolla URL pagina ufficiale..."
                            className="w-full rounded-[12px] border border-white/10 bg-[#161024] py-2 pl-9 pr-3 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none focus:border-white/30"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={enriching || !enrichUrl.trim()}
                          style={{ borderColor: `${modalAura.primary}60`, color: modalAura.primary }}
                          className="inline-flex items-center gap-1.5 rounded-[12px] border bg-transparent px-3.5 py-2 font-mono text-xs font-bold transition hover:bg-white/5 disabled:opacity-40"
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
                  )}
                </section>
              )}

              {/* ───────── 4. AZIONI ───────── */}
              <section className="space-y-4">
                {wearOpen && (
                  <form
                    onSubmit={handleSaveIndosso}
                    style={{ borderColor: `${modalAura.primary}45` }}
                    className="w-full space-y-3 rounded-2xl border bg-[#0E0A16] p-4 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        style={{ color: modalAura.primary }}
                        className="font-mono text-[10px] font-bold uppercase tracking-wider"
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
                            wearMomento === m ? { backgroundColor: modalAura.primary } : undefined
                          }
                          className={`rounded-xl py-2 text-[11px] font-semibold transition ${
                            wearMomento === m
                              ? 'font-bold text-[#08060C]'
                              : 'border border-white/10 bg-[#161024] text-[#B8A9C9] hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                      <input
                        type="text"
                        value={wearOutfit}
                        onChange={(e) => setWearOutfit(e.target.value)}
                        placeholder="Contesto o outfit (facoltativo)"
                        className="w-full rounded-[12px] border border-white/10 bg-[#161024] px-3 py-2 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={wearNote}
                        onChange={(e) => setWearNote(e.target.value)}
                        placeholder="Sensazioni o note (facoltativo)"
                        className="w-full rounded-[12px] border border-white/10 bg-[#161024] px-3 py-2 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingWear}
                        style={{ backgroundColor: modalAura.primary }}
                        className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{savingWear ? 'Salvataggio...' : 'Conferma Indosso'}</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                  {!isPreview ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(currentProfumo.id)}
                      className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Elimina</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    {!isPreview && !wearOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          setWearMomento(getDefaultMomento());
                          setWearOpen(true);
                        }}
                        style={{ borderColor: `${modalAura.primary}60`, color: modalAura.primary }}
                        className="flex items-center gap-1.5 rounded-full border bg-[#0E0A16] px-4 py-2.5 text-xs font-bold transition hover:bg-white/5"
                      >
                        <CalendarHeart className="h-3.5 w-3.5" />
                        <span>Indosso</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onClose}
                      style={{ backgroundColor: modalAura.primary }}
                      className="rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#08060C]/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-md space-y-4 rounded-[28px] border border-red-500/30 bg-[#161024] p-6 text-[#F6EFE4] shadow-2xl">
            <div className="space-y-1.5">
              <h3 className="font-serif text-xl text-[#F6EFE4]">Rimuovere questa creazione?</h3>
              <p className="text-xs text-[#B8A9C9]">
                Verranno eliminati anche tutti gli indossi registrati nel Diario per questo
                profumo.
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
