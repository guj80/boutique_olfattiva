/*
# Create profumi table (multi-user, owner-scoped)

## Overview
Creates the `profumi` table to store each user's personal perfume collection entries.
Each perfume is linked to its owner via `user_id` and can only be accessed by that user.

## New Tables
- `profumi`
  - `id` (uuid, primary key, auto-generated)
  - `nome` (text, not null) — perfume name
  - `brand` (text, not null) — perfume brand/maison
  - `famiglia_olfattiva` (text) — olfactory family (e.g. Woody, Floral, Oriental)
  - `prezzo_stimato_euro` (text) — estimated price in euros
  - `user_id` (uuid, not null, defaults to auth.uid()) — owner of the perfume entry
  - `created_at` (timestamptz, defaults to now()) — when the entry was added

## Security
- Row Level Security ENABLED on `profumi`.
- Four owner-scoped policies (SELECT, INSERT, UPDATE, DELETE) scoped to `authenticated` role only.
- Each user can only see, create, update, and delete their own perfume entries.
- `user_id` defaults to `auth.uid()` so client-side inserts that omit `user_id` still satisfy the INSERT policy's WITH CHECK.

## Notes
1. This app requires authentication (email/password via Supabase Auth).
2. No sign-in = no data visible. Each user's collection is private.
3. The `DEFAULT auth.uid()` on `user_id` is critical: the frontend insert call does not need to pass `user_id`.
*/

CREATE TABLE IF NOT EXISTS profumi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  brand text NOT NULL,
  famiglia_olfattiva text,
  prezzo_stimato_euro text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profumi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profumi" ON profumi;
CREATE POLICY "select_own_profumi" ON profumi FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profumi" ON profumi;
CREATE POLICY "insert_own_profumi" ON profumi FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profumi" ON profumi;
CREATE POLICY "update_own_profumi" ON profumi FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profumi" ON profumi;
CREATE POLICY "delete_own_profumi" ON profumi FOR DELETE
TO authenticated USING (auth.uid() = user_id);
