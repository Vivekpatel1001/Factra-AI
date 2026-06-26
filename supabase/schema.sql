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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

create index if not exists verification_reports_user_created_idx
  on public.verification_reports (user_id, created_at desc);

create index if not exists verification_reports_claim_idx
  on public.verification_reports using gin (to_tsvector('english', claim));

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.verification_reports enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_users to anon, authenticated;
grant select, insert, update, delete on public.app_sessions to anon, authenticated;
grant select, insert, update, delete on public.verification_reports to anon, authenticated;

-- Recommended production setup:
-- Add SUPABASE_SERVICE_ROLE_KEY to backend .env.local and do NOT create broad anon policies.
-- Service role bypasses RLS and keeps these custom auth tables backend-only.

-- Demo/local setup when you only have the anon key:
-- These policies allow the backend to use Supabase REST with the anon key.
-- They are convenient for a demo but not secure for a public production deployment.

drop policy if exists "demo anon can read users" on public.app_users;
drop policy if exists "demo anon can insert users" on public.app_users;
drop policy if exists "demo anon can read sessions" on public.app_sessions;
drop policy if exists "demo anon can insert sessions" on public.app_sessions;
drop policy if exists "demo anon can delete sessions" on public.app_sessions;
drop policy if exists "demo anon can read reports" on public.verification_reports;
drop policy if exists "demo anon can insert reports" on public.verification_reports;

create policy "demo anon can read users" on public.app_users
  for select to anon using (true);

create policy "demo anon can insert users" on public.app_users
  for insert to anon with check (true);

create policy "demo anon can read sessions" on public.app_sessions
  for select to anon using (true);

create policy "demo anon can insert sessions" on public.app_sessions
  for insert to anon with check (true);

create policy "demo anon can delete sessions" on public.app_sessions
  for delete to anon using (true);

create policy "demo anon can read reports" on public.verification_reports
  for select to anon using (true);

create policy "demo anon can insert reports" on public.verification_reports
  for insert to anon with check (true);
