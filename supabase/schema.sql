-- Factra AI Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists public.verification_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  input_type text not null check (input_type in ('text', 'link', 'image', 'video')),
  language text not null default 'en',
  claim text not null,
  verdict text not null,
  trust_score integer not null check (trust_score between 0 and 100),
  result jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.app_sessions
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days');

alter table public.verification_reports
  add column if not exists is_public boolean not null default false;

create index if not exists verification_reports_user_created_idx
  on public.verification_reports (user_id, created_at desc);

create index if not exists verification_reports_claim_idx
  on public.verification_reports using gin (to_tsvector('english', claim));

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.verification_reports enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.app_users from anon;
revoke all on public.app_sessions from anon;
revoke all on public.verification_reports from anon;
grant select, insert, update on public.app_users to authenticated;
grant select, insert, delete on public.app_sessions to authenticated;
grant select, insert, update, delete on public.verification_reports to authenticated;

drop policy if exists "demo anon can read users" on public.app_users;
drop policy if exists "demo anon can insert users" on public.app_users;
drop policy if exists "demo anon can read sessions" on public.app_sessions;
drop policy if exists "demo anon can insert sessions" on public.app_sessions;
drop policy if exists "demo anon can delete sessions" on public.app_sessions;
drop policy if exists "demo anon can read reports" on public.verification_reports;
drop policy if exists "demo anon can insert reports" on public.verification_reports;
drop policy if exists "users can read own profile" on public.app_users;
drop policy if exists "users can update own profile" on public.app_users;
drop policy if exists "users can read own sessions" on public.app_sessions;
drop policy if exists "users can delete own sessions" on public.app_sessions;
drop policy if exists "users can read own reports" on public.verification_reports;
drop policy if exists "users can insert own reports" on public.verification_reports;
drop policy if exists "users can delete own reports" on public.verification_reports;
drop policy if exists "public reports are readable" on public.verification_reports;

create policy "users can read own profile" on public.app_users
  for select to authenticated using (auth.uid() = id);

create policy "users can update own profile" on public.app_users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "users can read own sessions" on public.app_sessions
  for select to authenticated using (auth.uid() = user_id);

create policy "users can delete own sessions" on public.app_sessions
  for delete to authenticated using (auth.uid() = user_id);

create policy "users can read own reports" on public.verification_reports
  for select to authenticated using (auth.uid() = user_id);

create policy "users can insert own reports" on public.verification_reports
  for insert to authenticated with check (auth.uid() = user_id);

create policy "users can delete own reports" on public.verification_reports
  for delete to authenticated using (auth.uid() = user_id);

create policy "public reports are readable" on public.verification_reports
  for select to anon, authenticated using (is_public = true);
