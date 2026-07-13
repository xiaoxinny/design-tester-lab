/**
 * Tests for src/lib/auth-guard.ts.
 *
 * Only the `requireUser` / `getCurrentUser` synchronous variants are tested
 * (the Next.js `requireUserFromHeaders` variant requires the Next runtime).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { requireUser, getCurrentUser, AuthError } from '../src/lib/auth-guard';
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session';
import { getDb, closeDb } from '../src/db/client';
import { hashPassword } from '../src/lib/password';

// DEV_USER_ID is intentionally not exported from auth-guard; tests that
// need to assert the synthetic dev user should match by string literal.
const DEV_USER_ID_LITERAL = 'dev-user';

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

// Set up: temp DB with the schema applied
const tmpDir = mkdtempSync(join(tmpdir(), 'authguard-test-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
process.env.NODE_ENV = 'test';
delete process.env.AUTH_DISABLED;
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });

async function seedTestUsers(): Promise<void> {
  const hash = await hashPassword('test-password-12chars');
  const stmt = getDb().prepare(
    'INSERT OR REPLACE INTO users (id, email, password_hash) VALUES (?, ?, ?)',
  );
  stmt.run('user-1', 'user-1@test.local', hash);
  stmt.run('user-2', 'user-2@test.local', hash);
}

function expectThrow(label: string, fn: () => unknown, expectedStatus: number, expectedFragment: string): void {
  try {
    fn();
    fail_(label, `expected throw, got nothing`);
  } catch (e) {
    if (e instanceof AuthError && e.statusCode === expectedStatus && e.message.includes(expectedFragment)) {
      ok(label, `${e.statusCode} "${e.message}"`);
    } else {
      fail_(label, `wrong error: ${e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)}`);
    }
  }
}

async function main(): Promise<void> {
  await seedTestUsers();

  // === AUTH_DISABLED path ===

  const devUser = requireUser({ authDisabled: true });
  if (devUser.userId !== DEV_USER_ID_LITERAL) {
    fail_('AUTH_DISABLED returns dev user', `got: ${devUser.userId}`);
  } else {
    ok('AUTH_DISABLED returns dev user', `userId=${devUser.userId}, isDev=${devUser.isDev}`);
  }
  if (!devUser.isDev) {
    fail_('AUTH_DISABLED user has isDev=true', `isDev=${devUser.isDev}`);
  } else {
    ok('AUTH_DISABLED user has isDev=true', 'true');
  }
  if (devUser.email !== 'dev@local') {
    fail_('AUTH_DISABLED user has dev@local email', `email=${devUser.email}`);
  } else {
    ok('AUTH_DISABLED user has dev@local email', devUser.email);
  }

  // === No cookie header ===

  expectThrow(
    'no cookie header throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: null }),
    401,
    'not authenticated',
  );
  expectThrow(
    'undefined cookie header throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: undefined }),
    401,
    'not authenticated',
  );
  expectThrow(
    'empty cookie header throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: '' }),
    401,
    'not authenticated',
  );

  // === Malformed cookie header ===

  expectThrow(
    'cookie with no session cookie throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: 'other=value' }),
    401,
    'not authenticated',
  );
  expectThrow(
    'session cookie with malformed value throws 401',
    () =>
      requireUser({
        authDisabled: false,
        cookieHeader: `${SESSION_COOKIE_NAME}=not-hex`,
      }),
    401,
    'not authenticated',
  );
  expectThrow(
    'session cookie with right format but non-existent id throws 401',
    () =>
      requireUser({
        authDisabled: false,
        cookieHeader: `${SESSION_COOKIE_NAME}=${'0'.repeat(64)}`,
      }),
    401,
    'not authenticated',
  );

  // === Valid cookie ===

  const { session } = createSession({ userId: 'user-1' });
  const validCookie = `${SESSION_COOKIE_NAME}=${session.id}`;
  const authed = requireUser({ authDisabled: false, cookieHeader: validCookie });
  if (authed.userId !== 'user-1') {
    fail_('valid session returns the right user', `got: ${authed.userId}`);
  } else {
    ok('valid session returns the right user', `userId=${authed.userId}, isDev=${authed.isDev}`);
  }
  if (authed.isDev) {
    fail_('real session has isDev=false', `isDev=${authed.isDev}`);
  } else {
    ok('real session has isDev=false', 'false');
  }

  // === Expired session ===

  const { session: shortSession } = createSession({ userId: 'user-1', ttlMs: 1 });
  await new Promise((r) => setTimeout(r, 50));
  const shortCookie = `${SESSION_COOKIE_NAME}=${shortSession.id}`;
  expectThrow(
    'expired session throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: shortCookie }),
    401,
    'not authenticated',
  );

  // === Deleted session ===

  const { session: deletedSession } = createSession({ userId: 'user-1' });
  const deletedCookie = `${SESSION_COOKIE_NAME}=${deletedSession.id}`;
  // Delete via the DB directly to simulate admin action
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(deletedSession.id);
  expectThrow(
    'deleted session throws 401',
    () => requireUser({ authDisabled: false, cookieHeader: deletedCookie }),
    401,
    'not authenticated',
  );

  // === Multi-cookie header ===

  const { session: s3 } = createSession({ userId: 'user-2' });
  const multiCookie = `theme=dark; ${SESSION_COOKIE_NAME}=${s3.id}; tracking=off`;
  const authed3 = requireUser({ authDisabled: false, cookieHeader: multiCookie });
  if (authed3.userId !== 'user-2') {
    fail_('multi-cookie header parses the right session', `got: ${authed3.userId}`);
  } else {
    ok('multi-cookie header parses the right session', `userId=${authed3.userId}`);
  }

  // === getCurrentUser returns null vs throws ===

  if (getCurrentUser({ authDisabled: false, cookieHeader: null }) !== null) {
    fail_('getCurrentUser returns null when not authed', 'non-null');
  } else {
    ok('getCurrentUser returns null when not authed', 'null');
  }
  if (!getCurrentUser({ authDisabled: false, cookieHeader: validCookie })) {
    fail_('getCurrentUser returns user when authed', 'falsy');
  } else {
    ok('getCurrentUser returns user when authed', 'truthy');
  }
  if (!getCurrentUser({ authDisabled: true })) {
    fail_('getCurrentUser returns dev user when AUTH_DISABLED', 'falsy');
  } else {
    ok('getCurrentUser returns dev user when AUTH_DISABLED', 'truthy');
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
