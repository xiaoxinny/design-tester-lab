/**
 * Cookie parsing utilities.
 *
 * Shared between auth-guard (reads cookies) and auth-handlers (parses logout
 * cookie to find session id). One canonical implementation; don't duplicate.
 */
import { SESSION_COOKIE_NAME } from './session';

/**
 * Extract the session id from a Cookie header value.
 *
 * Returns the session id (32-byte hex) or null if the cookie header is
 * absent, malformed, or has a value with the wrong format.
 *
 * The format check is case-sensitive: session ids are uniformly lowercase
 * (generated from `randomBytes(32).toString('hex')`), and the SQLite
 * primary-key lookup is also case-sensitive. Accepting an uppercased
 * id here would silently fail the DB lookup, producing unexplained
 * auth failures.
 */
export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(eq + 1).trim();
    if (!/^[a-f0-9]{64}$/.test(value)) return null;
    return value;
  }
  return null;
}