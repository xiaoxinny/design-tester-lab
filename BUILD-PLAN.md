# Day-by-Day Build Plan

## Day 1 (today) — Foundation

- [x] Repo initialized, LICENSE (AGPL-3.0) added
- [x] `.gitignore`, `.env.example`, `README.md` written
- [ ] Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffold
- [ ] `package.json` with all dependencies pinned
- [ ] Drizzle ORM + better-sqlite3 setup
- [ ] Schema for 6 tables: `model_credentials`, `augmentations`, `prompts`, `runs`, `run_comparisons`, `augmentation_presets`
- [ ] Drizzle migrations generated
- [ ] Seed loader for 8 v1 augmentations (YAML → DB)
- [ ] Auth scaffold: signup, login, logout, session cookie, bcrypt
- [ ] Routes: `/`, `/signup`, `/login`, `/dashboard`, `/playground`, `/library`, `/runs/[id]`, `/settings`
- [ ] Docker multi-stage Dockerfile (Next.js 14 standalone, non-root, healthcheck)
- [ ] `docker-compose.yml` for local dev (with persistent volume)
- [ ] Coolify deployment doc
- [ ] First commit + push to GitHub

## Day 2 — BYOK + providers

- [ ] AES-256-GCM encryption module (`src/lib/crypto.ts`)
- [ ] BYOK credential vault page (`/settings/credentials`)
- [ ] Form to add/edit/delete model credentials
- [ ] Generic OpenAI-compatible provider adapter (`src/lib/providers/openai-compatible.ts`)
- [ ] Provider-specific adapters:
  - [ ] Anthropic (`src/lib/providers/anthropic.ts`) — uses Messages API
  - [ ] OpenAI (`src/lib/providers/openai.ts`) — uses Chat Completions
  - [ ] Google Gemini via OpenAI-compatible mode
  - [ ] OpenRouter via OpenAI-compatible mode
  - [ ] Ollama (local, base URL configurable, no key)
  - [ ] Custom OpenAI-compatible (any other endpoint)
- [ ] Provider factory + error handling
- [ ] Model metadata table (context window, max output, cost per 1M tokens, release date)
- [ ] **Password change UI with .env-as-backup note** — no recovery code, no email reset. The .env file is the recovery mechanism in local mode.

## Day 3 — Playground + generation loop

- [ ] `/playground` page UI:
  - Left rail: model picker, augmentation picker (with stack validation), prompt input, generation params
  - Right area: live preview iframe + lint report panel + history sidebar
- [ ] Augmentation stack picker UI:
  - Tokens radio group (pick 1)
  - Principles checkboxes (pick 0-1)
  - Behavior checkboxes (pick 0-1)
  - Stack validation with conflict warnings
  - "Save as preset" feature
- [ ] Generate button → server action → provider call → save run
- [ ] Streaming or wait-then-display (decide based on latency)
- [ ] Render iframe with `sandbox` attribute
- [ ] Initial prompt library with 25 curated starter prompts
- [ ] History sidebar showing recent runs

## Day 4 — Run history + comparison

- [ ] Run history view (`/library/[id]` or `/runs`)
- [ ] Single run view (`/runs/[id]`) with full lint report
- [ ] Comparison view (`/runs/compare?a=X&b=Y`)
  - Side-by-side iframe rendering
  - Two lint reports side-by-side
  - A/B voting (which is better?)
- [ ] Save comparison to `run_comparisons` table
- [ ] Run export (HTML file, JSON report)

## Day 5 — Lint engine

- [ ] `src/lib/lint/axe.ts` — runs axe-core against generated HTML in sandboxed iframe
- [ ] `src/lib/lint/contrast.ts` — WCAG ratio + APCA Lc computation
- [ ] `src/lib/lint/tokens.ts` — extracts computed styles, compares against injected token set
- [ ] `src/lib/lint/spacing.ts` — extracts margin/padding/gap, checks 8-pt grid adherence
- [ ] `src/lib/lint/semantic.ts` — checks heading order, landmarks, button-not-div
- [ ] Lint runner that takes generated HTML + augmentation stack → returns structured report
- [ ] Lint report panel UI (per-rule pass/fail with evidence + fix suggestion)

## Day 6 — Share + polish + deploy

- [ ] Share-as-link feature (`/share/[slug]`, public view-only)
- [ ] User rating (1-5 stars per run)
- [ ] Notes field per run
- [ ] Run history filtering (by model, by augmentation, by date)
- [ ] Search prompts
- [ ] Fork prompt (save modified copy to own library)
- [ ] Augmentation authoring guide (`docs/augmentations.md`)
- [ ] Coolify deploy doc (`docs/deploy-coolify.md`)
- [ ] README polish
- [ ] First public commit + Coolify deploy

## Post-v1 (backlog)

- Leaderboard page aggregating public runs
- Prolific/MTurk integration for human evaluation studies
- VLM critique layer (only as opt-in, with clear "this is noisy" warning)
- Custom augmentation authoring UI (still gated, but visual editor)
- Dataset export (anonymized, opt-in)
- Multiple comparison rounds (3+ models side-by-side)
- Embeddable widget for vendor model-release blog posts

## Open questions

- **Streaming vs wait:** the model APIs support SSE streaming. For UI gen, wait-then-display might be simpler. Decide on Day 3 based on latency testing.
- **Prompt library seeding:** 25 starter prompts covering what categories? Pricing, dashboard, mobile, form, landing, onboarding, system tools? Decide on Day 3.
- **How to handle very long generated HTML:** truncate in iframe? scroll? show "scroll for full view"? Decide on Day 3.
- **Multiple API keys per provider:** allow user to save "work Anthropic key" + "personal Anthropic key" and pick? Yes, via credential labels. Implemented Day 2.