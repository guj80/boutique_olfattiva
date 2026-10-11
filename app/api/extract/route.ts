-- ============================================================================
-- BOUTIQUE OLFATTIVA DI LUCA — SAFE & IDEMPOTENT UPGRADE MIGRATION
-- Non cancella né sovrascrive alcun dato dei 40 profumi esistenti!
-- ============================================================================

-- 1. Estensione sicura della tabella 'profumi'
ALTER TABLE public.profumi
  ADD COLUMN IF NOT EXISTS concentrazione text DEFAULT 'Extrait de Parfum',
  ADD COLUMN IF NOT EXISTS famiglia_olfattiva text,
  ADD COLUMN IF NOT EXISTS note_testa text,
  ADD COLUMN IF NOT EXISTS note_cuore text,
  ADD COLUMN IF NOT EXISTS note_fondo text,
  ADD COLUMN IF NOT EXISTS note_olfattive text,
  ADD COLUMN IF NOT EXISTS descrizione_ai text,
  ADD COLUMN IF NOT EXISTS prezzo_stimato_euro text,
  ADD COLUMN IF NOT EXISTS formato_ml integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS url_foto_vetrina text,
  ADD COLUMN IF NOT EXISTS stato text DEFAULT 'collezione',
  ADD COLUMN IF NOT EXISTS note_mouche text,
  ADD COLUMN IF NOT EXISTS note_pelle text,
  ADD COLUMN IF NOT EXISTS voto_longevita integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS voto_scia integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS voto_proiezione integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS voto_complessita integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS valutazione_stelle integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS stagione_ideale text,
  ADD COLUMN IF NOT EXISTS occasione_ideale text;

-- 2. Rende user_id opzionale per permettere inserimenti rapidi anche senza login attivo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profumi' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profumi ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Normalizza i 40 profumi storici: se 'stato' è NULL o vuoto, diventa 'collezione'
UPDATE public.profumi
SET stato = 'collezione'
WHERE stato IS NULL OR trim(stato) = '';

-- 4. Creazione/Estensione sicura della tabella 'indossi' (Scent Tracker)
CREATE TABLE IF NOT EXISTS public.indossi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profumo_id uuid REFERENCES public.profumi(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  data_indosso date DEFAULT CURRENT_DATE,
  momento_giornata text DEFAULT 'Sera',
  contesto_outfit text,
  note_giorno text,
  complimenti_ricevuti integer DEFAULT 0
);

ALTER TABLE public.indossi
  ADD COLUMN IF NOT EXISTS momento_giornata text DEFAULT 'Sera',
  ADD COLUMN IF NOT EXISTS contesto_outfit text,
  ADD COLUMN IF NOT EXISTS note_giorno text,
  ADD COLUMN IF NOT EXISTS complimenti_ricevuti integer DEFAULT 0;

-- 5. Policy RLS per garantire che la Boutique privata di Luca veda sempre tutti i 40+ profumi
ALTER TABLE public.profumi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indossi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Boutique Luca Accesso Totale Profumi" ON public.profumi;
CREATE POLICY "Boutique Luca Accesso Totale Profumi"
  ON public.profumi
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Boutique Luca Accesso Totale Indossi" ON public.indossi;
CREATE POLICY "Boutique Luca Accesso Totale Indossi"
  ON public.indossi
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
