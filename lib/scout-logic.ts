export interface ScoutFilters {
  scoutFamily: string;
  includeNotes: string[];
  excludeNotes: string[];
}

export async function runScoutQuery(filters: ScoutFilters) {
  const { scoutFamily, includeNotes, excludeNotes } = filters;

  const prompt = `Sei un esperto internazionale di alta profumeria, profumeria artistica indipendente e case di nicchia storiche e prestigiose.
REGOLE TASSATIVE:
- Escludi rigorosamente qualsiasi clone, dupe, imitazione economica o profumo arabo di massa.
- Restituisci ESATTAMENTE 3 creazioni distinte: 1 Designer di alto profilo, 1 Artistico indipendente e 1 di Nicchia prestigiosa.
Criteri di ricerca opzionali forniti dall'utente:
- Famiglia olfattiva preferita: ${scoutFamily}
- Note da includere: ${includeNotes.length > 0 ? includeNotes.join(', ') : 'Nessuna specifica'}
- Note da escludere tassativamente: ${excludeNotes.length > 0 ? excludeNotes.join(', ') : 'Nessuna specifica'}

Per ciascuno dei 3 profumi restituisci un oggetto JSON con questi campi esatti:
brand, nome, concentrazione, famiglia_olfattiva, naso, note_testa, note_cuore, note_fondo, categoria ("Designer", "Artistico", "Nicchia").
Restituisci un array JSON valido contenente esattamente questi 3 elementi, senza altro testo prima o dopo.`;

  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, search: true }),
  });

  const data = await res.json();
  if (!res.ok || !data.text) {
    throw new Error('Errore durante la comunicazione con il consultant.');
  }

  let cleanText = String(data.text).trim();
  if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
  if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
  if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);

  const parsed = JSON.parse(cleanText.trim());
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("L'AI non ha restituito un formato valido.");
  }

  return parsed;
}
