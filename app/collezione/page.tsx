'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, Profumo, Categoria, ProfumoInput, Momento } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import {
  ArrowLeft,
  Loader2,
  Trash2,
  FlaskConical,
  Pencil,
  Plus,
  X,
  ExternalLink,
  Search,
  Heart,
  BookOpen,
  Library,
  Euro,
  Tag,
  Save,
  Wind,
  Zap,
  Flame,
  BookMarked,
  ArrowUpCircle,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

const CATEGORIE: { key: Categoria; label: string; icon: typeof Library }[] = [
  { key: 'collezione', label: 'Collezione', icon: Library },
  { key: 'wishlist', label: 'Wishlist', icon: Heart },
  { key: 'da_studiare', label: 'Da Studiare', icon: BookOpen },
];

const MOMENTI: { key: Momento; label: string; icon: typeof Sun }[] = [
  { key: 'Mattina', label: 'Mattina', icon: Sunrise },
  { key: 'Pomeriggio', label: 'Pomeriggio', icon: Sun },
  { key: 'Sera', label: 'Sera', icon: Sunset },
  { key: 'Notte', label: 'Notte', icon: Moon },
];

export default function CollezionePage() {
  const { user, loading: authLoading } = useAuth();
  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Categoria>('collezione');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [indossaId, setIndossaId] = useState<string | null>(null);

  const loadProfumi = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profumi')
      .select('*')
      .order('created_at', { ascending: false });
    setProfumi((data ?? []) as Profumo[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfumi(); }, [loadProfumi]);

  const filtered = profumi
    .filter((p) => p.categoria === activeTab)
    .filter(
      (p) =>
        !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        (p.famiglia_olfattiva ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.note_olfattive ?? '').toLowerCase().includes(search.toLowerCase())
    );

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    const { error } = await supabase.from('profumi').delete().eq('id', id);
    if (!error) setProfumi((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  };

  const handleUpdate = async (id: string, updates: Partial<ProfumoInput>) => {
    const { error } = await supabase.from('profumi').update(updates).eq('id', id);
    if (!error) setProfumi((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    return !error;
  };

  const handleAdd = async (data: ProfumoInput) => {
    const { data: inserted, error } = await supabase.from('profumi').insert(data).select().single();
    if (!error && inserted) {
      setProfumi((prev) => [inserted as Profumo, ...prev]);
      return true;
    }
    return false;
  };

  const handlePromote = async (id: string) => {
    const ok = await handleUpdate(id, { categoria: 'collezione' });
    if (ok) setActiveTab('collezione');
  };

  const handleIndossa = async (profumoId: string, momento: Momento, note: string) => {
    const { error } = await supabase.from('indossi').insert({
      profumo_id: profumoId,
      momento,
      note_personali: note || null,
    });
    return !error;
  };

  const counts = CATEGORIE.map((c) => ({
    ...c,
    count: profumi.filter((p) => p.categoria === c.key).length,
  }));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
        <p className="tracking-wide-luxury text-xs uppercase text-muted-foreground mt-4">
          Caricamento collezione...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-muted-foreground hover:text-gold transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold gold-gradient-text">
          La Mia Collezione
        </h1>
        <button onClick={() => setShowAdd(true)} className="text-muted-foreground hover:text-gold transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cerca per nome, brand, famiglia o note olfattive..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full glass rounded-xl py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold/30 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {counts.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all ${
              activeTab === key
                ? 'gold-gradient-bg text-black font-medium'
                : 'glass text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs ${activeTab === key ? 'text-black/60' : 'text-muted-foreground/60'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && !search && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in-up">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-6">
            <FlaskConical className="w-8 h-8 text-gold/50" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
            {activeTab === 'collezione' && 'Nessun profumo in collezione'}
            {activeTab === 'wishlist' && 'Wishlist vuota'}
            {activeTab === 'da_studiare' && 'Nulla da studiare'}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
            {activeTab === 'collezione'
              ? 'Aggiungi il tuo primo profumo per iniziare il diario olfattivo.'
              : activeTab === 'wishlist'
                ? 'Salva qui i profumi che vorresti acquistare.'
                : 'Salva qui i profumi da approfondire e studiare.'}
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="py-3 px-8 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Profumo
          </button>
        </div>
      )}

      {filtered.length === 0 && search && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] animate-fade-in-up">
          <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nessun risultato per &quot;{search}&quot;
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((profumo, idx) => (
            <ProfumoCard
              key={profumo.id}
              profumo={profumo}
              isEditing={editingId === profumo.id}
              onDelete={() => handleDelete(profumo.id)}
              isDeleting={deleteId === profumo.id}
              onEditToggle={() => setEditingId(editingId === profumo.id ? null : profumo.id)}
              onSave={async (updates) => {
                const ok = await handleUpdate(profumo.id, updates);
                if (ok) setEditingId(null);
                return ok;
              }}
              onIndossa={() => setIndossaId(profumo.id)}
              onPromote={() => handlePromote(profumo.id)}
              index={idx}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddProfumoModal
          onClose={() => setShowAdd(false)}
          onAdd={async (data) => {
            const ok = await handleAdd(data);
            if (ok) setShowAdd(false);
            return ok;
          }}
          defaultCategoria={activeTab}
        />
      )}

      {indossaId && (
        <IndossaModal
          profumo={profumi.find((p) => p.id === indossaId)!}
          onClose={() => setIndossaId(null)}
          onSave={async (momento, note) => {
            const ok = await handleIndossa(indossaId, momento, note);
            if (ok) setIndossaId(null);
            return ok;
          }}
          momenti={MOMENTI}
        />
      )}
    </div>
  );
}

// ─── Profumo Card ───────────────────────────────────────────

function RatingBar({ value, label, icon: Icon }: { value: number | null; label: string; icon: typeof Wind }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-gold/60 flex-shrink-0" />
      <span className="tracking-wide-luxury text-[9px] uppercase text-muted-foreground/60 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full gold-gradient-bg rounded-full transition-all"
          style={{ width: value ? `${(value / 10) * 100}%` : '0%' }}
        />
      </div>
      {value && <span className="font-mono text-[10px] text-gold/70 w-4 text-right">{value}</span>}
    </div>
  );
}

function ProfumoCard({
  profumo,
  isEditing,
  onDelete,
  isDeleting,
  onEditToggle,
  onSave,
  onIndossa,
  onPromote,
  index,
}: {
  profumo: Profumo;
  isEditing: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  onEditToggle: () => void;
  onSave: (updates: Partial<ProfumoInput>) => Promise<boolean>;
  onIndossa: () => void;
  onPromote: () => void;
  index: number;
}) {
  const [editData, setEditData] = useState<Partial<ProfumoInput>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditData({
      nome: profumo.nome,
      brand: profumo.brand,
      famiglia_olfattiva: profumo.famiglia_olfattiva ?? '',
      prezzo_stimato_euro: profumo.prezzo_stimato_euro ?? '',
      note_olfattive: profumo.note_olfattive ?? '',
      info_fragrantica: profumo.info_fragrantica ?? '',
      url_foto_vetrina: profumo.url_foto_vetrina ?? '',
      url_brand: profumo.url_brand ?? '',
      url_fragrantica: profumo.url_fragrantica ?? '',
      categoria: profumo.categoria,
      longevita: profumo.longevita ?? undefined,
      scia: profumo.scia ?? undefined,
      proiezione: profumo.proiezione ?? undefined,
    });
    onEditToggle();
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(editData);
    setSaving(false);
  };

  if (isEditing) {
    return (
      <div className="glass-gold rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: `${index * 0.03}s` }}>
        <div className="flex items-center justify-between mb-4">
          <span className="tracking-wide-luxury text-[10px] text-gold uppercase font-medium">Modifica Scheda</span>
          <button onClick={onEditToggle} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-hide pr-1">
          <EditField label="Nome" value={editData.nome ?? ''} onChange={(v) => setEditData((p) => ({ ...p, nome: v }))} />
          <EditField label="Brand" value={editData.brand ?? ''} onChange={(v) => setEditData((p) => ({ ...p, brand: v }))} />
          <EditField label="Famiglia Olfattiva" value={editData.famiglia_olfattiva ?? ''} onChange={(v) => setEditData((p) => ({ ...p, famiglia_olfattiva: v }))} />
          <EditField label="Prezzo (€)" value={editData.prezzo_stimato_euro ?? ''} onChange={(v) => setEditData((p) => ({ ...p, prezzo_stimato_euro: v }))} />
          <EditField label="Note Olfattive" value={editData.note_olfattive ?? ''} onChange={(v) => setEditData((p) => ({ ...p, note_olfattive: v }))} />
          <EditField label="Info Fragrantica" value={editData.info_fragrantica ?? ''} onChange={(v) => setEditData((p) => ({ ...p, info_fragrantica: v }))} />
          <EditField label="URL Foto" value={editData.url_foto_vetrina ?? ''} onChange={(v) => setEditData((p) => ({ ...p, url_foto_vetrina: v }))} />
          <EditField label="URL Brand" value={editData.url_brand ?? ''} onChange={(v) => setEditData((p) => ({ ...p, url_brand: v }))} />
          <EditField label="URL Fragrantica" value={editData.url_fragrantica ?? ''} onChange={(v) => setEditData((p) => ({ ...p, url_fragrantica: v }))} />

          {/* Performance sliders */}
          <div className="pt-2 pb-1">
            <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-3">Performance (1–10)</p>
            <div className="space-y-3">
              {[
                { key: 'longevita' as const, label: 'Longevità', icon: Wind },
                { key: 'scia' as const, label: 'Scia', icon: Zap },
                { key: 'proiezione' as const, label: 'Proiezione', icon: Flame },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 text-gold/60" />
                      <label className="tracking-wide-luxury text-[10px] text-muted-foreground uppercase">{label}</label>
                    </div>
                    <span className="font-mono text-xs text-gold">{editData[key] ?? '—'}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={editData[key] ?? 5}
                    onChange={(e) => setEditData((p) => ({ ...p, [key]: parseInt(e.target.value) }))}
                    className="w-full accent-amber-500 h-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">Categoria</label>
            <select
              value={editData.categoria ?? 'collezione'}
              onChange={(e) => setEditData((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="collezione">Collezione</option>
              <option value="wishlist">Wishlist</option>
              <option value="da_studiare">Da Studiare</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full py-3 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Salva Modifiche</>}
        </button>
      </div>
    );
  }

  return (
    <div
      className="glass rounded-2xl overflow-hidden animate-fade-in-up hover:border-gold/20 transition-all group flex flex-col"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      {/* Image */}
      <div className="relative h-48 bg-secondary/30 overflow-hidden flex-shrink-0">
        {profumo.url_foto_vetrina ? (
          <img
            src={profumo.url_foto_vetrina}
            alt={profumo.nome}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FlaskConical className="w-12 h-12 text-gold/20" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-full text-[9px] tracking-wide-luxury uppercase font-medium backdrop-blur-md ${
            profumo.categoria === 'wishlist'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : profumo.categoria === 'da_studiare'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-gold/20 text-gold border border-gold/30'
          }`}>
            {profumo.categoria === 'wishlist' ? 'Wishlist' : profumo.categoria === 'da_studiare' ? 'Da Studiare' : 'Collezione'}
          </span>
        </div>
        {/* Action icons overlay */}
        <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={startEdit}
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <div className="mb-2">
          <h3 className="font-serif text-lg font-semibold text-foreground truncate">{profumo.nome}</h3>
          <p className="text-sm text-muted-foreground truncate">{profumo.brand}</p>
        </div>

        {profumo.famiglia_olfattiva && (
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3 h-3 text-gold/60" />
            <span className="tracking-wide-luxury text-[10px] text-gold uppercase">{profumo.famiglia_olfattiva}</span>
          </div>
        )}

        {profumo.note_olfattive && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{profumo.note_olfattive}</p>
        )}

        {profumo.info_fragrantica && (
          <p className="text-xs text-muted-foreground/70 italic mb-2 line-clamp-1">{profumo.info_fragrantica}</p>
        )}

        {/* Performance bars */}
        {(profumo.longevita || profumo.scia || profumo.proiezione) && (
          <div className="space-y-1.5 mb-3">
            {profumo.longevita && <RatingBar value={profumo.longevita} label="Longevità" icon={Wind} />}
            {profumo.scia && <RatingBar value={profumo.scia} label="Scia" icon={Zap} />}
            {profumo.proiezione && <RatingBar value={profumo.proiezione} label="Proiezione" icon={Flame} />}
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* Price + links */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            {profumo.prezzo_stimato_euro && profumo.prezzo_stimato_euro !== 'N/D' ? (
              <span className="font-mono text-sm text-gold-light flex items-center gap-1">
                <Euro className="w-3 h-3" />{profumo.prezzo_stimato_euro}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/40">—</span>
            )}
            <div className="flex items-center gap-2">
              {profumo.url_fragrantica && (
                <a href={profumo.url_fragrantica} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] tracking-wide-luxury uppercase text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
                  Fragrantica<ExternalLink className="w-3 h-3" />
                </a>
              )}
              {profumo.url_brand && (
                <a href={profumo.url_brand} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] tracking-wide-luxury uppercase text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
                  Brand<ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {profumo.categoria === 'collezione' && (
              <button
                onClick={onIndossa}
                className="flex-1 py-2 rounded-xl gold-gradient-bg text-black text-xs tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              >
                <BookMarked className="w-3.5 h-3.5" />
                Indossa Oggi
              </button>
            )}
            {profumo.categoria === 'da_studiare' && (
              <button
                onClick={onPromote}
                className="flex-1 py-2 rounded-xl glass text-xs tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-1.5 hover:border-gold/30 hover:text-gold text-muted-foreground"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Acquistato
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Field ───────────────────────────────────────────

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors"
      />
    </div>
  );
}

// ─── Indossa Modal ───────────────────────────────────────────

function IndossaModal({
  profumo,
  onClose,
  onSave,
  momenti,
}: {
  profumo: Profumo;
  onClose: () => void;
  onSave: (momento: Momento, note: string) => Promise<boolean>;
  momenti: { key: Momento; label: string; icon: typeof Sun }[];
}) {
  const [momento, setMomento] = useState<Momento>('Sera');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(momento, note);
    if (ok) setDone(true);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-gold rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <BookMarked className="w-7 h-7 text-green-400" />
            </div>
            <p className="font-serif text-lg text-foreground mb-1">Registrato!</p>
            <p className="text-xs text-muted-foreground mb-4">
              {profumo.nome} aggiunto al diario olfattivo.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl glass text-sm tracking-wide-luxury uppercase font-medium">
                Chiudi
              </button>
              <Link
                href="/diario"
                className="flex-1 py-2.5 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium text-center"
              >
                Diario
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-serif text-lg font-semibold text-foreground">{profumo.nome}</h2>
                <p className="text-xs text-muted-foreground">{profumo.brand}</p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="tracking-wide-luxury text-[10px] text-gold uppercase mb-3">Momento della giornata</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {momenti.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMomento(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs transition-all ${
                    momento === key
                      ? 'gold-gradient-bg text-black font-medium'
                      : 'glass text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">
                Note personali
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='es. "Con la giacca di pelle, scia fantastica..."'
                rows={3}
                className="w-full glass rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookMarked className="w-4 h-4" />Registra Indosso</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Add Modal ───────────────────────────────────────────

function AddProfumoModal({
  onClose,
  onAdd,
  defaultCategoria,
}: {
  onClose: () => void;
  onAdd: (data: ProfumoInput) => Promise<boolean>;
  defaultCategoria: Categoria;
}) {
  const [form, setForm] = useState<ProfumoInput>({
    nome: '',
    brand: '',
    famiglia_olfattiva: '',
    prezzo_stimato_euro: '',
    note_olfattive: '',
    info_fragrantica: '',
    url_foto_vetrina: '',
    url_brand: '',
    url_fragrantica: '',
    categoria: defaultCategoria,
    longevita: null,
    scia: null,
    proiezione: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const autoFragrantica = () => {
    const query = `${form.brand} ${form.nome}`.trim().replace(/\s+/g, '+');
    if (query) setForm((p) => ({ ...p, url_fragrantica: `https://www.fragrantica.com/search/?query=${query}` }));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.brand.trim()) { setError('Nome e brand sono obbligatori'); return; }
    setSaving(true);
    setError('');
    const ok = await onAdd(form);
    if (!ok) setError('Errore durante il salvataggio. Riprova.');
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-gold rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl font-semibold gold-gradient-text">Nuovo Profumo</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <EditField label="Nome *" value={form.nome} onChange={(v) => setForm((p) => ({ ...p, nome: v }))} />
          <EditField label="Brand *" value={form.brand} onChange={(v) => setForm((p) => ({ ...p, brand: v }))} />
          <EditField label="Famiglia Olfattiva" value={form.famiglia_olfattiva ?? ''} onChange={(v) => setForm((p) => ({ ...p, famiglia_olfattiva: v }))} />
          <EditField label="Prezzo (€)" value={form.prezzo_stimato_euro ?? ''} onChange={(v) => setForm((p) => ({ ...p, prezzo_stimato_euro: v }))} />
          <EditField label="Note Olfattive" value={form.note_olfattive ?? ''} onChange={(v) => setForm((p) => ({ ...p, note_olfattive: v }))} />
          <EditField label="Info Fragrantica" value={form.info_fragrantica ?? ''} onChange={(v) => setForm((p) => ({ ...p, info_fragrantica: v }))} />
          <EditField label="URL Foto" value={form.url_foto_vetrina ?? ''} onChange={(v) => setForm((p) => ({ ...p, url_foto_vetrina: v }))} />
          <EditField label="URL Brand (pagina ufficiale)" value={form.url_brand ?? ''} onChange={(v) => setForm((p) => ({ ...p, url_brand: v }))} />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="tracking-wide-luxury text-[10px] text-gold uppercase">URL Fragrantica</label>
              <button onClick={autoFragrantica} className="text-[10px] tracking-wide-luxury uppercase text-muted-foreground hover:text-gold transition-colors">
                Auto-genera
              </button>
            </div>
            <input
              type="text"
              value={form.url_fragrantica ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, url_fragrantica: e.target.value }))}
              className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            />
          </div>

          <div>
            <label className="tracking-wide-luxury text-[10px] text-gold uppercase mb-1.5 block">Categoria</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className="w-full glass rounded-lg px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="collezione">Collezione</option>
              <option value="wishlist">Wishlist</option>
              <option value="da_studiare">Da Studiare</option>
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mt-3 text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="mt-5 w-full py-3.5 rounded-xl gold-gradient-bg text-black text-sm tracking-wide-luxury uppercase font-medium transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />Aggiungi</>}
        </button>
      </div>
    </div>
  );
}
