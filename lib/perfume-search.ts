// ============================================================================
// PERFUME SEARCH — BOUTIQUE OLFATTIVA
// ============================================================================
// Logica di ricerca, filtri e aggregazione per il catalogo enciclopedico.
// Usa Supabase come datastore primario.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type {
  Perfume,
  Note,
  Accord,
  Maison,
  PerfumeSearchResult,
  PerfumeFilters,
  PerfumeDetail,
} from '../app/types/models';

// --- Utility ---------------------------------------------------------------

function parseFilter(value: string | null): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

// --- Search ---------------------------------------------------------------

export async function searchPerfumes(
  filters: PerfumeFilters,
  options: {
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'price' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    q?: string;
  } = {}
): Promise<PerfumeSearchResult> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    q,
  } = options;

  const { data, error, count } = await supabase
    .from('perfume')
    .select('*', { count: 'exact', head: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    console.error('[searchPerfumes] Supabase error:', error);
    throw new Error(`Failed to search perfumes: ${error.message}`);
  }

  // Apply client-side filters on the fetched results
  const filtered = (data || []).filter((p: Perfume) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    return true;
  });

  return {
    perfumes: filtered,
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > page * limit,
    filters: {
      notes: [],
      families: [],
      concentration: null,
      brand: null,
      minPrice: null,
      maxPrice: null,
    },
  };
}

// --- Advanced search with filters ------------------------------------------

interface AdvancedSearchFilters {
  q?: string;
  family?: string;
  note?: string;
  position?: 'top' | 'heart' | 'base';
  concentration?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export async function advancedSearch(
  filters: AdvancedSearchFilters
): Promise<PerfumeSearchResult> {
  const {
    q,
    family,
    note,
    position,
    concentration,
    brand,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = filters;

  const { data, error, count } = await supabase
    .from('perfume')
    .select('*', { count: 'exact', head: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    console.error('[advancedSearch] Supabase error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  return {
    perfumes: data || [],
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > page * limit,
    filters: {
      notes: [],
      families: [],
      concentration: null,
      brand: null,
      minPrice: null,
      maxPrice: null,
    },
  };
}

// --- Named queries ---------------------------------------------------------
// These use the existing catalogue connection to fetch curated / curated data.

export async function getTopNoteFamilies(): Promise<string[]> {
  const { data, error } = await supabase
    .from('note')
    .select('family')
    .eq('position', 'top');

  if (error) {
    console.error('[getTopNoteFamilies] error:', error);
    return [];
  }

  return (data || []).map((n: any) => n.family);
}

export async function getHeartNoteFamilies(): Promise<string[]> {
  const { data, error } = await supabase
    .from('note')
    .select('family')
    .eq('position', 'heart');

  if (error) {
    console.error('[getHeartNoteFamilies] error:', error);
    return [];
  }

  return (data || []).map((n: any) => n.family);
}

export async function getBaseNoteFamilies(): Promise<string[]> {
  const { data, error } = await supabase
    .from('note')
    .select('family')
    .eq('position', 'base');

  if (error) {
    console.error('[getBaseNoteFamilies] error:', error);
    return [];
  }

  return (data || []).map((n: any) => n.family);
}
