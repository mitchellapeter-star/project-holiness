-- Additive Project Holiness workflow migration.
-- This preserves the existing A3, action-item, discipline, and calling rows.

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
  add column if not exists active boolean not null default true;

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

-- Preserve legacy completed action items as completion history without deleting
-- or rewriting the original completed/status columns.
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