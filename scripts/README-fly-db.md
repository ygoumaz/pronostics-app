# Manually updating the production DB on Fly.io (from VS Code)

This is the **verified working method** to run one-shot DB edits against the
production SQLite database (`/data/prod.db`) on Fly.io, from a local Windows /
PowerShell + VS Code setup.

For a guided, repeatable workflow (script templates + safety checks) for the
common case of fixing a single participant's pronostic, see the
[fix-participant-pronostic skill](../.github/skills/fix-participant-pronostic/SKILL.md).

## TL;DR — the workflow that works

1. Write a **CommonJS** script (`.cjs`) using Prisma — see
   `fix-davidraj-pronostic.cjs` or the skill's
   [fix-pronostic.template.cjs](../.github/skills/fix-participant-pronostic/assets/fix-pronostic.template.cjs)
   for a copy-paste starting point.
2. Upload it directly to `/app/<name>.cjs` on the machine via a single
   non-interactive `flyctl sftp put` command (no interactive shell needed).
3. Run it with `flyctl ssh console --command "node /app/<name>.cjs"` —
   `/app` already has `node_modules` (with `@prisma/client`) available, so no
   `NODE_PATH` wrangling is required.
4. Clean up with `flyctl ssh console --command "rm -f /app/<name>.cjs"`.

See [deploy-fix-davidraj.ps1](deploy-fix-davidraj.ps1) or the skill's
[deploy-fix.template.ps1](../.github/skills/fix-participant-pronostic/assets/deploy-fix.template.ps1)
for a ready-made wrapper that does all four steps in one command.

## Why these specific steps

Things that **did NOT work** (and why):

- `flyctl ssh console -C "node /app/scripts/foo.mjs"` → the script isn't in the
  deployed image, so the file doesn't exist on the machine.
- `flyctl sftp put` to a **new subdirectory** like `/app/scripts/...` → fails
  with *"file does not exist"* (sftp won't create missing parent dirs).
  Uploading directly to the `/app` root (which already exists) works fine.
- Running an **`.mjs`** script → ESM resolves `node_modules` relative to the
  script's own location, so if it's not colocated with `/app/node_modules`,
  `@prisma/client` is **not found**. Stick to **`.cjs`** (CommonJS resolves
  `node_modules` by walking up from `/app`, so this isn't an issue there).
- `flyctl ssh console -C "cd /app && node ..."` → `flyctl -C` runs a single
  executable, not a shell. `cd` isn't an executable → *"cd: not found"*.
- `sqlite3` CLI → **not installed** on the machine (`sqlite3: not found`).

## Step-by-step

```powershell
$appName = 'pronostics-app'
$local   = 'scripts/your-script.cjs'
$remote  = '/app/your-script.cjs'

# 1. Upload (single command, no interactive shell)
flyctl sftp put $local $remote --app $appName

# 2. Run
flyctl ssh console --app $appName --command "node $remote"

# 3. Clean up
flyctl ssh console --app $appName --command "rm -f $remote"
```

> Note: `flyctl` may be named `flyctl.exe` and not aliased to `fly` on this
> machine. Use `flyctl`.

## Reusable templates

See the [fix-participant-pronostic skill](../.github/skills/fix-participant-pronostic/SKILL.md)
for copy-paste `.cjs` + `.ps1` templates, or an existing pair like
[fix-davidraj-pronostic.cjs](fix-davidraj-pronostic.cjs) /
[deploy-fix-davidraj.ps1](deploy-fix-davidraj.ps1) for a concrete example.
