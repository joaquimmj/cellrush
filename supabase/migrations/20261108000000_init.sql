-- cellrush: profiles, server-validated runs, leaderboards.
-- Rule of thumb: clients can read public leaderboard data and edit their own profile.
-- Runs are written ONLY by the submit-run Edge Function (service role) after a server replay.

-- ───────────────────────────── schools ─────────────────────────────
create table public.schools (
  id serial primary key,
  name text not null unique check (char_length(name) between 2 and 80),
  country text check (country ~ '^[A-Z]{2}$')
);

-- ───────────────────────────── profanity filter ─────────────────────────────
-- Deliberately small and boring; extend via PR. Matches whole words, case-insensitive.
create or replace function public.is_clean_name(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from unnest(array[
      'fuck', 'shit', 'cunt', 'bitch', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut',
      'putain', 'merde', 'connard', 'connasse', 'salope', 'enculé', 'encule', 'pute', 'nazi', 'hitler'
    ]) as w
    where lower(name) ~ ('(^|[^a-zà-ÿ])' || w || '($|[^a-zà-ÿ])')
  );
$$;

-- ───────────────────────────── profiles ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 2 and 24)
    check (display_name ~ '^[[:alnum:] ._''-]+$')
    check (public.is_clean_name(display_name)),
  country text check (country ~ '^[A-Z]{2}$'),
  school_id int references public.schools (id),
  -- "Other" school typed by the user: shown only after an admin approves it.
  school_other text check (char_length(school_other) <= 80),
  school_other_approved boolean not null default false,
  platform text check (platform in ('win', 'mac')),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_display_name_key on public.profiles (lower(display_name));

-- Users may not approve their own "other" school or unban themselves.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.banned := coalesce(old.banned, false);
    if tg_op = 'INSERT' or new.school_other is distinct from old.school_other then
      new.school_other_approved := false;
    else
      new.school_other_approved := old.school_other_approved;
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ───────────────────────────── runs ─────────────────────────────
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('30s', '60s', '120s', '10t', '25t', '50t')),
  platform text not null check (platform in ('win', 'mac')),
  layout text not null,
  seed bigint not null,
  played_on date not null,
  daily_number int check (daily_number > 0),
  -- Everything below is computed by the server replay, never taken from the client.
  score int not null check (score >= 0),
  tpm real not null,
  efficiency real not null check (efficiency between 0 and 1),
  completed int not null,
  elapsed_ms int not null,
  squares text not null check (squares ~ '^[gyx]*$'),
  flags text[] not null default '{}',
  ranked boolean not null,
  -- Keystrokes kept for audits / re-replays after an engine fix.
  events jsonb not null
);
-- Only the first daily attempt counts: one row per user, daily and platform.
create unique index runs_one_daily on public.runs (user_id, daily_number, platform) where daily_number is not null;
create index runs_leaderboard on public.runs (mode, platform, ranked, score desc);
create index runs_user_recent on public.runs (user_id, created_at desc);

-- Moderation queue: every flagged run lands here; admins resolve it.
create table public.flags (
  id bigserial primary key,
  run_id uuid not null references public.runs (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  note text
);

-- Per-IP submission log for rate limiting (IP stored hashed).
create table public.submit_log (
  id bigserial primary key,
  ip_hash text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index submit_log_ip on public.submit_log (ip_hash, created_at desc);

-- ───────────────────────────── row level security ─────────────────────────────
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.flags enable row level security;
alter table public.submit_log enable row level security;

create policy "schools are public" on public.schools for select to anon, authenticated using (true);

create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "edit own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "read own runs" on public.runs for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update/delete policies on runs, flags, submit_log: only the service role writes them.

-- Explicit grants (auto-exposure is off in config.toml).
grant usage on schema public to anon, authenticated;
grant select on public.schools to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (id, display_name, country, school_id, school_other, platform) on public.profiles to authenticated;
grant update (display_name, country, school_id, school_other, platform) on public.profiles to authenticated;
grant select (id, created_at, mode, platform, layout, played_on, daily_number, score, tpm, efficiency, completed, elapsed_ms, squares, flags, ranked)
  on public.runs to authenticated;
grant all on public.runs, public.flags, public.submit_log to service_role;
grant usage on all sequences in schema public to service_role;
grant all on public.schools, public.profiles to service_role;

-- ───────────────────────────── leaderboards ─────────────────────────────
-- Security-definer functions return only public columns of ranked runs (never keystrokes)
-- and hide banned players and unapproved "other" schools.

create or replace function public.leaderboard_daily(p_daily int, p_platform text, p_limit int default 100)
returns table (rank bigint, display_name text, country text, school text, score int, efficiency real, elapsed_ms int, squares text)
language sql stable security definer set search_path = ''
as $$
  select rank() over (order by r.score desc, r.elapsed_ms asc), p.display_name, p.country,
         coalesce(s.name, case when p.school_other_approved then p.school_other end), r.score, r.efficiency, r.elapsed_ms, r.squares
  from public.runs r
  join public.profiles p on p.id = r.user_id and not p.banned
  left join public.schools s on s.id = p.school_id
  where r.daily_number = p_daily and r.platform = p_platform and r.ranked
  order by r.score desc, r.elapsed_ms asc
  limit least(p_limit, 500);
$$;

create or replace function public.leaderboard_mode(p_mode text, p_platform text, p_limit int default 100)
returns table (rank bigint, display_name text, country text, school text, score int, efficiency real, played_on date)
language sql stable security definer set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.efficiency, r.played_on
    from public.runs r
    where r.mode = p_mode and r.platform = p_platform and r.ranked and r.daily_number is null
    order by r.user_id, r.score desc, r.created_at asc
  )
  select rank() over (order by b.score desc), p.display_name, p.country,
         coalesce(s.name, case when p.school_other_approved then p.school_other end), b.score, b.efficiency, b.played_on
  from best b
  join public.profiles p on p.id = b.user_id and not p.banned
  left join public.schools s on s.id = p.school_id
  order by b.score desc
  limit least(p_limit, 500);
$$;

-- Schools / countries: average of each member's best score in a mode; at least 3 players to appear.
create or replace function public.leaderboard_groups(p_group text, p_mode text, p_platform text, p_limit int default 50)
returns table (rank bigint, name text, players bigint, avg_score int, best_score int)
language sql stable security definer set search_path = ''
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score
    from public.runs r
    where r.mode = p_mode and r.platform = p_platform and r.ranked and r.daily_number is null
    order by r.user_id, r.score desc
  ), labelled as (
    select case when p_group = 'school' then coalesce(s.name, case when p.school_other_approved then p.school_other end)
                else p.country end as name,
           b.score
    from best b
    join public.profiles p on p.id = b.user_id and not p.banned
    left join public.schools s on s.id = p.school_id
  )
  select rank() over (order by avg(score) desc), name, count(*), round(avg(score))::int, max(score)
  from labelled
  where name is not null and p_group in ('school', 'country')
  group by name
  having count(*) >= 3
  order by avg(score) desc
  limit least(p_limit, 200);
$$;

revoke execute on function public.leaderboard_daily, public.leaderboard_mode, public.leaderboard_groups from public;
grant execute on function public.leaderboard_daily, public.leaderboard_mode, public.leaderboard_groups to anon, authenticated;

-- ───────────────────────────── admin (service role / SQL editor only) ─────────────────────────────
create view public.admin_flagged_runs with (security_invoker = true) as
  select f.id as flag_id, f.reason, f.resolved, f.note, r.id as run_id, r.created_at, p.display_name, r.mode, r.platform,
         r.score, r.tpm, r.efficiency, r.completed, r.flags, r.ranked
  from public.flags f
  join public.runs r on r.id = f.run_id
  left join public.profiles p on p.id = r.user_id
  order by f.created_at desc;
revoke all on public.admin_flagged_runs from anon, authenticated;
grant select on public.admin_flagged_runs to service_role;

-- Flag / unflag a run: admin_set_ranked('<run id>', true, 'reviewed: legit fast player').
create or replace function public.admin_set_ranked(p_run uuid, p_ranked boolean, p_note text)
returns void
language sql security definer set search_path = ''
as $$
  update public.runs set ranked = p_ranked where id = p_run;
  update public.flags set resolved = true, note = p_note where run_id = p_run;
$$;
revoke execute on function public.admin_set_ranked from public, anon, authenticated;
grant execute on function public.admin_set_ranked to service_role;
