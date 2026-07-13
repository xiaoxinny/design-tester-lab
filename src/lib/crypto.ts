/**
 * AES-256-GCM encryption for credential storage.
 *
 * Storage format: `<iv_b64>:<ct_b64>:<tag_b64>` (each component base64, separated by ':').
 *
 * AAD (Additional Authenticated Data): `userId:credentialId`. Using the same
 * ciphertext with a different (userId, credentialId) pair will fail the
 * authentication tag check, so a swapped-credential attack is detected.
 *
 * The Node `crypto` module returns the auth tag as a separate buffer; it is
 * concatenated here for storage and split on read.
 *
 * The key parameter is a 32-byte buffer. Key rotation is supported by the
 * `keyVersion` column on `model_credentials`; the caller passes the key for the
 * version that was used to encrypt the row.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit IV is the standard for GCM
const KEY_BYTES = 32; // AES-256
const AUTH_TAG_BYTES = 16;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export interface EncryptInput {
  key: Buffer;
  plaintext: string;
  userId: string;
  credentialId: string;
}

export interface EncryptResult {
  stored: string; // `<iv_b64>:<ct_b64>:<tag_b64>`
  ivB64: string;
  ctB64: string;
  tagB64: string;
}

export interface DecryptInput {
  key: Buffer;
  stored: string;
  userId: string;
  credentialId: string;
}

/**
 * Encrypt a plaintext credential with AES-256-GCM.
 *
 * AAD binds the ciphertext to the (userId, credentialId) pair. A row
 * moved between rows will fail to decrypt; this is the protection against
 * the swapped-ciphertext attack.
 */
export function encrypt(input: EncryptInput): EncryptResult {
  if (input.key.length !== KEY_BYTES) {
    throw new CryptoError(
      `encryption key must be ${KEY_BYTES} bytes (got ${input.key.length})`,
    );
  }
  if (input.plaintext.length === 0) {
    throw new CryptoError('plaintext must be non-empty');
  }
  if (input.userId.length === 0 || input.credentialId.length === 0) {
    throw new CryptoError('userId and credentialId must be non-empty (AAD binding)');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, input.key, iv);
  cipher.setAAD(Buffer.from(`${input.userId}:${input.credentialId}`, 'utf8'));
  const ct = Buffer.concat([cipher.update(input.plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const ivB64 = iv.toString('base64');
  const ctB64 = ct.toString('base64');
  const tagB64 = tag.toString('base64');
  return {
    stored: `${ivB64}:${ctB64}:${tagB64}`,
    ivB64,
    ctB64,
    tagB64,
  };
}

/**
 * Decrypt a credential that was encrypted with `encrypt`.
 *
 * Throws CryptoError on any tampering — wrong key, modified ciphertext,
 * wrong AAD binding, or malformed storage format. The error message does
 * not distinguish between these cases (deliberate) so an attacker cannot
 * use the error to learn which field is wrong.
 */
export function decrypt(input: DecryptInput): string {
  if (input.key.length !== KEY_BYTES) {
    throw new CryptoError(
      `encryption key must be ${KEY_BYTES} bytes (got ${input.key.length})`,
    );
  }
  const parts = input.stored.split(':');
  if (parts.length !== 3) {
    throw new CryptoError('stored ciphertext is malformed');
  }
  const ivB64 = parts[0]!;
  const ctB64 = parts[1]!;
  const tagB64 = parts[2]!;
  let iv: Buffer;
  let ct: Buffer;
  let tag: Buffer;
  try {
    iv = Buffer.from(ivB64, 'base64');
    ct = Buffer.from(ctB64, 'base64');
    tag = Buffer.from(tagB64, 'base64');
  } catch {
    throw new CryptoError('stored ciphertext is malformed');
  }
  if (iv.length !== IV_BYTES) {
    throw new CryptoError('stored ciphertext is malformed');
  }
  if (tag.length !== AUTH_TAG_BYTES) {
    throw new CryptoError('stored ciphertext is malformed');
  }

  const decipher = createDecipheriv(ALGORITHM, input.key, iv);
  decipher.setAAD(Buffer.from(`${input.userId}:${input.credentialId}`, 'utf8'));
  decipher.setAuthTag(tag);

  // Combine the ciphertext and auth-tag verification in one step. If the
  // AAD is wrong, the key is wrong, or the ciphertext/tag is tampered,
  // `decipher.final()` throws. The exact reason is not exposed in the
  // thrown error to keep the failure mode uninformative to attackers.
  let pt: Buffer;
  try {
    pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    throw new CryptoError('decryption failed (wrong key, tampered ciphertext, or wrong AAD binding)');
  }
  return pt.toString('utf8');
}

/**
 * Constant-time comparison helper. Useful for callers that need to compare
 * two ciphertexts without timing leakage (e.g. when matching a token in
 * a constant-time authentication flow).
 */
export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const CRYPTO_CONSTANTS = {
  ALGORITHM,
  IV_BYTES,
  KEY_BYTES,
  AUTH_TAG_BYTES,
} as const;
