/**
 * Authentication guard for server routes.
 *
 * Reads the session cookie from a request, looks up the session in the DB,
 * and returns the authenticated userId. Throws if the request is
 * unauthenticated and the route requires auth.
 *
 * Usage in a Next.js API route:
 *
 *   import { requireUser } from '@/lib/auth-guard';
 *
 *   export async function POST(req: NextRequest) {
 *     const user = await requireUser({...}); // throws on unauth
 *     // user.userId is now guaranteed non-null
 *   }
 *
 * AUTH_DISABLED support: when AUTH_DISABLED is set in the env, the guard
 * returns a synthetic user (id: 'dev-user') without consulting the session.
 * This is for local development only and is blocked from binding to non-loopback
 * addresses by the boot-time env check in src/lib/env.ts.
 */
import { getSession, SESSION_COOKIE_NAME, SessionError } from './session';
import { cookies } from 'next/headers';
import { resolveEnv } from './env';
import { parseSessionCookie } from './cookie';

const DEV_USER_ID = 'dev-user';
const DEV_USER_EMAIL = 'dev@local';

export class AuthError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export interface AuthedUser {
  userId: string;
  email: string | null;
  isDev: boolean;
}

/**
 * Returns the authenticated user, or throws an AuthError(401) if not.
 *
 * `authDisabled` is passed in (rather than read from process.env here) so
 * that the env-cached resolution is consistent across the app and so
 * tests can override it.
 *
 * Async because the underlying session lookup goes through the async
 * DbClient interface.
 */
export async function requireUser(opts: {
  authDisabled?: boolean;
  cookieHeader?: string | null;
}): Promise<AuthedUser> {
  if (opts.authDisabled) {
    return { userId: DEV_USER_ID, email: DEV_USER_EMAIL, isDev: true };
  }
  const cookieHeader = opts.cookieHeader;
  if (!cookieHeader) {
    throw new AuthError('not authenticated', 401);
  }
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) {
    throw new AuthError('not authenticated', 401);
  }
  let session;
  try {
    session = await getSession(sessionId);
  } catch (e) {
    if (e instanceof SessionError) {
      throw new AuthError('session lookup failed', 500);
    }
    throw e;
  }
  if (!session) {
    throw new AuthError('not authenticated', 401);
  }
  // We don't have user email here without a JOIN. The auth-guard does the
  // minimal lookup; routes that need the email can fetch it explicitly.
  return { userId: session.userId, email: null, isDev: false };
}

/**
 * Returns the authenticated user, or null if not. Use this when the route
 * can be reached by both authed and anon users (e.g. /api/me returning
 * the current user, or null if logged out).
 */
export async function getCurrentUser(opts: {
  authDisabled?: boolean;
  cookieHeader?: string | null;
}): Promise<AuthedUser | null> {
  try {
    return await requireUser(opts);
  } catch (e) {
    if (e instanceof AuthError && e.statusCode === 401) return null;
    throw e;
  }
}

/**
 * Server-component variant that reads the cookie via next/headers. Use in
 * server components, not in API routes (which receive the request).
 */
export async function requireUserFromHeaders(): Promise<AuthedUser> {
  const env = resolveEnv();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return requireUser({
    authDisabled: env.authDisabled,
    cookieHeader: sessionCookie?.value,
  });
}
