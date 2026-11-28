'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAura } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';

interface Draft {
  id: string;
  brand_canonico: string;
  nome: string;
  concentrazione: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  motivo_review: string[];
}

export default function UltranicchiaDrafts({ onRefresh }: { onRefresh: () => void }) {
  const { aura } = useAura();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profumi_staging')
        .select('*')
        .in('stato', ['pending', 'needs_review'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDrafts((data || []) as Draft[]);
    } catch (err: any) {
      showToast('Errore caricamento bozze: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActioningId(id);
    try {
      // Chiama la RPC di pubblicazione creata nel Passaggio 3
      const { error } = await supabase.rpc('pubblica_profumo', { p_staging_id: id });
      if (error) throw error;
      
      showToast('Profumo approvato e aggiunto al DB globale!', 'success');
      setDrafts(prev => prev.filter(d => d.id !== id));
      onRefresh(); // Aggiorna il Radar
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: string) {
    setActioningId(id);
    try {
      const { error } = await supabase
        .from('profumi_staging')
        .update({ stato: 'rejected' })
        .eq('id', id);
      
      if (error) throw error;
      setDrafts(prev => prev.filter(d => d.id !== id));
      showToast('Bozza scartata.', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-[#B8A9C9]"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Caricamento bozze...</div>;
  }

  if (drafts.length === 0) {
    return <div className="text-center py-10 text-[#B8A9C9] text-sm">Nessuna bozza in attesa. Importa un nuovo brand!</div>;
  }

  return (
    <div className="space-y-3">
      {drafts.map(draft => (
        <div key={draft.id} style={{ borderColor: `${aura.primary}30` }} className="rounded-[20px] border bg-[#161024] p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B8A9C9]">{draft.brand_canonico}</span>
              {draft.motivo_review && draft.motivo_review.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] text-red-300 font-bold uppercase">
                  <AlertCircle className="h-3 w-3" /> {draft.motivo_review.join(', ')}
                </span>
              )}
            </div>
            <h4 className="font-serif text-lg text-[#F6EFE4]">{draft.nome} {draft.concentrazione && <span className="text-sm font-sans text-[#B8A9C9]">({draft.concentrazione})</span>}</h4>
            <p className="text-xs text-[#B8A9C9] line-clamp-1">
              {draft.note_testa || draft.note_cuore || draft.note_fondo ? 'Note trovate: ' : 'Nessuna nota trovata.'}
              {[draft.note_testa, draft.note_cuore, draft.note_fondo].filter(Boolean).join(', ')}
            </p>
          </div>
          
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => handleReject(draft.id)}
              disabled={actioningId === draft.id}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#0E0A16] px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Scarta
            </button>
            <button
              onClick={() => handleApprove(draft.id)}
              disabled={actioningId === draft.id}
              style={{ backgroundColor: aura.primary }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold text-[#08060C] transition hover:opacity-90 disabled:opacity-50"
            >
              {actioningId === draft.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Approva
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
