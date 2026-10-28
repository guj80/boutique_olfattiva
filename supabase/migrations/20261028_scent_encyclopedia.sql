-- ============================================================================
-- SCENT ENCYCLOPEDIA MIGRATION — BOUTIQUE OLFATTIVA
-- File: 20261028_scent_encyclopedia.sql
-- Scopo: Enciclopedia dei profumi con schema corretto, note separate e
--        bridge table perfumo_note per i collegamenti olfattivi.
-- Data: 2026-10-28
-- ============================================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. MAISON (marche/manufacturers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maison (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    brand       TEXT,                     -- es. "Kilian", "Tom Ford"
    country     TEXT,                     -- es. "FR", "IT"
    founded     INTEGER,                  -- anno di fondazione
    website     TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maison ENABLE ROW LEVEL SECURITY;

CREATE POLICY maison_read ON public.maison
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE TRIGGER update_maison_updated_at
    BEFORE UPDATE ON public.maison
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. NOTE OLFATTIVA (tassonomia)
-- Nota: NON è fisso; permette variante per profumo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.note (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    family      TEXT NOT NULL,            -- citrus, fresh, herbal, floral, fruity, sweet, spicy, amber, woody, musky
    descriptor  TEXT,                     -- es. "Fresh, citrusy"
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT note_name_unique UNIQUE (name)
);

ALTER TABLE public.note ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_read ON public.note
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE TRIGGER update_note_updated_at
    BEFORE UPDATE ON public.note
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. PERFUME (catalogo condiviso / encyclopedia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfume (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    brand           TEXT,                 -- marchio (es. "Kilian", "Tom Ford")
    maison_id       UUID REFERENCES public.maison(id) ON DELETE SET NULL,
    family          TEXT,                 -- es. "Eau de Parfum", "Parfum"
    concentration   TEXT,                 -- EDV, EDT, EDC, Parfum, Extrait
    format          TEXT,                 -- 30ml, 50ml, 100ml, ...
    price_usd       DECIMAL(10,2),        -- may be null
    image_url       TEXT,                 -- URL immagine del flacone
    youtube_id      TEXT,                 -- reference video
    description     TEXT,                 -- descrizione olfattiva
    source_url      TEXT,                 -- link alla fonte
    confidence      INTEGER DEFAULT 100,  -- 0-100, data verificata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT perfume_name_unique UNIQUE (name, brand, family, concentration, format)
);

ALTER TABLE public.perfume ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfume_read ON public.perfume
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE TRIGGER update_perfume_updated_at
    BEFORE UPDATE ON public.perfume
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. BRIDGE TABLE: perfume_note (collega profumi alle note)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfume_note (
    perfume_id UUID REFERENCES public.perfume(id) ON DELETE CASCADE,
    note_id    UUID REFERENCES public.note(id) ON DELETE CASCADE,
    layer      TEXT CHECK (layer IN ('top', 'heart', 'base')),
    PRIMARY KEY (perfume_id, note_id, layer)
);

ALTER TABLE public.perfume_note ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfume_note_read ON public.perfume_note
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE INDEX idx_perfume_note_perfume ON public.perfume_note(perfume_id);
CREATE INDEX idx_perfume_note_note      ON public.perfume_note(note_id);

-- ============================================================
-- 5. ACCORD (coppie di note con confidenza e frequenza)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accord (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_a_id   UUID NOT NULL REFERENCES public.note(id) ON DELETE CASCADE,
    note_b_id   UUID NOT NULL REFERENCES public.note(id) ON DELETE CASCADE,
    strength    INTEGER NOT NULL CHECK (strength >= 0 AND strength <= 100),
    frequency   INTEGER,                  -- n° profumi che contengono entrambe le note
    confidence  INTEGER DEFAULT 100,      -- 0-100, veridicità dell'accoppiamento
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT accord_unique_pair UNIQUE (note_a_id, note_b_id),
    CONSTRAINT accord_no_self_reference CHECK (note_a_id <> note_b_id)
);

ALTER TABLE public.accord ENABLE ROW LEVEL SECURITY;

CREATE POLICY accord_read ON public.accord
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE INDEX idx_accord_note_a ON public.accord(note_a_id);
CREATE INDEX idx_accord_note_b ON public.accord(note_b_id);

-- ============================================================
-- 6. JOURNAL (diario personale utente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    perfume_id      UUID NOT NULL REFERENCES public.perfume(id) ON DELETE CASCADE,
    data_indosso    DATE NOT NULL,
    momento_giornata TEXT,
    meteo           TEXT,
    temperatura     NUMERIC,
    note_indosso    TEXT,
    contesto_outfit TEXT,
    note_giorno     TEXT,
    complimenti_ricevuti INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT journal_unique_user_perfume_date UNIQUE (user_id, perfume_id, data_indosso)
);

ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_owner ON public.journal
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS UTILITY
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maison_updated_at
    BEFORE UPDATE ON public.maison
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_note_updated_at
    BEFORE UPDATE ON public.note
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perfume_updated_at
    BEFORE UPDATE ON public.perfume
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. INDEX E OPTIMIZZAZIONI
-- ============================================================
CREATE INDEX idx_perfume_name ON public.perfume USING gin (name gin_trgm_ops);
CREATE INDEX idx_perfume_brand ON public.perfume USING gin (brand gin_trgm_ops);
CREATE INDEX idx_perfume_maison ON public.perfume(maison_id);
CREATE INDEX idx_perfume_note_perfume ON public.perfume_note(perfume_id);
CREATE INDEX idx_perfume_note_note ON public.perfume_note(note_id);
CREATE INDEX idx_accord_note_a ON public.accord(note_a_id);
CREATE INDEX idx_accord_note_b ON public.accord(note_b_id);

-- ============================================================
-- 9. FUNZIONE DI VERIFICA: elenca tutte le tabelle create
-- ============================================================
CREATE OR REPLACE FUNCTION public.entrance() RETURNS TABLE(table_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%' AND table_name <> 'auth';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.entrance IS 'Elenca le tabelle della base per debugging';
