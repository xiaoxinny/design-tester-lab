/**
 * Argon2id password hashing.
 *
 * Output format: standard PHC-string ($argon2id$v=19$m=...,t=...,p=...$salt$hash).
 * The hash contains all parameters, so verification re-derives them from the
 * stored value. Cost parameters can be changed later — the new hash uses the
 * new parameters, and the old hash still verifies until the user re-hashes.
 *
 * Cost parameters:
 * - Default (OWASP-min-A, single-user local): m=19456 KiB, t=2, p=1
 * - OWASP-min-B (multi-tenant, e.g. Supabase Cloud): m=7168 KiB, t=5, p=1
 *   Set via PASSWORD_OWASP_LEVEL=minB in env to upgrade.
 *
 * References:
 * - OWASP Password Storage Cheat Sheet (2024): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 * - RFC 9106 (Argon2 standardization): https://www.rfc-editor.org/rfc/rfc9106.html
 * - docs/security/threat-model.md (project-level decision)
 */
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

// Use string literals for algorithm/version instead of importing the const
// enums; tsconfig uses isolatedModules which forbids ambient const enums.
const ARGON2ID = 2;
const VERSION_0x13 = 1;

export type OwaspLevel = 'minA' | 'minB';

interface CostParams {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

const OWASP_MIN_A: CostParams = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const OWASP_MIN_B: CostParams = { memoryCost: 7168, timeCost: 5, parallelism: 1 };

export const MIN_PASSWORD_LENGTH = 8;

export class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordError';
  }
}

/**
 * Hash a plaintext password with the configured cost parameters.
 *
 * Returns a PHC string suitable for storage in the `users.password_hash` column.
 *
 * Throws PasswordError if the password is too short (caller's responsibility
 * to surface a friendlier error at the API layer).
 */
export async function hashPassword(
  password: string,
  level: OwaspLevel = 'minA',
): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordError(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length})`,
    );
  }
  const params = level === 'minB' ? OWASP_MIN_B : OWASP_MIN_A;
  try {
    return await argonHash(password, {
      algorithm: ARGON2ID,
      version: VERSION_0x13,
      ...params,
    });
  } catch (e) {
    throw new PasswordError(`password hashing failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Verify a plaintext password against a stored PHC string.
 *
 * Returns true on match, false on mismatch. Does NOT throw on a bad password
 * (returns false). Throws PasswordError only on internal errors (malformed
 * stored hash, library error).
 *
 * The verify call uses constant-time comparison; the boolean return is
 * not itself a timing oracle (both true and false take roughly the same
 * time, dominated by the hash recomputation).
 */
export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  if (!stored || !password) return false;
  if (!stored.startsWith('$argon2id$')) {
    throw new PasswordError('stored hash is not an argon2id PHC string');
  }
  try {
    return await argonVerify(stored, password);
  } catch (e) {
    // @node-rs/argon2 throws on a malformed stored hash, not on a wrong
    // password (wrong password returns false). Convert that to an error
    // so the caller can distinguish.
    throw new PasswordError(`password verification failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Re-hash if the stored hash was made with weaker parameters than the
 * currently-configured level.
 *
 * Returns the new hash if re-hashing is needed, or null if the existing
 * hash is already at the target level. Use this in the login flow to
 * transparently upgrade password hashes when users log in.
 */
export async function upgradeHashIfNeeded(
  stored: string,
  password: string,
  level: OwaspLevel = 'minA',
): Promise<string | null> {
  // The PHC string embeds the parameters, so we can extract them.
  // Format: $argon2id$v=19$m=19456,t=2,p=1$salt$hash
  const match = stored.match(/^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/);
  if (!match) return null;
  const [, storedM, storedT, storedP] = match;
  if (!storedM || !storedT || !storedP) return null;
  const target = level === 'minB' ? OWASP_MIN_B : OWASP_MIN_A;
  // Upgrade if any parameter is weaker than target.
  if (
    Number(storedM) < target.memoryCost ||
    Number(storedT) < target.timeCost ||
    Number(storedP) < target.parallelism
  ) {
    return await hashPassword(password, level);
  }
  return null;
}
