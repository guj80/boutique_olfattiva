export interface ScoutFilters {
  scoutFamily: string;
  includeNotes: string[];
  excludeNotes: string[];
}

export function buildScoutPrompt(filters: ScoutFilters, ownedNames: string[] = []) {
  const { scoutFamily, includeNotes, excludeNotes } = filters;
  return `Sei un esperto internazionale di alta profumeria, profumeria artistica indipendente e case di nicchia storiche e prestigiose.
REGOLE TASSATIVE:
- Escludi rigorosamente qualsiasi clone, dupe, imitazione economica o profumo arabo di massa.
- Escludi tassativamente qualsiasi profumo già presente in questa lista di proprietà dell'utente: [${ownedNames.join(', ')}].
- Restituisci ESATTAMENTE 3 creazioni distinte: 1 Designer di alto profilo, 1 Artistico indipendente e 1 di Nicchia prestigiosa.
Criteri di ricerca:
- Famiglia olfattiva: ${scoutFamily}
- Note da includere: ${includeNotes.length > 0 ? includeNotes.join(', ') : 'Nessuna specifica'}
- Note da escludere: ${excludeNotes.length > 0 ? excludeNotes.join(', ') : 'Nessuna specifica'}

Restituisci un array JSON puro contenente esattamente 3 oggetti con questi campi esatti:
brand, nome, concentrazione, famiglia_olfattiva, naso, note_testa, note_cuore, note_fondo, categoria ("Designer", "Artistico", "Nicchia").
Nessun testo fuori dal JSON.`;
}

export function parseScoutArray(rawText: string) {
  let cleanText = String(rawText).trim();
  if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
  if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
  if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);

  const parsed = JSON.parse(cleanText.trim());
  if (!Array.isArray(parsed)) {
    throw new Error("L'AI non ha restituito un formato valido.");
  }
  return parsed;
}

export async function collectProposals(filters: ScoutFilters, ownedNames: string[] = []) {
  const prompt = buildScoutPrompt(filters, ownedNames);
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, search: true }),
  });
  const data = await res.json();
  if (!res.ok || !data.text) {
    throw new Error('Errore durante la ricerca del consultant.');
  }
  return parseScoutArray(data.text);
}

export function filterNewProposals(proposals: any[], ownedNames: string[] = []) {
  return proposals.filter(
    (item) => !ownedNames.some((name) => name.toLowerCase() === item.nome?.toLowerCase())
  );
}

export function ownedListForPrompt(profumi: any[]) {
  return profumi.map((p) => `${p.brand} - ${p.nome}`);
}
