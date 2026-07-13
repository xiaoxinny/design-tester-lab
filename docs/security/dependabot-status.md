# Security advisories

> Status of open Dependabot alerts and the project's remediation posture. Counts reflect the Dependabot UI snapshot as of the latest push to `pnpm-lock.yaml`.

## Status

| Metric | Count |
|---|---|
| Total open alerts | 33 |
| Critical | 0 |
| High | 11 |
| Medium | 16 |
| Low | 6 |

The 33 open alerts all target the `next` package (Next.js 14.x line issues that require a major-version upgrade to Next.js 15 or 16).

## Required remediation

All 33 alerts require a major-version upgrade to Next.js 15 or 16. The upgrade is blocked because:

- The application uses none of the affected features (Image Optimization API, middleware redirects, Server Components for HTTP deserialization, App Router i18n).
- A Next.js 15 upgrade has breaking changes that warrant a dedicated upgrade session
- The 33 open alerts split into: 11 high (DoS, middleware bypass, SSRF, cache key confusion, RCE via image optimization), 16 medium (XSS, cache poisoning, cache growth, request smuggling), 6 low (dev origin check, race condition, cache collisions)

## Mitigation

For local-mode deployments behind no public proxy, the risk is minimal — the affected code paths are in features outside the project scope. For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers (mitigation noted in the upstream advisories).

## Tracking

Re-evaluate at production deployment. If on Next.js 14 at deployment time, schedule the 15 upgrade as a dedicated workstream.

## Re-scan

These numbers match the most recent Dependabot UI snapshot. A re-scan triggers on the next push to `pnpm-lock.yaml`, or via the Dependabot UI's "Re-run all jobs" action. Until then, the GitHub API returns the cached count.
