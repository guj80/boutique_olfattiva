/*
# Add Scent Diary (indossi) table and performance metrics columns

## Overview
Two changes:
1. New `indossi` table — records every time a perfume is worn (scent diary/tracker)
2. New performance columns on `profumi` — longevità, scia, proiezione (1–10 integer ratings)

## New Tables
- `indossi`
  - `id` (uuid, PK)
  - `profumo_id` (uuid, FK → profumi.id CASCADE)
  - `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
  - `indossato_il` (timestamptz, DEFAULT now())
  - `momento` (text) — 'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'
  - `note_personali` (text, nullable)

## Modified Tables
- `profumi` — adds nullable integer columns:
  - `longevita` (1–10)
  - `scia` (1–10)
  - `proiezione` (1–10)

## Security
- RLS enabled on `indossi` with 4 owner-scoped policies (authenticated only)
- `profumi` new columns inherit existing RLS policies automatically
*/

-- Performance metrics on profumi
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profumi' AND column_name='longevita') THEN
    ALTER TABLE profumi ADD COLUMN longevita integer CHECK (longevita BETWEEN 1 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profumi' AND column_name='scia') THEN
    ALTER TABLE profumi ADD COLUMN scia integer CHECK (scia BETWEEN 1 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profumi' AND column_name='proiezione') THEN
    ALTER TABLE profumi ADD COLUMN proiezione integer CHECK (proiezione BETWEEN 1 AND 10);
  END IF;
END $$;

-- Scent diary table
CREATE TABLE IF NOT EXISTS indossi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profumo_id uuid NOT NULL REFERENCES profumi(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  indossato_il timestamptz NOT NULL DEFAULT now(),
  momento text NOT NULL DEFAULT 'Sera',
  note_personali text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indossi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_indossi" ON indossi;
CREATE POLICY "select_own_indossi" ON indossi FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_indossi" ON indossi;
CREATE POLICY "insert_own_indossi" ON indossi FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_indossi" ON indossi;
CREATE POLICY "update_own_indossi" ON indossi FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_indossi" ON indossi;
CREATE POLICY "delete_own_indossi" ON indossi FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_indossi_user_id ON indossi(user_id);
CREATE INDEX IF NOT EXISTS idx_indossi_profumo_id ON indossi(profumo_id);
CREATE INDEX IF NOT EXISTS idx_indossi_indossato_il ON indossi(indossato_il DESC);
