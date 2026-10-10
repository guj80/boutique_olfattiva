'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Camera, Link as LinkIcon, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ScannerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'link' | 'foto'>('link');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Funzione unificata di elaborazione AI (sia per Link che per Foto)
  const handleAIExtraction = async (tipo: 'link' | 'foto', valore: string | File) => {
    setIsProcessing(true);
    setStatusMessage('Analisi della fragranza in corso con AI...');

    try {
      // 1. Chiamata all'API di estrazione neurale (che creiamo tra un attimo)
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, valore: tipo === 'link' ? valore : await fileToBase64(valore as File) })
      });

      const profumoEstratto = await res.json();

      if (!res.ok) throw new Error(profumoEstratto.error || 'Errore durante l\'estrazione');

      setStatusMessage('Salvataggio nella Boutique di Luca...');

      // 2. Salvataggio automatico nel database Supabase (struttura estesa)
      const { error: dbError } = await supabase.from('profumi').insert([
        {
          nome: profumoEstratto.nome,
          brand: profumoEstratto.brand,
          famiglia_olfattiva: profumoEstratto.famiglia_olfattiva,
          note_olfattive: profumoEstratto.note_olfattive,
          prezzo_stimato_euro: profumoEstratto.prezzo_stimato_euro,
          url_foto_vetrina: profumoEstratto.url_foto_vetrina || null,
          stato: 'collezione' // Salvato direttamente in collezione
        }
      ]);

      if (dbError) throw dbError;

      // 3. Reindirizzamento alla collezione
      router.push('/collezione');
    } catch (error: any) {
      console.error(error);
      alert(`Errore: ${error.message || 'Impossibile elaborare il profumo'}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  // Utility per convertire l'immagine in Base64 per Gemini Vision
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className="min-h-screen px-6 py-10 max-w-xl mx-auto flex flex-col justify-between">
      <div>
        {/* Torna Indietro */}
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Torna alla Home
        </Link>

        <header className="text-center mb-8">
          <p className="tracking-luxury text-xs text-gold uppercase mb-2">Acquisizione Intelligente</p>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Aggiungi Fragranza
          </h1>
        </header>

        {/* Selettore Modalità (Link o Foto) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 mb-8">
          <button
            onClick={() => setActiveTab('link')}
            className={`py-3 rounded-xl text-xs uppercase tracking-wide-luxury font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'link' ? 'bg-gold/20 text-gold border border-gold/30 shadow-lg' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon className="w-4 h-4" /> Da Link Web
          </button>
          <button
            onClick={() => setActiveTab('foto')}
            className={`py-3 rounded-xl text-xs uppercase tracking-wide-luxury font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'foto' ? 'bg-gold/20 text-gold border border-gold/30 shadow-lg' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="w-4 h-4" /> Da Fotocamera
          </button>
        </div>

        {/* Pannello 1: Inserimento Link */}
        {activeTab === 'link' && (
          <div className="glass rounded-2xl p-6 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-2 text-gold mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide-luxury font-medium">Fragrantica o Sito Ufficiale</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Incolla il link della pagina del profumo. L'intelligenza artificiale leggerà la scheda tecnica ed estarrà automaticamente note, brand e caratteristiche.
            </p>
            <input
              type="url"
              placeholder="https://www.fragrantica.com/perfume/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"
            />
            <button
              onClick={() => handleAIExtraction('link', urlInput)}
              disabled={isProcessing || !urlInput.trim()}
              className="w-full py-4 rounded-xl gold-gradient-bg text-black font-medium text-xs tracking-wide-luxury uppercase transition-transform active:scale-95 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Estrai e Salva con AI
            </button>
          </div>
        )}

        {/* Pannello 2: Scansione Fotocamera / Foto */}
        {activeTab === 'foto' && (
          <div className="glass rounded-2xl p-6 space-y-4 text-center animate-fade-in-up">
            <div className="flex items-center justify-center gap-2 text-gold mb-2">
              <Camera className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide-luxury font-medium">Visione Neurale Flacone</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scatta una foto alla boccetta o carica un'immagine dal tuo dispositivo. L'AI riconoscerà l'essenza all'istante.
            </p>
            
            <label className="border-2 border-dashed border-gold/30 hover:border-gold/60 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-gold/5 group">
              <Camera className="w-8 h-8 text-gold group-hover:scale-110 transition-transform" />
              <span className="text-xs text-foreground uppercase tracking-wide-luxury font-medium">Tocca per scattare o caricare</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleAIExtraction('foto', e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Stato di elaborazione in tempo reale */}
        {isProcessing && (
          <div className="mt-8 text-center glass-gold rounded-xl p-4 animate-pulse">
            <Loader2 className="w-6 h-6 text-gold animate-spin mx-auto mb-2" />
            <p className="text-xs text-gold uppercase tracking-wide-luxury font-medium">{statusMessage}</p>
          </div>
        )}
      </div>

      <footer className="mt-12 text-center text-[10px] tracking-widest text-muted-foreground uppercase">
        Boutique Olfattiva • AI Core Engine
      </footer>
    </div>
  );
}
