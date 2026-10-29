'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarHeart, Sparkles, Check, Trash2, Calendar, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { supabase, Profumo, Momento } from '@/lib/supabase';
import { PageHeader } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { ProfumoDetailModal } from '@/components/ProfumoDetailModal';
import { useToast } from '@/components/Toast';
import { useSpruzzo } from '@/components/Spruzzo';
import { getLocalIsoDate } from '@/lib/home-logic';

export default function DiarioPage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [indossi, setIndossi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale Scheda Dettaglio Condivisa
  const [selectedDetailProfumo, setSelectedDetailProfumo] = useState<Profumo | null>(null);

  // Form Registrazione Rapida Indosso
  const [selectedProfumoId, setSelectedProfumoId] = useState<string>('');
  const [wearData, setWearData] = useState<string>(getLocalIsoDate());
  const [wearMomento, setWearMomento] = useState<Momento>('Mattina');
  const [wearOutfit, setWearOutfit] = useState('');
  const [wearNote, setWearNote] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const accent = '#C98A3A';
  const { showToast } = useToast();
  const { triggerSpruzzo } = useSpruzzo();

  useEffect(() => {
    ;
    fetchDiarioData();
  }, []);

  async function fetchDiarioData() {
    setLoading(true);
    try {
      const [profumiRes, indossiRes] = await Promise.all([
        supabase.from('profumi').select('*').order('nome', { ascending: true }),
        supabase.from('indossi').select('*').order('created_at', { ascending: false }),
      ]);

      if (profumiRes.error) throw profumiRes.error;
      if (indossiRes.error) throw indossiRes.error;

      const profumiList = (profumiRes.data || []) as Profumo[];
      setProfumi(profumiList);
      if (profumiList.length > 0 && !selectedProfumoId) {
        setSelectedProfumoId(profumiList[0].id);
      }

      const profumiMap = new Map(profumiList.map((p) => [p.id, p]));
      const enriched = (indossiRes.data || []).map((item: any) => ({
        ...item,
        profumo: profumiMap.get(item.profumo_id) || null,
      }));
      setIndossi(enriched);
    } catch (err) {
      console.error('Errore caricamento diario:', err);
      showToast('Impossibile caricare il diario olfattivo.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (savingWear || !selectedProfumoId) return;

    setSavingWear(true);
    try {
      const customDate = new Date(`${wearData}T12:00:00`);
      const now = new Date();
      customDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: selectedProfumoId,
          momento_giornata: wearMomento,
          contesto_outfit: wearOutfit.trim() || null,
          note_giorno: wearNote.trim() || null,
          created_at: customDate.toISOString(),
        },
      ]);
      if (error) throw error;

      triggerSpruzzo();
      showToast('Indosso registrato nel Diario.');
      setWearOutfit('');
      setWearNote('');
      fetchDiarioData();
    } catch (err: any) {
      showToast(err?.message || 'Errore salvataggio indosso.', 'error');
    } finally {
      setSavingWear(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      const { error } = await supabase.from('indossi').delete().eq('id', id);
      if (error) throw error;
      showToast('Indosso rimosso dal Diario.');
      fetchDiarioData();
    } catch (err: any) {
      showToast(err?.message || "Errore durante l'eliminazione.", 'error');
    }
  }

  // Statistiche analitiche calcolate sugli indossi
  const stats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    const momentoCounts: Record<string, number> = { Mattina: 0, Pomeriggio: 0, Sera: 0, Notte: 0 };

    indossi.forEach((item) => {
      const fam = item.profumo?.famiglia_olfattiva || 'Altro';
      familyCounts[fam] = (familyCounts[fam] || 0) + 1;

      const mom = item.momento_giornata || 'Mattina';
      if (momentoCounts[mom] !== undefined) {
        momentoCounts[mom]++;
      }
    });

    const total = indossi.length || 1;
    const sortedFamilies = Object.entries(familyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fam, count]) => ({
        famiglia: fam,
        count,
        percent: Math.round((count / total) * 100),
      }));

    return { sortedFamilies, momentoCounts, totalIndossi: indossi.length };
  }, [indossi]);

  function getMomentoIcon(momento: string) {
    switch (momento) {
      case 'Mattina':
        return <Sunrise className="h-4 w-4 text-amber-300" />;
      case 'Pomeriggio':
        return <Sun className="h-4 w-4 text-sky-300" />;
      case 'Sera':
        return <Sunset className="h-4 w-4 text-orange-400" />;
      default:
        return <Moon className="h-4 w-4 text-indigo-300" />;
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-8 pb-36 space-y-10">
      <PageHeader
        title="Diario Olfattivo"
        subtitle="REGISTRO"
      />

      {/* 1. FORM DI REGISTRAZIONE RAPIDA IN EVIDENZA */}
      <section
        style={{ borderColor: '#C98A3A' }}
        className="rounded-[26px] border bg-[#0E0A16] p-6 shadow-2xl space-y-5"
      >
        <div
          style={{ borderColor: '#C98A3A' }}
          className="flex items-center justify-between border-b pb-3"
        >
          <div className="flex items-center gap-2">
            <CalendarHeart style={{ color: '#C98A3A' }} className="h-4 w-4" />
            <span
              style={{ color: '#C98A3A' }}
              className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
            >
              Registra Nuovo Indosso
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase text-[#B8A9C9]">
            Scelta Rapida
          </span>
        </div>

        <form onSubmit={handleSaveIndosso} className="space-y-4 text-xs">
          <div>
            <label htmlFor="select-profumo" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
              Seleziona Fragranza
            </label>
            <select
              id="select-profumo"
              value={selectedProfumoId}
              onChange={(e) => setSelectedProfumoId(e.target.value)}
              style={{ borderColor: '#C98A3A' }}
              className="w-full rounded-[14px] bg-[#161024] border p-3 text-sm text-[#F6EFE4] focus:outline-none"
            >
              {profumi.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#161024]">
                  {p.brand} — {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-data" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Data
              </label>
              <input
                id="input-data"
                type="date"
                value={wearData}
                max={getLocalIsoDate()}
                onChange={(e) => setWearData(e.target.value)}
                style={{ borderColor: '#C98A3A' }}
                className="w-full rounded-[14px] bg-[#161024] border p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="select-momento" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Momento della Giornata
              </label>
              <select
                id="select-momento"
                value={wearMomento}
                onChange={(e) => setWearMomento(e.target.value as Momento)}
                style={{ borderColor: '#C98A3A' }}
                className="w-full rounded-[14px] bg-[#161024] border p-2.5 text-xs text-[#F6EFE4] focus:outline-none"
              >
                <option value="Mattina">Mattina</option>
                <option value="Pomeriggio">Pomeriggio</option>
                <option value="Sera">Sera</option>
                <option value="Notte">Notte</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-outfit" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Contesto o Outfit (facoltativo)
              </label>
              <input
                id="input-outfit"
                type="text"
                value={wearOutfit}
                onChange={(e) => setWearOutfit(e.target.value)}
                placeholder="Es. Ufficio, Abito formale, Casual..."
                style={{ borderColor: '#C98A3A' }}
                className="w-full rounded-[14px] bg-[#161024] border p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="input-note" className="block font-mono text-[10px] uppercase text-[#B8A9C9] mb-1.5">
                Sensazioni / Note (facoltativo)
              </label>
              <input
                id="input-note"
                type="text"
                value={wearNote}
                onChange={(e) => setWearNote(e.target.value)}
                placeholder="Durata, scia, evoluzione sulla pelle..."
                style={{ borderColor: '#C98A3A' }}
                className="w-full rounded-[14px] bg-[#161024] border p-3 text-[#F6EFE4] placeholder:text-[#B8A9C9]/45 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingWear}
              style={{ backgroundColor: '#C98A3A' }}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              <Check className="h-4 w-4" />
              <span>{savingWear ? 'Salvataggio...' : 'Conferma Indosso'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. ANALITICHE E GRAFICI OLFATTIVI */}
      {stats.totalIndossi > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Ripartizione Famiglie Olfattive */}
          <div
            style={{ borderColor: '#C98A3A' }}
            className="rounded-[24px] border bg-[#0E0A16] p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
              <Sparkles style={{ color: '#C98A3A' }} className="h-4 w-4" />
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-[#F6EFE4]">
                Famiglie Olfattive Preferite
              </h3>
            </div>
            <div className="space-y-3 pt-1">
              {stats.sortedFamilies.map(({ famiglia, count, percent }) => (
                <div key={famiglia} className="space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#F6EFE4]">{famiglia}</span>
                    <span className="text-[#B8A9C9]">{count} indossi ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#161024] border border-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: '#C98A3A',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown Momenti della Giornata */}
          <div
            style={{ borderColor: '#C98A3A' }}
            className="rounded-[24px] border bg-[#0E0A16] p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
              <Calendar style={{ color: '#C98A3A' }} className="h-4 w-4" />
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-[#F6EFE4]">
                Indossi per Momento
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {Object.entries(stats.momentoCounts).map(([mom, count]) => (
                <div
                  key={mom}
                  style={{ borderColor: '#C98A3A' }}
                  className="flex flex-col items-center justify-center rounded-[18px] border bg-[#161024] p-4 text-center space-y-1"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {getMomentoIcon(mom)}
                    <span className="font-mono text-[10px] uppercase text-[#B8A9C9]">{mom}</span>
                  </div>
                  <span className="font-serif text-2xl text-[#F6EFE4] font-bold">{count}</span>
                  <span className="font-mono text-[9px] text-[#B8A9C9]">registrazioni</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. CRONOLOGIA DEL DIARIO (TIMELINE STORICA) */}
      <section className="space-y-4">
        <div
          style={{ borderColor: '#C98A3A' }}
          className="inline-block rounded-md bg-[#0E0A16] border px-3.5 py-1"
        >
          <h2
            style={{ color: '#C98A3A' }}
            className="font-mono text-xs uppercase tracking-[0.2em] font-bold"
          >
            Storico Indossi ({indossi.length})
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 rounded-[20px] bg-[#161024]/30" />
            ))}
          </div>
        ) : indossi.length === 0 ? (
          <div
            style={{ borderColor: '#C98A3A' }}
            className="rounded-[24px] border bg-[#0E0A16] p-12 text-center text-xs text-[#B8A9C9]"
          >
            Nessun indosso registrato nel diario. Usa il form sopra per iniziare.
          </div>
        ) : (
          <div className="space-y-3">
            {indossi.map((item) => {
              const profumo = item.profumo;
              if (!profumo) return null;
              const dateStr = new Date(item.created_at).toLocaleDateString('it-IT', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={item.id}
                  style={{ borderColor: '#C98A3A' }}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-[22px] border bg-[#0E0A16] p-4 transition hover:border-white/30 shadow-lg gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      onClick={() => {
                        setSelectedDetailProfumo(profumo);
                        ;
                      }}
                      className="h-14 w-14 flex items-center justify-center shrink-0 cursor-pointer transition group-hover:scale-105"
                    >
                      <BottlePedestal
                        src={profumo.url_foto_vetrina || profumo.immagine_url}
                        alt={profumo.nome}
                        bare={true}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] uppercase text-[#B8A9C9]">
                          {dateStr}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#161024] border border-white/10 px-2.5 py-0.5 font-mono text-[9px] text-[#F6EFE4]">
                          {getMomentoIcon(item.momento_giornata)}
                          <span>{item.momento_giornata}</span>
                        </span>
                      </div>
                      <h4
                        onClick={() => {
                          setSelectedDetailProfumo(profumo);
                          ;
                        }}
                        className="font-serif text-base text-[#F6EFE4] cursor-pointer hover:underline truncate"
                      >
                        {profumo.brand} — <span className="font-bold">{profumo.nome}</span>
                      </h4>
                      {(item.contesto_outfit || item.note_giorno) && (
                        <p className="font-mono text-[11px] text-[#B8A9C9] truncate">
                          {item.contesto_outfit && <span className="text-[#F6EFE4]">Outfit: {item.contesto_outfit}</span>}
                          {item.contesto_outfit && item.note_giorno && ' • '}
                          {item.note_giorno && <span>{item.note_giorno}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteIndosso(item.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#161024] text-red-400 hover:bg-red-500/10 border border-white/10 transition shrink-0 self-end sm:self-center"
                    title="Elimina indosso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SCHEDA DI DETTAGLIO CONDIVISA */}
      <ProfumoDetailModal
        profumo={selectedDetailProfumo}
        onClose={() => {
          setSelectedDetailProfumo(null);
          ;
        }}
        onUpdated={(updated) => {
          setSelectedDetailProfumo(updated);
          setProfumi((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          fetchDiarioData();
        }}
        onDeleted={(deletedId) => {
          setProfumi((prev) => prev.filter((p) => p.id !== deletedId));
          setSelectedDetailProfumo(null);
          fetchDiarioData();
        }}
        onIndossoRegistered={() => {
          fetchDiarioData();
        }}
      />
    </main>
  );
}
