-- LifeHub Supabase PostgreSQL Schema (All 11 PRD Entities + Sync State + RLS)
-- Run this in your Supabase SQL Editor to enable multi-device cloud sync between PC and Android.

create extension if not exists "pgcrypto";

-- 1. User profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Owner',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Projects
create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#0F766E',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3. Tasks (with self-referencing subtasks)
create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  parent_task_id text references public.tasks(id) on delete cascade,
  title text not null,
  notes text not null default '',
  due_at timestamptz,
  reminder_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 4. Wallets (IDR integer starting balance)
create table if not exists public.wallets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'e-wallet')),
  starting_balance bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 5. Categories
create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  icon text not null default 'tag',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 6. Transactions (integer IDR rupiah)
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id text not null references public.wallets(id),
  destination_wallet_id text references public.wallets(id),
  category_id text references public.categories(id),
  amount bigint not null check (amount >= 0),
  type text not null check (type in ('expense', 'income', 'transfer')),
  date date not null,
  note text not null default '',
  merchant text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 7. Monthly Budgets (integer IDR rupiah)
create table if not exists public.budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null references public.categories(id),
  month text not null, -- YYYY-MM
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, category_id, month)
);

-- 8. Notes & Daily Journal
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('note', 'journal')),
  title text not null default '',
  body text not null default '',
  journal_date date,
  mood smallint check (mood is null or (mood >= 1 and mood <= 5)),
  mood_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists idx_notes_unique_journal_day
  on public.notes(user_id, journal_date)
  where type = 'journal' and deleted_at is null;

-- 9. Tags
create table if not exists public.tags (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 10. Tag Assignments
create table if not exists public.tag_assignments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id text not null references public.tags(id) on delete cascade,
  item_type text not null check (item_type in ('task', 'transaction', 'note')),
  item_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 11. Cross-module Links
create table if not exists public.links (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_type text not null check (from_type in ('task', 'transaction', 'note')),
  from_id text not null,
  to_type text not null check (to_type in ('task', 'transaction', 'note')),
  to_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Fast Snapshot Sync table (used by LifeHub instant cloud sync for atomic LWW merges)
create table if not exists public.lifehub_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row-Level Security on every table
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.notes enable row level security;
alter table public.tags enable row level security;
alter table public.tag_assignments enable row level security;
alter table public.links enable row level security;
alter table public.lifehub_snapshots enable row level security;

-- Owner-only policies
create policy "owner_profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "owner_projects" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_wallets" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_tags" on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_tag_assignments" on public.tag_assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_links" on public.links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_snapshots" on public.lifehub_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime sync publication
alter publication supabase_realtime add table public.lifehub_snapshots;
