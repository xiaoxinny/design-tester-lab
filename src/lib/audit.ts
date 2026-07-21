/**
 * Audit logging for security-relevant events.
 *
 * The audit_log table records what happened, when, who triggered it, and
 * what was affected. It is the forensic trail for security incidents and
 * the basis for "is this user doing anything suspicious?" queries.
 *
 * Event taxonomy (the action column):
 *
 *   Auth:
 *     login_success              user logged in
 *     login_failure_wrong_password  email matched, password did not
 *     login_failure_unknown_email   no user with that email
 *     login_failure_short_password invalid password format
 *     logout                     user logged out
 *     session_expired            getSession returned null for a real id
 *     signup_success             new user created
 *     signup_failure_duplicate   email already in use
 *
 *   Credentials:
 *     credential_added           a new BYOK credential was stored
 *     credential_used            the decrypted key was read for a generation
 *     credential_deleted         a credential was removed
 *     credential_decryption_failed  decrypt failed at use time
 *
 *   General:
 *     auth_disabled_used         AUTH_DISABLED was honored (development)
 *     rate_limited               (future) request rate limit hit
 *
 * The metadata field carries request id, ip address fragment, or any other
 * small context. Never include the credential itself, the password, or
 * any other secret.
 *
 * Failure mode: logEvent catches its own errors and writes them to console.
 * Audit logging must NEVER cause the calling code path to fail. If the
 * audit table is missing or the DB is locked, the user-facing operation
 * succeeds and the audit gap is logged.
 */
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/client';

export type AuditAction =
  | 'login_success'
  | 'login_failure_wrong_password'
  | 'login_failure_unknown_email'
  | 'login_failure_short_password'
  | 'logout'
  | 'session_expired'
  | 'signup_success'
  | 'signup_failure_duplicate'
  | 'credential_added'
  | 'credential_used'
  | 'credential_deleted'
  | 'credential_decryption_failed'
  | 'auth_disabled_used'
  | 'rate_limited';

export interface LogEventInput {
  /** User who triggered the event. Null when the event has no associated user (e.g. unknown-email login attempt). */
  userId: string | null;
  /** Event verb in snake_case. See the AuditAction type for the canonical list. */
  action: AuditAction;
  /** What kind of thing was affected. e.g. "credential", "user", "session". */
  targetType?: string;
  /** The id of the affected thing. e.g. the credential id, the session id. */
  targetId?: string;
  /** Free-form context. Must not contain credentials, passwords, or keys. */
  metadata?: Record<string, unknown>;
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Write an audit event. Errors are swallowed (logged to stderr) so that
 * audit logging never breaks the calling code path. The audit gap should
 * be visible in the application's logs but not in the user response.
 *
 * Async to match the underlying DbClient; callers in synchronous code paths
 * should `await logEvent(...)` to be sure the row landed before the
 * request returns.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const id = randomBytes(16).toString('hex');
    const metadataJson = input.metadata !== undefined ? JSON.stringify(input.metadata) : null;
    await getDb().run(
      `INSERT INTO audit_log (id, user_id, action, target_type, target_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      input.userId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      metadataJson,
    );
  } catch (e) {
    // Audit must never break the calling code path. Log enough to identify
    // which event failed (action + targetId) but NOT the full input —
    // metadata may contain user identifiers or other sensitive context.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to log event:', e, 'action:', input.action, 'targetId:', input.targetId);
  }
}

interface AuditRowRaw {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string | null;
  created_at: number;
}

/**
 * Read recent audit events for one user. Admin read (cross-user) is
 * intentionally not implemented — the calling layer must enforce that
 * a user only sees their own events.
 */
export async function readEvents(opts: { userId: string; limit?: number }): Promise<AuditLogRow[]> {
  if (!opts.userId) {
    throw new Error('readEvents requires userId');
  }
  const limit = Math.min(opts.limit ?? 100, 1000);
  const rows = await getDb().all<AuditRowRaw>(
    `SELECT id, user_id, action, target_type, target_id, metadata, created_at
     FROM audit_log
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    opts.userId,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata !== null ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}
