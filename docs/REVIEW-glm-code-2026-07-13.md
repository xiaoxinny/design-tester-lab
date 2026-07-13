# Code Review: design-tester-lab

**Date:** 2026-07-13
**Reviewer:** GLM-5.2 (via Synthetic API, single model call per section)
**Scope:** Day 1 + (B) auth scaffold start
**Files reviewed:** src/db/schema-sqlite.ts, src/db/seed.ts, src/db/push.ts, src/lib/env.ts, drizzle/0000_smooth_blue_blade.sql, content/augmentations/*.md, scripts/test-env.ts, package.json, .env.example, README.md

---

## 1. SECURITY

### 1.1 AUTH_DISABLED + non-loopback guard (env.ts:117-123) -- bypass vectors

The check refuses to start the app when both AUTH_DISABLED is set and HOST is not 127.0.0.1/localhost. Three concrete bypass vectors:

1. **Unset/empty `HOST` skips the guard entirely.** The condition requires `env['HOST']` to be truthy. If HOST is unset, the guard is skipped and the app falls back to framework default 0.0.0.0. Real scenario: a containerized deployment where the operator sets AUTH_DISABLED but forgets HOST -- the authless app is now reachable on the cluster IP.

2. **`localhost` is accepted literally but resolved via the system resolver.** A malicious init container or compromised Helm hook writing `10.0.0.5 localhost` to /etc/hosts makes the app bind to a non-loopback address with auth disabled while the guard believes it approved loopback.

3. **Loopback bind is re-exposed by a tunnel/sidecar regardless of the guard.** Even when the guard succeeds, an authless instance is trivially re-published via ngrok, socat, ssh -R, a service-mesh sidecar, or kubectl port-forward. The guard's threat model assumes bind address == reachability, which breaks the moment a forwarder is introduced.

**Fix:** (a) change condition to `if (authDisabled && !isLoopbackBind(env['HOST']))` where `isLoopbackBind` returns true if HOST is unset, empty, 127.0.0.1, ::1, or localhost; (b) document the tunnel-re-exposure risk prominently; (c) keep the explicit "I_UNDERSTAND" env var for the rare intentional case.

### 1.2 ENCRYPTION_KEY == SESSION_SECRET

Reusing the same 32-byte value for AES-GCM and HMAC violates key-separation assumptions. If SESSION_SECRET leaks first (the more exposed key), the attacker simultaneously obtains the AES key and can decrypt any field-level ciphertext. Cross-protocol confusion: a signature oracle on cookies becomes a decryption oracle on encrypted payloads.

**Fix:** Reject equality with a hard validation error. Better: derive both keys from a single master via HKDF with distinct labels ("enc" / "mac") so operators configure one secret and key separation is guaranteed structurally.

### 1.3 CRLF passes `.trim()` into headers and logs (env.ts:19)

A value like `abc\r\nSet-Cookie: evil=1` passes through unchanged. Reachable sinks:

- **Set-Cookie injection** -- env-derived cookie names or APP_NAME values can plant session-fixation cookies
- **HTTP response splitting** -- redirect targets, Content-Disposition filenames
- **Log forgery** -- pino console transports don't escape CRLF; attacker-controlled values can inject fake log levels or ANSI sequences

**Fix:** In readEnv, strip \r, \n, and C0 control bytes (not just whitespace). Add charset regex per key. Ensure all header writes go through setter APIs that reject CRLF rather than string concatenation.

### 1.4 Module-level `resolvedEnv` cache (env.ts:189-200)

- **Test fail-open:** tests setting process.env.SESSION_SECRET never reach validation against the cached value, masking regressions
- **Runtime fail-open:** if an operator unsets a required secret at runtime, the cache retains the old value and the app keeps serving as if configured -- exactly wrong for fail-closed design
- **Rotation staleness:** rotated secrets are ignored until restart

**Fix:** Don't cache across calls -- re-reading process.env is nanosecond-cheap. If caching is required for perf, expose resetEnv() for tests, key the cache on a generation counter, or add a short TTL.

### 1.5 argon2id parameters

The library defaults (m=19456, t=2, p=1 -- OWASP minimum A) are correct for single-user local-mode auth. For Supabase Cloud multi-tenant, raise to OWASP minimum B (m=12288, t=3, p=1) when auth is implemented.

### 1.6 key_version column

Schema has `key_version: integer NOT NULL DEFAULT 1` on model_credentials. Good -- enables rotation. No rotation tooling yet (Day 2+).

---

## 2. SCHEMA

### 2.1 PK on (id, version) vs implicit rowid + unique index (augmentations table)

Recommendation: make `(id, version)` the explicit composite PRIMARY KEY. Collapses uniqueness and rowid index, eliminates redundant unique index. Tradeoff: any child FK into augmentations must use composite two-column FK. **Decision:** keep composite unique index for now (less surgery), document the tradeoff.

### 2.2 onDelete: 'restrict' enforcement (runs.modelCredentialId)

SQLite parses ON DELETE RESTRICT and Drizzle passes it through verbatim -- no translation. SQLite has no deferred constraint checking, so RESTRICT and NO ACTION are functionally identical there. Behavior is enforced. No change needed.

### 2.3 prompts.forkedFrom self-reference (schema-sqlite.ts:172)

The AnySQLiteColumn cast is purely a TypeScript escape hatch for the circular type. Runtime DDL Drizzle emits is a normal `FOREIGN KEY (forked_from) REFERENCES prompts(id)`. Self-reference preserved. **Verify** in generated migration: grep for `REFERENCES "prompts" ("id")` on forked_from line.

### 2.4 JSON TEXT roundtrip for conflicts_with / requires

Roundtrip is safe for arrays of primitives. Risks to guard: (a) `JSON.parse(null)` throws -- wrap reads in null check or coerce null to `[]`; (b) storing Date or BigInt objects silently loses precision -- restrict to string IDs only and validate with zod on read; (c) duplicate IDs not deduped by JSON. Add a zod schema and Drizzle custom type to centralize (de)serialization.

### 2.5 boolean columns and = 1 / = TRUE

`integer(mode:'boolean')` stores 0/1. `WHERE is_public = 1` is reliable. `WHERE is_public = TRUE` works on SQLite >= 3.23.0 (TRUE aliased to 1). Drizzle's `eq(is_public, true)` binds JS `true` as integer `1` via parameterized query. No change needed.

### 2.6 timestamp_ms with `unixepoch() * 1000`

Correct. unixepoch() returns integer seconds since 1970-01-01 UTC; * 1000 yields integer ms. Caveats: (a) unixepoch() requires SQLite >= 3.38.0 -- verify bundled driver; (b) default fires only on INSERT, not UPDATE. If any table needs updated_at, add trigger or set explicitly.

### 2.7 Missing indexes

Indexes are present and adequate per the generated migration:
- `sessions_user_idx` (sessions.userId) -- auth checks
- `runs_user_created_idx` (runs.userId, runs.createdAt) -- dashboard queries
- `runs_prompt_idx` (runs.promptId) -- fork lineage

### 2.8 PRAGMA checks

- `PRAGMA journal_mode = WAL` -- set on every connection
- `PRAGMA foreign_keys = ON` -- critical (defaults OFF)
- `PRAGMA busy_timeout` -- set to >=5000ms

push.ts sets journal_mode + foreign_keys. Good start. busy_timeout is missing -- add to src/lib/db/index.ts when it's written.

---

## 3. AUGMENTATION METADATA

### 3.1 Token-aug mutual conflicts

shadcn-tokens, m3-tokens, better-design-default each list the other two in conflicts_with, forming a complete mutual-exclusion triangle. `none` correctly has conflicts_with: [] as the baseline control.

**Dangling reference:** All three tokens augs reference `tailwind-default` in conflicts_with but no such augmentation exists among the 8. Either add a `tailwind-default` augmentation or remove the reference.

### 3.2 Constitution mutual exclusion

Both sides declared: constitution-tier-1-2 -> [constitution-full] and constitution-full -> [constitution-tier-1-2]. Symmetric. ✓

### 3.3 Behavior mutual exclusion

Both sides declared: critique-revise -> [lint-feedback] and lint-feedback -> [critique-revise]. Symmetric. ✓

### 3.4 Missing requires

All eight have requires: []. Two behaviors imply dependencies:
- critique-revise critiques its own output against the constitution -> should requires: [constitution-tier-1-2] OR [constitution-full]
- lint-feedback revises against the actual measurements tied to the rubric -> similar

Making this explicit lets the loader enforce it.

### 3.5 ID-only vs (id, version) references

ID-only is defensible for conflicts_with because conflicts are categorical ("these design systems can't coexist, any version"). For requires, version matters more. Recommendation: keep conflicts_with ID-only, but make requires version-pinned. Human decision.

### 3.6 none + behavior augs

If none is meant as a strict bare-model control, it may need to conflict with behavior augs. Currently none + critique-revise is legal but isn't "bare." Decision: leave as-is (user can opt into critique without tokens if they want).

---

## 4. PRIORITIZED CODE CHANGES

### Must-fix (security)

1. **env.ts: AUTH_DISABLED guard** -- make isLoopbackBind() handle unset/empty HOST. Currently the guard is bypassed when HOST is unset.
2. **env.ts: control-char stripper** -- add assertNoControlChars() to readEnv. Currently \r\n in middle of env values passes through.
3. **env.ts: ENCRYPTION_KEY != SESSION_SECRET check** -- reject equality. Currently copy-paste errors silently produce equal keys.

### Should-fix (correctness)

4. **augmentations/*.md: dangling tailwind-default reference** -- either add the augmentation or remove the reference from conflicts_with arrays.
5. **augmentations/*.md: requires declarations** -- add requires: [constitution-tier-1-2] (or [constitution-full]) to critique-revise and lint-feedback.
6. **schema-sqlite.ts: JSON parse safety** -- wrap read accesses with null check, validate with zod, restrict arrays to string IDs only.

### Nice-to-have (style)

7. **augmentations PK shape** -- convert augmentations to use composite PK rather than implicit rowid + unique index.
8. **schema-sqlite.ts: updated_at columns** -- add to tables that need them (none currently, but document for Day 3+ additions).
9. **env.ts: HKDF derivation** -- derive enc + mac keys from single master secret. Defer to when we have real BYOK credentials.

---

## 5. PRIORITIZED NEW DOCS TO CREATE

1. **docs/adr/0001-byok-key-handling.md** -- 3 pages. Documents BYOK handling: in-memory only, encrypted-at-rest fallback, log redaction, revocation flow. Load-bearing for any contributor touching the model-call path.

2. **docs/security/threat-model.md** -- 10 pages. Argon2id parameters, session handling, BYOK exposure surface, prompt-injection from models under evaluation, retention rules. Required reading before auth or eval changes.

3. **docs/contributing/augmentation-system.md** -- 10 pages. Pipeline (input -> augmenters -> eval cases), extension point, contract, registration, worked example. The project's core contribution surface.

4. **docs/operations/deployment.md** -- 10 pages. Self-hosting runbook: Next.js 14 standalone build, SQLite file placement + backup, Drizzle migration commands, env var matrix, AGPL source-offering obligations.

5. **docs/adr/0002-sqlite-drizzle-concurrency.md** -- 3 pages. Why SQLite (WAL, single writer) was chosen over Postgres, the concurrency ceiling, migration triggers.

6. **docs/adr/0003-evaluation-reproducibility.md** -- 3 pages. How evaluations stay reproducible: temperature pinning, seed capture, response caching keyed by (model, prompt, params).

7. **docs/contributing/agpl-and-dco.md** -- 3 pages. What AGPL means for contributors and deployers, network-use disclosure trigger.

8. **docs/contributing/testing-ai-evaluators.md** -- 3 pages. Testing without burning real API credits: recorded-response fixtures, mock adapters, snapshot tests.

---

## 6. OVERALL VERDICT

Proceed with revisions. The bones are right -- schema, augmentations, env validation, AGPL licensing. The must-fix items are small (3 control-char stripper, 4 dangling reference, 5 requires declarations, 6 equality check) and can be addressed in 1-2 hours before any further auth work. The new docs are concrete and bounded; the deployment + threat-model pair is the highest priority. After the must-fix items are resolved, proceed to (B) auth scaffold with confidence. The architecture is sound; the gaps are in execution detail.