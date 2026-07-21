/**
 * User account creation and lookup.
 *
 * The signup flow:
 * 1. Validate email + password (caller's responsibility; this module
 *    re-validates as a defense-in-depth measure).
 * 2. Hash the password with argon2id.
 * 3. Generate a UUID-like user id.
 * 4. INSERT the user.
 *
 * Email is stored lowercased for case-insensitive uniqueness on the
 * unique index. The original case is not preserved (a deliberate choice
 * to keep the lookup simple; password recovery is by email only).
 */
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/client';
import { hashPassword, MIN_PASSWORD_LENGTH, type OwaspLevel, verifyPassword, upgradeHashIfNeeded } from './password';

export class UserError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UserError';
    this.statusCode = statusCode;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateUserInput {
  email: string;
  password: string;
  owaspLevel?: OwaspLevel;
}

export interface UserRecord {
  id: string;
  email: string;
}

/**
 * Create a new user. Returns the user record on success.
 *
 * Throws UserError(400) on invalid input, UserError(409) on duplicate email.
 */
export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new UserError('email is required', 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new UserError('email is not valid', 400);
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new UserError(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400,
    );
  }

  // Generate a 16-byte user id, hex-encoded.
  const id = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(input.password, input.owaspLevel ?? 'minA');

  try {
    await getDb().run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      id,
      email,
      passwordHash,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed: users.email')) {
      throw new UserError('an account with that email already exists', 409);
    }
    throw e;
  }
  return { id, email };
}

/**
 * Look up a user by email. Returns null if not found.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const row = await getDb().get<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = ?',
    normalized,
  );
  if (!row) return null;
  return { id: row.id, email: row.email };
}

/**
 * Look up a user by id. Returns null if not found.
 */
export async function getUserById(id: string): Promise<UserRecord | null> {
  if (!id) return null;
  const row = await getDb().get<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE id = ?',
    id,
  );
  if (!row) return null;
  return { id: row.id, email: row.email };
}

/**
 * Authenticate a user by email + password. Returns the user record on
 * success, null on a bad password or unknown email.
 *
 * On a successful login, also transparently upgrades the stored hash if it
 * was made with weaker parameters than the current target.
 */
export async function authenticateUser(
  email: string,
  password: string,
  owaspLevel: OwaspLevel = 'minA',
): Promise<{ user: UserRecord; upgradedHash: string | null } | null> {
  const normalized = email.trim().toLowerCase();
  const row = await getDb().get<{ id: string; email: string; password_hash: string }>(
    'SELECT id, email, password_hash FROM users WHERE email = ?',
    normalized,
  );
  if (!row) {
    // Constant-time-ish: still hash the input password to avoid an obvious
    // timing oracle that distinguishes "email exists" from "password wrong".
    // Wrap in try/catch so a too-short password doesn't throw — a throw
    // would produce a 500 for non-existent emails vs. a 401 for existing
    // ones, creating an email-enumeration oracle.
    try {
      await hashPassword(password, owaspLevel);
    } catch {
      // We are only burning time, not validating. Discard the error.
    }
    return null;
  }
  const ok = await verifyPassword(row.password_hash, password);
  if (!ok) return null;

  // Successful login. Try to upgrade the hash if the parameters are weak.
  const upgraded = await upgradeHashIfNeeded(row.password_hash, password, owaspLevel);
  if (upgraded) {
    await getDb().run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      upgraded,
      row.id,
    );
  }
  // Update last_login_at
  await getDb().run(
    'UPDATE users SET last_login_at = ? WHERE id = ?',
    Date.now(),
    row.id,
  );
  return { user: { id: row.id, email: row.email }, upgradedHash: upgraded };
}
