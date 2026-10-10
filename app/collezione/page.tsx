'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, Profumo } from '@/lib/supabase';
import { Search, Sparkles, ArrowLeft, Plus, Trash2, Clock, Compass, Edit3 } from 'lucide-react';

export default function CollezionePage() {
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState<'collezione' | 'radar'>('collezione');
  
  // Stato per la modale di indosso
  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);
  const [momentoScelto, setMomentoScelto] = useState<'Mattina' | 'Pomeriggio' | 'Sera'>('Sera');
  const [noteIndosso, setNoteIndosso] = useState('');

  // Carica i profumi da Supabase in base allo stato (collezione o radar)
  const fetchProfumi = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profumi')
      .select('*')
      .eq('stato', filtroStato)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore caricamento:', error);
    } else if (data) {
      setProfumi(data as Profumo[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProfumi();
  }, [filtroStato]);

  // Ricerca Semantica con Gemini (/api/search)
  const handleAISearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setAiSearchResults(null);
      return;
    }

    setIsAiSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      if (data.matchedIds) {
        setAiSearchResults(data.matchedIds);
      }
    } catch (err) {
      console.error('Errore ricerca AI:', err);
    } finally {
      setIsAiSearching(false);
    }
  };

  // Registrazione di un indosso (Scent Tracker)
  const registraIndosso = async () => {
    if (!selectedProfumo) return;

    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: selectedProfumo.id,
          momento_giornata: momentoScelto,
          note_indosso: noteIndosso || null
        }
      ]);

      if (error) throw error;

      alert(`Registrato con successo! Hai indossato "${selectedProfumo.nome}" (${momentoScelto}).`);
      setSelectedProfumo(null);
      setNoteIndosso('');
    } catch (err: any) {
      console.error(err);
      alert('Errore nella registrazione dell\'indosso');
    }
  };

  // Eliminazione profumo
  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo profumo?')) return;
    const { error } = await supabase.from('profumi').delete().eq('id', id);
    if (!error) {
      setProfumi(profumi.filter(p => p.id !== id));
    }
  };

  // Filtraggio finale dei profumi da mostrare
  const profumiFiltrati = profumi.filter(p => {
    if (aiSearchResults) {
      return aiSearchResults.includes(p.id);
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.nome.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      (p.famiglia_olfattiva && p.famiglia_olfattiva.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      {/* Intestazione e Navigazione */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/scanner" className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Aggiungi
          </Link>
        </div>
      </div>

      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-semibold gold-gradient-text mb-2">
          {filtroStato === 'collezione' ? 'Collezione Privata' : 'Radar Boutique (Test)'}
        </h1>
        <p className="tracking-luxury text-xs text-muted-foreground uppercase">
          Archivio Olfattivo di Luca
        </p>
      </header>

      {/* Switcher Collezione / Radar */}
      <div className="flex justify-center gap-3 mb-6">
        <button
          onClick={() => { setFiltroStato('collezione'); setAiSearchResults(null); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl text-xs uppercase tracking-wide-luxury font-medium transition-all ${
            filtroStato === 'collezione' ? 'bg-gold text-black font-semibold shadow-lg' : 'glass text-muted-foreground hover:text-foreground'
          }`}
        >
          Collezione
        </button>
        <button
          onClick={() => { setFiltroStato('radar'); setAiSearchResults(null); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl text-xs uppercase tracking-wide-luxury font-medium transition-all flex items-center gap-1.5 ${
            filtroStato === 'radar' ? 'bg-gold text-black font-semibold shadow-lg' : 'glass text-muted-foreground hover:text-foreground'
          }`}
        >
          <Compass className="w-3.5 h-3.5" /> Radar Test
        </button>
      </div>

      {/* Barra di Ricerca Neurale AI */}
      <form onSubmit={handleAISearch} className="relative mb-10 max-w-xl mx-auto">
        <div className="relative flex items-center">
          <Sparkles className="absolute left-4 w-4 h-4 text-gold" />
          <input
            type="text"
            placeholder="Chiedi all'AI (es. 'Un profumo fresco per una serata estiva')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/80 border border-border rounded-2xl pl-11 pr-24 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors shadow-inner"
          />
          <button
            type="submit"
            disabled={isAiSearching}
            className="absolute right-2 px-4 py-2 rounded-xl gold-gradient-bg text-black text-xs uppercase tracking-wider font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAiSearching ? 'Analisi...' : 'Cerca'}
          </button>
        </div>
        {aiSearchResults && (
          <div className="flex justify-between items-center mt-2 px-2">
            <span className="text-[10px] text-gold uppercase tracking-wider">Filtro AI Attivo ({aiSearchResults.length} risultati)</span>
            <button type="button" onClick={() => { setAiSearchResults(null); setSearchQuery(''); }} className="text-[10px] text-muted-foreground hover:text-foreground underline">
              Mostra tutti
            </button>
          </div>
        )}
      </form>

      {/* Griglia dei Profumi */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : profumiFiltrati.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center max-w-md mx-auto">
          <p className="text-sm text-muted-foreground mb-4">Nessun profumo trovato in questa sezione.</p>
          <Link href="/scanner" className="inline-flex items-center gap-2 text-xs uppercase tracking-wide-luxury text-gold hover:underline">
            <Plus className="w-4 h-4" /> Aggiungi il primo flacone
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profumiFiltrati.map((profumo) => (
            <div key={profumo.id} className="glass rounded-2xl p-6 flex flex-col justify-between transition-all hover:border-gold/30 group">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{profumo.brand}</p>
                    <h3 className="font-serif text-xl font-semibold text-foreground group-hover:text-gold-light transition-colors">
                      {profumo.nome}
                    </h3>
                  </div>
                  {profumo.prezzo_stimato_euro && profumo.prezzo_stimato_euro !== 'N/D' && (
                    <span className="font-mono text-sm text-gold-light bg-gold/10 px-2.5 py-1 rounded-lg border border-gold/20">
                      {profumo.prezzo_stimato_euro}
                    </span>
                  )}
                </div>

                {profumo.famiglia_olfattiva && (
                  <span className="inline-block text-[10px] tracking-wide-luxury uppercase text-gold bg-gold/5 px-2 py-0.5 rounded-md border border-gold/15 mb-3">
                    {profumo.famiglia_olfattiva}
                  </span>
                )}

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                  {profumo.note_olfattive || 'Note olfattive non specificate.'}
                </p>
              </div>

              {/* Bottoni di Azione Rapida sulla Scheda */}
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                {filtroStato === 'collezione' ? (
                  <button
                    onClick={() => setSelectedProfumo(profumo)}
                    className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors font-medium"
                  >
                    <Clock className="w-3.5 h-3.5" /> Indossa Oggi
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Test in Boutique</span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(profumo.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale "Indossa Oggi" (Scent Tracker) */}
      {selectedProfumo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-up">
          <div className="glass-gold rounded-3xl p-6 max-w-md w-full border border-gold/30 shadow-2xl space-y-4">
            <div className="text-center">
              <p className="text-[10px] text-gold uppercase tracking-luxury mb-1">Registro Indossi</p>
              <h3 className="font-serif text-2xl font-semibold text-foreground">{selectedProfumo.nome}</h3>
              <p className="text-xs text-muted-foreground">{selectedProfumo.brand}</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wide-luxury text-muted-foreground block">Momento della giornata</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Mattina', 'Pomeriggio', 'Sera'] as const).map((momento) => (
                  <button
                    key={momento}
                    onClick={() => setMomentoScelto(momento)}
                    className={`py-2.5 rounded-xl text-xs uppercase tracking-wider font-medium transition-all ${
                      momentoScelto === momento ? 'bg-gold text-black font-semibold' : 'bg-background border border-border text-muted-foreground'
                    }`}
                  >
                    {momento}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide-luxury text-muted-foreground block">Note o Impressioni del giorno (Opzionale)</label>
              <textarea
                rows={3}
                placeholder="Es. Sulle spalle con una giacca di pelle, ottima scia con il fresco serale..."
                value={noteIndosso}
                onChange={(e) => setNoteIndosso(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedProfumo(null)}
                className="flex-1 py-3 rounded-xl glass text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Annulla
              </button>
              <button
                onClick={registraIndosso}
                className="flex-1 py-3 rounded-xl gold-gradient-bg text-black font-medium text-xs uppercase tracking-wider"
              >
                Conferma Indosso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
