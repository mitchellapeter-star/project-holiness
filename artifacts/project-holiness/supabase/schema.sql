create table if not exists public.holiness_a3 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_statement text not null default 'There is a gap between where I am and the holiness I''m called to. Holiness means being set apart for God, growing toward sainthood, and conforming my will to His, the universal call every baptized person shares.' || E'\n\n' || 'If married, this call extends to one''s marriage as well, since spouses are meant to help sanctify one another.',
  life_rationale text not null default 'Becoming holy leads to heaven, leaves a lasting effect on ourselves and those who come after us, and greatly improves our lives and the lives of those around us. Growth in holiness is growth in love, of God and neighbor, and it bears fruit far beyond ourselves.' || E'\n\n' || 'If married, this includes a holy marriage, which shapes not only the spouses but their children as well.',
  problem_assessment text not null default '',
  countermeasures text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holiness_action_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in-progress', 'done')),
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holiness_disciplines (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  completed boolean not null default false,
  last_completed date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.holiness_callings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  date_added date not null default current_date,
  next_step text not null default '',
  status text not null default 'Captured' check (status in ('Captured', 'Praying', 'Confirmed', 'Acting', 'Completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.holiness_a3 enable row level security;
alter table public.holiness_action_items enable row level security;
alter table public.holiness_disciplines enable row level security;
alter table public.holiness_callings enable row level security;

drop policy if exists "Users can read their own A3" on public.holiness_a3;
drop policy if exists "Users can insert their own A3" on public.holiness_a3;
drop policy if exists "Users can update their own A3" on public.holiness_a3;
create policy "Users can read their own A3" on public.holiness_a3 for select using (auth.uid() = user_id);
create policy "Users can insert their own A3" on public.holiness_a3 for insert with check (auth.uid() = user_id);
create policy "Users can update their own A3" on public.holiness_a3 for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their action items" on public.holiness_action_items;
create policy "Users can manage their action items" on public.holiness_action_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their disciplines" on public.holiness_disciplines;
create policy "Users can manage their disciplines" on public.holiness_disciplines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their callings" on public.holiness_callings;
create policy "Users can manage their callings" on public.holiness_callings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists holiness_action_items_user_idx on public.holiness_action_items(user_id, created_at);
create index if not exists holiness_disciplines_user_idx on public.holiness_disciplines(user_id, created_at);
create index if not exists holiness_callings_user_idx on public.holiness_callings(user_id, date_added desc);

-- Additive Project Holiness workflow migration.
-- Existing action, A3, discipline, and calling rows are preserved.

alter table public.holiness_action_items
  add column if not exists title text;

update public.holiness_action_items
set title = task
where title is null or btrim(title) = '';

alter table public.holiness_action_items
  alter column title set default '';

alter table public.holiness_action_items
  alter column title set not null;

alter table public.holiness_action_items
  add column if not exists description text not null default '',
  add column if not exists start_date date,
  add column if not exists frequency text not null default 'one-time',
  add column if not exists end_date date,
  add column if not exists active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

update public.holiness_action_items
set start_date = coalesce(start_date, due_date, current_date),
    frequency = coalesce(nullif(frequency, ''), 'one-time')
where start_date is null or frequency is null or btrim(frequency) = '';

alter table public.holiness_action_items
  alter column start_date set default current_date,
  alter column start_date set not null;

alter table public.holiness_action_items
  drop constraint if exists holiness_action_items_frequency_check;

alter table public.holiness_action_items
  add constraint holiness_action_items_frequency_check
  check (frequency in ('daily', 'weekly', 'monthly', 'one-time', 'other'));

create table if not exists public.holiness_action_completions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_item_id text not null references public.holiness_action_items(id) on delete cascade,
  completion_period date not null,
  status text not null default 'completed' check (status = 'completed'),
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, action_item_id, completion_period)
);

insert into public.holiness_action_completions
  (id, user_id, action_item_id, completion_period, status, completed_at)
select
  'legacy-' || id || '-' || coalesce(due_date, current_date)::text,
  user_id,
  id,
  coalesce(due_date, current_date),
  'completed',
  coalesce(updated_at, timezone('utc', now()))
from public.holiness_action_items
where completed = true or status = 'done'
on conflict (user_id, action_item_id, completion_period) do nothing;

alter table public.holiness_action_completions enable row level security;

drop policy if exists "Users can manage their action completions"
  on public.holiness_action_completions;

create policy "Users can manage their action completions"
  on public.holiness_action_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists holiness_action_items_user_active_idx
  on public.holiness_action_items(user_id, active, frequency);

create index if not exists holiness_action_completions_user_period_idx
  on public.holiness_action_completions(user_id, completion_period);

create index if not exists holiness_action_completions_action_idx
  on public.holiness_action_completions(action_item_id, completion_period);

-- Atomic persistence support is defined in:
-- supabase/migrations/20260912_atomic_workspace_saves.sql