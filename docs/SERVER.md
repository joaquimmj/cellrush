# Server (Supabase)

Everything runs locally first. Nothing here touches a hosted project.

```bash
pnpm db:start      # builds the edge bundle, starts Postgres/Auth/REST/Edge Functions in Docker
pnpm env:local     # writes apps/web/.env.local with the local URL + anon key
pnpm dev           # the web app now has sign-in, profiles and leaderboards
pnpm test:db       # integration tests against the local stack (tampered scores, RLS, rate limits…)
pnpm db:reset      # re-apply migrations + seed.sql
pnpm db:stop
```

Magic-link emails land in the local mail catcher (URL printed by `pnpm env:local`).
GitHub/Google sign-in are wired but disabled until OAuth apps exist (`supabase/config.toml`,
secrets in `supabase/.env`, then `VITE_OAUTH_PROVIDERS=github,google`).

## How a run gets on a leaderboard

1. The browser plays the run and keeps every keydown (`{t, code, key, mods}`), nothing else.
2. On finish, a signed-in player's keystrokes are POSTed to the `submit-run` Edge Function.
3. The function replays them with **the same engine bundle the browser runs**
   (`pnpm build:edge` → `supabase/functions/_shared/cellrush.gen.js`), recomputes the score,
   and refuses malformed or impossible submissions (wrong daily seed/date, unfinished, events
   out of order or after the end…).
4. Plausibility checks flag (store, never rank) runs with inhuman key speed, machine-regular
   timing, or > 120 drills/min. Flagged runs go to `public.flags` for review.
5. The row is written with the service role. Clients have no insert/update rights on `runs`,
   cannot read keystrokes, and cannot unban themselves or approve their own school.

Limits: 6 runs/min per account, 30/min per IP; one ranked daily per account, day and platform.

## Moderation (SQL editor / service role)

```sql
select * from admin_flagged_runs where not resolved;
select admin_set_ranked('<run id>', true, 'reviewed: legit');   -- or false to keep it off the boards
update profiles set banned = true where display_name = '…';
update profiles set school_other_approved = true where id = '…';
```
