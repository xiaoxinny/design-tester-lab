/**
 * POST /api/auth/signup
 *
 * Body: { email: string, password: string }
 * Returns 201 with { userId, email, sessionId, cookie } and a Set-Cookie
 * header. Errors: 400 (invalid input), 409 (duplicate / local-mode single
 * user), 500 (internal).
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleSignup, AuthHandlerError } from '@/lib/auth-handlers';
import { resolveEnv } from '@/lib/env';
import { getDb } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const env = resolveEnv();
  const isLocalWithDefaultUser =
    env.mode === 'local' && env.local?.defaultUser !== null && env.local?.defaultUser !== undefined;
  const hasExistingUser = (): boolean => {
    const row = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
    return row.c > 0;
  };
  try {
    const result = await handleSignup(body, {
      isLocalWithDefaultUser,
      secure: process.env.NODE_ENV === 'production',
      hasExistingUser,
    });
    const res = NextResponse.json(
      { userId: result.userId, email: result.email, sessionId: result.sessionId },
      { status: 201 },
    );
    res.cookies.set({
      name: result.cookie.name,
      value: result.cookie.value,
      httpOnly: result.cookie.httpOnly,
      secure: result.cookie.secure,
      sameSite: result.cookie.sameSite,
      path: result.cookie.path,
      expires: result.cookie.expires,
    });
    return res;
  } catch (e) {
    if (e instanceof AuthHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}