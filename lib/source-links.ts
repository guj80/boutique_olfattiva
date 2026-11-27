import type { Profumo } from '@/lib/supabase';

export interface SourceLink {
  key: 'web' | 'parfumo' | 'fragrantica';
  label: string;
  href: string;
  /** true se il link punta direttamente alla pagina salvata, false se è una ricerca */
  direct: boolean;
}

export interface StoredSourceUrls {
  url_sito_ufficiale?: string | null;
  url_parfumo?: string | null;
  url_fragrantica?: string | null;
}

const isHttp = (u?: string | null): u is string =>
  typeof u === 'string' && /^https?:\/\//i.test(u.trim());

/**
 * Restituisce SEMPRE i tre link: se la scheda ha l'URL diretto salvato lo usa,
 * altrimenti ripiega su una ricerca costruita da brand + nome. Così il link
 * non sparisce mai, nemmeno per i profumi inseriti prima di questa funzione.
 */
export function buildSourceLinks(
  p: Pick<Profumo, 'brand' | 'nome'> & StoredSourceUrls
): SourceLink[] {
  const q = `${p.brand || ''} ${p.nome || ''}`.trim();
  const enc = encodeURIComponent(q);
  return [
    {
      key: 'web',
      label: 'Ricerca web',
      href: isHttp(p.url_sito_ufficiale)
        ? p.url_sito_ufficiale.trim()
        : `https://www.google.com/search?q=${encodeURIComponent(`${q} profumo`)}`,
      direct: isHttp(p.url_sito_ufficiale),
    },
    {
      key: 'parfumo',
      label: 'Parfumo',
      href: isHttp(p.url_parfumo)
        ? p.url_parfumo.trim()
        : `https://www.parfumo.com/s_perfumes_x.php?in=1&filter=${enc}`,
      direct: isHttp(p.url_parfumo),
    },
    {
      key: 'fragrantica',
      label: 'Fragrantica',
      href: isHttp(p.url_fragrantica)
        ? p.url_fragrantica.trim()
        : `https://www.fragrantica.com/search/?query=${enc}`,
      direct: isHttp(p.url_fragrantica),
    },
  ];
}

/** Smista un link incollato dall'utente nel campo giusto in base al dominio. */
export function classifyPastedUrl(url: string): keyof StoredSourceUrls | null {
  const u = url.trim().toLowerCase();
  if (!isHttp(u)) return null;
  if (u.includes('parfumo.')) return 'url_parfumo';
  if (u.includes('fragrantica.')) return 'url_fragrantica';
  if (/(basenotes|wikipedia|youtube|instagram|facebook|google\.)/.test(u)) return null;
  return 'url_sito_ufficiale';
}

/** Tiene solo gli URL validi, pronti da salvare. */
export function pickStoredUrls(src: StoredSourceUrls): StoredSourceUrls {
  const out: StoredSourceUrls = {};
  if (isHttp(src.url_sito_ufficiale)) out.url_sito_ufficiale = src.url_sito_ufficiale.trim();
  if (isHttp(src.url_parfumo)) out.url_parfumo = src.url_parfumo.trim();
  if (isHttp(src.url_fragrantica)) out.url_fragrantica = src.url_fragrantica.trim();
  return out;
}
