export type StatoCandidato = 'in_attesa' | 'approvato' | 'scartato' | 'conflitto';

export type PermissionScraping = 'si' | 'no' | 'da_verificare';

export type NoteStruttura =
  | 'testa_cuore_fondo'
  | 'soggetto_controsoggetto_coda'
  | 'altro';

export interface FonteUfficiale {
  id: string;
  created_at: string;
  brand: string;
  url_sito: string;
  categoria: string | null;
  permission_scraping: PermissionScraping;
  note_struttura: NoteStruttura;
  ultima_visita: string | null;
  attivo: boolean;
}

export interface Candidato {
  id: string;
  created_at: string;
  brand: string;
  nome: string;
  categoria: string | null;
  famiglia: string | null;
  note_testa: string | null;
  note_cuore: string | null;
  note_fondo: string | null;
  accordi: string | null;
  perche: string | null;
  fonte_url: string | null;
  confidenza: number;
  stato: StatoCandidato;
  conflitto_note: boolean;
  note_verificate: boolean;
  catalogo_id: number | null;
}
