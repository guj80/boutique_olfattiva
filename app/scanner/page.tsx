'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, GeminiResult, Categoria } from '@/lib/supabase';
import {
  ArrowLeft,
  Camera,
  Loader2,
  Check,
  RotateCcw,
  Search,
  Heart,
  BookOpen,
  Library,
  ExternalLink,
  Pencil,
  Plus,
  X,
} from 'lucide-react';

type Status = 'idle' | 'analyzing' | 'result' | 'saved' | 'error';

export default function ScannerPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [saveCategoria, setSaveCategoria] = useState<Categoria>('collezione');
  const [saving, setSaving] = useState(false);
  const [fragranticaUrl, setFragranticaUrl] = useState('');
  const [brandSearchUrl, setBrandSearchUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setStatus('analyzing');
      setErrorMsg('');
      setManualMode(false);

      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;

      try {
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mimeType }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Errore analisi');
        }

        const data: GeminiResult = await res.json();
        setResult(data);

        // Auto-generate search URLs
        const query = `${data.brand} ${data.nome}`
          .trim()
          .replace(/\s+/g, '+');
        setFragranticaUrl(
          `https://www.fragrantica.com/search/?query=${query}`
        );
        setBrandSearchUrl(`https://www.google.com/search?q=${query}+perfume+official+site`);

        setStatus('result');
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Errore durante l\'analisi.'
        );
        setStatus('error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = () => {
    if (!manualName.trim()) return;
    setResult({
      nome: manualName.trim(),
      brand: manualBrand.trim() || 'Sconosciuto',
      famiglia_olfattiva: 'N/D',
      prezzo_stimato_euro: 'N/D',
      note_olfattive: 'N/D',
    });
    const query = `${manualBrand} ${manualName}`.trim().replace(/\s+/g, '+');
    setFragranticaUrl(`https://www.fragrantica.com/search/?query=${query}`);
    setBrandSearchUrl(`https://www.google.com/search?q=${query}+perfume+official+site`);
    setManualMode(false);
    setStatus('result');
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('profumi').insert({
        nome: result.nome,
        brand: result.brand,
        famiglia_olfattiva: result.famiglia_olfattiva,
        prezzo_stimato_euro: result.prezzo_stimato_euro,
        note_olfattive: result.note_olfattive,
        categoria: saveCategoria,
        url_fragrantica: fragranticaUrl || null,
      });

      if (error) throw error;
      setStatus('saved');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Errore nel salvataggio.'
      );
      setStatus('error');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setStatus('idle');
    setPreview(null);
    setResult(null);
    setErrorMsg('');
    setManualMode(false);
    setManualName('');
    setManualBrand('');
    setSaveCategoria('collezione');
    setFragranticaUrl('');
    setBrandSearchUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-xl font-semibold gold-gradient-text">
          Scanner
        </h1>
        <div className="w-5" />
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* Info banner */}
      {status === 'idle' && (
        <div className="mb-6 glass rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Lo Scanner identifica i profumi per informazioni in tempo reale.
            Non aggiunge automaticamente alla collezione — puoi salvare in
            Collezione, Wishlist o Da Studiare.
          </p>
        </div>
      )}

      {/* IDLE STATE */}
      {status === 'idle' && !manualMode && (
        <div className="flex flex-col items-center justify-center animate-fade-in-up gap-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="glass-gold rounded-3xl w-full max-w-xs h-72 flex flex-col items-center justify-center gap-4 transition-all active:scale-95 hover:border-gold/30 group"
          >
            <div className="w-16 h-16 rounded-full glass-gold flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse-gold">
              <Camera className="w-7 h-7 text-gold" />
            </div>
            <div className="text-center">
              <p className="tracking-wide-luxury text-sm uppercase text-gold font-medium">
                Scansiona Flacone
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                Inquadra un flacone per identificarlo
              </p>
            </div>
          </button>

          {/* Manual entry option */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] tracking-wide-luxury uppercase text-muted-foreground">
              oppure
            </span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <button
            onClick={() => setManualMode(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Inserisci nome manualmente
          </button>
        </div>
      )}

      {/* MANUAL ENTRY MODE */}
      {status === 'idle' && manualMode && (
        <div className="animate-fade-in-up max-w-sm mx-auto">
          <div className="glass-gold rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Inserimento Manuale
              </h2>
              <button
                onClick={() => setManualMode(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Non riesci a identificare il profumo? Inserisci il nome a mano e
              cerca le informazioni sui siti ufficiali.
            </p>
            <div>
              <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">
                Nome Profumo *
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="es. Naxos"
                className="w-full glass rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-gold/30"
              />
            </div>
            <div>
              <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">
                Brand
              </label>
              <input
                type="text"
                value={manualBrand}
                onChange={(e) => setManualBrand(e.target.value)}
                placeholder="es. Xerjoff"
                className="w-full glass rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-gold/30"
              />
            </div>
            <button
              onClick={handleManualSubmit}
              disabled={!manualName.trim()}
              className="w-full py-3 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Cerca Info
            </button>
          </div>
        </div>
      )}

      {/* ANALYZING STATE */}
      {status === 'analyzing' && preview && (
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="relative w-full max-w-xs">
            <img
              src={preview}
              alt="Anteprima"
              className="w-full rounded-2xl object-cover opacity-60"
            />
            <div className="absolute inset-0 rounded-2xl shimmer pointer-events-none" />
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="tracking-wide-luxury text-xs uppercase text-gold animate-pulse">
              L'IA sta analizzando...
            </p>
            <p className="text-xs text-muted-foreground">
              Identificando nome, brand e famiglia olfattiva
            </p>
          </div>
        </div>
      )}

      {/* RESULT STATE */}
      {status === 'result' && result && (
        <div className="animate-fade-in-up">
          {preview && (
            <img
              src={preview}
              alt="Flacone scansionato"
              className="w-full max-w-xs mx-auto rounded-2xl mb-6 object-cover"
            />
          )}

          {result.nome === 'Non riconosciuto' ? (
            <div className="glass rounded-2xl p-6 text-center mb-6">
              <p className="font-serif text-lg text-foreground mb-2">
                Profumo non riconosciuto
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                L&apos;IA non è riuscita a identificare il flacone. Puoi
                inserire il nome manualmente.
              </p>
              <button
                onClick={() => {
                  setStatus('idle');
                  setManualMode(true);
                  setPreview(null);
                  setResult(null);
                }}
                className="py-2.5 px-6 rounded-xl glass text-sm tracking-wide-luxury uppercase font-medium hover:bg-white/5 transition-colors inline-flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Inserisci Manualmente
              </button>
            </div>
          ) : (
            <div className="glass-gold rounded-2xl p-6 mb-4">
              <div className="space-y-4">
                <div>
                  <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1">
                    Nome
                  </p>
                  <p className="font-serif text-2xl font-semibold text-foreground">
                    {result.nome}
                  </p>
                </div>

                <div>
                  <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1">
                    Brand
                  </p>
                  <p className="text-sm text-foreground">{result.brand}</p>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1">
                      Famiglia Olfattiva
                    </p>
                    <p className="tracking-wide-luxury text-xs text-muted-foreground uppercase">
                      {result.famiglia_olfattiva}
                    </p>
                  </div>
                  {result.prezzo_stimato_euro &&
                    result.prezzo_stimato_euro !== 'N/D' && (
                      <div className="text-right">
                        <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1">
                          Valore
                        </p>
                        <p className="font-mono text-lg text-gold-light">
                          {result.prezzo_stimato_euro}
                        </p>
                      </div>
                    )}
                </div>

                {result.note_olfattive && result.note_olfattive !== 'N/D' && (
                  <div>
                    <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1">
                      Note Olfattive
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.note_olfattive}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External links for research */}
          {result.nome !== 'Non riconosciuto' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <a
                  href={fragranticaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-gold/20 transition-all active:scale-95"
                >
                  <Search className="w-5 h-5 text-gold" />
                  <span className="text-xs tracking-wide-luxury uppercase text-foreground">
                    Fragrantica
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center">
                    Cerca note e recensioni
                  </span>
                </a>
                <a
                  href={brandSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass rounded-xl p-4 flex flex-col items-center gap-2 hover:border-gold/20 transition-all active:scale-95"
                >
                  <ExternalLink className="w-5 h-5 text-gold" />
                  <span className="text-xs tracking-wide-luxury uppercase text-foreground">
                    Sito Ufficiale
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center">
                    Pagina del brand
                  </span>
                </a>
              </div>

              {/* Save section */}
              <div className="glass rounded-2xl p-5 mb-4">
                <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-3 font-medium">
                  Salva in:
                </p>
                <div className="flex gap-2 mb-4">
                  {(
                    [
                      { key: 'collezione', label: 'Collezione', icon: Library },
                      { key: 'wishlist', label: 'Wishlist', icon: Heart },
                      {
                        key: 'da_studiare',
                        label: 'Da Studiare',
                        icon: BookOpen,
                      },
                    ] as { key: Categoria; label: string; icon: typeof Library }[]
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setSaveCategoria(key)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs transition-all ${
                        saveCategoria === key
                          ? 'gold-gradient-bg text-black font-medium'
                          : 'glass text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Salva
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-4 rounded-xl glass text-foreground text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 hover:bg-white/5"
            >
              <RotateCcw className="w-4 h-4" />
              Riprova
            </button>
          </div>
        </div>
      )}

      {/* SAVED STATE */}
      {status === 'saved' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
            Salvato!
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs">
            Il profumo è stato aggiunto a{' '}
            {saveCategoria === 'collezione'
              ? 'Collezione'
              : saveCategoria === 'wishlist'
                ? 'Wishlist'
                : 'Da Studiare'}
            .
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl glass text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Altro
            </button>
            <Link
              href="/collezione"
              className="flex-1 py-3 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium text-center transition-transform active:scale-95"
            >
              Collezione
            </Link>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
          <div className="glass rounded-2xl p-8 text-center max-w-xs">
            <p className="font-serif text-lg text-red-400 mb-3">
              Qualcosa è andato storto
            </p>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleReset}
                className="py-3 px-6 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95"
              >
                Riprova
              </button>
              <button
                onClick={() => {
                  setStatus('idle');
                  setManualMode(true);
                  setErrorMsg('');
                }}
                className="py-3 px-6 rounded-xl glass text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Inserisci Manualmente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
