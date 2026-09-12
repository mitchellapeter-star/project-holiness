-- Additive ordering support for Standard Work action items.
-- Existing action items and completion history are preserved.

alter table public.holiness_action_items
  add column if not exists sort_order integer not null default 0;

with zeroed_buckets as (
  select user_id, frequency
  from public.holiness_action_items
  group by user_id, frequency
  having bool_and(sort_order = 0)
),
ranked as (
  select
    action.id,
    row_number() over (
      partition by action.user_id, action.frequency
      order by action.created_at, action.id
    ) - 1 as position
  from public.holiness_action_items as action
  inner join zeroed_buckets as bucket
    on bucket.user_id = action.user_id
   and bucket.frequency = action.frequency
)
update public.holiness_action_items as action
set sort_order = ranked.position
from ranked
where action.id = ranked.id;

create index if not exists holiness_action_items_user_frequency_order_idx
  on public.holiness_action_items(user_id, frequency, sort_order);