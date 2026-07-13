# ADR 0001: BYOK key handling

**Status:** Accepted
**Date:** 2026-07-13
**Deciders:** Yi Jiaxin, design-tester-lab maintainers
**Supersedes:** None

## Context

design-tester-lab lets users evaluate AI models on UI generation. Each user brings their own API keys (Anthropic, OpenAI, Google, OpenRouter, Ollama, MiniMax-M3, etc.) — the app never has its own model account. This makes BYOK (Bring Your Own Key) the project's central trust contract.

The question: where do user-supplied keys live, in what form, and under what threat model?

## Decision

### Storage

**In-memory only by default. Optional encrypted-at-rest fallback.**

- **Phase 1 (in-memory, the default):** The user's API key is decrypted from the `model_credentials.encrypted_key` field at the moment a generation is initiated, held in process memory for the duration of that one call, and discarded when the response stream closes. Never written to logs, never serialized, never returned to the client after initial save.
- **Phase 2 (optional, future):** A "high-value account" flag that prompts for the key per-session instead of storing it. Removes the at-rest encryption problem entirely at the cost of UX.

### Encryption (Phase 1 at-rest fallback)

When the user saves a key via the BYOK form:

- AES-256-GCM with a **per-row 96-bit random IV** stored alongside ciphertext
- **AAD** = `user_id:credential_id` so swapped-credential attacks fail the auth tag
- **key_version** column on `model_credentials` table enables rotation without downtime (multi-version decryption reads current key_version first, falls back to older versions)
- Master key from `ENCRYPTION_KEY` env var (32-byte base64); app refuses to start if missing, wrong size, or equal to `SESSION_SECRET` (key-separation requirement)

### Memory handling

- Process memory is the unavoidable risk surface for any BYOK system; this is not a defect
- Node does not allow reliable zeroization, so we do **not** pretend to offer it
- The app **never logs the key**, never writes it to error reports, never includes it in crash dumps
- Stack traces are scrubbed at the logger boundary to redact anything matching `sk-[A-Za-z0-9]{20,}` / `sk-ant-[A-Za-z0-9-]{20,}` / `AIza[0-9A-Za-z_-]{35}` / `gsk_[A-Za-z0-9]{20,}` patterns

### Transport

- HTTPS only (enforced at the reverse-proxy / Cloudflare Tunnel layer; the app itself is HTTP and assumes TLS termination upstream)
- Keys are POSTed once during the BYOK setup flow and never sent to the client again
- Server-side proxy: the app calls the model provider from the server, **never from the browser**. This is a hard architectural choice because browser-side calls would expose the key in DevTools.

### Revocation

- User can delete a credential at any time; the row is hard-deleted (no soft-delete)
- Active generations using a deleted credential continue to completion (their model call is in-flight)
- New generations using that credential fail with a clear "credential deleted" error
- This matches AWS / GCP / Vercel credential-revocation UX

### What we explicitly rejected

- **Client-side direct calls to model providers.** Would expose the key in browser DevTools. Rejected.
- **Storing keys in plaintext on disk.** Single-disk-encryption-away from compromise. Rejected.
- **Reversible encryption (deterministic IVs).** Defeats the point of encryption. Rejected.
- **Sharing keys across users.** No multi-tenant key pooling. Each user's keys are theirs alone.
- **Asking users to enter their key on every generation.** Friction, encourages writing down. Rejected for the default flow.

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

- `src/lib/crypto.ts` (or its successor) uses `crypto.createCipheriv('aes-256-gcm', key, iv)` with a fresh IV per encrypt
- AAD parameter is set to `Buffer.from(`${userId}:${credentialId}`)` (or equivalent) on both encrypt and decrypt
- The logger has a `redact` hook that scrubs the four provider-key patterns above
- `db:verify` includes a roundtrip test: encrypt a known string, decrypt it, assert deep-equal
- A negative test: encrypt a credential, modify one byte of the ciphertext, expect decrypt to throw

## References

- OWASP Password Storage Cheat Sheet (for related-but-different context)
- NIST SP 800-38D (AES-GCM specification)
- RFC 9106 (Argon2 standardization)
- design-tester-lab `docs/security/threat-model.md` (companion document)
- design-tester-lab `docs/research/09-adversarial-review-v2.md` (the original VLM-judge question)