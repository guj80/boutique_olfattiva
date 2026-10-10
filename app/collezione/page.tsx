'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Sparkles, X } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function CollezionePage() {
  const [profumi, setProfumi] = useState<any[]>([]);
  const [profumiFiltrati, setProfumiFiltrati] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Caricamento iniziale di tutti i profumi
  useEffect(() => {
    async function fetchProfumi() {
      const { data } = await supabase.from('profumi').select('*').order('created_at', { ascending: false });
      if (data) {
        setProfumi(data);
        setProfumiFiltrati(data);
      }
      setIsLoading(false);
    }
    fetchProfumi();
  }, []);

  // Funzione per la Ricerca AI
  const handleAISearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const { ids } = await res.json();
      
      if (ids && Array.isArray(ids)) {
        // Filtriamo il catalogo tenendo solo gli ID restituiti dall'AI
        const risultati = profumi.filter(p => ids.includes(p.id));
        setProfumiFiltrati(risultati);
      }
    } catch (error) {
      console.error("Errore ricerca:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setQuery('');
    setProfumiFiltrati(profumi);
  };

  if (isLoading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-serif text-amber-500 mb-8 text-center">La Mia Collezione</h1>
      
      {/* Barra di Ricerca AI */}
      <div className="relative mb-10 flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-3 h-5 w-5 text-amber-500" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
            placeholder="Chiedi all'AI (es. 'Un profumo fresco per l'estate', 'Simile a Erba Pura')..."
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 w-full"
          />
          {query && (
            <button onClick={resetSearch} className="absolute right-3 top-3 text-zinc-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <Button 
          onClick={handleAISearch} 
          disabled={isSearching || !query}
          className="bg-amber-600 hover:bg-amber-500 text-white"
        >
          {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {/* Griglia Profumi */}
      {profumiFiltrati.length === 0 ? (
        <p className="text-center text-zinc-500">Nessun profumo trovato.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {profumiFiltrati.map((profumo) => (
            <Card key={profumo.id} className="bg-zinc-900 border-zinc-800 overflow-hidden">
              <div className="flex">
                {profumo.url_foto_vetrina && (
                  <img src={profumo.url_foto_vetrina} alt={profumo.nome} className="w-1/3 object-cover" />
                )}
                <div className="p-4 flex-1">
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">{profumo.brand}</p>
                  <CardTitle className="text-xl font-serif text-white mt-1 mb-2">{profumo.nome}</CardTitle>
                  <p className="text-sm text-amber-500 mb-2">{profumo.famiglia_olfattiva}</p>
                  <p className="text-xs text-zinc-400 line-clamp-2">{profumo.note_olfattive}</p>
                  <div className="mt-4 flex justify-between items-center text-xs font-semibold">
                    <span className="text-zinc-300">{profumo.prezzo_stimato_euro}€</span>
                    <span className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">{profumo.info_fragrantica?.split(' ')[0] || 'N/D'}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
