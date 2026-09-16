-- Allow the "missed" status alongside "completed" for action completions,
-- enabling a three-state practice checkbox: unmarked -> completed -> missed -> unmarked.

alter table public.holiness_action_completions
  drop constraint holiness_action_completions_status_check;

alter table public.holiness_action_completions
  add constraint holiness_action_completions_status_check
  check (status in ('completed', 'missed'));
