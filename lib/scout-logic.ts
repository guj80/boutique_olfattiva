export interface ScoutFilters {
  scoutFamily: string;
  includeNotes: string[];
  excludeNotes: string[];
}

export function ownedListForPrompt(profumi: any[]): string[] {
  // Mantenuto per retrocompatibilità ma non filtrato
  return [];
}

export function buildScoutPrompt(filters: ScoutFilters, ownedNames: string[] = []): string {
  const { scoutFamily, includeNotes, excludeNotes } = filters;

  return `Sei un esperto internazionale di alta profumeria, profumeria artistica indipendente e case di nicchia storiche.
REGOLE TASSATIVE:
- Escludi rigorosamente qualsiasi clone, dupe, imitazione o profumo arabo di massa.
- Restituisci ESATTAMENTE 3 creazioni reali e distinte: 1 Designer di alto profilo, 1 Artistico indipendente e 1 di Nicchia prestigiosa.

Criteri richiesti:
- Famiglia olfattiva: ${scoutFamily}
- Note da includere: ${includeNotes.length > 0 ? includeNotes.join(', ') : 'Qualsiasi'}
- Note da escludere: ${excludeNotes.length > 0 ? excludeNotes.join(', ') : 'Nessuna'}

Restituisci SOLO un array JSON valido di 3 oggetti con queste chiavi esatte:
[
  {
    "brand": "...",
    "nome": "...",
    "concentrazione": "Eau de Parfum",
    "famiglia_olfattiva": "...",
    "naso": "...",
    "note_testa": "...",
    "note_cuore": "...",
    "note_fondo": "...",
    "categoria": "Designer | Artistico | Nicchia"
  }
]`;
}

export function parseScoutArray(rawText: string): any[] {
  const cleanText = String(rawText)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleanText.indexOf('[');
  const end = cleanText.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('Formato risposta non valido.');
  }

  const jsonSlice = cleanText.slice(start, end + 1);
  const parsed = JSON.parse(jsonSlice);
  if (!Array.isArray(parsed)) {
    throw new Error('Risposta non in formato lista.');
  }
  return parsed;
}

export function filterNewProposals(proposals: any[], ownedNames: string[] = []): any[] {
  // Disattivato: restituisce direttamente tutte le proposte dell'AI senza scartare nulla
  return proposals;
}

export async function collectProposals(
  filters: ScoutFilters,
  ownedNames: string[] = []
): Promise<any[]> {
  const prompt = buildScoutPrompt(filters, ownedNames);
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, search: false }),
  });

  const data = await res.json();
  if (!res.ok || !data.text) {
    throw new Error(data?.error || 'Errore durante la ricerca AI.');
  }

  return parseScoutArray(data.text);
}
