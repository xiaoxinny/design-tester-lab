# Deployment guide

This document covers both storage modes and the recommended deployment patterns. For Coolify-specific operator workflows, see the [Coolify official documentation](https://coolify.io/docs); the patterns described here are compatible with any Docker-based PaaS that supports a `Dockerfile` build pack, a persistent volume, environment variables, and an HTTP port mapping.

## Overview

design-tester-lab is a Next.js application with two storage modes:

- **Supabase Cloud mode** (default if Supabase env vars are set): Postgres + Auth + RLS in the cloud
- **Local mode** (when Supabase env vars are unset): SQLite file, single user provisioned from `.env`

This guide covers both modes and the recommended deployment patterns.

## Mode 1 — Local mode on a home server

Recommended for: solo developer, evaluation use, no production traffic.

### Requirements

- Any x86_64 or arm64 Linux box with Docker
- 2 GB RAM minimum (4 GB recommended for Playwright + headless rendering)
- 1 GB disk for the SQLite DB + augmentation storage
- Optional: Tailscale or Cloudflare Tunnel for remote access

### Quick start

```bash
git clone https://github.com/xiaoxinny/design-tester-lab
cd design-tester-lab
pnpm install

cp .env.example .env
# Generate two distinct 32-byte secrets:
openssl rand -base64 32  # ENCRYPTION_KEY
openssl rand -base64 32  # SESSION_SECRET
# Set LOCAL_DEFAULT_USER_EMAIL and LOCAL_DEFAULT_USER_PASSWORD

pnpm db:push
pnpm db:seed
pnpm build
pnpm start
# → http://localhost:3030
```

For LAN access: bind to `0.0.0.0` (Next.js default). Visit `http://<server-ip>:3030` from another device on the same network.

For external access: use Tailscale (recommended) or Cloudflare Tunnel (more setup). Do NOT just port-forward without auth — the local mode is single-user.

### Backup

```bash
# Daily
sqlite3 data/design-tester-lab.db ".backup '/backup/design-tester-lab-$(date +%F).db'"

# Or dump as SQL (portable, human-readable):
sqlite3 data/design-tester-lab.db .dump > backup.sql

Restore: replace `data/design-tester-lab.db` with the backup, or:
sqlite3 data/design-tester-lab.db < backup.sql

### Backup the .env

Without `.env`, you cannot decrypt the stored BYOK credentials. Treat it as sensitive. Backup strategy:

- Password manager entry (preferred for the developer)
- Encrypted backup volume (e.g., gocryptfs + rclone to a cloud bucket)
- Hardware token for very high-value credentials

Do NOT commit `.env` to git. `.gitignore` excludes it.

## Mode 2 — Supabase Cloud mode

Recommended for: shared use, multi-user, persistent data, public deployment.

### Requirements

- A Supabase Cloud project (free tier is sufficient for the feature set)
- A Coolify / Dokploy / Railway / Render / Fly.io deployment target
- A registered domain (optional but recommended for HTTPS)
- Cloudflare Tunnel or reverse proxy for HTTPS

### Supabase setup

1. Create a project at https://supabase.com
2. Find your connection strings:
   - **Project URL**: Settings -> API -> Project URL
   - **anon key**: Settings -> API -> anon / public
   - **service_role key**: Settings -> API -> service_role (server only)
   - **DB URL**: Settings -> Database -> Connection string -> URI (for migrations)
3. Apply the schema:
   ```bash
   psql "$SUPABASE_DB_URL" < drizzle/0000_smooth_blue_blade.sql
   ```
   Or paste `drizzle/0000_smooth_blue_blade.sql` into the Supabase dashboard SQL editor.
4. Seed augmentations:
   ```bash
   pnpm db:seed:supabase
   ```

### App deployment

Coolify (recommended for self-hosted):

1. Create new Application in Coolify, source = this GitHub repo
2. Build type: a Node.js build pack with pnpm support (Coolify's default Nixpacks auto-detects `pnpm-lock.yaml`; or use a custom `Dockerfile` if you need fine-grained control), port = 3030
3. Environment variables:
   ```
   ENCRYPTION_KEY=<openssl rand -base64 32>
   SESSION_SECRET=<openssl rand -base64 32>
   NEXT_PUBLIC_SUPABASE_URL=<project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   SUPABASE_DB_URL=<connection string>
   NODE_ENV=production
   ```
4. Mount a persistent volume at `/app/data` (for local-cache files; not strictly needed in Supabase mode)
5. Add Cloudflare Tunnel or reverse proxy for HTTPS
6. Deploy

Health check: `wget -qO- http://localhost:3030/api/health || exit 1` (start period 90s).

## Environment variables reference

| Var | Required | Mode | Notes |
|---|---|---|---|
| `ENCRYPTION_KEY` | yes | both | 32-byte base64; distinct from SESSION_SECRET |
| `SESSION_SECRET` | yes | both | ≥32-byte base64; HMAC for session signing |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | supabase | https://<ref>.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | supabase | anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | supabase | server-only |
| `SUPABASE_DB_URL` | optional | supabase | only for `db:seed:supabase` |
| `LOCAL_DEFAULT_USER_EMAIL` | optional | local | bootstrap user on first run |
| `LOCAL_DEFAULT_USER_PASSWORD` | optional | local | 8+ chars; bootstrap password |
| `DATABASE_URL` | optional | local | default `./data/design-tester-lab.db` |
| `STORAGE_DIR` | optional | local | default `./data/storage` |
| `AUGMENTATIONS_DIR` | optional | both | default `./content/augmentations` |
| `PORT` | optional | both | default 3030 |
| `NODE_ENV` | optional | both | `production` recommended |
| `LOG_LEVEL` | optional | both | `trace\|debug\|info\|warn\|error\|fatal` |
| `AUTH_DISABLED` | escape hatch | local only | DANGEROUS; see threat model |
| `I_UNDERSTAND_AUTH_IS_DISABLED_AND_I_AM_EXPOSING_MY_NETWORK` | escape hatch | local only | required if AUTH_DISABLED + non-loopback |

## AGPL-3.0 source-disclosure obligation

If you deploy this app as a network service (web-hosted, accessible to users other than yourself), AGPL-3.0 Section 13 requires that you offer the complete corresponding source code to those users.

For design-tester-lab this means:

- Public deployments must link to the source repo (https://github.com/xiaoxinny/design-tester-lab)
- Any modifications you make must be published under AGPL-3.0
- The "Corresponding Source" includes all scripts required to regenerate the binary (build config, schema migrations, environment templates)

This is a non-trivial obligation. If you don't want it, fork under a different license (requires permission from contributors) or use a non-AGPL alternative.

## Operational runbook

### Migrations

```bash
# Local mode
pnpm db:push

# Supabase mode (manual via dashboard or psql)
psql "$SUPABASE_DB_URL" < drizzle/0001_*.sql

# After schema changes, regenerate migrations:
pnpm db:generate
# Inspect the new drizzle/0001_*.sql file before applying
```

### Augmentation updates

```bash
# Edit content/augmentations/*.md or add new ones
# Re-run the seed loader (idempotent -- only updates on (id, version) change)
pnpm db:seed

# Or for Supabase mode:
pnpm db:seed:supabase
```

### Health check endpoint

Currently `GET /api/health` returns `{ status: "ok" }` if the app is running and the DB is reachable. This is what Coolify should poll. To verify manually: `curl http://localhost:3030/api/health`.

### Restart

```bash
# Local
pkill -f "next-server" && pnpm start

# Coolify
# Use the Coolify UI Restart button, or:
docker restart <container-name>

# Supabase seed re-run
pnpm db:seed:supabase
```

## Disaster recovery

If the SQLite DB is corrupted:

1. Stop the app
2. Backup the corrupted file: `cp data/design-tester-lab.db data/corrupt.db`
3. Restore from the most recent backup: `cp /backup/latest.db data/design-tester-lab.db`
4. Restart

If `.env` is lost:

1. Stop the app
2. Re-create `.env` with the same `LOCAL_DEFAULT_USER_EMAIL` and a NEW `LOCAL_DEFAULT_USER_PASSWORD`
3. Restart — the app will re-bootstrap the user with the new password
4. **Important:** any BYOK credentials stored in the previous DB are now lost. They were encrypted with a key derived from the previous `ENCRYPTION_KEY`. To recover them, you need the old `ENCRYPTION_KEY` AND the old DB.

This is why `ENCRYPTION_KEY` backup is critical.