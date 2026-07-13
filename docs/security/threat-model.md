# Threat model

**Status:** Living document. Update whenever a new attack surface is added.
**Last reviewed:** 2026-07-13 (Day 1 + start of (B) auth scaffold)
**Applies to:** design-tester-lab v0.1.x

## In-scope threats

### 1. Credential exposure (BYOK)

| Threat | Mitigation | Residual risk |
|---|---|---|
| Disk theft / backup leak | AES-256-GCM encryption at rest, key from env | Key-version column enables rotation; if `ENCRYPTION_KEY` leaks, all credentials are compromised. Mitigate via HSM-backed env in production. |
| Process memory dump | No mitigation possible at the OS level | Inherent to any BYOK system. Acceptable. |
| Logger leak | Stack-trace scrubber redacts 4 provider-key patterns | New provider = new pattern; missing-pattern leak possible |
| Backup / DB export | SQLite is single-file, hard to subset exfiltrate | Acceptable |
| `/proc/<pid>/environ` read | Same-user-only on Linux | Acceptable for single-user local mode |

### 2. Authentication bypass

| Threat | Mitigation | Residual risk |
|---|---|---|
| Credential stuffing (online) | Argon2id hashing (~150-300ms per attempt) | Login throttling deferred to Day 2+ |
| Session cookie theft | HttpOnly + SameSite=Lax cookies | CSRF protection deferred to Day 2 |
| `AUTH_DISABLED` + public bind | Boot-time guard refuses non-loopback bind unless explicit ack | Tunnel/sidecar bypass is documented risk; out of scope to detect |
| Password reset via forgotten env | Documented: read original password back from `.env`, or wipe DB | Single-user local mode only; not relevant in Supabase mode |
| ENCRYPTION_KEY == SESSION_SECRET | Equality check at boot; app refuses to start | Crypto separation enforces assumption |
| Short / predictable keys | ENCRYPTION_KEY must be 32 bytes; SESSION_SECRET must be ≥32 bytes | Random-quality keys require ops discipline (documented in README) |

### 3. Prompt injection via evaluated models

The app's central feature is generating UI from model output. The model output is then rendered in a sandboxed iframe for the user to inspect.

| Threat | Mitigation | Residual risk |
|---|---|---|
| Model output contains `<script>` that runs in parent frame | Iframe `sandbox` attribute: `sandbox="allow-same-origin allow-scripts"` (no `allow-top-navigation`) | Tighten further to `sandbox=""` if no JS needed in preview |
| Model output sets cookies | Iframe is sandboxed; cross-origin cookie scope is restricted | Acceptable |
| Model output exfiltrates via `fetch()` | Iframe sandbox blocks `fetch()` to non-same-origin | Acceptable |
| Model output contains `<img onerror>` calling back to attacker | CSP `img-src 'self' data:` blocks external image sources | Strict CSP enforced at the reverse-proxy layer |
| Adversarial model output designed to confuse the deterministic lint engine | The lint engine measures computed styles from a sandboxed render; adversarial output that breaks layout is correctly detected (high violation count) | Acceptable; this is the rubric working |

### 4. Local-mode-specific threats

| Threat | Mitigation | Residual risk |
|---|---|---|
| SQLite file on shared filesystem | File mode 0600 (set by app on first run) | Default umask may not enforce; document |
| `.env` file leak | Gitignored; documented as the password-recovery mechanism | If the host filesystem is compromised, attacker has both DB and key |
| Untrusted model output rendered next to the user's credentials in the same browser tab | BYOK form is on a separate route from preview | Acceptable |

### 5. Supply chain

| Threat | Mitigation | Residual risk |
|---|---|---|
| Compromised npm package | `pnpm-lock.yaml` committed; pinned versions; npm audit on CI | New CVEs in existing packages require patch |
| Compromised augmentation YAML (e.g., via repo PR) | Augmentations are app-controlled; PR review required | Augmentations inject content into model system prompt; a malicious one could exfiltrate via prompt injection. Mitigated: augmentations are versioned; published=false hides them; reviewer must opt in. |
| Compromised Drizzle migration | Migration is generated from schema, not hand-written; schema is in version control | Acceptable |

## Out-of-scope threats

The following are explicitly out of scope for v1:

- **DDoS against the app itself.** v1 is single-tenant local; rate limiting is per-user, not anti-DDoS.
- **Side-channel attacks on the model provider.** We don't run the models; we call providers. Their security is theirs.
- **Coordinated multi-user attacks.** v1 local mode is single-user. Supabase Cloud mode uses Supabase's auth and is constrained by their security model.
- **Recovery from a fully-compromised host.** Out of scope; the threat model assumes the host OS is trustworthy.

## Verification matrix

| Threat | Test | Status |
|---|---|---|
| BYOK roundtrip | `scripts/test-crypto.ts` (TODO Day 2) | — |
| Logger redaction | `scripts/test-logger-redaction.ts` (TODO Day 2) | — |
| AUTH_DISABLED guard | `scripts/test-env.ts` | ✅ 14 cases pass |
| ENCRYPTION_KEY size | `scripts/test-env.ts` | ✅ |
| ENCRYPTION_KEY != SESSION_SECRET | `scripts/test-env.ts` | ✅ |
| CRLF in env value | `scripts/test-env.ts` | ✅ |
| Augmentation dangling refs | `pnpm db:seed` + visual inspection | ✅ |
| FK constraints enforced | `PRAGMA foreign_keys = ON` in push.ts | ✅ |

## Open questions (deferred)

1. **Login throttling.** Currently nothing prevents rapid-fire login attempts. argon2id's ~200ms per attempt is the only rate limit. Add Express-rate-limit-style throttling on Day 2+ when the API routes exist.
2. **CSRF tokens.** Cookie-based sessions without CSRF tokens are vulnerable to cross-site form submission. Add a `SameSite=Lax` cookie + origin-check on state-mutating requests on Day 2+.
3. **HSTS / HTTPS-only flags.** The app is HTTP and assumes TLS at the reverse proxy. Add HSTS header when the app is in production. Document in `docs/operations/deployment.md`.
4. **Rate-limit BYOK vault endpoint.** A logged-in user who can write credentials can hammer the endpoint. Add per-user rate limit on Day 2+.
5. **Audit log.** Every credential read should be logged (without the key itself). Currently the schema has no audit log table. Day 3+.
6. **Argon2id cost parameters.** OWASP-min-A (m=19456) is fine for single-user local. For multi-tenant Supabase, raise to OWASP-min-B.

## References

- NIST SP 800-63B (digital identity guidelines)
- OWASP Authentication Cheat Sheet
- OWASP Password Storage Cheat Sheet
- RFC 9106 (Argon2)
- design-tester-lab `docs/adr/0001-byok-key-handling.md`
- design-tester-lab `docs/REVIEW-glm-5.2-2026-07-13.md`
- design-tester-lab `docs/REVIEW-glm-code-2026-07-13.md`