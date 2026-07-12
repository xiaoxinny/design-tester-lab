# design-tester-lab

A Coolors-style playground for evaluating AI models on UI generation. Bring your own API keys, pick from curated design augmentations, generate UI live, get a deterministic design-quality report, compare models side-by-side.

**License:** AGPL-3.0 (network copyleft — see `LICENSE`)

## What it is

A web app where you:

1. Sign up with email + password
2. Bring your own API keys (Anthropic, OpenAI, Google, OpenRouter, Ollama, anything OpenAI-compatible — including MiniMax-M3)
3. Pick a prompt (from the curated library or write your own)
4. Pick augmentation layers (tokens, principles, behavior — can be combined)
5. Hit generate → live preview the result in a sandboxed iframe
6. Get a deterministic design-quality report (axe-core a11y, APCA contrast, token consistency, spacing scale, semantic HTML)
7. Save the run to your history, compare runs side-by-side, share via link

## Why this exists

Most AI design tools (v0, Claude Design, Figma Make, Bolt, Lovable) generate code but don't let you compare models, measure output objectively, or save comparison history. This tool is the missing evaluation layer.

It does not ship its own AI design opinions. It gives you an open rubric (WCAG 2.2 AA, APCA, 8-pt grid, token-consistency, semantic HTML) and lets you run any model against any prompt against that rubric.

## Quick start (local dev)

The app runs in one of two modes, chosen automatically by environment:

- **Supabase Cloud mode** (default if Supabase env vars are set): Postgres + Auth + RLS in the cloud. Multi-user, signup flow, password reset via Supabase.
- **Local mode** (fallback if Supabase env vars are absent): SQLite at `data/design-tester-lab.db`, single user provisioned from `.env`. No signup flow. The `.env` file is the password-recovery mechanism.

### Supabase Cloud mode

```bash
git clone https://github.com/xiaoxinny/design-tester-lab
cd design-tester-lab
pnpm install

cp .env.example .env
# Edit .env and fill the Supabase Cloud section (see comments in .env.example)
# Set SUPABASE_DB_URL to the connection string from your Supabase project
#   Settings -> Database -> Connection string -> URI

# Apply the schema to your Supabase project (pick one):
#   Option A — via the Supabase dashboard SQL editor: paste docs/supabase-schema.sql
#   Option B — via psql from your local machine:
#     psql $SUPABASE_DB_URL < docs/supabase-schema.sql

# Seed the 8 augmentations into the remote Supabase Postgres:
pnpm db:seed:supabase

pnpm dev       # → http://localhost:3030
```

Note: in Supabase Cloud mode, do NOT run `pnpm db:seed` (which targets local SQLite). Use `pnpm db:seed:supabase` instead. Both scripts are idempotent — safe to re-run.

### Local mode (no Supabase)

```bash
git clone https://github.com/xiaoxinny/design-tester-lab
cd design-tester-lab
pnpm install

cp .env.example .env
# Edit .env and fill the Local mode section:
#   LOCAL_DEFAULT_USER_EMAIL=you@home.local
#   LOCAL_DEFAULT_USER_PASSWORD=*** (12+ chars, your choice)

pnpm db:push   # creates the SQLite schema
pnpm db:seed   # seeds the 8 v1 augmentations
pnpm dev       # → http://localhost:3030
```

Then log in at http://localhost:3030 with the email + password from `.env`.

### Password recovery in local mode

In local mode, your original password lives in `.env`. If you change it through `/settings` and forget the new one, you have two recovery paths:

- **Read the original from `.env`** — the env var is still there from first setup
- **Wipe and start over** — `rm data/design-tester-lab.db && pnpm db:push && pnpm db:seed`, then log in with the `.env` password again

No recovery codes, no email reset. If you want those, use Supabase Cloud mode.

### Switching from local mode to Supabase Cloud

1. Create a Supabase Cloud project (free tier)
2. Apply `docs/supabase-schema.sql` to it
3. Fill in the Supabase section of `.env`
4. Restart the app
5. Sign up as a new user in the Supabase Auth flow

The SQLite database at `data/design-tester-lab.db` is no longer used.

## Quick start (Coolify deployment)

See [`docs/deploy-coolify.md`](docs/deploy-coolify.md) for the full walkthrough.

TL;DR:

1. Create a new Application in Coolify
2. Source = this GitHub repo, branch = `main`, build pack = Dockerfile
3. Set environment variables (ENCRYPTION_KEY, SESSION_SECRET, DATABASE_URL)
4. Mount a persistent volume at `/app/data`
5. Configure domain + Cloudflare Tunnel
6. Deploy

## Architecture

- **Next.js 14** (App Router, TypeScript, server components, server actions)
- **SQLite** via better-sqlite3 + Drizzle ORM (zero external service, portable to Postgres later)
- **Auth** — email + password with bcrypt, session cookies, server-side session validation
- **BYOK** — user-supplied API keys encrypted at rest with AES-256-GCM (key from `ENCRYPTION_KEY`)
- **Model providers** — single OpenAI-compatible adapter (works with Anthropic, OpenAI, Google, OpenRouter, Ollama, and any OpenAI-compatible endpoint)
- **Lint engine** — axe-core + apca-w3 + custom token-consistency + custom spacing-scale + custom semantic-HTML check, all running in a sandboxed iframe
- **Augmentations** — YAML files in `content/augmentations/*.md`, validated against a schema, loaded into SQLite at build time
- **Deployment** — multi-stage Dockerfile, Coolify-friendly (single-node Swarm, proper healthcheck, non-root user, no `npx` in CMD)

## The augmentation system

Augmentations are layered and composable. Users pick from three categories:

- **Tokens** (pick exactly one): `None`, `shadcn-tokens`, `Material 3 tokens`, `better-design tokens`
- **Principles** (pick zero or one): `Constitution Tier 1+2`, `Full Constitution`
- **Behavior** (pick zero or one): `Critique-revise (self)`, `Lint-feedback critique`

Each augmentation is a YAML file in `content/augmentations/` with provenance (source URL + license). To add a new one, open a PR.

Conflict detection ensures users don't pick `shadcn-tokens` + `Material 3 tokens` together. Behavior augmentations are mutually exclusive (don't run both critique loops).

## The 8 v1 augmentations

1. `none` — baseline, no system prompt augmentation
2. `shadcn-tokens` — shadcn/ui design system tokens + component patterns
3. `m3-tokens` — Material Design 3 foundation tokens + type roles
4. `better-design-default` — better-design multi-brand shadcn-based tokens
5. `constitution-tier-1-2` — WCAG 2.2 AA + 8-pt grid + type scale + semantic HTML
6. `constitution-full` — adds aesthetic dispositions to Tier 1+2
7. `critique-revise` — model critiques its own output, revises once
8. `lint-feedback` — deterministic lint results injected into critique prompt

## The lint engine

Every run produces a structured lint report covering:

- **Accessibility** (axe-core, ~90 WCAG 2.2 A/AA rules)
- **Contrast** (WCAG ratio + APCA Lc values)
- **Token consistency** (does generated HTML use only the brand tokens?)
- **Spacing scale** (8-pt grid adherence)
- **Semantic HTML** (heading order, landmark elements, button-not-div)

The lint is deterministic and free. It does not use VLM critique (VLM critique of VLM output is circular and produces noise — see `docs/why-no-vlm-judge.md`).

## Roadmap

- **Day 1** ✅ Repo init, schema, auth, Next.js skeleton, Dockerfile
- **Day 2** BYOK credential vault + provider adapters
- **Day 3** Playground UI + augmentation picker + generation loop
- **Day 4** Run history + comparison view
- **Day 5** Lint engine + report panel
- **Day 6** Share-as-link + polish + deploy

See `BUILD-PLAN.md` for the full plan.

## Contributing

PRs welcome. Add augmentations by dropping a YAML file in `content/augmentations/` with frontmatter (id, name, description, category, license, source) and the system prompt body. The DB seed loader picks them up automatically.

## License

AGPL-3.0. See `LICENSE` for full text. In short: free to use, modify, and distribute. If you run a modified version as a network service, you must publish your modifications.