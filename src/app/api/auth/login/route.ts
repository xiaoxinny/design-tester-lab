/**
 * POST /api/auth/login
 *
 * Body: { email: string, password: string }
 * Returns 200 with { userId, email, sessionId, cookie } and Set-Cookie
 * header. Errors: 400 (invalid input), 401 (invalid credentials).
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleLogin, AuthHandlerError } from '@/lib/auth-handlers';
import { applyRateLimit } from '@/lib/rate-limit-http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit by client IP. The threat model assumes the app is behind a
  // reverse proxy that sets x-forwarded-for. Without that, all requests
  // share the 'unknown' bucket and the limit applies globally.
  const limited = applyRateLimit(req, 'auth.login');
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  try {
    const result = await handleLogin(body, {
      secure: process.env.NODE_ENV === 'production',
    });
    const res = NextResponse.json(
      { userId: result.userId, email: result.email, sessionId: result.sessionId },
      { status: 200 },
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
