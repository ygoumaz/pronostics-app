---
name: fix-participant-pronostic
description: 'Use when a participant''s pronostic (score prediction) in pronostics-app needs to be corrected, backfilled, or inserted directly in the production database on Fly.io. Triggers: "fix pronostic", "update <name>''s prediction/score", "backfill missing pronostic", "correct match result prediction", "deploy fix script", "run a fix on production/Fly.io DB". Produces a one-off Prisma .cjs fix script plus a PowerShell deploy wrapper that uploads and runs it against the live Fly.io machine.'
---

# Fix Participant Pronostic

Creates and runs a one-off script that corrects or inserts a single participant's
pronostic (home/away goals prediction) for a specific match number, directly
against the production SQLite DB on the `pronostics-app` Fly.io machine.

## When to Use
- A participant's prediction for a given match is wrong and needs correcting.
- A participant is missing a pronostic for a match and it needs to be inserted.
- Any one-off "update production DB row" request scoped to the `Pronostic` model.

Do NOT use this for bulk/multi-match backfills across many participants (see
`scripts/fix-tomgoat-pronostics.cjs` or `scripts/fix-serge-pronostics.cjs` for
that pattern instead) — this skill is for a single participant + single match.

## Prerequisites / Facts to Gather
1. **Participant** — a name/email fragment to match via `contains` (case may
   vary in DB, so query both `displayName` and `email` with a couple of
   casings).
2. **Match number** — look up in [data/matches.json](../../../data/matches.json).
   Note that KNOCKOUT stage matches only have placeholders (e.g. "1er Groupe H")
   in this file — the actual `homeTeamCode`/`awayTeamCode` are resolved in the
   DB once group standings are known, not in this static file.
3. **Expected team codes** — cross-check team names against
   [data/teams.json](../../../data/teams.json) to get 3-letter codes (e.g.
   Spain → `ESP`, Cape Verde → `CPV`). These are used as a safety assertion,
   not guessed blindly.
4. **Desired score** — home goals / away goals to set.

## Procedure
1. Copy [assets/fix-pronostic.template.cjs](./assets/fix-pronostic.template.cjs)
   to `scripts/fix-<participant>-match<N>.cjs` and fill in:
   - `PARTICIPANT_QUERY` contains-fragments (displayName + email)
   - `MATCH_NUMBER`
   - `EXPECTED_HOME_CODE` / `EXPECTED_AWAY_CODE`
   - `HOME_GOALS` / `AWAY_GOALS`
2. Copy [assets/deploy-fix.template.ps1](./assets/deploy-fix.template.ps1) to
   `scripts/deploy-fix-<participant>-match<N>.ps1` and update the two
   `fix-...cjs` filename references to match step 1's filename.
3. Run the deploy script from the repo root. If PowerShell blocks script
   execution, scope the bypass to the current process only (don't change the
   system-wide policy):
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   .\scripts\deploy-fix-<participant>-match<N>.ps1
   ```
4. Verify the console output shows, in order: participant found (with id),
   match found with the **expected** team codes, then either "Updated
   pronostic" or "created new one" with the correct score, then cleanup.
5. Leave the `.cjs`/`.ps1` files committed in `scripts/` as an audit trail
   (this repo's convention — see existing `fix-*-pronostic*.cjs` /
   `deploy-fix-*.ps1` pairs). Do not delete them after running.

## Safety Notes
- The template **aborts** if the DB's actual `homeTeamCode`/`awayTeamCode`
  don't match the `EXPECTED_*` values you set — this prevents writing a score
  to the wrong fixture if group standings shifted. Never remove this check.
- The template resets `points: null` on write so the score gets re-evaluated
  by the app's scoring logic rather than keeping a stale points value.
- This modifies the **live production database** directly — treat it as a
  destructive/hard-to-reverse action and confirm the participant/match/score
  with the user before running.
- Full background on the Fly.io upload/run mechanics (why `.cjs` not `.mjs`,
  `flyctl` binary name, etc.) is in
  [scripts/README-fly-db.md](../../../scripts/README-fly-db.md) and repo
  memory (`/memories/repo/fly-db-updates.md`). Note: in practice, uploading
  directly to `/app/<script>.cjs` via `flyctl sftp put` and running with
  `flyctl ssh console --command "node /app/<script>.cjs"` (as the templates
  here do) has worked reliably, which is simpler than the `/tmp` + `NODE_PATH`
  shell wrapping the README describes.
