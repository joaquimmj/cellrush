-- M6: Analyst-mode scenarios ("sc-<id>") are submitted like other runs; ranked by fastest completion.

alter table public.runs drop constraint runs_mode_check;
alter table public.runs add constraint runs_mode_check check (
  mode in ('30s', '60s', '120s', '10t', '25t', '50t', 'sc-pnl-banking', 'sc-revenue-projection', 'sc-clean-data')
);

-- Fastest completed attempt per player for one scenario.
create or replace function public.leaderboard_scenario(p_id text, p_platform text, p_limit int default 100)
returns table (rank bigint, display_name text, country text, school text, elapsed_ms int, efficiency real, played_on date)
language sql stable security definer set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.elapsed_ms, r.efficiency, r.played_on
    from public.runs r
    where r.mode = 'sc-' || p_id and r.platform = p_platform and r.ranked and r.completed = 1
    order by r.user_id, r.elapsed_ms asc, r.created_at asc
  )
  select rank() over (order by b.elapsed_ms asc), p.display_name, p.country,
         coalesce(s.name, case when p.school_other_approved then p.school_other end), b.elapsed_ms, b.efficiency, b.played_on
  from best b
  join public.profiles p on p.id = b.user_id and not p.banned
  left join public.schools s on s.id = p.school_id
  order by b.elapsed_ms asc
  limit least(p_limit, 500);
$$;
revoke execute on function public.leaderboard_scenario from public;
grant execute on function public.leaderboard_scenario to anon, authenticated;
