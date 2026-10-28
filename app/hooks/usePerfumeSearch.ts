// ============================================================================
// USE PERFUME SEARCH — BOUTIQUE OLFATTIVA
// ============================================================================
// Hook React per la gestione dello stato di ricerca, filtri e caricamento
// dei profumi. Fornisce un'API pulita per il client.
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  PerfumeSearchResult,
  PerfumeFilters,
  Perfume,
  Note,
  Accord,
  Maison,
  PerfumeDetail,
} from '../types/models';

// --- Types -----------------------------------------------------------------

export interface SearchFilters {
  q: string;
  family: string;
  note: string;
  position: 'top' | 'heart' | 'base' | '';
  concentration: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
  page: number;
  limit: number;
  sortBy: 'name' | 'price' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export interface UsePerfumeSearchOptions {
  initialFilters?: SearchFilters;
  debounceMs?: number;
}

export interface UsePerfumeSearchReturn {
  result: PerfumeSearchResult | null;
  loading: boolean;
  error: string | null;
  filters: SearchFilters;
  setFilter: (key: keyof SearchFilters, value: string | number) => void;
  setFilterValue: (key: keyof SearchFilters, value: string | number) => void;
  refresh: () => Promise<void>;
  clearFilters: () => void;
}

// --- Hook ------------------------------------------------------------------

export function usePerfumeSearch(options: UsePerfumeSearchOptions = {}) {
  const {
    initialFilters = {
      q: '',
      family: '',
      note: '',
      position: '',
      concentration: '',
      brand: '',
      minPrice: '',
      maxPrice: '',
      page: 1,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
    debounceMs = 300,
  } = options;

  const [result, setResult] = useState<PerfumeSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  // Debounce guard
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Call the real API endpoint once available
      // const res = await fetch(`/api/perfumes?${new URLSearchParams({
      //   q: filters.q,
      //   family: filters.family,
      //   note: filters.note,
      //   position: filters.position,
      //   concentration: filters.concentration,
      //   brand: filters.brand,
      //   minPrice: filters.minPrice,
      //   maxPrice: filters.maxPrice,
      //   page: filters.page.toString(),
      //   limit: filters.limit.toString(),
      //   sortBy: filters.sortBy,
      //   sortOrder: filters.sortOrder,
      // })}`);
      // const data = await res.json();
      // setResult(data);

      // Placeholder: return empty
      setResult({
        perfumes: [],
        total: 0,
        page: filters.page,
        limit: filters.limit,
        hasMore: false,
        filters: {
          notes: [],
          families: [],
          concentration: null,
          brand: null,
          minPrice: null,
          maxPrice: null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load perfumes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      load();
    }, debounceMs);
    setDebounceTimer(timer);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [filters, debounceMs, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const setFilter = useCallback((key: keyof SearchFilters, value: string | number) => {
    setFilters((prev) => {
      const next = { ...prev };
      // Numeric keys
      if (key === 'page' || key === 'limit') {
        next[key] = typeof value === 'number' ? value : Number(value);
      } else if (key === 'sortBy' || key === 'sortOrder') {
        (next as any)[key] = value as string;
      } else if (key === 'position') {
        (next[key] as any) = value as 'top' | 'heart' | 'base' | '';
      } else {
        (next[key] as any) = String(value);
      }
      return next;
    });
  }, []);

  const setFilterValue = useCallback((key: keyof SearchFilters, value: string | number) => {
    setFilter(key, value);
  }, [setFilter]);

  const clearFilters = useCallback(() => {
    setFilters({
      q: initialFilters.q,
      family: initialFilters.family,
      note: initialFilters.note,
      position: initialFilters.position,
      concentration: initialFilters.concentration,
      brand: initialFilters.brand,
      minPrice: initialFilters.minPrice,
      maxPrice: initialFilters.maxPrice,
      page: 1,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  }, [initialFilters]);

  return {
    result,
    loading,
    error,
    filters,
    setFilter,
    setFilterValue,
    refresh,
    clearFilters,
  };
}

// --- Perfume detail hook ---------------------------------------------------

export function usePerfumeDetail(perfumeId: string | null) {
  const [detail, setDetail] = useState<PerfumeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!perfumeId) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // TODO: Call the real API endpoint once available
      // const res = await fetch(`/api/perfumes/${perfumeId}`);
      // const data = await res.json();
      // setDetail(data as PerfumeDetail);

      // Placeholder: return empty
      setDetail({
        perfume: {
          id: perfumeId,
          name: '',
          brand: '',
          maisonId: '',
          family: '',
          concentration: '',
          format: '',
          priceUsd: null,
          imageUrl: null,
          youtubeId: null,
          description: null,
          sourceUrl: null,
          confidence: 0,
          createdAt: '',
          updatedAt: '',
        },
        notes: [],
        accords: [],
        maison: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load perfume detail');
    } finally {
      setLoading(false);
    }
  }, [perfumeId]);

  useEffect(() => {
    load();
  }, [perfumeId, load]);

  return {
    detail,
    loading,
    error,
    refresh: load,
  };
}
