'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  Plus,
  FlaskConical,
  Crown,
  Sparkles,
  Droplets,
  Feather,
  Sun,
  Sunset,
  Moon,
  Stars,
} from 'lucide-react';
import { supabase, Profumo, Momento, isCollezioneProfumo } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { resolveAura, useAura } from '@/components/AuraProvider';
import { SmartBottleImage } from '@/components/BottleImage';
import { useToast } from '@/components/Toast';

const MOMENTI: Array<{ key: Momento; label: string; icon: any }> = [
  { key: 'Mattina', label: 'Mattina', icon: Sun },
  { key: 'Pomeriggio', label: 'Pomeriggio', icon: Sunset },
  { key: 'Sera', label: 'Sera', icon: Moon },
  { key: 'Notte', label: 'Notte', icon: Stars },
];

export default function DiarioPage() {
  const [indossi, setIndossi] = useState<any[]>([]);
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Stato per inserimento Diario Multiplo Giornaliero
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [selectedMomento, setSelectedMomento] = useState<Momento>('Mattina');
  const [contestoOutfit, setContestoOutfit] = useState<string>('');
  const [noteGiorno, setNoteGiorno] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const { aura, setAuraFromProfumo } = useAura();
  const { showToast } = useToast();

  useEffect(() => {
    fetchDiario();
  }, []);

  async function fetchDiario() {
    setLoading(true);
    try {
      const [{ data: indossiData, error: errIndossi }, { data: profumiData, error: errProfumi }] =
        await Promise.all([
          supabase.from('indossi').select('*').order('created_at', { ascending: false }),
          supabase.from('profumi').select('*').order('nome', { ascending: true }),
        ]);

      if (errIndossi) throw errIndossi;
      if (errProfumi) throw errProfumi;

      const listProfumi = profumiData || [];
      setProfumi(listProfumi);
      if (listProfumi.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(listProfumi[0].id);
      }

      const profumiMap = new Map(listProfumi.map((p: any) => [p.id, p]));
      const enriched = (indossiData || []).map((item: any) => ({
        ...item,
        profumi: profumiMap.get(item.profumo_id) || null,
      }));

      setIndossi(enriched);
    } catch (err) {
      console.error('Errore caricamento diario:', err);
      showToast('Impossibile caricare il diario olfattivo.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumoId) {
      showToast('Seleziona una fragranza.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Inserimento multiplo senza alcuna sovrascrittura nello stesso giorno
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: selectedProfumoId,
          momento_giornata: selectedMomento,
          contesto_outfit: contestoOutfit.trim() || null,
          note_giorno: noteGiorno.trim() || null,
        },
      ]);

      if (error) throw error;

      const chosen = profumi.find((p) => p.id === selectedProfumoId);
      if (chosen) setAuraFromProfumo(chosen);

      setContestoOutfit('');
      setNoteGiorno('');
      showToast(`Indosso (${selectedMomento}) registrato nel Diario.`);
      fetchDiario();
    } catch (err: any) {
      showToast(err?.message || 'Errore nella registrazione.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      const { error } = await supabase.from('indossi').delete().eq('id', id);
      if (error) throw error;
      setIndossi((prev) => prev.filter((item) => item.id !== id));
      setDeleteId(null);
      showToast('Registrazione rimossa.');
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'eliminazione.", 'error');
    }
  }

  // STATISTICHE EVOLUTE DELLA BOUTIQUE E DELL'ATELIER
  const boutiqueStats = useMemo(() => {
    const flaconiCollezione = profumi.filter(isCollezioneProfumo);
    const maisonsSet = new Set(profumi.map((p) => p.brand).filter(Boolean));
    const nasiSet = new Set(profumi.map((p) => p.naso).filter(Boolean));

    const famCount: Record<string, number> = {};
    profumi.forEach((p) => {
      if (p.famiglia_olfattiva) {
        famCount[p.famiglia_olfattiva] = (famCount[p.famiglia_olfattiva] || 0) + 1;
      }
    });
    const famigliaDominante =
      Object.entries(famCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const profumiIndossatiCount: Record<string, number> = {};
    indossi.forEach((item) => {
      const pName = item.profumi?.nome;
      if (pName) {
        profumiIndossatiCount[pName] = (profumiIndossatiCount[pName] || 0) + 1;
      }
    });
    const signatureScent =
      Object.entries(profumiIndossatiCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return {
      totaleFlaconi: flaconiCollezione.length,
      totaleMaisons: maisonsSet.size,
      totaleNasi: nasiSet.size,
      famigliaDominante,
      signatureScent,
      totaleIndossi: indossi.length,
    };
  }, [profumi, indossi]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-8 pb-36 space-y-8">
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
        <span
          style={{ color: aura.primary }}
          className="font-mono text-xs uppercase tracking-widest"
        >
          Diario &amp; Metriche d&apos;Atelier
        </span>
      </header>

      {/* STATISTICHE DELLA COLLEZIONE CON SIMBOLI D'ALTA PROFUMERIA */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
              Signature Scent
            </span>
            <Crown style={{ color: aura.primary }} className="h-4 w-4" />
          </div>
          <p className="font-serif text-xl text-[#F6EFE4] truncate">
            {boutiqueStats.signatureScent}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
              Accordo Dominante
            </span>
            <Droplets style={{ color: aura.primary }} className="h-4 w-4" />
          </div>
          <p className="font-serif text-xl text-[#F6EFE4] truncate">
            {boutiqueStats.famigliaDominante}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
              Maisons &amp; Nasi
            </span>
            <Feather style={{ color: aura.primary }} className="h-4 w-4" />
          </div>
          <p className="font-serif text-xl text-[#F6EFE4]">
            {boutiqueStats.totaleMaisons} Maisons • {boutiqueStats.totaleNasi} Nasi
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
              Rituali Registrati
            </span>
            <FlaskConical style={{ color: aura.primary }} className="h-4 w-4" />
          </div>
          <p className="font-serif text-xl text-[#F6EFE4]">
            {boutiqueStats.totaleIndossi} Indossi
          </p>
        </div>
      </section>

      {/* REGISTRAZIONE DIARIO MULTIPLO (MATTINA / POMERIGGIO / SERA / NOTTE SENZA SOVRASCRITTURE) */}
      <section
        style={{ borderColor: `${aura.primary}35` }}
        className="rounded-[28px] border bg-[#1E1428]/95 p-6 space-y-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles style={{ color: aura.primary }} className="h-4 w-4" />
            <h2 className="font-serif text-xl text-[#F6EFE4]">
              Registra Indosso Giornaliero Multiplo
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#B8A9C9]">
            Layering &amp; Cambio Fragranza
          </span>
        </div>

        <form onSubmit={handleAddIndosso} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9] mb-1.5">
                Creazione Scelta
              </label>
              <select
                value={selectedProfumoId}
                onChange={(e) => setSelectedProfumoId(e.target.value)}
                className="w-full rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-3 text-xs text-[#F6EFE4] focus:outline-none"
              >
                {profumi.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#140D1C]">
                    {p.brand} — {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9] mb-1.5">
                Momento della Giornata
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {MOMENTI.map((m) => {
                  const Icon = m.icon;
                  const active = selectedMomento === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMomento(m.key)}
                      style={active ? { backgroundColor: aura.primary } : undefined}
                      className={`flex flex-col items-center justify-center gap-1 rounded-[14px] py-2 text-[10px] font-mono transition ${
                        active
                          ? 'text-[#140D1C] font-bold'
                          : 'bg-[#140D1C] text-[#B8A9C9] border border-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={contestoOutfit}
              onChange={(e) => setContestoOutfit(e.target.value)}
              placeholder="Occasione o tenuta (es. Abito sartoriale, Cena, Atelier...)"
              className="w-full rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-2.5 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45"
            />
            <input
              type="text"
              value={noteGiorno}
              onChange={(e) => setNoteGiorno(e.target.value)}
              placeholder="Annotazioni olfattive sulla pelle o evoluzione..."
              className="w-full rounded-[16px] border border-white/10 bg-[#140D1C] px-4 py-2.5 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/45"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || profumi.length === 0}
              style={{ backgroundColor: aura.primary }}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-[#140D1C] transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Registrazione...' : 'Aggiungi al Diario'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* REGISTRO STORICO DEGLI INDOSSI */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl text-[#F6EFE4] px-1">
          Archivio degli Indossi
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-[20px] aura-skeleton" />
            ))}
          </div>
        ) : indossi.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-12 text-center space-y-2">
            <p className="font-serif text-xl text-[#F6EFE4]">
              Nessun indosso registrato
            </p>
            <p className="text-xs text-[#B8A9C9]">
              Utilizza il pannello superiore per registrare le fragranze indossate nella giornata.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {indossi.map((item) => {
              const p = item.profumi;
              const pAura = p ? resolveAura(p.famiglia_olfattiva, p.nome) : aura;
              const dateStr = new Date(item.created_at).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={item.id}
                  style={{ borderColor: `${pAura.primary}38` }}
                  className="flex items-center justify-between gap-4 rounded-[22px] border bg-[#1E1428]/90 p-4 transition"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <SmartBottleImage
                      src={p?.url_foto_vetrina || p?.immagine_url}
                      alt={p?.nome || 'Flacone'}
                      iconSize="w-5 h-5"
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        style={{ color: pAura.primary }}
                        className="font-mono text-[10px] uppercase tracking-wider"
                      >
                        {dateStr} • {item.momento_giornata || 'Mattina'}{' '}
                        {item.contesto_outfit ? `• ${item.contesto_outfit}` : ''}
                      </p>
                      <h3 className="font-serif text-xl text-[#F6EFE4] truncate mt-0.5">
                        {p ? `${p.brand} — ${p.nome}` : 'Creazione rimossa'}
                      </h3>
                      {item.note_giorno && (
                        <p className="text-xs text-[#B8A9C9] truncate mt-0.5">
                          &ldquo;{item.note_giorno}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteId(item.id)}
                    title="Elimina indosso"
                    className="p-2 text-[#B8A9C9] hover:text-red-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/30 bg-[#1E1428] p-6 text-[#F6EFE4] space-y-4 shadow-2xl">
            <h3 className="font-serif text-xl text-[#F6EFE4]">
              Rimuovere questo indosso?
            </h3>
            <p className="text-xs text-[#B8A9C9]">
              La voce verrà eliminata dall&apos;archivio del diario.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#B8A9C9]"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteIndosso(deleteId)}
                className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-red-500"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
