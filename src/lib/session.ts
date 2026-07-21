/**
 * Session management.
 *
 * Sessions live in the `sessions` table (see src/db/schema-sqlite.ts). The
 * session id is a 32-byte random hex string, used directly as the cookie
 * value. Sessions expire after a fixed duration (default 7 days). The cookie
 * attributes (HttpOnly, Secure, SameSite=Lax) are set at the API-route
 * layer; this module is transport-agnostic.
 *
 * Design notes:
 * - Session lookup is a single SQL query. The session id is the lookup key.
 * - The session id is generated with crypto.randomBytes(32) — uniform random.
 * - Expiry is enforced in the SELECT (WHERE expires_at > now) so deleted or
 *   expired rows are not returned to the caller.
 * - The cookie value is the session id verbatim; the API route layer is
 *   responsible for setting HttpOnly/Secure/SameSite on the response.
 *
 * All public functions are async because the underlying DbClient is async
 * (Postgres-backed in ONLINE_MODE; the SQLite impl is also exposed as async
 * for interface uniformity).
 */
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/client';

const SESSION_BYTES = 32; // 256 bits of entropy
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export interface CreateSessionInput {
  userId: string;
  ttlMs?: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface CookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  path: '/';
  expires: Date;
}

/**
 * Create a new session for a user. Returns the session record including the
 * id (used as the cookie value) and the cookie attributes the API route
 * should set on the Set-Cookie response header.
 */
export async function createSession(input: CreateSessionInput): Promise<{
  session: SessionRecord;
  cookie: CookieAttributes;
}> {
  if (!input.userId) throw new SessionError('userId must be non-empty');
  const id = randomBytes(SESSION_BYTES).toString('hex');
  const now = Date.now();
  const expiresAt = now + (input.ttlMs ?? SESSION_TTL_MS);
  await getDb().run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    id,
    input.userId,
    expiresAt,
    now,
  );
  return {
    session: { id, userId: input.userId, expiresAt, createdAt: now },
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      expires: new Date(expiresAt),
    },
  };
}

/**
 * Look up a session by id. Returns the session record if it exists and is
 * not expired. Returns null otherwise.
 */
export async function getSession(id: string): Promise<SessionRecord | null> {
  if (!id) return null;
  const row = await getDb().get<{
    id: string;
    user_id: string;
    expires_at: number;
    created_at: number;
  }>(
    `SELECT id, user_id, expires_at, created_at
     FROM sessions
     WHERE id = ? AND expires_at > ?`,
    id,
    Date.now(),
  );
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Delete a session by id. Returns true if a row was removed, false if the
 * session did not exist.
 */
export async function deleteSession(id: string): Promise<boolean> {
  if (!id) return false;
  const info = await getDb().run(`DELETE FROM sessions WHERE id = ?`, id);
  return info.changes > 0;
}

/**
 * Delete all sessions for a user. Used at logout-everywhere flows (not yet
 * wired into the API; available for future use).
 */
export async function deleteSessionsForUser(userId: string): Promise<number> {
  if (!userId) return 0;
  const info = await getDb().run(
    `DELETE FROM sessions WHERE user_id = ?`,
    userId,
  );
  return info.changes;
}

export const SESSION_COOKIE_NAME = 'design_tester_lab_session';

export const SESSION_CONFIG = {
  SESSION_BYTES,
  SESSION_TTL_MS,
  COOKIE_NAME: SESSION_COOKIE_NAME,
} as const;
