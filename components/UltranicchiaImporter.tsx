'use client';

import React, { useState } from 'react';
import { Search, RefreshCw, Square, SquareCheck, Layers } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { useAura } from '@/components/AuraProvider';
import { useToast } from '@/components/Toast';

type BrandCandidate = { nome: string; concentrazione: string | null; selected: boolean; };

export default function UltranicchiaImporter({ onImportComplete }: { onImportComplete: () => void }) {
  const { aura } = useAura();
  const { showToast } = useToast();

  const [brandQuery, setBrandQuery] = useState('');
  const [brandCandidates, setBrandCandidates] = useState<BrandCandidate[]>([]);
  const [searchingBrand, setSearchingBrand] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  async function handleSearchBrand() {
    if (!brandQuery.trim()) return;
    setSearchingBrand(true); setBrandCandidates([]);
    try {
      const res = await apiFetch('/api/ultranicchia/import-brand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const mapped = (data.candidates || []).map((c: any) => ({ ...c, selected: true }));
      setBrandCandidates(mapped);
      if (mapped.length === 0) showToast('Nessun profumo trovato online.', 'error');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setSearchingBrand(false); }
  }

  async function handleImportBrand() {
    const selected = brandCandidates.filter(c => c.selected);
    if (selected.length === 0) return showToast('Seleziona almeno un profumo.', 'error');
    
    setImportProgress({ current: 0, total: selected.length });
    try {
      const saveRes = await apiFetch('/api/ultranicchia/save-candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandQuery.trim(), candidates: selected }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error);
      
      const batchId = saveData.batchId;
      let remaining = selected.length;
      
      while (remaining > 0) {
        const enrichRes = await apiFetch('/api/ultranicchia/enrich-batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId, limit: 2 }),
        });
        const enrichData = await enrichRes.json();
        if (!enrichRes.ok) throw new Error(enrichData.error);
        
        remaining = enrichData.remaining;
        setImportProgress({ current: selected.length - remaining, total: selected.length });
        if (remaining > 0) await new Promise(r => setTimeout(r, 1000));
      }
      
      showToast(`Importazione completata! Vai alle Bozze per approvare.`);
      setBrandQuery(''); setBrandCandidates([]); setImportProgress(null);
      onImportComplete();
    } catch (err: any) {
      showToast(err.message, 'error');
      setImportProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)}
          placeholder="Es. Lowkey Scents, Bortnikoff..."
          className="flex-1 rounded-[16px] border border-white/10 bg-[#0E0A16] px-4 py-3 text-sm text-[#F6EFE4] focus:outline-none"
          disabled={!!importProgress}
        />
        <button
          type="button" onClick={handleSearchBrand}
          disabled={searchingBrand || !brandQuery.trim() || !!importProgress}
          style={{ backgroundColor: aura.primary }}
          className="flex items-center justify-center gap-2 rounded-[16px] px-6 py-3 text-xs font-bold text-[#08060C] transition disabled:opacity-40"
        >
          {searchingBrand ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span>Cerca Brand</span>
        </button>
      </div>

      {brandCandidates.length > 0 && (
        <div className="rounded-[20px] border border-white/10 bg-[#0E0A16] p-4 space-y-3 mt-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-semibold text-[#F6EFE4]">Trovati: {brandCandidates.length}</span>
            <button
              type="button" onClick={() => setBrandCandidates(brandCandidates.map(c => ({ ...c, selected: !brandCandidates.every(x => x.selected) })))}
              className="text-[10px] text-[#B8A9C9] hover:text-white"
            >Seleziona tutti</button>
          </div>
          <ul className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {brandCandidates.map((c, idx) => (
              <li key={idx}>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={c.selected} onChange={() => {
                    const next = [...brandCandidates]; next[idx].selected = !next[idx].selected; setBrandCandidates(next);
                  }} className="hidden" />
                  {c.selected ? <SquareCheck style={{ color: aura.primary }} className="h-5 w-5 shrink-0" /> : <Square className="h-5 w-5 shrink-0 text-[#B8A9C9]" />}
                  <span className="text-sm text-[#F6EFE4] flex-1">{c.nome}</span>
                </label>
              </li>
            ))}
          </ul>
          
          {importProgress && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-[#B8A9C9] font-mono">
                <span>Arricchimento AI...</span><span>{importProgress.current} / {importProgress.total}</span>
              </div>
              <div className="h-2 w-full bg-[#1E1428] rounded-full overflow-hidden">
                <div className="h-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%`, backgroundColor: aura.primary }} />
              </div>
            </div>
          )}
          <button
            type="button" onClick={handleImportBrand} disabled={!!importProgress || !brandCandidates.some(c => c.selected)}
            style={{ backgroundColor: aura.primary }}
            className="w-full flex items-center justify-center gap-2 rounded-[16px] py-3 text-xs font-bold text-[#08060C] transition disabled:opacity-40 mt-2"
          >
            <Layers className="h-4 w-4" />
            <span>{importProgress ? 'Importazione...' : `Importa ${brandCandidates.filter(c => c.selected).length} profumi`}</span>
          </button>
        </div>
      )}
    </div>
  );
}
