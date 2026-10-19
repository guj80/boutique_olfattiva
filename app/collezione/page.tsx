'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Library,
  Compass,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  ExternalLink,
  Star,
  CheckCircle2,
} from 'lucide-react';
import {
  supabase,
  isCollezioneProfumo,
  isRadarProfumo,
  parsePrezzoEuro,
} from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { BottlePedestal } from '@/components/BottleImage';
import { GlassCard } from '@/components/GlassCard';
import { useAura, resolveAura, SECTION_THEMES } from '@/components/AuraProvider';

export default function CollezionePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [profumi, setProfumi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('tutte');

  const { setCustomAura } = useAura();

  useEffect(() => {
    // Aura dinamica: Blu profondo per Collezione, Ametista per Radar
    setCustomAura(activeTab === 'collezione' ? SECTION_THEMES.collezione : SECTION_THEMES.radar);

    async function fetchItems() {
      try {
        const { data, error } = await supabase
          .from('profumi')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProfumi(data || []);
      } catch (err) {
        console.error('Errore caricamento profumi:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, [activeTab, setCustomAura]);

  const collezioneList = profumi.filter(isCollezioneProfumo);
  const radarList = profumi.filter(isRadarProfumo);
  const currentList = activeTab === 'collezione' ? collezioneList : radarList;

  // Estrae le famiglie presenti per il filtro rapido
  const availableFamilies = Array.from(
    new Set(currentList.map((p) => p.famiglia_olfattiva).filter(Boolean))
  );

  const filteredProfumi = currentList.filter((p) => {
    const matchesSearch =
      (p.nome || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.note_olfattive || '').toLowerCase().includes(searchFilter.toLowerCase());

    const matchesFamily =
      selectedFamily === 'tutte' || p.famiglia_olfattiva === selectedFamily;

    return matchesSearch && matchesFamily;
  });

  const accentColor = activeTab === 'collezione' ? '#38BDF8' : '#C084FC';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-5 pb-36 space-y-7">
      {/* HEADER DI SEZIONE CON LOGO BLACK SU ALONE DEL TEMA */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 border border-white/10 p-2 shadow-lg">
            <Logo variant="black" className="h-full w-full" />
          </div>
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4] tracking-tight">
              {activeTab === 'collezione' ? 'Vault Privato' : 'Radar & Scouting'}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E7C9E]">
              {activeTab === 'collezione'
                ? `${collezioneList.length} flaconi in possesso`
                : `${radarList.length} campioni sotto esame`}
            </p>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center rounded-2xl bg-[#090612] border border-white/10 p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setActiveTab('collezione');
              setSelectedFamily('tutte');
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold transition ${
              activeTab === 'collezione'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow'
                : 'text-[#8E7C9E] hover:text-[#F6EFE4]'
            }`}
          >
            <Library className="h-3.5 w-3.5" />
            <span>Collezione ({collezioneList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('radar');
              setSelectedFamily('tutte');
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold transition ${
              activeTab === 'radar'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow'
                : 'text-[#8E7C9E] hover:text-[#F6EFE4]'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Radar ({radarList.length})</span>
          </button>
        </div>
      </header>

      {/* BARRA FILTRI E RICERCA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E7C9E]" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Cerca per brand, nome o note olfattive..."
            className="w-full rounded-[18px] border border-white/10 bg-[#090612] pl-11 pr-4 py-3.5 text-xs sm:text-sm text-[#F6EFE4] placeholder:text-[#8E7C9E]/60 focus:border-sky-400/50 focus:outline-none"
          />
        </div>

        {/* Filtro Famiglia Rapido */}
        {availableFamilies.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedFamily('tutte')}
              className={`rounded-xl px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider transition shrink-0 border ${
                selectedFamily === 'tutte'
                  ? 'border-white/30 bg-white/10 text-[#F6EFE4]'
                  : 'border-white/10 bg-[#090612] text-[#8E7C9E] hover:border-white/20'
              }`}
            >
              Tutte
            </button>
            {availableFamilies.map((fam) => (
              <button
                key={fam}
                type="button"
                onClick={() => setSelectedFamily(fam)}
                className={`rounded-xl px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider transition shrink-0 border ${
                  selectedFamily === fam
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-[#090612] text-[#8E7C9E] hover:border-white/20'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GRIGLIA FLACONI */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 rounded-[26px] aura-skeleton" />
          ))}
        </div>
      ) : filteredProfumi.length === 0 ? (
        <GlassCard accentColor={accentColor} className="p-10 text-center space-y-3">
          <p className="font-serif text-xl text-[#F6EFE4]">Nessuna fragranza trovata</p>
          <p className="font-mono text-xs text-[#8E7C9E]">
            {searchFilter || selectedFamily !== 'tutte'
              ? 'Prova a modificare i filtri di ricerca.'
              : activeTab === 'collezione'
              ? 'La tua collezione è ancora vuota. Usa lo Scanner AI o il tasto + per aggiungere flaconi.'
              : 'Nessun campione nel Radar. Aggiungi nuove scoperte in fase di valutazione.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
          {filteredProfumi.map((p) => {
            const imgUrl = p.url_foto_vetrina || p.immagine_url;
            const pAura = resolveAura(p.famiglia_olfattiva, p.nome);
            const inCollezione = isCollezioneProfumo(p);

            return (
              <GlassCard
                key={p.id}
                accentColor={pAura.primary}
                className="group flex flex-col justify-between p-4 transition duration-300 hover:-translate-y-1"
              >
                <div>
                  {/* Immagine con Sigillo originale se in Collezione */}
                  <BottlePedestal
                    src={imgUrl}
                    alt={p.nome}
                    size="md"
                    className="!h-36 w-full"
                    showSigil={inCollezione}
                  />

                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        style={{ color: pAura.primary }}
                        className="font-mono text-[9px] uppercase tracking-wider truncate"
                      >
                        {p.brand}
                      </span>
                      {p.famiglia_olfattiva && (
                        <span className="font-mono text-[9px] text-[#8E7C9E] truncate">
                          {p.famiglia_olfattiva}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-base text-[#F6EFE4] leading-snug line-clamp-1">
                      {p.nome}
                    </h3>

                    {p.concentrazione && (
                      <p className="font-mono text-[10px] text-[#B8A9C9]/80">
                        {p.concentrazione} {p.formato_ml ? `• ${p.formato_ml}ml` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Card con Prezzo o Anno */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#F6EFE4]">
                    {p.prezzo_stimato_euro ? `€${parsePrezzoEuro(p)}` : '—'}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400">
                    {p.naso ? `Naso: ${p.naso}` : p.anno_lancio ? `Anno: ${p.anno_lancio}` : ''}
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </main>
  );
}
