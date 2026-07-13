# Security advisories

> Status of open Dependabot alerts and the project's remediation posture.

**Last updated:** 2026-07-13

## Status

| Metric | Count |
|---|---|
| Total open alerts | 16 |
| Critical | 0 |
| High | 5 |
| Medium | 8 |
| Low | 3 |

## Affected packages

| Package | Scope | Severity profile |
|---|---|---|
| `next` | direct | 5 high, 8 medium, 3 low |

## Required remediation

All 16 alerts require a major-version upgrade from Next.js 14 to 15 (or 16). The upgrade is pending because:

- The application uses none of the affected features (Image Optimization API, middleware redirects, Server Components for HTTP deserialization, App Router i18n).
- A Next.js 15 upgrade has breaking changes that warrant a dedicated migration session
- The 16 open alerts split into: 5 high (DoS, middleware bypass, SSRF), 8 medium (XSS, cache poisoning, cache growth), 3 low (dev origin check, race condition)

## Mitigation

For local-mode deployments behind no public proxy, the residual risk is minimal — the affected code paths are in features outside the shipped scope. For Supabase Cloud mode behind Cloudflare Tunnel, configure the tunnel to vary cache key on `x-nextjs-data` and `x-nextjs-redirect` headers (mitigation noted in the upstream advisories).

## Tracking

Re-evaluate at production deployment. If on Next.js 14 at that point, schedule the 15 upgrade as a dedicated workstream.