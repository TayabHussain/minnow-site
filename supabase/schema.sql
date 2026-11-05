-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists cta_clicks (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  src text not null default 'direct',
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists cta_clicks_ip_hash_idx on cta_clicks (ip_hash);

create table if not exists survey_responses (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  src text not null default 'direct',
  name text,
  email text,
  would_use text,
  usage text[],
  annoyance smallint,
  pay_how text,
  worries text[],
  age text,
  country text,
  wish text,
  open_to_chat boolean,
  answers jsonb,                         -- the 15 survey answers, keyed q1..q15
  created_at timestamptz not null default now()
);
create index if not exists survey_responses_ip_hash_idx on survey_responses (ip_hash);

-- Lock the tables: with RLS on and no policies, the public (anon) key can read and write nothing.
-- Only your server functions can, using the secret/service_role key.
alter table cta_clicks enable row level security;
alter table survey_responses enable row level security;

-- Page visits (main page and survey page).
create table if not exists survey_views (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  src text not null default 'direct',
  page text not null default 'survey',   -- 'survey' = survey page visit, 'landing' = main page visit
  created_at timestamptz not null default now()
);
create index if not exists survey_views_ip_hash_idx on survey_views (ip_hash);
alter table survey_views enable row level security;

-- Dashboard numbers: funnel, click-through rate, per-source and per-day figures.
-- Every visitor is counted once (by hashed IP), however often they click or reload.
create or replace function get_stats() returns json
language sql security definer set search_path = public as $$
  with
  lv as (select distinct on (ip_hash) ip_hash, src from survey_views where page = 'landing' order by ip_hash, created_at),
  sv as (select distinct on (ip_hash) ip_hash, src from survey_views where page = 'survey'  order by ip_hash, created_at),
  fc as (select distinct on (ip_hash) ip_hash, src from cta_clicks order by ip_hash, created_at),
  r  as (select distinct on (ip_hash) ip_hash, src from survey_responses order by ip_hash, created_at),
  srcs as (select src from lv union select src from sv union select src from fc union select src from r),
  by_src as (
    select s.src,
      (select count(*) from lv where lv.src = s.src) as landing,
      (select count(*) from lv where lv.src = s.src and lv.ip_hash in (select ip_hash from fc)) as clicked,
      (select count(*) from fc where fc.src = s.src) as clickers,
      (select count(*) from sv where sv.src = s.src) as survey_visits,
      (select count(*) from r  where r.src  = s.src) as completed
    from srcs s
  ),
  days as (select (current_date - n)::date as d from generate_series(0, 29) as n),
  daily as (
    select d.d as day,
      (select count(distinct v.ip_hash) from survey_views v where v.page = 'landing' and v.created_at::date = d.d) as landing,
      (select count(distinct c.ip_hash) from cta_clicks c where c.created_at::date = d.d) as clickers,
      (select count(*) from survey_responses x where x.created_at::date = d.d) as submissions
    from days d
  )
  select json_build_object(
    'landing_visitors',       (select count(*) from lv),
    'landing_clicked',        (select count(*) from lv where ip_hash in (select ip_hash from fc)),
    'total_clicks',           (select count(*) from cta_clicks),
    'unique_clickers',        (select count(*) from fc),
    'unique_survey_visitors', (select count(*) from sv),
    'reached_survey',         (select count(*) from fc join sv using (ip_hash)),
    'total_surveys',          (select count(*) from survey_responses),
    'unique_respondents',     (select count(*) from r),
    'converted',              (select count(*) from fc join r using (ip_hash)),
    'by_source', coalesce((select json_agg(json_build_object(
        'src', src, 'landing', landing, 'clicked', clicked, 'clickers', clickers,
        'survey_visits', survey_visits, 'completed', completed)
        order by clickers desc, landing desc) from by_src), '[]'::json),
    'daily', coalesce((select json_agg(json_build_object(
        'day', day, 'landing', landing, 'clickers', clickers, 'submissions', submissions)
        order by day) from daily), '[]'::json)
  );
$$;
revoke all on function get_stats() from public, anon, authenticated;
grant execute on function get_stats() to service_role;

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
