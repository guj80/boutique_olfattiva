'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, GeminiResult } from '@/lib/supabase';
import {
  ArrowLeft,
  Camera,
  Loader2,
  Check,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

type Status = 'idle' | 'uploading' | 'analyzing' | 'result' | 'saved' | 'error';

export default function ScannerPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setStatus('analyzing');
      setErrorMsg('');

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

  const handleSave = async () => {
    if (!result) return;
    setStatus('uploading');

    try {
      const { error } = await supabase.from('profumi').insert({
        nome: result.nome,
        brand: result.brand,
        famiglia_olfattiva: result.famiglia_olfattiva,
        prezzo_stimato_euro: result.prezzo_stimato_euro,
      });

      if (error) throw error;
      setStatus('saved');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Errore nel salvataggio.'
      );
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setPreview(null);
    setResult(null);
    setErrorMsg('');
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

      {/* IDLE STATE */}
      {status === 'idle' && (
        <div className="flex flex-col items-center justify-center animate-fade-in-up">
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
                Inquadra un flacone di profumo per analizzarlo
              </p>
            </div>
          </button>
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
      {status === 'result' && result && preview && (
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
              <p className="text-sm text-muted-foreground">
                L'IA non è riuscita a identificare il flacone. Riprova con
                un'immagine più chiara.
              </p>
            </div>
          ) : (
            <div className="glass-gold rounded-2xl p-6 mb-6">
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
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-4 rounded-xl glass text-foreground text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 hover:bg-white/5"
            >
              <RotateCcw className="w-4 h-4" />
              Riprova
            </button>
            {result.nome !== 'Non riconosciuto' && (
              <button
                onClick={handleSave}
                className="flex-1 py-4 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Aggiungi
              </button>
            )}
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
            Il profumo è stato aggiunto alla tua collezione.
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl glass text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95"
            >
              <Camera className="w-4 h-4 inline mr-2" />
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
            <button
              onClick={handleReset}
              className="py-3 px-6 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95"
            >
              Riprova
            </button>
          </div>
        </div>
      )}

      {/* UPLOADING (save) STATE */}
      {status === 'uploading' && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] animate-fade-in-up">
          <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
          <p className="tracking-wide-luxury text-xs uppercase text-gold">
            Salvataggio...
          </p>
        </div>
      )}
    </div>
  );
}
