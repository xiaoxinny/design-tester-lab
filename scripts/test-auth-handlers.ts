/**
 * Smoke test: full auth cycle (signup -> login -> logout -> login).
 *
 * Exercises the transport-agnostic auth-handlers in the order a real user
 * would hit them: create account, log in (gets session cookie), log out
 * (cookie cleared), log in again (new session).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  handleSignup,
  handleLogin,
  handleLogout,
  AuthHandlerError,
} from '../src/lib/auth-handlers';
import { getSession, SESSION_COOKIE_NAME } from '../src/lib/session';
import { getDb, closeDb } from '../src/db/client';

let pass = 0;
let fail = 0;

function ok(label: string, detail: string): void {
  console.log(`OK:   ${label} -- ${detail}`);
  pass++;
}

function fail_(label: string, detail: string): void {
  console.log(`FAIL: ${label} -- ${detail}`);
  fail++;
}

function expectThrow(label: string, fn: () => unknown, expectedStatus: number): Promise<void> {
  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.then(
        () => fail_(label, 'expected throw, got resolved promise'),
        (e) => {
          if (e instanceof AuthHandlerError && e.statusCode === expectedStatus) {
            ok(label, `${e.statusCode} "${e.message}"`);
          } else {
            fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
          }
        },
      );
    }
    fail_(label, `expected throw, got ${r}`);
    return Promise.resolve();
  } catch (e) {
    if (e instanceof AuthHandlerError && e.statusCode === expectedStatus) {
      ok(label, `${e.statusCode} "${e.message}"`);
    } else {
      fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
    }
    return Promise.resolve();
  }
}

function cookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

function hasUsers(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  return row.c > 0;
}

const hasExistingUser = hasUsers;

const TEST_PASSWORD = 'test-password-12chars';
const TEST_EMAIL = 'smoke@test.local';

const tmpDir = mkdtempSync(join(tmpdir(), 'auth-smoke-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
process.env.NODE_ENV = 'test';
delete process.env.AUTH_DISABLED;
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });

async function main(): Promise<void> {
  // === 1. Signup ===

  const signup = await handleSignup(
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    {
      isLocalWithDefaultUser: false,
      secure: false,
      hasExistingUser,
    },
  );
  if (!signup.userId) {
    fail_('signup returns userId', 'empty');
  } else {
    ok('signup returns userId', signup.userId);
  }
  if (signup.email !== TEST_EMAIL) {
    fail_('signup returns lowercase email', `got: ${signup.email}`);
  } else {
    ok('signup returns lowercase email', signup.email);
  }
  if (signup.cookie.name !== SESSION_COOKIE_NAME) {
    fail_('signup sets the right cookie name', `got: ${signup.cookie.name}`);
  } else {
    ok('signup sets the right cookie name', signup.cookie.name);
  }
  if (!signup.cookie.httpOnly) {
    fail_('signup cookie is HttpOnly', 'httpOnly=false');
  } else {
    ok('signup cookie is HttpOnly', 'httpOnly=true');
  }
  if (signup.cookie.sameSite !== 'lax') {
    fail_('signup cookie SameSite=lax', signup.cookie.sameSite);
  } else {
    ok('signup cookie SameSite=lax', signup.cookie.sameSite);
  }
  // Verify the session row exists in the DB
  const sessionAfterSignup = getSession(signup.sessionId);
  if (!sessionAfterSignup) {
    fail_('signup creates a session row in DB', 'session not found');
  } else if (sessionAfterSignup.userId !== signup.userId) {
    fail_('signup session belongs to the new user', `got: ${sessionAfterSignup.userId}`);
  } else {
    ok('signup creates a session row in DB belonging to the new user', sessionAfterSignup.id.slice(0, 16) + '...');
  }

  // === 2. Login with same email ===

  const login = await handleLogin(
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { secure: false },
  );
  if (login.userId !== signup.userId) {
    fail_('login returns same userId as signup', `got: ${login.userId}`);
  } else {
    ok('login returns same userId as signup', login.userId);
  }
  if (login.sessionId === signup.sessionId) {
    fail_('login creates a new session id (not reuse signup session)', 'same id');
  } else {
    ok('login creates a new session id', login.sessionId.slice(0, 16) + '...');
  }
  if (!getSession(login.sessionId)) {
    fail_('login session row exists in DB', 'session not found');
  } else {
    ok('login session row exists in DB', 'present');
  }

  // === 3. Wrong password rejected ===

  await expectThrow(
    'login with wrong password returns 401',
    () =>
      handleLogin({ email: TEST_EMAIL, password: 'wrong-password-12' }, { secure: false }),
    401,
  );

  // === 4. Unknown email rejected ===

  await expectThrow(
    'login with unknown email returns 401',
    () =>
      handleLogin({ email: 'no-such@test.local', password: TEST_PASSWORD }, { secure: false }),
    401,
  );

  // === 4a. Email-enumeration oracle protection ===

  // Short password + non-existent email should still return 401 (not 500),
  // and must not throw out of authenticateUser.
  let shortPwUnknownEmailStatus: number | null = null;
  try {
    await handleLogin(
      { email: 'no-such-2@test.local', password: 'short' },
      { secure: false },
    );
  } catch (e) {
    if (e instanceof AuthHandlerError) {
      shortPwUnknownEmailStatus = e.statusCode;
    }
  }
  if (shortPwUnknownEmailStatus !== 401) {
    fail_(
      'short password + unknown email returns 401 (not 500)',
      `got: ${shortPwUnknownEmailStatus}`,
    );
  } else {
    ok('short password + unknown email returns 401 (not 500)', '401');
  }

  // === 5. Duplicate signup rejected ===

  await expectThrow(
    'duplicate signup returns 409',
    () =>
      handleSignup(
        { email: TEST_EMAIL, password: TEST_PASSWORD },
        { isLocalWithDefaultUser: false, secure: false, hasExistingUser },
      ),
    409,
  );

  // === 6. Invalid email rejected ===

  await expectThrow(
    'signup with malformed email returns 400',
    () =>
      handleSignup(
        { email: 'not-an-email', password: TEST_PASSWORD },
        { isLocalWithDefaultUser: false, secure: false, hasExistingUser },
      ),
    400,
  );

  // === 7. Logout ===

  const logout = handleLogout(cookieHeader(login.sessionId), { secure: false });
  if (logout.cookie.value !== '') {
    fail_('logout cookie value is empty (signals clear)', `got: ${logout.cookie.value}`);
  } else {
    ok('logout cookie value is empty (signals clear)', 'value=""');
  }
  if (logout.cookie.expires.getTime() > Date.now()) {
    fail_('logout cookie expires in the past', `expires: ${logout.cookie.expires.toISOString()}`);
  } else {
    ok('logout cookie expires in the past', logout.cookie.expires.toISOString());
  }
  // Verify the session was deleted
  if (getSession(login.sessionId)) {
    fail_('logout deletes the session row', 'still present');
  } else {
    ok('logout deletes the session row', 'deleted');
  }

  // === 8. Login again after logout ===

  const reLogin = await handleLogin(
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { secure: false },
  );
  if (reLogin.sessionId === login.sessionId) {
    fail_('re-login creates a fresh session id', 'reused old id');
  } else {
    ok('re-login creates a fresh session id', reLogin.sessionId.slice(0, 16) + '...');
  }
  if (!getSession(reLogin.sessionId)) {
    fail_('re-login session exists in DB', 'session not found');
  } else {
    ok('re-login session exists in DB', 'present');
  }

  // === 9. Local-mode single-user enforcement ===

  // Wipe and test: with no existing user, signup allowed.
  // (We already have user, so signup of a different email should still succeed
  // when isLocalWithDefaultUser=false. With isLocalWithDefaultUser=true and
  // an existing user, signup of a different email should fail.)
  await expectThrow(
    'local-mode-with-default-user + existing user + new email = 409',
    () =>
      handleSignup(
        { email: 'different@test.local', password: TEST_PASSWORD },
        { isLocalWithDefaultUser: true, secure: false, hasExistingUser },
      ),
    409,
  );

  // === 10. Logout without cookie ===

  const logout2 = handleLogout(null, { secure: false });
  if (logout2.cookie.value !== '') {
    fail_('logout with no cookie still returns clear-cookie', 'non-empty value');
  } else {
    ok('logout with no cookie still returns clear-cookie', 'value=""');
  }

  // === 11. Logout with malformed cookie ===

  const logout3 = handleLogout('garbage', { secure: false });
  if (logout3.cookie.value !== '') {
    fail_('logout with garbage cookie returns clear-cookie', 'non-empty value');
  } else {
    ok('logout with garbage cookie returns clear-cookie', 'value=""');
  }

  // === 12. cookie.secure reflects opts.secure ===

  const secureLogin = await handleLogin(
    { email: TEST_EMAIL, password: TEST_PASSWORD },
    { secure: true },
  );
  if (!secureLogin.cookie.secure) {
    fail_('login with secure=true sets secure cookie', 'secure=false');
  } else {
    ok('login with secure=true sets secure cookie', 'secure=true');
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);

  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('UNEXPECTED:', e);
  process.exit(1);
});