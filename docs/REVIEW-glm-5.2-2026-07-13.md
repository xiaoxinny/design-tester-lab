# GLM-5.2 Architectural Review — 2026-07-13

**Reviewer:** GLM-5.2 (Zhipu, via Synthetic API at `api.synthetic.new/openai/v1`, model `hf:zai-org/GLM-5.2`)
**Target:** `design-tester-lab` Day 1 docs (`README.md`, `BUILD-PLAN.md`, `package.json`, `.env.example`, `LICENSE`, `.gitignore`)
**Verdict up front:** Build with revisions. The bones are right, but the docs as written have at least three concrete bugs, the timeline is optimistic by ~30%, and the dual-mode storage design needs a more honest "this is how the abstraction fails" section.

---

## 1. Architecture coherence

### Dual-mode storage

The "one repo, two backends" approach is sound in principle and has a real use case (zero-friction local install vs. multi-user cloud), but the costs are being under-sold in the docs.

**What works:**
- The mode-switching trigger is clean: presence/absence of `NEXT_PUBLIC_SUPABASE_URL`. No runtime flag, no config file. That's the right shape.
- Using Drizzle ORM for both is the correct call — it's one of the few ORMs that genuinely supports dialect divergence without two separate query builders.
- `jose` is already in the dependency list, which is good — it's the right primitive for both HMAC session signing and the JWT verification path against Supabase.

**What's not being acknowledged:**
- **The repository abstraction will leak.** Postgres has `jsonb`, `gen_random_uuid()`, partial unique indexes, `RETURNING`, full-text search, row-level security. SQLite has none of those. The moment any feature touches those, you have either (a) two code paths or (b) a lowest-common-denominator schema that throws away Postgres's advantages. The README's claim that SQLite is "portable to Postgres later" is only true for the trivial subset of the schema.
- **RLS is a feature, not an accident.** Supabase mode relies on RLS for multi-tenant isolation. Local mode has no equivalent — it's a single user, period. The moment someone tries to extend local mode to "multi-user via SQLite," they'll be reinventing RLS badly. Worth saying out loud.
- **Migrations are split-brain.** Drizzle migrations are dialect-specific. You will end up with `drizzle/supabase/` and `drizzle/sqlite/` directories and a `pnpm db:push` that picks one. `package.json` only models the SQLite path. Either add `db:push:supabase` and `db:migrate:supabase` now, or accept that the schema is frozen to whatever Drizzle can express in both.
- **The "Supabase Cloud mode + `pnpm db:seed`" sequence in the README is wrong.** `db:seed` writes to the local SQLite file. Supabase Cloud mode means the data lives in remote Postgres, not in `./data/`. Either the seed loader has to push augmentations into Supabase, or the README's quick-start is broken. **Concrete doc bug, not hypothetical.** [FIXED in this revision: see README line 50, `pnpm db:seed:supabase`]

**Verdict on dual-mode:** Keep it, but add a `docs/architecture-decisions/0001-dual-mode-storage.md` that enumerates what each backend gives up. The current docs present this as nearly free; it isn't.

### Augmentation stack validation

The constraint (exactly-1 tokens, at-most-1 principles, at-most-1 behavior) is **defensible but more restrictive than necessary in two places and too loose in one place.**

- **Tokens: exactly-1 is correct.** Multiple token systems in the same prompt would be incoherent. Lock this down.
- **Principles: at-most-1 is correct for v1, but `constitution-tier-1-2` and `constitution-full` should be a radio pair, not two independent checkboxes.** If they're meant to compose as a hierarchy, the UI should reflect that. Otherwise a user picks neither and gets a weaker result than expected.
- **Behavior: at-most-1 is right for now, but the two behaviors aren't symmetric.** `critique-revise` is two model calls. `lint-feedback` is also two calls but with an external input. They can compose if you structure the behavior stack as a small DAG (lint → critique → revise), but the current flat at-most-1 model hides that. Consider `behavior_count: 0..N` with a `compose_order` field from day 1; it's cheap to add and you'll want it by v2.
- **Conflict detection is underspecified.** Move conflicts to augmentation metadata (`conflicts_with: [shadcn-tokens]`), not a hand-maintained if/else.

**Verdict on stack validation:** Tighten the principles-as-hierarchy piece, model behavior composition from day 1, move conflicts to metadata.

---

## 2. Security

### BYOK encryption

AES-256-GCM at rest is the correct primitive. Three things to check at implementation:

1. **Per-credential IV/nonce.** GCM nonce reuse under the same key is catastrophic. Fresh random 96-bit IV per encryption, stored alongside ciphertext.
2. **AAD (additional authenticated data).** Bind ciphertext to user ID + credential ID so swapped-credential attacks fail the auth tag.
3. **Key rotation.** No key version field documented in the schema. Without it, rotating `ENCRYPTION_KEY` requires downtime. Add `key_version INTEGER NOT NULL DEFAULT 1` to the encrypted payload header.

### Session cookies

HMAC-signed with `SESSION_SECRET` via `jose` — fine for server-side sessions. But:
- **No CSRF protection mentioned.** Forms that mutate state need CSRF tokens or SameSite=strict + origin checks. `jose` doesn't give you this.
- **Session storage location unspecified.** SQLite lookup per request, or JWT in cookie + revocation list? Pick one and document it.

### Local mode `.env`-as-recovery

Honestly fine **for the threat model the docs imply** (single user, single trusted machine), and the README's explanation is unusually clear about it.

What it is **not** fine for:
- **Any non-trivial threat model.** If the machine is multi-user, or the `.env` is committed by accident, or the filesystem is world-readable, you've stored a plaintext credential. README should explicitly say "local mode is for single-user, single-trusted-machine use."

### The `.env.example` had corruption (now fixed)

Earlier versions of `.env.example` had `***` mid-variable producing broken config when copied. **Fixed in this revision:** see the `ENCRYPTION_KEY` and `SUPABASE_DB_URL` blocks which are now syntactically valid empty values with format documentation.

### Other

- **Open Supabase signup + BYOK + stored credentials = API key abuse vector.** Need captcha/rate limiting, otherwise this becomes a free key-validation service for attackers.
- **No CSP mentioned.** Iframes rendering untrusted LLM output need `Content-Security-Policy: sandbox` and a strict `sandbox` attribute on the iframe. `BUILD-PLAN.md` says "Render iframe with `sandbox` attribute" — good, but add the CSP.
- **`better-sqlite3` is a native module.** Coolify Dockerfile must compile against the target Node version.

**Verdict on security:** Design is reasonable, add AAD + key versioning, add rate limiting to signup.

---

## 3. The 6-day timeline

**Verdict: 8-10 days for one competent engineer, not 6.**

### Likely to take longer

- **Day 1 was already over.** Zero source code had been written when the review was done. Realistic Day 1 end state: scaffolding + schema + auth skeleton.
- **Day 2 is two days packed into one.** Six provider adapters, each with quirks. Plus credential vault UI. Realistically 2 days.
- **Day 5 lint engine is also two days.** Five lint modules + runner + UI. **Token-consistency requires injecting tokens into iframe and reading computed styles back** — genuinely tricky because generated HTML may inline its own colors. Spacing-scale has a known gotcha: `rem` values need parent font-size resolution.
- **Streaming vs wait decision** and **prompt library seeding** are punted to Day 3 but materially affect the playground UI. Decide on Day 2.

### Likely faster

- **Day 4 (history + comparison)** is mostly CRUD + two-column layout. One solid day.
- **Day 6 (share + polish + deploy)** is fine as written if Day 5 doesn't bleed in.

### What to cut to hit 6 days

- **User rating (1-5 stars)**, **notes field per run**, **run export (HTML, JSON)**, **multiple API keys per provider with labels** — all cuttable to v1.1.

### Revised timeline

- Day 1: scaffold + schema + auth + Dockerfile
- Day 2: crypto module + BYOK vault + model metadata + Anthropic + OpenAI
- Day 3: remaining adapters + provider factory + password-change UI
- Day 4: Playground UI + augmentation picker + generation loop
- Day 5: Lint engine
- Day 6: History + comparison + share-as-link
- Day 7: Polish + deploy + Coolify doc

---

## 4. The 8 v1 augmentations

### Right calls

- `shadcn-tokens` and `m3-tokens` as v1 tokens. shadcn = de-facto React tokens; M3 = de-facto mobile tokens.
- `constitution-tier-1-2` as a default principles layer.
- `none` (baseline) should ship. Without it, you can't measure the augmentation effect.
- `lint-feedback` is the most novel. Highest-ROI item. Keep.

### Issues

- **`better-design-default` is redundant with `shadcn-tokens` in v1.** Both are shadcn-derived. Verify this is genuinely different before tagging.
- **`constitution-full` adds "aesthetic dispositions"** — be honest about what that is. If it's a list of vibes, that's not an augmentation, that's an opinion. Either commit to it as "the house style" or be explicit it's opt-in subjective.

### Missing from v1

- **No "examples / few-shot" augmentation.** A `shadcn-examples` layer would likely outperform `shadcn-tokens` alone. Highest-leverage addition.
- **No prompt-only augmentation** (no tokens, no principles, just "be a good UI designer"). Useful as a control vs. `none`.

### v1.1 candidates

`tailwind-default`, `radix-colors`, `vercel-geist-tokens`, `constitution-mobile` (touch targets, safe areas, dynamic type).

---

## 5. The deterministic lint engine

### What's covered

axe-core, APCA Lc + WCAG ratio, token consistency, 8-pt grid, semantic HTML. Solid floor.

### What's missing

- **No typography check.** Generated UI almost always has type-scale problems. **The single most common design-quality issue in LLM-generated UI.**
- **No "meaningless alt" check.** Axe catches missing alt but not `alt="image"`.
- **No interaction-state check.** Hover/focus/disabled states are where LLM-generated UI most often fails.
- **No responsive sanity check.**
- **No bundle-size check.**

### On the no-VLM-judge decision

**Reasoning is sound and defensible.** VLM judging VLM on subjective aesthetics is a closed loop. Determinism is a UX feature. **Where you might leave value on the table:** opt-in human evaluation as a separate signal in v1.1.

**Verdict on lint engine:** Five modules is the right floor; six (with typography) would be the right ceiling for v1.

---

## 6. License (AGPL-3.0)

### Is it the right license?

**For what you're protecting, yes — but the data value-prop isn't actually triggered by v1.**

- AGPL protects code, not data. Prompts, generations, lint scores are not "source code."
- The leaderboard moat is not actually a moat. If someone forks and publishes a competing leaderboard, that's legal under AGPL. You compete on rubric quality, not license.
- AGPL-3.0 may inhibit adoption. Companies building on this as a vendor evaluation pipeline will avoid AGPL because it contaminates their distribution.

### Recommendation

**Keep AGPL-3.0 for v1** — changing later is annoying, your stated goal is "dataset accumulation matters." But:

1. Add `CONTRIBUTOR-LICENSE-AGREEMENT.md` for augmentation submissions.
2. Add `DATA-LICENSE.md` saying public leaderboard data is CC-BY-4.0 (or whatever).
3. Be honest in README that AGPL protects code, not data. **If data is the moat, data needs its own license.**

---

## 7. What's missing from the docs

### Bugs to fix

1. **`.env.example` corruption** — fixed in this revision
2. **`README.md` said `pnpm db:seed` after Supabase setup** — fixed (now `pnpm db:seed:supabase`)
3. **`.env.example` referenced `$SUPABASE_DB_URL`** — fixed (variable now defined)

### Missing from `BUILD-PLAN.md`

- No risk register. Top 5 risks + contingency.
- No "definition of done" for v1.
- No test strategy mapping per module.
- No a11y test plan for the app itself.

### Missing from `README.md`

- No screenshots / GIFs.
- No "what this isn't" section.
- No performance/limitations section.
- No privacy section.
- No link to the rubric spec.

### Missing from `.env.example`

- `SUPABASE_DB_URL` — added in this revision
- `ENCRYPTION_KEY` byte-length — documented in this revision
- No key rotation procedure
- No `NODE_ENV` / `LOG_LEVEL` / `PUBLIC_BASE_URL`

---

## Top 3 changes

1. **Fix `.env.example` corruption.** Done in this revision.
2. **Cut Day 1 scope, re-plan as 7-8 days.** Drop rating, notes, export, multi-key-per-provider.
3. **Add a sixth lint module: typography.** Plus `docs/rubric.md`.

---

## Overall verdict

**Build with revisions.**

The core thesis is coherent. The evidence base for no-VLM-judge is sound. Nothing in the design is fatally flawed. Everything in the docs needs a careful second pass.

---

*Review produced by GLM-5.2 (Zhipu, via Synthetic API) as a single-model review. No fan-out, no agent mixing. Document is the deliverable.*