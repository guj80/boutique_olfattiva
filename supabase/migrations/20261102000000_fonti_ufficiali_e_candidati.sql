-- ============================================================================
-- LABORATORIO — Fonti ufficiali e coda di approvazione candidati
-- Tabelle nuove, isolate. Nessun ALTER su profumi o perfumes.
-- RLS attiva, sola lettura per utenti autenticati, scrittura solo dalla
-- service role (le rotte API). Seed iniziale: 5 brand pilota.
-- Per annullare tutto: DROP TABLE public.candidati; DROP TABLE public.fonti_ufficiali;
-- ============================================================================

create table if not exists public.fonti_ufficiali (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  brand text not null unique,
  url_sito text not null,
  categoria text,
  permission_scraping text not null default 'da_verificare',
  note_struttura text not null default 'testa_cuore_fondo',
  ultima_visita timestamptz,
  attivo boolean not null default true
);

create table if not exists public.candidati (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  brand text not null,
  nome text not null,
  categoria text,
  famiglia text,
  note_testa text,
  note_cuore text,
  note_fondo text,
  accordi text,
  perche text,
  fonte_url text,
  confidenza int not null default 0,
  stato text not null default 'in_attesa',
  conflitto_note boolean not null default false,
  note_verificate boolean not null default false,
  catalogo_id bigint
);

alter table public.fonti_ufficiali enable row level security;
alter table public.candidati enable row level security;

-- Sola lettura per utenti autenticati. La scrittura avviene solo
-- dalla service role (che bypassa RLS), usata nelle rotte API server-side.
drop policy if exists "fonti_sola_lettura" on public.fonti_ufficiali;
create policy "fonti_sola_lettura" on public.fonti_ufficiali
  for select to authenticated using (true);

drop policy if exists "candidati_sola_lettura" on public.candidati;
create policy "candidati_sola_lettura" on public.candidati
  for select to authenticated using (true);

insert into public.fonti_ufficiali (brand, url_sito, categoria, permission_scraping, note_struttura, attivo)
values
  ('Lorenzo Pazzaglia', 'https://www.lorenzopazzaglia.com', 'Ultra-nicchia', 'da_verificare', 'testa_cuore_fondo', true),
  ('Filippo Sorcinelli', 'https://www.filipposorcinelli.com', 'Ultra-nicchia', 'da_verificare', 'soggetto_controsoggetto_coda', true),
  ('Xerjoff', 'https://www.xerjoff.com', 'Nicchia', 'da_verificare', 'testa_cuore_fondo', true),
  ('BORNTOSTANDOUT', 'https://www.borntostandout.com', 'Ultra-nicchia', 'da_verificare', 'testa_cuore_fondo', true),
  ('Creed', 'https://www.creedfragrance.com', 'Designer/Artistica', 'da_verificare', 'testa_cuore_fondo', true)
on conflict (brand) do nothing;
