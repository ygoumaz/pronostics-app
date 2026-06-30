# Manually updating the production DB on Fly.io (from VS Code)

This is the **verified working method** to run one-shot DB edits against the
production SQLite database (`/data/prod.db`) on Fly.io, from a local Windows /
PowerShell + VS Code setup.

## TL;DR — the workflow that works

1. Write a **CommonJS** script (`.cjs`) using Prisma (see template below).
2. Upload it to `/tmp` on the machine via `flyctl sftp`.
3. Run it with `NODE_PATH=/app/node_modules` wrapped in `/bin/sh -c '...'`.

## Why these specific steps

Things that **did NOT work** (and why):

- `flyctl ssh console -C "node /app/scripts/foo.mjs"` → the script isn't in the
  deployed image, so the file doesn't exist on the machine.
- `flyctl sftp` `put` to `/app/scripts/...` → fails with *"file does not exist"*
  (can't create new remote files there). **Upload to `/tmp` instead.**
- Running an `.mjs` from `/tmp` → ESM resolves `node_modules` relative to the
  script location (`/tmp`), so `@prisma/client` is **not found**.
- `flyctl ssh console -C "cd /app && node ..."` → `flyctl -C` runs a single
  executable, not a shell. `cd` isn't an executable → *"cd: not found"*.
- `NODE_PATH=... node ...` directly via `-C` → fly tries to exec the literal
  `NODE_PATH=...` as a program → *"no such file or directory"*.
- `sqlite3` CLI → **not installed** on the machine (`sqlite3: not found`).

The combination that works: a **`.cjs`** file (CommonJS honours `NODE_PATH`),
run through **`/bin/sh -c`** with **`NODE_PATH=/app/node_modules`** set.

## Step-by-step

```powershell
# 1. Upload the script to /tmp (interactive sftp shell)
flyctl sftp shell -a pronostics-app
#   then at the » prompt:
#   put scripts/your-script.cjs /tmp/your-script.cjs
#   (close the terminal afterwards — there is no 'exit' command)

# 2. Run it
flyctl ssh console -a pronostics-app -C "/bin/sh -c 'NODE_PATH=/app/node_modules node /tmp/your-script.cjs'"
```

> Note: `flyctl` may be named `flyctl.exe` and not aliased to `fly` on this
> machine. Use `flyctl`.

## Reusable template

See [db-update.template.cjs](db-update.template.cjs). Copy it, edit the
`run()` body with your Prisma operations, then upload + run as above.
