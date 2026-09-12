-- Fresh API-facing wrapper created with public route visibility from inception.
-- The delegated transaction still requires auth.uid() before accessing data.

create or replace function public.save_holiness_workspace_v3(p_payload jsonb)
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

revoke all on function public.save_holiness_workspace_v3(jsonb) from public;
revoke all on function public.save_holiness_workspace_v3(jsonb) from anon;
revoke all on function public.save_holiness_workspace_v3(jsonb) from authenticated;

notify pgrst, 'reload schema';