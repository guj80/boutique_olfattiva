-- ============================================================================
-- BASELINE SCHEMA REALE — BOUTIQUE OLFATTIVA
-- SOLO DOCUMENTAZIONE: descrive lo stato reale in produzione.
-- Non eseguire manualmente se il database è già attivo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tabella collezione personale e radar
CREATE TABLE IF NOT EXISTS public.profumi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  nome text NOT NULL,
  brand text NOT NULL,
  famiglia_olfattiva text,
  prezzo_stimato_euro text,
  note_olfattive text,
  info_fragrantica text,
  url_foto_vetrina text,
  stato text DEFAULT 'collezione',
  note_pelle text,
  note_mouche text,
  voto_longevita integer,
  voto_scia integer,
  voto_proiezione integer,
  voto_complessita integer DEFAULT 8,
  valutazione_stelle integer DEFAULT 5,
  stagione_ideale text,
  occasione_ideale text,
  concentrazione text DEFAULT 'Extrait de Parfum',
  note_testa text,
  note_cuore text,
  note_fondo text,
  descrizione_ai text,
  formato_ml integer DEFAULT 50,
  naso text
);

-- 2. Tabella registro indossi (Diario)
CREATE TABLE IF NOT EXISTS public.indossi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profumo_id uuid REFERENCES public.profumi(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  momento_giornata text,
  meteo text,
  temperatura numeric,
  note_indosso text,
  contesto_outfit text,
  note_giorno text,
  complimenti_ricevuti integer DEFAULT 0
);

-- 3. Tabella catalogo enciclopedico (~59.000 referenze)
CREATE TABLE IF NOT EXISTS public.perfumes (
  id bigint PRIMARY KEY,
  number bigint,
  name text,
  brand text,
  release_year integer,
  concentration text,
  rating_value numeric,
  rating_count integer,
  main_accords text,
  top_notes text,
  middle_notes text,
  base_notes text,
  perfumers text,
  url text,
  embedding vector(1536),
  cached_ai_data jsonb
);

-- 4. Sicurezza RLS (Row Level Security)
ALTER TABLE public.profumi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indossi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profumi' AND policyname = 'profumi_solo_autenticati'
  ) THEN
    CREATE POLICY "profumi_solo_autenticati" ON public.profumi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'indossi' AND policyname = 'indossi_solo_autenticati'
  ) THEN
    CREATE POLICY "indossi_solo_autenticati" ON public.indossi FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perfumes' AND policyname = 'perfumes_lettura_catalogo'
  ) THEN
    CREATE POLICY "perfumes_lettura_catalogo" ON public.perfumes FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
