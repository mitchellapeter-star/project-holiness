-- Allow a "canceled" status alongside "completed" and "missed" for action completions.
-- Canceled occurrences don't count for or against the person: they're excluded from
-- both the planned and actual completion totals.

alter table public.holiness_action_completions
  drop constraint holiness_action_completions_status_check;

alter table public.holiness_action_completions
  add constraint holiness_action_completions_status_check
  check (status in ('completed', 'missed', 'canceled'));
