'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { FAMILIES, FamilyId } from '@/lib/scent-families';
import {
  loadScentDatabase,
  applyFilters,
  classifyPerfumeFamily,
  familiesOfPerfume,
  type PerfumeFilters,
  type ScentPerfume,
  type ScentDatabase,
} from '@/lib/dataset';

type Position = 'top' | 'heart' | 'base' | null;

interface PerfumeMatch {
  perfume: ScentPerfume;
  families: FamilyId[];
}

export default function EnciclopediaPage() {
  const [db, setDb] = useState<ScentDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PerfumeFilters>({
    q: '',
    families: [],
    notes: [],
    position: null,
    brand: '',
  });
  const [results, setResults] = useState<PerfumeMatch[]>([]);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadScentDatabase()
      .then((d) => {
        if (!cancelled) setDb(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // debounce per la ricerca immediata
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 220);
    return () => clearTimeout(t);
  }, [filters.q]);

  const runFilters = useCallback(() => {
    if (!db) return;
    const applied: PerfumeFilters = {
      q: debouncedQ,
      families: filters.families,
      notes: filters.notes,
      position: filters.position,
      brand: filters.brand,
    };
    const filtered = applyFilters(db, applied);
    setResults(
      filtered.map((m) => ({
        perfume: m.perfume,
        families: m.families,
      })),
    );
  }, [db, debouncedQ, filters.families, filters.notes, filters.position, filters.brand]);

  useEffect(() => {
    runFilters();
  }, [runFilters]);

  const handleQChange = (e: ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, q: e.target.value }));
  const handleBrandChange = (e: ChangeEvent<HTMLInputElement>) => setFilters((f) => ({ ...f, brand: e.target.value }));
  const toggleFamily = (id: FamilyId) =>
    setFilters((f) => {
      const has = f.families.includes(id);
      const next = has ? f.families.filter((x) => x !== id) : [...f.families, id];
      return { ...f, families: next };
    });
  const setPosition = (pos: Position) => setFilters((f) => ({ ...f, position: pos }));
  const handleNoteChange = (e: ChangeEvent<HTMLInputElement>) =>
    setFilters((f) => ({ ...f, notes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }));
  const clearFilters = () => setFilters({ q: '', families: [], notes: [], position: null, brand: '' });

  const selectedFamilyCount = filters.families.length;
  const selectedNoteCount = filters.notes.length;

  if (!db) {
    return (
      <div className="enciclo-shell">
        <div className="enciclo-spinner" />
        <p>Caricamento Enciclopedia…</p>
      </div>
    );
  }

  return (
    <div className="enciclo-shell">
      {/* Header */}
      <header className="enciclo-hero">
        <div className="enciclo-hero-inner">
          <h1 className="enciclo-title">Enciclopedia Olfattiva</h1>
          <p className="enciclo-subtitle">
            {db.count.toLocaleString()} profumi · {db.notes.length} note · {FAMILIES.length} famiglie olfattive
          </p>
        </div>
      </header>

      {/* Barra di ricerca */}
      <div className="enciclo-search">
        <div className="enciclo-search-box">
          <svg className="enciclo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={filters.q}
            onChange={handleQChange}
            placeholder="Cerca profumo, maestro, casa, nota, accordo…"
            className="enciclo-search-input"
            aria-label="Cerca nel catalogo"
          />
          {filters.q && (
            <button
              className="enciclo-cross"
              onClick={() => setFilters((f) => ({ ...f, q: '' }))}
              aria-label="Cancella ricerca"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {filters.q && (
          <button className="enciclo-clear-q" onClick={() => setFilters((f) => ({ ...f, q: '' }))}>
            Annulla ricerca
          </button>
        )}
      </div>

      {/* Filtri */}
      <div className="enciclo-filters">
        {selectedFamilyCount > 0 && (
          <div className="enciclo-filter-chip">
            <span>Famiglie selezionate: {filters.families.length}</span>
            <button onClick={() => setFilters((f) => ({ ...f, families: [] }))}>Cancella</button>
          </div>
        )}
        {selectedNoteCount > 0 && (
          <div className="enciclo-filter-chip">
            <span>Note selezionate: {filters.notes.length}</span>
            <button onClick={() => setFilters((f) => ({ ...f, notes: [] }))}>Cancella</button>
          </div>
        )}
      </div>

      <div className="enciclo-filter-row">
        <div className="enciclo-side">
          <div className="enciclo-filter-group">
            <h2 className="enciclo-filter-title">Famiglie olfattive</h2>
            <div className="enciclo-chip-grid">
              {FAMILIES.map((f) => {
                const active = filters.families.includes(f.id);
                return (
                  <button
                    key={f.id}
                    className={`enciclo-chip ${active ? 'enciclo-chip--on' : ''}`}
                    style={{ '--chip-color': f.color } as React.CSSProperties}
                    onClick={() => toggleFamily(f.id)}
                  >
                    <span className="enciclo-chip-dot" style={{ backgroundColor: f.color }} />
                    <span className="enciclo-chip-label">{f.labelEng}</span>
                    {active && <span className="enciclo-chip-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="enciclo-filter-group">
            <h2 className="enciclo-filter-title">Nota singola</h2>
            <div className="enciclo-position-pills">
              {(['top', 'heart', 'base'] as Position[]).map((pos) => (
                <button
                  key={pos}
                  className={`enciclo-position-pill ${filters.position === pos ? 'enciclo-position-pill--on' : ''}`}
                  onClick={() => setPosition(filters.position === pos ? null : pos)}
                >
                  {pos === 'top' ? 'Testa' : pos === 'heart' ? 'Cuore' : 'Fondo'}
                </button>
              ))}
            </div>
            <input
              value={filters.notes.join(', ')}
              onChange={handleNoteChange}
              placeholder="Scrivi la nota (es. Bergamotto, Rosa…)"
            />
          </div>

          <div className="enciclo-filter-group">
            <h2 className="enciclo-filter-title">Casa/Nazione</h2>
            <input
              value={filters.brand}
              onChange={handleBrandChange}
              placeholder="Es. Dior, Chanel, Xerjoff…"
            />
          </div>
        </div>

        <div className="enciclo-results">
          {loading ? (
            <div className="enciclo-skeleton">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="enciclo-skeleton-card" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="enciclo-empty">
              <div className="enciclo-empty-icon">✦</div>
              <p>Nessun profumo corrisponde ai filtri.</p>
              <button className="enciclo-empty-clear" onClick={clearFilters}>
                Ripristina filtri
              </button>
            </div>
          ) : (
            <div className="enciclo-grid">
              {results.map(({ perfume, families }) => {
                const primaryFamily = classifyPerfumeFamily(perfume);
                return (
                  <article
                    key={perfume.id}
                    className="enciclo-card"
                    style={{ ['--card-accent' as string]: FAMILY_BY_COLOR[primaryFamily] }}
                  >
                    <div className="enciclo-card-top">
                      <div className="enciclo-card-hero" />
                      <div className="enciclo-card-meta">
                        <span className="enciclo-card-family" style={{ backgroundColor: FAMILY_BY_COLOR[primaryFamily] }}>
                          {FAMILIES.find((f) => f.id === primaryFamily)?.labelEng ?? primaryFamily}
                        </span>
                        <span className="enciclo-card-year">{perfume.year ?? '—'}</span>
                      </div>
                    </div>

                    <h3 className="enciclo-card-title">{perfume.name}</h3>
                    <p className="enciclo-card-brand">{perfume.brand}</p>

                    <div className="enciclo-pyramid">
                      <div className="enciclo-pyramid-row">
                        <span className="enciclo-pyramid-label">Testa</span>
                        <div className="enciclo-pyramid-bar">
                          <div className="enciclo-pyramid-fill" style={{ width: Math.min(perfume.top.length * 18, 220) + '%' }} />
                        </div>
                        <div className="enciclo-pyramid-notes">
                          {perfume.top.slice(0, 3).map((n) => (
                            <span key={n} className="enciclo-note-chip">{n}</span>
                          ))}
                        </div>
                      </div>
                      <div className="enciclo-pyramid-divider" />
                      <div className="enciclo-pyramid-row">
                        <span className="enciclo-pyramid-label">Cuore</span>
                        <div className="enciclo-pyramid-bar">
                          <div
                            className="enciclo-pyramid-fill"
                            style={{ width: Math.min(perfume.middle.length * 18, 220) + '%' }}
                          />
                        </div>
                        <div className="enciclo-pyramid-notes">
                          {perfume.middle.slice(0, 3).map((n) => (
                            <span key={n} className="enciclo-note-chip">{n}</span>
                          ))}
                        </div>
                      </div>
                      <div className="enciclo-pyramid-divider" />
                      <div className="enciclo-pyramid-row">
                        <span className="enciclo-pyramid-label">Fondo</span>
                        <div className="enciclo-pyramid-bar">
                          <div
                            className="enciclo-pyramid-fill"
                            style={{ width: Math.min(perfume.base.length * 18, 220) + '%' }}
                          />
                        </div>
                        <div className="enciclo-pyramid-notes">
                          {perfume.base.slice(0, 3).map((n) => (
                            <span key={n} className="enciclo-note-chip">{n}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="enciclo-accords">
                      <span className="enciclo-accords-title">Accordi principali</span>
                      <div className="enciclo-accords-row">
                        {perfume.accords.slice(0, 6).map((a, i) => (
                          <div key={a} className="enciclo-accord-bar" style={{ width: Math.max(32 - i * 4, 8) + '%' }}>
                            <span className="enciclo-accord-name">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="enciclo-card-foot">
                      <span className="enciclo-card-rating">★ {perfume.rating ?? '—'}</span>
                      <span className="enciclo-card-votes">{perfume.votes ?? 0} voti</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="enciclo-pager">
              <span className="enciclo-pager-count">
                {results.length.toLocaleString()} profumi trovati
              </span>
              <button className="enciclo-pager-reset" onClick={clearFilters}>
                Svuota filtri
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// mappa famiglia -> colore (usato per il colore della prima famiglia)
const FAMILY_BY_COLOR: Record<FamilyId, string> = Object.fromEntries(
  FAMILIES.map((f) => [f.id, f.color]),
) as Record<FamilyId, string>;
