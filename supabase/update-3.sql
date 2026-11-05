-- Run this ONCE in Supabase SQL Editor (after schema.sql or update-2.sql) for the new 15-question survey.
-- Adds a column for the answers and returns them to the dashboard. Existing data is kept.
alter table survey_responses add column if not exists answers jsonb;

-- Every survey submission, newest first, with whether that person clicked the CTA first.
create or replace function get_responses() returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.created_at desc), '[]'::json) from (
    select r.id, r.created_at, r.src, r.name, r.email, r.would_use, r.usage, r.annoyance,
           r.pay_how, r.worries, r.age, r.country, r.wish, r.open_to_chat, r.answers,
           exists (select 1 from cta_clicks c where c.ip_hash = r.ip_hash) as via_cta,
           exists (select 1 from survey_views v where v.ip_hash = r.ip_hash and v.page = 'landing') as saw_landing
    from survey_responses r
    order by r.created_at desc
    limit 500
  ) t;
$$;
revoke all on function get_responses() from public, anon, authenticated;
grant execute on function get_responses() to service_role;

notify pgrst, 'reload schema';
