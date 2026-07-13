# Security advisories

> Auto-generated reference of remaining open Dependabot alerts and their remediation status.

**Last updated:** 2026-07-13

## Summary

| Metric | Initial | Current |
|---|---|---|
| Total alerts | 58 | 16 |
| Critical | 4 | 0 |
| High | 18 | 5 |
| Medium | 26 | 8 |
| Low | 10 | 3 |

## What was fixed in commit 752392f

| Package | Old | New | Alerts cleared |
|---|---|---|---|
| `next` | 14.2.20 | 14.2.35 | 30 (down to 16) |
| `drizzle-orm` | 0.36.4 | 0.45.2 | 2 (SQL injection via `sql.identifier()` and `sql.as()` escaping) |
| `drizzle-kit` | 0.30.1 | 0.31.10 | follows drizzle-orm |
| `vitest` | 2.1.9 | 4.1.10 | 2 (critical, CVE-2026-47429 — file read/exec on UI server exposure) |
| `vite` | 5.4.21 (transitive) | 7.3.6 (direct) | 3 (transitive — required for vitest 4 peer dep) |
| `diff` | 7.0.0 | 8.0.3 | 2 (DoS in parsePatch + ReDoS) |
| `glob` | (transitive) | 11.1.0 | 1 (command injection via -c flag) |
| `esbuild` | (transitive) | 0.25+ | 1 (dev server request forgery) |
| `postcss` | (transitive) | 8.5.10 | 1 (XSS via unescaped `</style>`) |

## Remaining 16 (all Next.js, require Next.js 15+)

These require a major-version upgrade from Next.js 14 to 15 (or 16). Deferred to Day 6 alongside deployment prep because:

- The app doesn't yet use any of the affected features (Image Optimization API, middleware redirects, Server Components for HTTP deserialization, App Router i18n)
- A Next.js 15 upgrade has breaking changes that warrant a dedicated migration session
- The remaining 16 are split into: 5 high (DoS, middleware bypass, SSRF), 8 medium (XSS, cache poisoning, cache growth), 3 low (dev origin check, race condition)

### Mitigation in the meantime

For local-mode deployments behind no public proxy, the residual risk is minimal — the affected code paths are in features we don't use. For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers (mitigation noted in the upstream advisories).

### Tracking

Re-evaluate at the start of Day 6 (deployment prep). If still on Next.js 14 by then, schedule the 15 upgrade as a dedicated workstream.