# Deployment Guide

This guide covers the three supported deployment modes and the production deployment target: Dokploy, a Docker-based PaaS.

## Modes overview

| Mode | Configuration | Database | Users | OAuth |
|---|---|---|---|---|
| Local mode (default) | `ONLINE_MODE` unset or `0` | SQLite | Single user | No |
| Supabase mode | `ONLINE_MODE=1` plus Supabase variables | Supabase Postgres | Multi-user | Yes — Google/GitHub via Supabase |
| Direct Postgres mode | `ONLINE_MODE=1` plus `DATABASE_URL` | PostgreSQL | Multi-user | No |

`ENCRYPTION_KEY` and `SESSION_SECRET` are required in every mode and must be different values. In online mode, use either the complete Supabase configuration or a PostgreSQL `DATABASE_URL`; do not mix the two database configurations unintentionally.

## Quick start (local development)

The guided setup is recommended:

```bash
pnpm setup
pnpm dev
```

`pnpm setup` interactively creates the local environment, configures the bootstrap user, and prepares the database.

For a manual setup:

```bash
cp .env.example .env
# Fill in ENCRYPTION_KEY, SESSION_SECRET,
# LOCAL_DEFAULT_USER_EMAIL, and LOCAL_DEFAULT_USER_PASSWORD.
pnpm db:push
pnpm db:seed
pnpm dev
```

The development server is available at `http://localhost:3030`. Keep `.env` private; it contains secrets and is not committed to git.

## Deploying to Dokploy

### Prerequisites

- A VPS with Dokploy installed
- A GitHub repository containing the application
- A domain pointing to the VPS
- A Supabase project (the free tier is sufficient for online mode)

### Supabase project setup (one-time)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the Supabase SQL Editor and paste the contents of `drizzle/postgres/schema.sql` to apply the schema.
3. Enable OAuth providers in **Authentication → Providers → Google** and **GitHub**. Configure the provider credentials as required by Supabase.
4. Note these values from the Supabase dashboard:
   - **Project URL**
   - **Publishable Key**, beginning with `sb_publishable_`
   - **Service Role Key** (server-only)
   - **Database connection string**, if you will run seed or migration commands manually

### Dokploy configuration

1. Create an **Application**, select **GitHub**, and choose this repository and the `main` branch.
2. Set **Build Type** to **Dockerfile**.
3. Add the Supabase-mode environment variables listed in the reference table below. Set `ONLINE_MODE=1`, `NODE_ENV=production`, and `PORT=3030`.
4. Configure the domain and route traffic to container port `3030`. Enable HTTPS through Dokploy or its configured reverse proxy.
5. Deploy.

No manual database initialization is needed during deployment. The container entrypoint handles migrations and seeding for local SQLite mode. In Supabase mode, SQLite initialization is skipped because the schema has already been applied to Supabase.

### Environment variables reference

| Variable | Local mode | Supabase mode | Direct Postgres mode | Notes |
|---|---:|---:|---:|---|
| `ONLINE_MODE` | No, or `0` | `1` | `1` | Selects online mode when set to `1` |
| `ENCRYPTION_KEY` | Required | Required | Required | Base64-encoded 32-byte key; generate with `openssl rand -base64 32` |
| `SESSION_SECRET` | Required | Required | Required | Session-signing secret; use a different value from `ENCRYPTION_KEY` |
| `DATABASE_URL` | Required | No | Required | SQLite path, normally `./data/design-tester-lab.db`, or PostgreSQL URL in direct mode |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Required | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Required | No | Client-safe `sb_publishable_...` key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Required | No | Server-only; never expose it to the browser |
| `SUPABASE_DB_URL` | No | Recommended for manual seed/migrations | No | Supabase Postgres connection string for database tooling |
| `LOCAL_DEFAULT_USER_EMAIL` | Required for bootstrap | No | No | Initial local user email |
| `LOCAL_DEFAULT_USER_PASSWORD` | Required for bootstrap | No | No | Initial local user password |
| `STORAGE_DIR` | Optional | Optional | Optional | Defaults to `./data/storage`; persist it if local artifacts are important |
| `AUGMENTATIONS_DIR` | Optional | Optional | Optional | Defaults to `./content/augmentations` |
| `NEXT_PUBLIC_APP_URL` | Optional | Recommended | Recommended | Public URL used for canonical links |
| `PORT` | Optional | Optional | Optional | Defaults to `3030` |
| `NODE_ENV` | Optional | Recommended `production` | Recommended `production` | Runtime environment |
| `LOG_LEVEL` | Optional | Optional | Optional | `trace`, `debug`, `info`, `warn`, or `error` |
| `AUTH_DISABLED` | Local only | No | No | Dangerous development escape hatch; leave `false` in deployments |

### What happens on each redeploy

| Mode | Database and user data | Uploaded/generated files | Redeploy behavior |
|---|---|---|---|
| Local mode | Preserved only when `/app/data` is mounted as a persistent volume | Preserved only when the storage directory is on that volume | Entrypoint applies any missing SQLite migrations and re-seeds augmentations idempotently |
| Supabase mode | Preserved in Supabase | Preserve `/app/data/storage` if the app writes durable local artifacts there | Container replacement does not affect database data; schema initialization is skipped |
| Direct Postgres mode | Preserved in the configured PostgreSQL server | Preserve `/app/data/storage` if needed | Container replacement does not affect database data; schema management remains external |

Never remove the Dokploy volume or run an equivalent `docker compose down -v` operation when local data must be retained.

### OAuth setup

OAuth is available in Supabase mode only.

1. In Supabase, open **Authentication → Providers**.
2. Enable **Google** and/or **GitHub** and enter the provider credentials.
3. Add the application callback URL to the provider's allowed redirect URLs:

   `https://your-domain.com/api/auth/callback`

4. Ensure the application's public URL and Supabase variables match the deployed domain.

### Backup

For Supabase mode, use the Supabase dashboard's database backup or export tools. Keep a secure copy of the database and the server-side secrets needed to decrypt stored credentials.

For local mode, copy the SQLite database from the running container and back up the persistent volume contents:

```bash
docker cp <container-name>:/app/data/design-tester-lab.db ./design-tester-lab-$(date +%F).db
docker cp <container-name>:/app/data/storage ./storage-backup-$(date +%F)
```

Back up `.env` separately through a password manager or encrypted storage. Without the original `ENCRYPTION_KEY`, encrypted credentials in the database cannot be recovered.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Container starts and immediately exits | Required environment variable is missing or invalid | Check `ENCRYPTION_KEY`, `SESSION_SECRET`, `ONLINE_MODE`, and the selected database variables in Dokploy logs |
| App returns 502 after deployment | Domain routes to the wrong port or container is unhealthy | Route Dokploy to port `3030`; inspect container logs and health-check settings |
| Online mode tries to use SQLite | `ONLINE_MODE` is not exactly `1`, or online variables are incomplete | Set `ONLINE_MODE=1` and provide either all Supabase variables or a PostgreSQL `DATABASE_URL` |
| Supabase login is missing | OAuth provider is disabled or the callback URL is not allow-listed | Enable the provider in Supabase and add `https://your-domain.com/api/auth/callback` |
| Local data disappears after redeploy | The `/app/data` persistent volume was not configured or was deleted | Add and retain a Dokploy persistent volume mounted at `/app/data`; restore the latest backup if needed |
| Schema or seed errors in local mode | Database setup was interrupted or the SQLite path is not writable | Check `DATABASE_URL`, volume permissions, then restart the container so the entrypoint can retry |
| Direct Postgres connection fails | Invalid URL, unreachable host, or database TLS/network policy | Verify `DATABASE_URL`, allow the Dokploy host, and confirm the database accepts PostgreSQL connections |

## AGPL-3.0 source disclosure obligation

This project is licensed under AGPL-3.0. If you run it as a network service, Section 13 requires you to offer the complete corresponding source code to users who interact with the service over the network. Keep the source, build configuration, schema, and required scripts available under the same license, and provide users with a clear way to obtain them.
