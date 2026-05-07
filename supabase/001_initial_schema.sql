-- supabase/migrations/001_initial_schema.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- or via the Supabase CLI: supabase db push

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES
-- One row per auth.users row.
-- Stores display name and role (parent | doctor).
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('parent', 'doctor')),
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- CHILDREN
-- Each child belongs to one parent (profiles row with role='parent').
-- ─────────────────────────────────────────────
create table if not exists public.children (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  age         smallint not null check (age between 1 and 18),
  photo_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists children_parent_id_idx on public.children (parent_id);

-- ─────────────────────────────────────────────
-- PAIN LOGS
-- One log per "session" on the body map screen.
-- ─────────────────────────────────────────────
create table if not exists public.pain_logs (
  id                  uuid primary key default uuid_generate_v4(),
  child_id            uuid not null references public.children (id) on delete cascade,
  parent_id           uuid not null references public.profiles (id) on delete cascade,
  pain_type           text check (pain_type in ('sharp','dull','burning','throbbing','aching','stabbing')),
  when_did_it_start   timestamptz,
  pain_scale          smallint check (pain_scale between 1 and 10),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists pain_logs_child_id_idx  on public.pain_logs (child_id);
create index if not exists pain_logs_parent_id_idx on public.pain_logs (parent_id);

-- ─────────────────────────────────────────────
-- PAIN ZONES
-- One row per tapped body-map zone within a log.
-- pain_level: 0 = untapped, 1–4 = colour states from ShowpainScreen.js
-- ─────────────────────────────────────────────
create table if not exists public.pain_zones (
  id           uuid primary key default uuid_generate_v4(),
  pain_log_id  uuid not null references public.pain_logs (id) on delete cascade,
  zone_id      text not null,
  side         text not null check (side in ('front', 'back')),
  pain_level   smallint not null check (pain_level between 0 and 4)
);

create index if not exists pain_zones_log_id_idx on public.pain_zones (pain_log_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- The backend uses the service-role key so it bypasses RLS.
-- These policies are a safety net for direct Supabase client access.
-- ─────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.children   enable row level security;
alter table public.pain_logs  enable row level security;
alter table public.pain_zones enable row level security;

-- Profiles: users can only read/update their own row
create policy "profiles: owner access"
  on public.profiles for all
  using (auth.uid() = id);

-- Children: parents can only access their own children
create policy "children: owner access"
  on public.children for all
  using (auth.uid() = parent_id);

-- Pain logs: parents can only access their own logs
create policy "pain_logs: owner access"
  on public.pain_logs for all
  using (auth.uid() = parent_id);

-- Pain zones: accessible if the parent owns the associated log
create policy "pain_zones: owner access"
  on public.pain_zones for all
  using (
    exists (
      select 1 from public.pain_logs
      where pain_logs.id = pain_zones.pain_log_id
        and pain_logs.parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- STORAGE BUCKET (child photos)
-- Run this separately if you get a "bucket already exists" error.
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('child-photos', 'child-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "child-photos: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'child-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public reads (photos have guessable URLs but are not sensitive)
create policy "child-photos: public read"
  on storage.objects for select
  using (bucket_id = 'child-photos');
