/**
 * Model credential storage (BYOK).
 *
 * Each row in `model_credentials` holds one API key for one provider.
 * The key is stored encrypted with the project's AES-256-GCM (`crypto.ts`)
 * and only decrypted on demand at the moment a generation starts.
 *
 * Read paths that don't need the key (listing credentials, showing labels)
 * return metadata only. Read paths that DO need the key (the generation
 * runner calling the model provider) call `getDecryptedCredential()`.
 *
 * The key returned from `getDecryptedCredential()` is plaintext at the call
 * site. It should be used immediately and discarded (do not log, do not
 * store, do not serialize beyond the active request).
 */
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/client';
import { encrypt, decrypt, CryptoError } from './crypto';

export class CredentialError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CredentialError';
    this.statusCode = statusCode;
  }
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama' | 'custom';

export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'custom'];

/**
 * Metadata about a credential. Safe to return to the API client.
 */
export interface CredentialMeta {
  id: string;
  userId: string;
  provider: Provider;
  label: string;
  baseUrl: string | null;
  keyVersion: number;
  lastUsedAt: number | null;
  createdAt: number;
}

/**
 * A credential with the decrypted key. Only available to internal callers
 * that immediately use the key and discard it. Never return this shape
 * from an API route.
 */
export interface CredentialWithKey extends CredentialMeta {
  key: string;
}

export interface AddCredentialInput {
  userId: string;
  provider: Provider;
  label: string;
  key: string;
  baseUrl?: string;
  encryptionKey: Buffer;
}

/**
 * Create a new credential for a user.
 *
 * Encrypts the key with AES-256-GCM bound to (userId, credentialId). Throws
 * CredentialError(400) on invalid input.
 */
export function addCredential(input: AddCredentialInput): CredentialMeta {
  if (!input.userId) {
    throw new CredentialError('userId is required', 400);
  }
  if (!PROVIDERS.includes(input.provider)) {
    throw new CredentialError(`provider must be one of: ${PROVIDERS.join(', ')}`, 400);
  }
  const label = input.label.trim();
  if (!label) {
    throw new CredentialError('label is required', 400);
  }
  if (!input.key) {
    throw new CredentialError('key is required', 400);
  }
  // ollama and custom require a baseUrl
  if ((input.provider === 'ollama' || input.provider === 'custom') && !input.baseUrl) {
    throw new CredentialError(`provider "${input.provider}" requires a baseUrl`, 400);
  }

  const id = randomBytes(16).toString('hex');
  const { stored } = encrypt({
    key: input.encryptionKey,
    plaintext: input.key,
    userId: input.userId,
    credentialId: id,
  });

  try {
    getDb()
      .prepare(
        `INSERT INTO model_credentials
         (id, user_id, provider, label, encrypted_key, base_url, key_version)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(id, input.userId, input.provider, label, stored, input.baseUrl ?? null);
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      throw new CredentialError('a credential with that label already exists for this user', 409);
    }
    throw e;
  }

  const created = getCredentialMeta(id, input.userId);
  if (!created) {
    throw new CredentialError('credential was inserted but cannot be read back', 500);
  }
  return created;
}

/**
 * List credential metadata for a user. Does NOT return the encrypted key.
 */
export function listCredentials(userId: string): CredentialMeta[] {
  if (!userId) return [];
  const rows = getDb()
    .prepare(
      `SELECT id, user_id, provider, label, base_url, key_version, last_used_at, created_at
       FROM model_credentials
       WHERE user_id = ?
       ORDER BY created_at ASC`,
    )
    .all(userId) as Array<{
      id: string;
      user_id: string;
      provider: Provider;
      label: string;
      base_url: string | null;
      key_version: number;
      last_used_at: number | null;
      created_at: number;
    }>;
  return rows.map(rowToMeta);
}

/**
 * Get credential metadata for one row. Returns null if not found OR if
 * the row belongs to a different user (no info leak between users).
 */
export function getCredentialMeta(id: string, userId: string): CredentialMeta | null {
  if (!id || !userId) return null;
  const row = getDb()
    .prepare(
      `SELECT id, user_id, provider, label, base_url, key_version, last_used_at, created_at
       FROM model_credentials
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as
    | {
        id: string;
        user_id: string;
        provider: Provider;
        label: string;
        base_url: string | null;
        key_version: number;
        last_used_at: number | null;
        created_at: number;
      }
    | undefined;
  if (!row) return null;
  return rowToMeta(row);
}

/**
 * Get a credential and decrypt its key. Used by the generation runner.
 *
 * Throws CredentialError(404) if the row does not exist for the given user,
 * CredentialError(500) if the encryption key cannot decrypt (key rotation
 * or wrong ENCRYPTION_KEY).
 *
 * This is the ONLY function in the project that returns plaintext keys. The
 * caller is responsible for not logging, not persisting, and discarding the
 * key as soon as the generation completes.
 */
export function getDecryptedCredential(id: string, userId: string, encryptionKey: Buffer): CredentialWithKey | null {
  if (!id || !userId) return null;
  const row = getDb()
    .prepare(
      `SELECT id, user_id, provider, label, encrypted_key, base_url, key_version, last_used_at, created_at
       FROM model_credentials
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as
    | {
        id: string;
        user_id: string;
        provider: Provider;
        label: string;
        encrypted_key: string;
        base_url: string | null;
        key_version: number;
        last_used_at: number | null;
        created_at: number;
      }
    | undefined;
  if (!row) return null;
  let key: string;
  try {
    key = decrypt({
      key: encryptionKey,
      stored: row.encrypted_key,
      userId: row.user_id,
      credentialId: row.id,
    });
  } catch (e) {
    if (e instanceof CryptoError) {
      throw new CredentialError('credential decryption failed (key may be wrong or rotated)', 500);
    }
    throw e;
  }
  return {
    ...rowToMeta(row),
    key,
  };
}

/**
 * Delete a credential. Returns true if a row was removed.
 *
 * Use the userId parameter to enforce that users can only delete their own
 * credentials (no cross-user deletion).
 */
export function deleteCredential(id: string, userId: string): boolean {
  if (!id || !userId) return false;
  const info = getDb()
    .prepare('DELETE FROM model_credentials WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return info.changes > 0;
}

/**
 * Update the last_used_at timestamp for a credential. Fire-and-forget:
 * the caller does not need to handle the result.
 */
export function touchCredential(id: string, userId: string): void {
  if (!id || !userId) return;
  getDb()
    .prepare('UPDATE model_credentials SET last_used_at = ? WHERE id = ? AND user_id = ?')
    .run(Date.now(), id, userId);
}

function rowToMeta(row: {
  id: string;
  user_id: string;
  provider: Provider;
  label: string;
  base_url: string | null;
  key_version: number;
  last_used_at: number | null;
  created_at: number;
}): CredentialMeta {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    label: row.label,
    baseUrl: row.base_url,
    keyVersion: row.key_version,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}