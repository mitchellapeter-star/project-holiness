-- Atomic, conflict-safe workspace persistence.
-- Existing workspace rows and completion history are preserved.

alter table public.holiness_a3
  add column if not exists revision bigint not null default 0;

create or replace function public.save_holiness_workspace(
  p_expected_revision bigint,
  p_project_statement text,
  p_life_rationale text,
  p_problem_assessment text,
  p_countermeasures text,
  p_action_items jsonb,
  p_completions jsonb,
  p_disciplines jsonb,
  p_callings jsonb,
  p_deleted_action_item_ids text[],
  p_deleted_completion_ids text[],
  p_deleted_discipline_ids text[],
  p_deleted_calling_ids text[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_now timestamptz := timezone('utc', now());
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  insert into public.holiness_a3 (
    user_id,
    project_statement,
    life_rationale,
    problem_assessment,
    countermeasures,
    revision,
    updated_at
  )
  values (
    v_user_id,
    p_project_statement,
    p_life_rationale,
    p_problem_assessment,
    p_countermeasures,
    0,
    v_now
  )
  on conflict (user_id) do nothing;

  select revision
  into v_revision
  from public.holiness_a3
  where user_id = v_user_id
  for update;

  if v_revision is distinct from p_expected_revision then
    raise exception 'workspace_conflict'
      using errcode = 'PT409',
            detail = 'This workspace was changed by another session. Reload before saving again.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_action_items, '[]'::jsonb)) as incoming(id text)
    inner join public.holiness_action_items as existing on existing.id = incoming.id
    where existing.user_id <> v_user_id
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_completions, '[]'::jsonb)) as incoming(id text)
    inner join public.holiness_action_completions as existing on existing.id = incoming.id
    where existing.user_id <> v_user_id
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_disciplines, '[]'::jsonb)) as incoming(id text)
    inner join public.holiness_disciplines as existing on existing.id = incoming.id
    where existing.user_id <> v_user_id
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_callings, '[]'::jsonb)) as incoming(id text)
    inner join public.holiness_callings as existing on existing.id = incoming.id
    where existing.user_id <> v_user_id
  ) then
    raise exception 'workspace_identifier_conflict'
      using errcode = '23505',
            detail = 'A workspace row identifier belongs to another user.';
  end if;

  delete from public.holiness_action_completions
  where user_id = v_user_id
    and id = any(coalesce(p_deleted_completion_ids, array[]::text[]));

  delete from public.holiness_action_items
  where user_id = v_user_id
    and id = any(coalesce(p_deleted_action_item_ids, array[]::text[]));

  delete from public.holiness_disciplines
  where user_id = v_user_id
    and id = any(coalesce(p_deleted_discipline_ids, array[]::text[]));

  delete from public.holiness_callings
  where user_id = v_user_id
    and id = any(coalesce(p_deleted_calling_ids, array[]::text[]));

  insert into public.holiness_action_items (
    id, user_id, title, task, description, start_date, frequency,
    due_date, end_date, status, active, sort_order, completed, updated_at
  )
  select
    item.id, v_user_id, item.title, item.task, item.description, item.start_date,
    item.frequency, item.due_date, item.end_date, item.status, item.active,
    item.sort_order, item.completed, v_now
  from jsonb_to_recordset(coalesce(p_action_items, '[]'::jsonb)) as item(
    id text,
    title text,
    task text,
    description text,
    start_date date,
    frequency text,
    due_date date,
    end_date date,
    status text,
    active boolean,
    sort_order integer,
    completed boolean
  )
  on conflict (id) do update set
    title = excluded.title,
    task = excluded.task,
    description = excluded.description,
    start_date = excluded.start_date,
    frequency = excluded.frequency,
    due_date = excluded.due_date,
    end_date = excluded.end_date,
    status = excluded.status,
    active = excluded.active,
    sort_order = excluded.sort_order,
    completed = excluded.completed,
    updated_at = excluded.updated_at
  where public.holiness_action_items.user_id = v_user_id;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_completions, '[]'::jsonb)) as incoming(action_item_id text)
    left join public.holiness_action_items as action
      on action.id = incoming.action_item_id
     and action.user_id = v_user_id
    where action.id is null
  ) then
    raise exception 'workspace_completion_parent_mismatch'
      using errcode = '23503',
            detail = 'A completion does not belong to one of the current user''s actions.';
  end if;

  insert into public.holiness_action_completions (
    id, user_id, action_item_id, completion_period, status, completed_at
  )
  select
    completion.id, v_user_id, completion.action_item_id,
    completion.completion_period, completion.status, completion.completed_at
  from jsonb_to_recordset(coalesce(p_completions, '[]'::jsonb)) as completion(
    id text,
    action_item_id text,
    completion_period date,
    status text,
    completed_at timestamptz
  )
  on conflict (id) do update set
    action_item_id = excluded.action_item_id,
    completion_period = excluded.completion_period,
    status = excluded.status,
    completed_at = excluded.completed_at
  where public.holiness_action_completions.user_id = v_user_id;

  insert into public.holiness_disciplines (
    id, user_id, name, cadence, completed, last_completed, updated_at
  )
  select
    discipline.id, v_user_id, discipline.name, discipline.cadence,
    discipline.completed, discipline.last_completed, v_now
  from jsonb_to_recordset(coalesce(p_disciplines, '[]'::jsonb)) as discipline(
    id text,
    name text,
    cadence text,
    completed boolean,
    last_completed date
  )
  on conflict (id) do update set
    name = excluded.name,
    cadence = excluded.cadence,
    completed = excluded.completed,
    last_completed = excluded.last_completed,
    updated_at = excluded.updated_at
  where public.holiness_disciplines.user_id = v_user_id;

  insert into public.holiness_callings (
    id, user_id, title, description, date_added, next_step, status, updated_at
  )
  select
    calling.id, v_user_id, calling.title, calling.description,
    calling.date_added, calling.next_step, calling.status, v_now
  from jsonb_to_recordset(coalesce(p_callings, '[]'::jsonb)) as calling(
    id text,
    title text,
    description text,
    date_added date,
    next_step text,
    status text
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    date_added = excluded.date_added,
    next_step = excluded.next_step,
    status = excluded.status,
    updated_at = excluded.updated_at
  where public.holiness_callings.user_id = v_user_id;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_action_items, '[]'::jsonb)) as incoming(id text)
    left join public.holiness_action_items as saved
      on saved.id = incoming.id
     and saved.user_id = v_user_id
    where saved.id is null
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_completions, '[]'::jsonb)) as incoming(id text)
    left join public.holiness_action_completions as saved
      on saved.id = incoming.id
     and saved.user_id = v_user_id
    where saved.id is null
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_disciplines, '[]'::jsonb)) as incoming(id text)
    left join public.holiness_disciplines as saved
      on saved.id = incoming.id
     and saved.user_id = v_user_id
    where saved.id is null
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(coalesce(p_callings, '[]'::jsonb)) as incoming(id text)
    left join public.holiness_callings as saved
      on saved.id = incoming.id
     and saved.user_id = v_user_id
    where saved.id is null
  ) then
    raise exception 'workspace_identifier_conflict'
      using errcode = '23505',
            detail = 'A workspace row identifier could not be saved for the current user.';
  end if;

  update public.holiness_a3
  set project_statement = p_project_statement,
      life_rationale = p_life_rationale,
      problem_assessment = p_problem_assessment,
      countermeasures = p_countermeasures,
      revision = v_revision + 1,
      updated_at = v_now
  where user_id = v_user_id;

  return v_revision + 1;
end;
$$;

revoke all on function public.save_holiness_workspace(
  bigint, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text[], text[], text[], text[]
) from public;
revoke all on function public.save_holiness_workspace(
  bigint, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text[], text[], text[], text[]
) from anon;

grant execute on function public.save_holiness_workspace(
  bigint, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text[], text[], text[], text[]
) to authenticated;

create or replace function public.save_holiness_workspace_v2(p_payload jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select public.save_holiness_workspace(
    (p_payload ->> 'expected_revision')::bigint,
    p_payload ->> 'project_statement',
    p_payload ->> 'life_rationale',
    p_payload ->> 'problem_assessment',
    p_payload ->> 'countermeasures',
    coalesce(p_payload -> 'action_items', '[]'::jsonb),
    coalesce(p_payload -> 'completions', '[]'::jsonb),
    coalesce(p_payload -> 'disciplines', '[]'::jsonb),
    coalesce(p_payload -> 'callings', '[]'::jsonb),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(p_payload -> 'deleted_action_item_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(p_payload -> 'deleted_completion_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(p_payload -> 'deleted_discipline_ids')), array[]::text[]),
    coalesce(array(select pg_catalog.jsonb_array_elements_text(p_payload -> 'deleted_calling_ids')), array[]::text[])
  );
$$;

revoke all on function public.save_holiness_workspace_v2(jsonb) from public;
revoke all on function public.save_holiness_workspace_v2(jsonb) from anon;
revoke all on function public.save_holiness_workspace_v2(jsonb) from authenticated;

create or replace function public.load_holiness_workspace()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'revision',
      coalesce((
        select a3.revision
        from public.holiness_a3 as a3
        where a3.user_id = auth.uid()
      ), 0::bigint),
    'a3', (
      select pg_catalog.jsonb_build_object(
        'project_statement', a3.project_statement,
        'life_rationale', a3.life_rationale,
        'problem_assessment', a3.problem_assessment,
        'countermeasures', a3.countermeasures
      )
      from public.holiness_a3 as a3
      where a3.user_id = auth.uid()
    ),
    'action_items',
      coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(action_row) order by action_row.sort_order, action_row.created_at)
        from (
          select id, title, task, description, start_date, frequency, due_date,
                 end_date, status, active, sort_order, created_at
          from public.holiness_action_items
          where user_id = auth.uid()
        ) as action_row
      ), '[]'::jsonb),
    'completions',
      coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(completion_row) order by completion_row.completion_period desc)
        from (
          select id, action_item_id, completion_period, status, completed_at
          from public.holiness_action_completions
          where user_id = auth.uid()
        ) as completion_row
      ), '[]'::jsonb),
    'disciplines',
      coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(discipline_row) order by discipline_row.created_at)
        from (
          select id, name, cadence, completed, last_completed, created_at
          from public.holiness_disciplines
          where user_id = auth.uid()
        ) as discipline_row
      ), '[]'::jsonb),
    'callings',
      coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(calling_row) order by calling_row.date_added desc)
        from (
          select id, title, description, date_added, next_step, status
          from public.holiness_callings
          where user_id = auth.uid()
        ) as calling_row
      ), '[]'::jsonb)
  );
$$;

revoke all on function public.load_holiness_workspace() from public;
revoke all on function public.load_holiness_workspace() from anon;
grant execute on function public.load_holiness_workspace() to authenticated;