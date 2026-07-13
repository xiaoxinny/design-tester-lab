# Security advisories

> Status of open Dependabot alerts and the project's remediation posture. Numbers reflect the most recent re-scan of `pnpm-lock.yaml` by GitHub Dependabot; counts may be stale until the next push event triggers a re-scan.

## Status

| Metric | Count (as of last re-scan) |
|---|---|
| Total open alerts | 16 |
| Critical | 0 |
| High | 5 |
| Medium | 8 |
| Low | 3 |

> The GitHub Dependabot UI may show a different count (for example, 33 or 58) immediately after a push. Dependabot's re-scan runs on its own schedule; the values above reflect the alerts that match the lockfile at the time the last re-scan completed.

## Affected packages

| Package | Scope | Severity profile |
|---|---|---|
| `next` | direct | 5 high, 8 medium, 3 low |

## Required remediation

All 16 alerts match the current `pnpm-lock.yaml` and require a major-version upgrade to Next.js 15 or 16. The upgrade is blocked because:

- The application uses none of the affected features (Image Optimization API, middleware redirects, Server Components for HTTP deserialization, App Router i18n).
- A Next.js 15 upgrade has breaking changes that warrant a dedicated upgrade session
- The 16 open alerts split into: 5 high (DoS, middleware bypass, SSRF), 8 medium (XSS, cache poisoning, cache growth), 3 low (dev origin check, race condition)

## Mitigation

For local-mode deployments behind no public proxy, the risk is minimal — the affected code paths are in features outside the project scope. For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers (mitigation noted in the upstream advisories).

## Tracking

Re-evaluate at production deployment. If on Next.js 14 at deployment time, schedule the 15 upgrade as a dedicated workstream.

## Re-scan

The numbers above are derived from a one-time `pnpm audit --prod` after the dep upgrade in commit `752392f`. To trigger a fresh Dependabot re-scan: push any change to `pnpm-lock.yaml`, or use the Dependabot UI's "Re-run all jobs" action. The doc will be reconciled on the next re-scan.
