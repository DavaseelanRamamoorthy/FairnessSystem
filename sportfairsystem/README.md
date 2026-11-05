# Moonwalkers club app (SportFairSystem v3)

One rule drives the app: **every fixture records the chances each eligible
player was owed versus given, and the planner pays back what is owed.** The
club's admin (membership, money, tournaments, kit) lives in the same place so
eligibility and history agree.

> v3 is a rebuild. The old app is tagged `v2-final`. The full plan is in the
> PR description / `docs` to come.

## How fairness is counted

| Chance | Owed to each eligible player | Given |
|---|---|---|
| Selection (XI) | `weight × min(1, 11 / on-time pool)` | `weight` if they played |
| Batting | share of the batting weight the team used (positions 1–4 = 3, 5–7 = 2, 8–11 = 1), capped at the band the player asked for | weight of the slot they batted |
| Bowling | share of the team's overs among players who bowl | overs bowled |

*Eligible* = membership paid, not on leave, answered **yes in Spond before the
deadline snapshot**. Late answers only fill gaps and earn no owed credit.
Balances reset each season (`carryOver` rule). Rules are editable per season
in `seasons.rules` (see `src/engine/rules.ts`).

## Layout

```
supabase/migrations   schema, row-level security, RPCs, views (Supabase CLI)
supabase/tests        pgTAP security tests
src/engine            pure TypeScript fairness engine + tests (eligibility, ledger, planner)
src/finance           dues, balance sheet, tournament split + tests
src/import            scorecard / Spond formats, name matching, PDF adapter
scripts               validate-scorecard, validate-spond
../.claude/skills     Claude runbooks: import-cricheroes-match, import-spond-availability
```

## Develop

```bash
npm install
npm test            # engine, finance, import unit tests
npm run db:start    # local Supabase in Docker, applies migrations
npm run db:test     # pgTAP security tests
npm run dev
```

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (printed by `npm run db:start`).

## Security model

- No table or function is reachable without signing in.
- Access helpers live in the unexposed `app_private` schema.
- Every multi-row write is one RPC (one transaction) that checks the caller's
  season role: organiser, captain/vice-captain, or a responsibility
  (treasurer, kit manager).
- Contact details sit in `member_private` (self, captains, organiser only).
- Members are never hard-deleted; merges move history and are audited.

## Matchday with Claude

Sign in to Spond / CricHeroes yourself in the Claude built-in browser, then ask
Claude to "snapshot Spond availability for Sunday" or "import Sunday's
CricHeroes match". Claude writes a JSON file under `imports/` (gitignored),
validates it, and you upload and confirm it in the app.
