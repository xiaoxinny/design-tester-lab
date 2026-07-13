/**
 * POST /api/auth/logout
 *
 * Reads the session cookie and deletes the session row. Always returns
 * a clear-cookie response, even if the cookie was missing or malformed
 * (logout is idempotent).
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleLogout } from '@/lib/auth-handlers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieHeader = req.headers.get('cookie');
  const result = handleLogout(cookieHeader, {
    secure: process.env.NODE_ENV === 'production',
  });
  const res = NextResponse.json({ ok: true }, { status: 200 });
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
}