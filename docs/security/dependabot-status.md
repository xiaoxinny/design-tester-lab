# Security advisories

> Status of open Dependabot alerts and the project's remediation posture. Counts reflect the Dependabot UI snapshot as of the latest push to `pnpm-lock.yaml`.

## Status

| Metric | Count |
|---|---|
| Total open alerts | 2 |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |

The two remaining open alerts target `next` in the 16.0.0-beta.0 / 16.1.x line. The required fix is a major-version upgrade to Next.js 16.x.

## Recent remediation

The following 31 alerts were closed in the security upgrade landed alongside this status update:

- `next` 14.2.35 -> 15.5.20 closed 28 of 28 open Next.js 14.x alerts (range `< 15.5.x`). Build succeeds, all 322 tests pass.
- `diff` (jsdiff) 7.0.0 -> 8.0.4 closed the parsePatch / applyPatch DoS (GHSA-73rr-hh4g-fpgx). The direct dep is now a devDependency.
- `glob` 10.3.10 -> 10.5.0 (direct + pnpm.overrides for transitive) closed the CLI command injection via `-c/--cmd` (GHSA-5j98-mcp5-4vw2). A pnpm.overrides entry pins the version for transitive consumers.
- `postcss` 8.5.17 and `esbuild` 0.28.1 were already past the patched versions; the open alerts were stale (the Dependabot UI had not yet re-scanned after the earlier bump). The next push re-triggers the scan and the GitHub API will reflect the cleared state.

## Required remediation

The two remaining alerts both target `next` in the 16.x line. The required fix is a major-version upgrade to Next.js 16.x.

- A Next.js 16 upgrade has additional breaking changes beyond the 15 upgrade already landed (React 19 was already a precondition; the 16 line expects React 19).
- The application does not use any of the affected 16.x features (the i18n middleware bypass, the HTTP request smuggling in rewrites, the unbounded disk cache growth). Local-mode deployments behind no public proxy face minimal exposure.

## Mitigation

For local-mode deployments behind no public proxy, the risk is minimal: the affected code paths are in features outside the project scope (no middleware, no rewrites, no image optimization in the codebase). For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers (mitigation noted in the upstream advisories).

## Tracking

Re-evaluate at production deployment. If on Next.js 15 at deployment time, schedule the 16 upgrade as a dedicated workstream.

## Re-scan

These numbers reflect the GitHub Dependabot API snapshot as of the security upgrade push. A re-scan triggers on each push to `pnpm-lock.yaml`. Until then, the GitHub API returns the cached count.
