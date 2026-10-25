export interface FragranceKey {
  brand?: string | null;
  nome?: string | null;
}

const CONCENTRATION_PHRASES = [
  'eau de parfum',
  'eau de toilette',
  'eau de cologne',
  'extrait de parfum',
  'extrait',
  'parfum',
  'cologne',
  'edp',
  'edt',
];

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripConcentration(s: string): string {
  let out = ` ${s} `;
  for (const phrase of CONCENTRATION_PHRASES) {
    out = out.split(` ${phrase} `).join(' ');
    out = out.split(` ${phrase} `).join(' '); // seconda passata per frasi adiacenti
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Chiave normalizzata: brand senza accenti e nome senza brand né concentrazione. */
export function fragranceKey(k: FragranceKey): { b: string; n: string } {
  const b = fold(String(k.brand || ''));
  let n = stripConcentration(fold(String(k.nome || '')));
  if (b && n.indexOf(`${b} `) === 0) n = n.slice(b.length + 1).trim();
  return { b, n };
}

function brandsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 3 && b.length >= 3 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
}

/** Stessa fragranza = stessa casa e stesso nome (le altre concentrazioni contano come lo stesso profumo). */
export function isSameFragrance(x: FragranceKey, y: FragranceKey): boolean {
  const a = fragranceKey(x);
  const b = fragranceKey(y);
  return a.n.length > 0 && a.n === b.n && brandsMatch(a.b, b.b);
}

/** Separa le proposte nuove da quelle già possedute o ripetute. */
export function filterNewProposals<T extends FragranceKey>(
  items: T[],
  owned: FragranceKey[]
): { kept: T[]; rejected: T[] } {
  const kept: T[] = [];
  const rejected: T[] = [];
  for (const item of items) {
    const already = owned.some((o) => isSameFragrance(item, o)) || kept.some((k) => isSameFragrance(item, k));
    (already ? rejected : kept).push(item);
  }
  return { kept, rejected };
}

export function ownedListForPrompt(owned: FragranceKey[], max = 300): string {
  const lines = owned
    .filter((o) => o.brand && o.nome)
    .slice(0, max)
    .map((o) => `${String(o.brand).slice(0, 60)} — ${String(o.nome).slice(0, 80)}`);
  return lines.length > 0 ? lines.join('\n') : 'Nessuno';
}

export interface ScoutPromptOptions {
  count: number;
  family: string;
  include: string[];
  exclude: string[];
  ownedList: string;
  alsoExcluded?: string[];
}

export function buildScoutPrompt(o: ScoutPromptOptions): string {
  const clip = (a: string[]) => a.map((x) => x.slice(0, 40)).join(', ');
  return `Sei un esperto di alta profumeria, profumeria artistica indipendente e case di nicchia storiche e prestigiose.
Proponi SOLO creazioni reali, esistenti e in commercio: se non sei certo che un profumo esista davvero, non includerlo.

REGOLE TASSATIVE:
- Escludi qualsiasi clone, dupe, imitazione economica o profumo arabo di massa.
- NON proporre nessuno dei profumi già posseduti elencati sotto, né la stessa fragranza in un'altra concentrazione.${
    o.alsoExcluded && o.alsoExcluded.length > 0
      ? `\n- NON proporre nemmeno questi, già scartati: ${o.alsoExcluded.slice(0, 40).join('; ')}.`
      : ''
  }
- Restituisci ESATTAMENTE ${o.count} creazioni distinte, di Maison diverse tra loro.

Criteri di ricerca opzionali forniti dall'utente:
- Famiglia olfattiva preferita: ${o.family}
- Note da includere: ${o.include.length > 0 ? clip(o.include) : 'Nessuna specifica'}
- Note da escludere tassativamente: ${o.exclude.length > 0 ? clip(o.exclude) : 'Nessuna specifica'}

PROFUMI GIÀ POSSEDUTI DALL'UTENTE (da non riproporre):
${o.ownedList}

Per ciascuna creazione restituisci un oggetto JSON con questi campi esatti:
brand, nome, concentrazione, famiglia_olfattiva (UNA parola tra: Agrumata, Aromatica, Marina, Floreale, Fruttata, Verde, Speziata, Legnosa, Ambrata, Gourmand, Cuoiata, Muschiata), naso (stringa vuota se non noto), note_testa, note_cuore, note_fondo (in italiano, separate da virgola; stringa vuota se non note con certezza).
Non inventare nulla: i campi sconosciuti restano stringhe vuote.
Restituisci un array JSON valido, senza altro testo prima o dopo.`;
}

/** Estrae l'array di proposte anche se l'AI scrive testo attorno o lascia virgole finali. */
export function parseScoutArray(text: string): any[] {
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end <= start) throw new Error('nessun array');
    parsed = JSON.parse(cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'));
  }
  if (!Array.isArray(parsed)) throw new Error('non è un array');
  return parsed.filter((x) => x && typeof x === 'object' && x.brand && x.nome);
}

export interface CollectOptions {
  wanted: number;
  owned: FragranceKey[];
  /** Chiede all'AI `count` proposte; `alsoExcluded` elenca quelle già scartate o accettate. */
  fetchBatch: (a: { count: number; alsoExcluded: string[]; attempt: number }) => Promise<any[]>;
  maxAttempts?: number;
}

/**
 * Raccoglie fino a `wanted` proposte nuove. Se l'AI ne suggerisce di già possedute,
 * ne richiede altre (una sola volta di default) escludendo quelle già viste.
 */
export async function collectProposals(o: CollectOptions): Promise<any[]> {
  const maxAttempts = o.maxAttempts ?? 2;
  let accepted: any[] = [];
  const discarded: string[] = [];

  for (let attempt = 0; attempt < maxAttempts && accepted.length < o.wanted; attempt++) {
    const missing = o.wanted - accepted.length;
    let batch: any[];
    try {
      batch = await o.fetchBatch({
        count: attempt === 0 ? o.wanted : missing + 1,
        alsoExcluded: [...discarded, ...accepted.map((a) => `${a.brand} — ${a.nome}`)],
        attempt,
      });
    } catch (e) {
      if (accepted.length > 0) break; // tengo quanto già ottenuto
      throw e;
    }
    const { kept, rejected } = filterNewProposals(batch, [...o.owned, ...accepted]);
    rejected.forEach((r) => discarded.push(`${r.brand} — ${r.nome}`));
    accepted = [...accepted, ...kept].slice(0, o.wanted);
  }
  return accepted;
}
