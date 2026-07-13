/**
 * Auth business logic, transport-agnostic.
 *
 * Each function takes a parsed body and returns a discriminated-union result.
 * The Next.js route handlers in app/api/auth/* translate JSON + status
 * codes; this module is testable in isolation without booting Next.js.
 */
import { z } from 'zod';
import { createUser, authenticateUser, UserError } from './user';
import { createSession, deleteSession, SESSION_COOKIE_NAME } from './session';
import { parseSessionCookie } from './cookie';

export class AuthHandlerError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthHandlerError';
    this.statusCode = statusCode;
  }
}

export const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface CookieAttributes {
  name: typeof SESSION_COOKIE_NAME;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  expires: Date;
}

export interface AuthSuccess {
  userId: string;
  email: string;
  sessionId: string;
  cookie: CookieAttributes;
}

export interface LogoutSuccess {
  cookie: CookieAttributes;
}

function buildAuthSuccess(
  userId: string,
  email: string,
  sessionId: string,
  expiresAt: number,
  opts: { secure: boolean },
): AuthSuccess {
  return {
    userId,
    email,
    sessionId,
    cookie: {
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      httpOnly: true,
      secure: opts.secure,
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    },
  };
}

function buildLogoutSuccess(opts: { secure: boolean }): LogoutSuccess {
  return {
    cookie: {
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: opts.secure,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0), // epoch: clears in browsers
    },
  };
}

/**
 * Sign a user up. Optionally enforces a single-user-per-instance policy for
 * local-mode-with-default-user.
 */
export async function handleSignup(
  rawBody: unknown,
  opts: {
    isLocalWithDefaultUser: boolean;
    secure: boolean;
    hasExistingUser: () => boolean;
  },
): Promise<AuthSuccess> {
  const parsed = SignupBody.safeParse(rawBody);
  if (!parsed.success) {
    throw new AuthHandlerError(
      parsed.error.issues.map((i) => i.message).join(', ') || 'invalid request body',
      400,
    );
  }
  const { email, password } = parsed.data;

  if (opts.isLocalWithDefaultUser && opts.hasExistingUser()) {
    throw new AuthHandlerError(
      'local mode already has a user; sign in instead of creating a new account',
      409,
    );
  }

  let user;
  try {
    user = await createUser({ email, password });
  } catch (e) {
    if (e instanceof UserError) {
      throw new AuthHandlerError(e.message, e.statusCode);
    }
    throw e;
  }

  const { session } = createSession({ userId: user.id });
  return buildAuthSuccess(user.id, user.email, session.id, session.expiresAt, opts);
}

/**
 * Log a user in.
 */
export async function handleLogin(
  rawBody: unknown,
  opts: { secure: boolean },
): Promise<AuthSuccess> {
  const parsed = LoginBody.safeParse(rawBody);
  if (!parsed.success) {
    throw new AuthHandlerError('email and password are required', 400);
  }
  const { email, password } = parsed.data;

  const result = await authenticateUser(email, password);
  if (!result) {
    throw new AuthHandlerError('invalid email or password', 401);
  }
  const { session } = createSession({ userId: result.user.id });
  return buildAuthSuccess(result.user.id, result.user.email, session.id, session.expiresAt, opts);
}

/**
 * Log a user out. Reads the session id from the cookie header.
 */
export function handleLogout(
  cookieHeader: string | null,
  opts: { secure: boolean },
): LogoutSuccess {
  const sessionId = parseSessionCookie(cookieHeader);
  if (sessionId) {
    deleteSession(sessionId);
  }
  return buildLogoutSuccess(opts);
}