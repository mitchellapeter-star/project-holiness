-- Route browser saves through a regular table insert. The trigger delegates to
-- the same atomic, revision-checked transaction and discards the payload.

create table if not exists public.holiness_workspace_save_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.holiness_workspace_save_commands enable row level security;

drop policy if exists "Users can submit their own workspace saves"
  on public.holiness_workspace_save_commands;
create policy "Users can submit their own workspace saves"
  on public.holiness_workspace_save_commands
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own workspace save results"
  on public.holiness_workspace_save_commands;
create policy "Users can read their own workspace save results"
  on public.holiness_workspace_save_commands
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.process_holiness_workspace_save_command()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  new.revision := public.save_holiness_workspace(
    (new.payload ->> 'expected_revision')::bigint,
    new.payload ->> 'project_statement',
    new.payload ->> 'life_rationale',
    new.payload ->> 'problem_assessment',
    new.payload ->> 'countermeasures',
    coalesce(new.payload -> 'action_items', '[]'::jsonb),
    coalesce(new.payload -> 'completions', '[]'::jsonb),
    coalesce(new.payload -> 'disciplines', '[]'::jsonb),
    coalesce(new.payload -> 'callings', '[]'::jsonb),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(new.payload -> 'deleted_action_item_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(new.payload -> 'deleted_completion_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(new.payload -> 'deleted_discipline_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(new.payload -> 'deleted_calling_ids')), array[]::text[])
  );
  new.payload := null;
  return new;
end;
$$;

drop trigger if exists process_holiness_workspace_save_command
  on public.holiness_workspace_save_commands;
create trigger process_holiness_workspace_save_command
before insert on public.holiness_workspace_save_commands
for each row execute function public.process_holiness_workspace_save_command();

grant insert, select on public.holiness_workspace_save_commands to authenticated;
revoke all on public.holiness_workspace_save_commands from anon;

notify pgrst, 'reload schema';