# ADR 0001: BYOK key handling

**Status:** Accepted
**Date:** 2026-07-13
**Deciders:** Project maintainers
**Supersedes:** None

## Context

design-tester-lab lets users evaluate AI models on UI generation. Each user brings their own API keys (Anthropic, OpenAI, Google, OpenRouter, Ollama, etc.) — the app never has its own model account. This makes BYOK (Bring Your Own Key) the project's central trust contract.

The question: where do user-supplied keys live, in what form, and under what threat model?

## Decision

### Storage

**In-memory only by default. Optional encrypted-at-rest fallback.**

- **Default (in-memory):** The user's API key is decrypted from the `model_credentials.encrypted_key` field at the moment a generation is initiated, held in process memory for the duration of that one call, and discarded when the response stream closes. Never written to logs, never serialized, never returned to the client after initial save.
- **Optional (per-session prompt):** A "high-value account" flag that prompts for the key per-session rather than storing it. Eliminates the at-rest encryption problem at the cost of UX.

### Encryption (at-rest fallback)

When the user saves a key via the BYOK form:

- AES-256-GCM with a **per-row 96-bit random IV** stored alongside ciphertext
- **AAD** = `user_id:credential_id` so swapped-credential attacks fail the auth tag
- `key_version` column on `model_credentials` table enables rotation without downtime (multi-version decryption reads the active key_version first, then earlier versions)
- Master key from `ENCRYPTION_KEY` env var (32-byte base64); app refuses to start if missing, wrong size, or equal to `SESSION_SECRET` (key-separation requirement)

### Memory handling

- Process memory is the unavoidable risk surface for any BYOK system; this is an inherent constraint
- Node lacks reliable zeroization; the system makes no claim of zeroization.
- The app **never logs the key**, never writes it to error reports, never includes it in crash dumps
- Stack traces are scrubbed at the logger boundary to redact anything matching `sk-[A-Za-z0-9]{20,}` / `sk-ant-[A-Za-z0-9-]{20,}` / `AIza[0-9A-Za-z_-]{35}` / `gsk_[A-Za-z0-9]{20,}` patterns (full list in this section)

### Transport

- HTTPS only (enforced at the reverse-proxy / Cloudflare Tunnel layer; the app itself is HTTP and assumes TLS termination upstream)
- Keys are POSTed once during the BYOK setup flow and never returned to the client
- Server-side proxy: the app calls the model provider from the server, **never from the browser**. This is a hard architectural choice because browser-side calls expose the key in DevTools.

### Revocation

- User can delete a credential at any time; the row is hard-deleted (no soft-delete)
- Active generations using a deleted credential continue to completion (their model call is in-flight)
- Subsequent generations using that credential fail with a clear "credential deleted" error
- This matches AWS / GCP / Vercel credential-revocation UX

### Alternatives considered

- **Client-side direct calls to model providers.** Exposes the key in browser DevTools.
- **Storing keys in plaintext on disk.** A single disk-encryption layer away from compromise.
- **Reversible encryption (deterministic IVs).** Defeats the point of encryption.
- **Sharing keys across users.** No multi-tenant key pooling. Each user's keys are theirs alone.
- **Asking users to enter their key on every generation.** Friction, encourages writing down. Not adopted for the default flow.

## Consequences

Positive:
- User keys are never in a place where a casual disk inspection finds them
- Key separation from session secrets limits blast radius if one leaks
- The threat model is small and documented; reviewers can reason about it

Negative:
- A memory-dump attack against the Node process yields keys for active generations. Acceptable because this is true of every BYOK system, but it is not zero.
- Key rotation requires re-encrypting every stored credential. The `key_version` column + a one-shot migration script handles this, but it's operational work.

## Verification

To verify the BYOK path is correctly implemented, check:

- `src/lib/crypto.ts` uses `crypto.createCipheriv('aes-256-gcm', key, iv)` with a fresh IV per encrypt
- AAD parameter is set to `Buffer.from(`${userId}:${credentialId}`)` (or equivalent) on both encrypt and decrypt
- The logger has a `redact` hook that scrubs the four provider-key patterns listed in this section
- `db:verify` includes a roundtrip test: encrypt a known string, decrypt it, assert deep-equal
- A negative test: encrypt a credential, modify one byte of the ciphertext, expect decrypt to throw

## References

- OWASP Password Storage Cheat Sheet (for related-but-different context)
- NIST SP 800-38D (AES-GCM specification)
- RFC 9106 (Argon2 standardization)
- design-tester-lab `docs/security/threat-model.md` (companion document)
- design-tester-lab `docs/research/09-adversarial-review-v2.md` (the VLM-judge question)