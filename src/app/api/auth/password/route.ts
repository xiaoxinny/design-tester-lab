/**
 * PATCH /api/auth/password
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Requires an authenticated session. Verifies the user's current password
 * against the stored argon2id hash, then re-hashes with the same OWASP level
 * used at signup (minA by default) and persists the new hash.
 *
 * Errors:
 *   401 - unauthenticated (handled by requireUser -> AuthError)
 *   400 - invalid input / password too short
 *   403 - incorrect current password
 *   403 - incorrect current password, or user record missing (collapsed to 403 to avoid user-existence oracle)
 *   429 - rate limited (per-IP preauth + per-user postauth)
 *   500 - internal (e.g. malformed stored hash)
 */
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db/client';
import { requireUser, AuthError } from '@/lib/auth-guard';
import { resolveEnv } from '@/lib/env';
import { deleteSessionsForUser, SESSION_COOKIE_NAME } from '@/lib/session';
import {
  applyPreAuthRateLimit,
  applyRateLimit,
} from '@/lib/rate-limit-http';
import {
  hashPassword,
  verifyPassword,
  PasswordError,
  MIN_PASSWORD_LENGTH,
} from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // Pre-auth throttling (per-IP). Per-user throttle runs after auth so we
  // can key on userId.
  const preAuthLimited = applyPreAuthRateLimit(req);
  if (preAuthLimited) return preAuthLimited;

  const env = resolveEnv();
  let user;
  try {
    user = await requireUser({
      authDisabled: env.authDisabled,
      cookieHeader: req.headers.get('cookie'),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }

  const userLimited = applyRateLimit(req, 'auth.password', user.userId);
  if (userLimited) return userLimited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const currentPassword =
    typeof body === 'object' && body !== null && 'currentPassword' in body
      ? (body as { currentPassword: unknown }).currentPassword
      : undefined;
  const newPassword =
    typeof body === 'object' && body !== null && 'newPassword' in body
      ? (body as { newPassword: unknown }).newPassword
      : undefined;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required' },
      { status: 400 },
    );
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `new password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const db = getDb();
  const row = await db.get<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE id = ?',
    user.userId,
  );

  // Treat a missing user as "wrong current password" rather than 404, so
  // a deleted/inconsistent account doesn't leak that the user existed.
  if (!row) {
    // Burn roughly the same time as a verify call so the response time
    // doesn't differ observably from a "wrong password" case.
    try {
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        currentPassword,
      );
    } catch {
      // ignore
    }
    return NextResponse.json(
      { error: 'incorrect current password' },
      { status: 403 },
    );
  }

  let valid = false;
  try {
    valid = await verifyPassword(row.password_hash, currentPassword);
  } catch (e) {
    if (e instanceof PasswordError) {
      // Malformed stored hash — treat as 500, surface the underlying issue.
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    throw e;
  }
  if (!valid) {
    return NextResponse.json(
      { error: 'incorrect current password' },
      { status: 403 },
    );
  }

  let newHash: string;
  try {
    newHash = await hashPassword(newPassword, 'minA');
  } catch (e) {
    if (e instanceof PasswordError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  await db.run(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    newHash,
    row.id,
  );

  // Invalidate all existing sessions so stolen cookies are revoked
  await deleteSessionsForUser(row.id);

  return NextResponse.json({ ok: true });
}
