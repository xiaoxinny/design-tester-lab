# design-tester-lab

A web playground for evaluating AI models on UI generation. Bring your own API keys, pick from curated design augmentations, generate UI live, get a deterministic design-quality report, and compare models side-by-side.

**License:** AGPL-3.0 (network copyleft — see `LICENSE`)

---

## What it is

A web application with the following flow:

1. Sign up with email and password
2. Bring your own API keys (any OpenAI-compatible endpoint: Anthropic, OpenAI, Google, OpenRouter, Ollama, etc.)
3. Pick a prompt from the curated library, or write your own
4. Pick augmentation layers (tokens, principles, behavior — composable)
5. Generate → live preview the result in a sandboxed iframe
6. Receive a deterministic design-quality report (axe-core a11y, APCA contrast, token consistency, spacing scale, semantic HTML)
7. Save runs to your history, compare runs side-by-side, share via link

## Why it exists

Existing AI design tools (v0, Claude Design, Figma Make, Bolt, Lovable) generate code but do not let you compare models, measure output against an objective rubric, or save comparison history. design-tester-lab fills that gap: it provides an open rubric (WCAG 2.2 AA, APCA, 8-pt grid, token consistency, semantic HTML) and lets you run any model against any prompt against that rubric.

The project is a host for running augmentations. Augmentations supply the design opinions; the project supplies the execution surface.

---

## Quick start

The app runs in one of two modes, chosen automatically by environment:

- **Supabase Cloud mode** (default if Supabase env vars are set): Postgres + Auth + RLS in the cloud. Multi-user, signup flow, password reset via Supabase.
- **Local mode** (fallback if Supabase env vars are absent): SQLite at `data/design-tester-lab.db`, single user provisioned from `.env`. No signup flow. The `.env` file is the password-recovery mechanism.

### Supabase Cloud mode

```bash
git clone https://github.com/xiaoxinny/design-tester-lab
cd design-tester-lab
pnpm install

cp .env.example .env
# Edit .env and fill the Supabase Cloud section.
# Set SUPABASE_DB_URL to the connection string from your Supabase project:
#   Settings -> Database -> Connection string -> URI

# Apply the schema to your Supabase project (pick one):
#   Option A — via the Supabase dashboard SQL editor: paste docs/supabase-schema.sql
#   Option B — via psql from your local machine:
#     psql "$SUPABASE_DB_URL" < docs/supabase-schema.sql

# Seed the 8 augmentations into the remote Supabase Postgres:
pnpm db:seed:supabase

pnpm dev       # → http://localhost:3030
```

In Supabase Cloud mode, do **not** run `pnpm db:seed` (which targets local SQLite). Use `pnpm db:seed:supabase` instead. Both scripts are idempotent and safe to re-run.

### Local mode (no Supabase)

```bash
git clone https://github.com/xiaoxinny/design-tester-lab
cd design-tester-lab
pnpm install

cp .env.example .env
# Edit .env and fill the Local mode section:
#   LOCAL_DEFAULT_USER_EMAIL=you@home.local
#   LOCAL_DEFAULT_USER_PASSWORD=<12+ chars, your choice>

pnpm db:push   # creates the SQLite schema
pnpm db:seed   # seeds the 8 v1 augmentations
pnpm dev       # → http://localhost:3030
```

Log in at `http://localhost:3030` with the email and password from `.env`.

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

## Architecture

- **Next.js 14** (App Router, TypeScript, server components, server actions)
- **SQLite** via `better-sqlite3` and Drizzle ORM (no external service; portable to Postgres)
- **Auth** — email and password with argon2id (`@node-rs/argon2`, OWASP minimum A parameters), session cookies, server-side session validation
- **BYOK** — user-supplied API keys encrypted at rest with AES-256-GCM (key from `ENCRYPTION_KEY` env var)
- **Model providers** — single OpenAI-compatible adapter (Anthropic, OpenAI, Google, OpenRouter, Ollama, and any OpenAI-compatible endpoint)
- **Lint engine** — `axe-core`, `apca-w3`, and custom token-consistency, spacing-scale, and semantic-HTML checks, all deterministic, all running in a sandboxed iframe
- **Augmentations** — YAML files in `content/augmentations/*.md`, validated against a schema, loaded into SQLite at build time
- **Deployment** — multi-stage Dockerfile, Coolify-friendly (single-node Swarm, proper healthcheck, non-root user, no `npx` in CMD)

## The augmentation system

Augmentations are layered and composable. Users pick from three categories:

- **Tokens** (pick exactly one): `none`, `shadcn-tokens`, `m3-tokens`, `better-design-default`
- **Principles** (pick zero or one): `constitution-tier-1-2`, `constitution-full`
- **Behavior** (pick zero or one): `critique-revise`, `lint-feedback`

Each augmentation is a YAML file in `content/augmentations/` with provenance (source URL and license). To add a new one, open a pull request — see [`docs/contributing/augmentation-system.md`](docs/contributing/augmentation-system.md).

Conflict detection ensures users cannot pick incompatible combinations (for example, `shadcn-tokens` and `m3-tokens` together). Behavior augmentations are mutually exclusive (the two critique loops run independently; the picker does not stack them).

## The 8 augmentations

| ID | Category | Description |
|---|---|---|
| `none` | tokens | Baseline; no system prompt augmentation |
| `shadcn-tokens` | tokens | shadcn/ui design system tokens and component patterns |
| `m3-tokens` | tokens | Material Design 3 foundation tokens and type roles |
| `better-design-default` | tokens | better-design multi-brand shadcn-based tokens |
| `constitution-tier-1-2` | principles | WCAG 2.2 AA, 8-pt grid, type scale, semantic HTML |
| `constitution-full` | principles | Adds aesthetic dispositions to Tier 1+2 |
| `critique-revise` | behavior | Model critiques its own output, revises once |
| `lint-feedback` | behavior | Deterministic lint results injected into critique prompt |

## The lint engine

Every run produces a structured lint report covering:

- **Accessibility** (axe-core, ~90 WCAG 2.2 A/AA rules)
- **Contrast** (WCAG ratio and APCA Lc values)
- **Token consistency** (does generated HTML use only the brand tokens)
- **Spacing scale** (8-pt grid adherence)
- **Semantic HTML** (heading order, landmark elements, button-not-div)

The lint is deterministic and free. It does not use VLM critique — see [`docs/research/09-adversarial-review-v2.md`](docs/research/09-adversarial-review-v2.md) for the rationale (circular evaluation, house-style contamination, and VisJudge-Bench correlation numbers).

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/operations/deployment.md`](docs/operations/deployment.md) | Production deployment runbook (local mode, Supabase mode, Coolify, env vars, AGPL obligations, disaster recovery) |
| [`docs/security/threat-model.md`](docs/security/threat-model.md) | In-scope and out-of-scope threats; required reading before any auth or eval-path change |
| [`docs/security/dependabot-status.md`](docs/security/dependabot-status.md) | Current Dependabot alert status and remediation history |
| [`docs/adr/0001-byok-key-handling.md`](docs/adr/0001-byok-key-handling.md) | BYOK key lifecycle, encryption, memory handling, revocation |
| [`docs/contributing/augmentation-system.md`](docs/contributing/augmentation-system.md) | How augmentations work, the three categories, how to add a new one |
| [`docs/research/`](docs/research/) | Background research that informed the architecture (10 documents, see `docs/research/README.md`) |
| [`docs/REVIEW-glm-5.2-2026-07-13.md`](docs/REVIEW-glm-5.2-2026-07-13.md) | GLM-5.2 architectural review of the original docs |
| [`docs/REVIEW-glm-code-2026-07-13.md`](docs/REVIEW-glm-code-2026-07-13.md) | GLM-5.2 code review of the implementation |

## Contributing

Pull requests welcome. The highest-leverage contributions are:

- **New augmentations** — drop a YAML file in `content/augmentations/` with frontmatter (id, version, name, description, category, license, source, conflicts_with, requires) and the system prompt body. The DB seed loader picks them up automatically.
- **New model providers** — add an adapter in `src/lib/providers/`. The OpenAI-compatible adapter handles most providers; custom endpoints just need a different base URL.
- **New lint rules** — add a module in `src/lib/lint/`. Each rule is a function that takes rendered HTML + computed styles and returns a structured report.
- **Documentation improvements** — particularly deployment recipes for non-Coolify targets, additional provider adapters, and augmentation patterns.

## License

AGPL-3.0. See [`LICENSE`](LICENSE) for the full text. Summary: free to use, modify, and distribute. If you run a modified version as a network service, you must publish your modifications to the users of that service.

For the implications of AGPL on deployment, see [`docs/operations/deployment.md#agpl-30-source-disclosure-obligation`](docs/operations/deployment.md).