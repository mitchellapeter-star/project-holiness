-- Prevent stale browser builds from issuing direct destructive requests.
-- Explicit deletions remain available through save_holiness_workspace.

alter function public.save_holiness_workspace(
  bigint, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text[], text[], text[], text[]
) security definer;

alter function public.save_holiness_workspace(
  bigint, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text[], text[], text[], text[]
) set search_path = '';

drop policy if exists "Users can insert their own A3"
  on public.holiness_a3;
drop policy if exists "Users can update their own A3"
  on public.holiness_a3;

drop policy if exists "Users can manage their action items"
  on public.holiness_action_items;
drop policy if exists "Users can read their action items"
  on public.holiness_action_items;
drop policy if exists "Users can insert their action items"
  on public.holiness_action_items;
drop policy if exists "Users can update their action items"
  on public.holiness_action_items;

create policy "Users can read their action items"
  on public.holiness_action_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their action completions"
  on public.holiness_action_completions;
drop policy if exists "Users can read their action completions"
  on public.holiness_action_completions;
drop policy if exists "Users can insert their action completions"
  on public.holiness_action_completions;
drop policy if exists "Users can update their action completions"
  on public.holiness_action_completions;

create policy "Users can read their action completions"
  on public.holiness_action_completions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their disciplines"
  on public.holiness_disciplines;
drop policy if exists "Users can read their disciplines"
  on public.holiness_disciplines;
drop policy if exists "Users can insert their disciplines"
  on public.holiness_disciplines;
drop policy if exists "Users can update their disciplines"
  on public.holiness_disciplines;

create policy "Users can read their disciplines"
  on public.holiness_disciplines for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their callings"
  on public.holiness_callings;
drop policy if exists "Users can read their callings"
  on public.holiness_callings;
drop policy if exists "Users can insert their callings"
  on public.holiness_callings;
drop policy if exists "Users can update their callings"
  on public.holiness_callings;

create policy "Users can read their callings"
  on public.holiness_callings for select
  using (auth.uid() = user_id);