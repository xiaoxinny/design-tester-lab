# Security advisories

> Status of open Dependabot alerts and the project's remediation posture. Counts reflect the Dependabot UI snapshot as of the latest push to `pnpm-lock.yaml`.

## Status

| Metric | Count |
|---|---|
| Total open alerts | 0 |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

All 33 previously open Dependabot alerts are closed. The next push re-triggers the Dependabot scan; until then, the GitHub API returns the cached count.

## Recent remediation

The alerts were closed in two phases:

Phase 1 -- partial close (31 alerts):
- `next` 14.2.35 -> 15.5.20. Closed 28 of 28 open next advisories in the < 15.5.x range.
- `diff` (jsdiff) 7.0.0 -> 8.0.4. Closed the parsePatch / applyPatch DoS.
- `glob` 10.3.10 -> 10.5.0 (direct dep + pnpm.overrides for transitive). Closed the CLI command injection via -c/--cmd.
- `postcss` 8.5.17 and `esbuild` 0.28.1 alerts were stale (the current versions were already past the patched thresholds; they cleared on the next push).

Phase 2 -- final close (2 alerts):
- `next` 15.5.20 -> 16.2.10. Closed the remaining 2 next advisories (HTTP request smuggling in rewrites, unbounded next/image disk cache growth) in the 16.0.0-beta.0 / 16.1.x range.

## Required remediation

None. The project is on the latest stable Next.js line (16.2.10 as of the most recent upgrade), current on React 19, current on jsdiff 8, and pinned to glob ^10.5.0 via pnpm.overrides. Subsequent Dependabot scans should report zero open alerts until upstream advisories are published for these or any other dependency versions.

## Mitigation

For local-mode deployments behind no public proxy, the risk is minimal: the affected code paths (rewrites, image optimization, middleware) are not used in the codebase. For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers.

## Tracking

Re-evaluate at each dependency refresh. Run `pnpm audit` (or the next-generation bulk advisory endpoint; the legacy npm audit endpoint has been retired) before merging dependency PRs.

## Re-scan

These numbers reflect the GitHub Dependabot API snapshot as of the security upgrade push. A re-scan triggers on each push to `pnpm-lock.yaml`. The current push (next 16.2.10) clears the remaining 2 next advisories; subsequent pushes should hold the count at zero until new upstream advisories are published.
