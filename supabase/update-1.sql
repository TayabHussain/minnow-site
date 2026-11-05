-- Run this ONCE in Supabase SQL Editor if you already ran schema.sql earlier.
create table if not exists survey_views (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  src text not null default 'direct',
  created_at timestamptz not null default now()
);
create index if not exists survey_views_ip_hash_idx on survey_views (ip_hash);
alter table survey_views enable row level security;

create or replace function get_stats() returns json
language sql security definer set search_path = public as $$
  with fc as (
    select distinct on (ip_hash) ip_hash, src from cta_clicks order by ip_hash, created_at
  ),
  v as (select distinct ip_hash from survey_views),
  r as (select distinct ip_hash from survey_responses),
  by_src as (
    select fc.src,
           count(*) as unique_clickers,
           count(v.ip_hash) as reached_survey,
           count(r.ip_hash) as completed
    from fc
    left join v on v.ip_hash = fc.ip_hash
    left join r on r.ip_hash = fc.ip_hash
    group by fc.src
  )
  select json_build_object(
    'total_clicks',           (select count(*) from cta_clicks),
    'unique_clickers',        (select count(*) from fc),
    'unique_survey_visitors', (select count(*) from v),
    'reached_survey',         (select count(*) from fc join v using (ip_hash)),
    'total_surveys',          (select count(*) from survey_responses),
    'unique_respondents',     (select count(*) from r),
    'converted',              (select count(*) from fc join r using (ip_hash)),
    'by_source', coalesce(
      (select json_agg(json_build_object('src', src, 'unique_clickers', unique_clickers,
                                         'reached_survey', reached_survey, 'completed', completed)
                       order by unique_clickers desc) from by_src),
      '[]'::json)
  );
$$;
revoke all on function get_stats() from public, anon, authenticated;
grant execute on function get_stats() to service_role;
notify pgrst, 'reload schema';
