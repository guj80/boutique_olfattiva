'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  ScanLine,
  ChevronRight,
  RefreshCw,
  FlaskConical,
  BookOpen,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  Indosso,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
} from '@/lib/supabase';

const METEO = [
  'Soleggiato e Caldo',
  'Temperato Primaverile',
  'Fresco Autunnale',
  'Piovoso e Umido',
  'Freddo Invernale',
];
const CONTESTI = ['Ufficio', 'Aperitivo', 'Cena', 'Serata', 'Evento'];
const PROFILI = [
  'Legnoso / Ambrato / Deciso',
  'Agrumato / Fresco / Pulito',
  'Speziato / Boozy / Caldo',
  'Gourmand / Ricco',
  'Marino / Aromatizzato',
  'Cuoiato / Incensato / Fumoso',
];
const MOMENTI = ['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const;

function PerfumeBottleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="3" rx="1" />
      <path d="M10 5v2h4V5" />
      <rect x="5" y="7" width="14" height="15" rx="3" />
      <path d="M15 4h4" />
      <path d="M18 2l2 2-2 2" />
      <rect x="8.5" y="11" width="7" height="6" rx="1" />
    </svg>
  );
}

function SmartBottleImage({
  src,
  alt,
  className,
  iconSize = 'w-5 h-5',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    return (
      <div className="bottle-ph">
        <FlaskConical className={`${iconSize} stroke-[1.2]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === 'direct') setStage('proxy');
        else setStage('failed');
      }}
    />
  );
}

type Opt = string | { value: string; label: string };

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const { value: v, label: l } = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default function BoutiqueHomePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [ultimoIndosso, setUltimoIndosso] = useState<Indosso | null>(null);
  const [loading, setLoading] = useState(true);

  const [activePanel, setActivePanel] = useState<'none' | 'ai' | 'collezione' | 'decant'>('none');

  const [meteo, setMeteo] = useState('Fresco Autunnale');
  const [occasione, setOccasione] = useState('Ufficio');
  const [umore, setUmore] = useState('Legnoso / Ambrato / Deciso');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<{
    advice: string;
    recommended: Profumo[];
  } | null>(null);

  const [selectedQuickProfumoId, setSelectedQuickProfumoId] = useState('');
  const [selectedDecantId, setSelectedDecantId] = useState('');
  const [quickMomento, setQuickMomento] = useState<(typeof MOMENTI)[number]>('Mattina');
  const [quickContesto, setQuickContesto] = useState('Ufficio');
  const [savingQuickWear, setSavingQuickWear] = useState(false);

  useEffect(() => {
    fetchVaultData();
  }, []);

  async function fetchVaultData() {
    setLoading(true);
    try {
      const { data: profumiData } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });

      const allProfumi = (profumiData || []) as Profumo[];
      setProfumi(allProfumi);

      const firstCol = allProfumi.find(isCollezioneProfumo);
      if (firstCol) setSelectedQuickProfumoId(firstCol.id);

      const firstDecant = allProfumi.find(isRadarProfumo);
      if (firstDecant) setSelectedDecantId(firstDecant.id);

      const { data: indossiData } = await supabase
        .from('indossi')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (indossiData && indossiData.length > 0) {
        const last = indossiData[0] as Indosso;
        const matchedProfumo = allProfumi.find((p) => p.id === last.profumo_id) || null;
        setUltimoIndosso({ ...last, profumi: matchedProfumo });
      }
    } catch (e) {
      console.error('Errore caricamento Vault:', e);
    } finally {
      setLoading(false);
    }
  }

  const collezione = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radar = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);

  async function askQuickAiEngine() {
    if (collezione.length === 0) return;
    setAdvisorLoading(true);
    setAdvisorResult(null);
    try {
      const query = `Clima: "${meteo}". Contesto: "${occasione}". Stile ricercato: "${umore}". Seleziona in modo tecnico e oggettivo 3 profumi della mia collezione adatti a oggi basandoti solo sulle loro note reali.`;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, profumi: collezione }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore IA');

      const recIds: string[] = data.recommendedIds || [];
      const recProfumi = recIds
        .map((id) => collezione.find((p) => p.id === id))
        .filter(Boolean) as Profumo[];

      setAdvisorResult({
        advice: data.sommelierAdvice,
        recommended: recProfumi.slice(0, 3),
      });
    } catch (err: any) {
      alert(err?.message || "Impossibile consultare l'IA in questo momento.");
    } finally {
      setAdvisorLoading(false);
    }
  }

  async function handleQuickWearSave(profumoIdToWear: string) {
    if (!profumoIdToWear) return;
    setSavingQuickWear(true);
    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: profumoIdToWear,
          momento_giornata: quickMomento,
          contesto_outfit: quickContesto,
        },
      ]);
      if (error) throw error;
      await fetchVaultData();
      setActivePanel('none');
    } catch (err: any) {
      alert(err?.message || 'Errore registrazione indosso.');
    } finally {
      setSavingQuickWear(false);
    }
  }

  const last = ultimoIndosso?.profumi || null;
  const toggle = (p: 'ai' | 'collezione' | 'decant') =>
    setActivePanel(activePanel === p ? 'none' : p);

  return (
    <div className="shelf">
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-8 py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="tile tile--ink w-20 h-20 sm:w-24 sm:h-24 shrink-0">
              <img
                src="/logo.jpg"
                alt="Boutique Olfattiva"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="serif on-field text-4xl sm:text-6xl leading-[0.95]">
              Boutique
              <br />
              Olfattiva
            </h1>
          </div>
          <Link href="/diario" className="btn btn--butter shrink-0" aria-label="Diario indossi">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Diario indossi</span>
          </Link>
        </header>

        {/* Hero: l'ultimo profumo indossato */}
        <section className="card mt-8 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="tile w-28 h-28 sm:w-36 sm:h-36 shrink-0">
              {last ? (
                <SmartBottleImage
                  src={last.url_foto_vetrina || last.immagine_url}
                  alt={last.nome}
                  iconSize="w-10 h-10"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <PerfumeBottleIcon className="w-12 h-12 opacity-40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {last ? (
                <>
                  <p className="text-sm font-semibold muted">L&apos;ultimo indosso</p>
                  <h2 className="serif text-3xl sm:text-5xl leading-tight">{last.nome}</h2>
                  <p className="mt-1 text-base">
                    {last.brand}
                    <span className="muted">
                      , {(ultimoIndosso?.momento_giornata || 'oggi').toLowerCase()}
                      {ultimoIndosso?.contesto_outfit
                        ? `, ${ultimoIndosso.contesto_outfit.toLowerCase()}`
                        : ''}
                    </span>
                  </p>
                </>
              ) : (
                <h2 className="serif text-3xl sm:text-5xl leading-tight">
                  Cosa indossi oggi?
                </h2>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggle('ai')}
                  className={`btn ${activePanel === 'ai' ? 'btn--ink' : 'btn--butter'}`}
                >
                  <Sparkles className="w-4 h-4" />
                  Chiedi all&apos;IA
                </button>
                <button
                  type="button"
                  onClick={() => toggle('collezione')}
                  className={`btn ${activePanel === 'collezione' ? 'btn--ink' : ''}`}
                >
                  <PerfumeBottleIcon className="w-4 h-4" />
                  Scegli dalla collezione
                </button>
                <button
                  type="button"
                  onClick={() => toggle('decant')}
                  className={`btn ${activePanel === 'decant' ? 'btn--ink' : ''}`}
                >
                  <Compass className="w-4 h-4" />
                  In prova / Decant
                </button>
              </div>
            </div>
          </div>

          {activePanel === 'ai' && (
            <div className="panel space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Clima / stagione" value={meteo} onChange={setMeteo} options={METEO} />
                <Field
                  label="Contesto"
                  value={occasione}
                  onChange={setOccasione}
                  options={CONTESTI}
                />
                <Field
                  label="Profilo olfattivo"
                  value={umore}
                  onChange={setUmore}
                  options={PROFILI}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={askQuickAiEngine}
                  disabled={advisorLoading || collezione.length === 0}
                  className="btn btn--ink"
                >
                  {advisorLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sto pensando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Consigliami tre profumi
                    </>
                  )}
                </button>
              </div>

              {advisorResult && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed">{advisorResult.advice}</p>
                  {advisorResult.recommended.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {advisorResult.recommended.map((p) => (
                        <div
                          key={p.id}
                          className="card flex flex-col justify-between gap-3 p-3"
                          style={{ boxShadow: '3px 3px 0 var(--ink)' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="tile w-12 h-12 shrink-0">
                              <SmartBottleImage
                                src={p.url_foto_vetrina || p.immagine_url}
                                alt={p.nome}
                                iconSize="w-4 h-4"
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold muted truncate">{p.brand}</p>
                              <p className="serif text-lg truncate">{p.nome}</p>
                              <p className="text-xs muted line-clamp-1">
                                {getUnifiedNotes(p) || p.famiglia_olfattiva}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickWearSave(p.id)}
                            disabled={savingQuickWear}
                            className="btn btn--butter justify-center"
                          >
                            Indosso questo oggi
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activePanel === 'collezione' && (
            <div className="panel grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2">
                <Field
                  label={`Flacone dalla collezione (${collezione.length})`}
                  value={selectedQuickProfumoId}
                  onChange={setSelectedQuickProfumoId}
                  options={collezione.map((p) => ({
                    value: p.id,
                    label: `${p.brand} - ${p.nome}`,
                  }))}
                />
              </div>
              <Field
                label="Momento"
                value={quickMomento}
                onChange={(v) => setQuickMomento(v as (typeof MOMENTI)[number])}
                options={[...MOMENTI]}
              />
              <Field
                label="Contesto"
                value={quickContesto}
                onChange={setQuickContesto}
                options={CONTESTI}
              />
              <button
                type="button"
                onClick={() => handleQuickWearSave(selectedQuickProfumoId)}
                disabled={savingQuickWear || !selectedQuickProfumoId}
                className="btn btn--ink justify-center"
              >
                {savingQuickWear ? 'Salvo...' : 'Conferma indosso'}
              </button>
            </div>
          )}

          {activePanel === 'decant' && (
            <div className="panel">
              {radar.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <Field
                      label={`Decant e campioncini in test (${radar.length})`}
                      value={selectedDecantId || radar[0]?.id || ''}
                      onChange={setSelectedDecantId}
                      options={radar.map((p) => ({
                        value: p.id,
                        label: `${p.brand} - ${p.nome}`,
                      }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickWearSave(selectedDecantId || radar[0]?.id)}
                    disabled={savingQuickWear}
                    className="btn btn--ink justify-center"
                  >
                    Indosso il decant oggi
                  </button>
                </div>
              ) : (
                <p className="text-sm muted">Nessun campioncino nel Radar al momento.</p>
              )}
            </div>
          )}
        </section>

        {/* Accessi rapidi */}
        <section className="mt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <Link
              href="/collezione"
              className="card card--butter md:col-span-3 p-6 flex flex-col justify-between min-h-[11rem]"
            >
              <PerfumeBottleIcon className="w-7 h-7" />
              <div className="mt-6 flex items-end justify-between gap-3">
                <div>
                  <h3 className="serif text-3xl sm:text-4xl">La collezione</h3>
                  <span className="chip mt-2">{loading ? '...' : collezione.length} flaconi</span>
                </div>
                <span className="go">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </div>
            </Link>

            <Link
              href="/scanner"
              className="card md:col-span-2 p-6 flex flex-col justify-between min-h-[11rem]"
            >
              <ScanLine className="w-7 h-7" />
              <div className="mt-6 flex items-end justify-between gap-3">
                <div>
                  <h3 className="serif text-2xl">Identifica un flacone</h3>
                  <p className="mt-1 text-sm muted">
                    Foto o testo: l&apos;IA cerca e verifica le informazioni.
                  </p>
                </div>
                <span className="go shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </div>
            </Link>
          </div>

          <Link
            href="/collezione?vista=radar"
            className="card card--rose p-5 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <Compass className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="serif text-2xl">Radar</h3>
                <p className="text-sm">Il laboratorio dove valuti prima di comprare.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="chip hidden sm:inline-block">
                {loading ? '...' : radar.length} in osservazione
              </span>
              <span className="go">
                <ChevronRight className="w-5 h-5" />
              </span>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
