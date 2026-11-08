# Security

Please do **not** open a public issue for a vulnerability.

Report it privately: **[open a security advisory](https://github.com/joaquimmj/cellrush/security/advisories/new)**.
You'll get an answer within a few days.

Especially welcome:

- ways to get a score onto a leaderboard that the server replay should have rejected
  (the replay lives in `packages/drills/src/validate.ts`);
- bypasses of Row Level Security (`supabase/migrations/`);
- anything that exposes another player's email or keystrokes.

Scores are never trusted from the browser: the server replays every keystroke with the same
engine. If you find a way around that, it's a bug, not a feature. Thanks for telling us.
