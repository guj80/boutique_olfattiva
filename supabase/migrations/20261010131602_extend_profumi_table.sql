/*
# Extend profumi table with full perfume metadata

## Overview
Adds new columns to the existing `profumi` table to support a richer perfume collection experience:
- Olfactory notes, Fragrantica info, photo URLs, external links
- A category system (collezione / wishlist / da_studiare) to organize perfumes
- Manual search and brand link support

## Modified Tables
- `profumi` — adds the following nullable columns:
  - `note_olfattive` (text) — comma-separated olfactory notes (e.g. "Pesca, Rosa, Vaniglia")
  - `info_fragrantica` (text) — Fragrantica rating and character summary (e.g. "4.0/5 - Floreale, Fruttato")
  - `url_foto_vetrina` (text) — URL to a display image for the perfume
  - `url_brand` (text) — URL to the brand's official page for this perfume
  - `url_fragrantica` (text) — URL to the Fragrantica page for this perfume
  - `categoria` (text, NOT NULL DEFAULT 'collezione') — categorization: 'collezione', 'wishlist', or 'da_studiare'

## Security
- No changes to existing RLS policies. All existing owner-scoped policies remain in effect.
- The new columns inherit the same RLS protections as the rest of the table.

## Notes
1. All new columns are nullable so existing rows remain valid without modification.
2. The `categoria` column defaults to 'collezione' so all existing and new entries land in the main collection by default.
3. No data is lost — this is purely additive.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'note_olfattive') THEN
    ALTER TABLE profumi ADD COLUMN note_olfattive text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'info_fragrantica') THEN
    ALTER TABLE profumi ADD COLUMN info_fragrantica text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'url_foto_vetrina') THEN
    ALTER TABLE profumi ADD COLUMN url_foto_vetrina text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'url_brand') THEN
    ALTER TABLE profumi ADD COLUMN url_brand text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'url_fragrantica') THEN
    ALTER TABLE profumi ADD COLUMN url_fragrantica text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profumi' AND column_name = 'categoria') THEN
    ALTER TABLE profumi ADD COLUMN categoria text NOT NULL DEFAULT 'collezione';
  END IF;
END $$;
