/**
 * Tests for src/lib/session.ts.
 *
 * Uses a temp SQLite file (cleaned up at end of run).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSession, getSession, deleteSession, deleteSessionsForUser, SESSION_CONFIG } from '../src/lib/session';

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
const tmpDir = mkdtempSync(join(tmpdir(), 'session-test-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
Object.assign(process.env, { NODE_ENV: 'test' }); // ensure cookie.secure = false

// Apply the schema
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Apply the schema using tsx
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });

// Insert test users (the sessions table has a FK to users)
import { getDb, closeDb } from '../src/db/client';
import { hashPassword } from '../src/lib/password';

const seedUserIds = ['user-1', 'user-2', 'user-3', 'user-4'];

async function seedTestUsers(): Promise<void> {
  const hash = await hashPassword('test-password-12chars');
  const stmt = getDb().prepare(
    'INSERT OR REPLACE INTO users (id, email, password_hash) VALUES (?, ?, ?)',
  );
  for (const id of seedUserIds) {
    stmt.run(id, `${id}@test.local`, hash);
  }
}

async function main(): Promise<void> {
  await seedTestUsers();

  // === Cookie config ===

  if (SESSION_CONFIG.COOKIE_NAME !== 'design_tester_lab_session') {
    fail_('cookie name is stable', `got ${SESSION_CONFIG.COOKIE_NAME}`);
  } else {
    ok('cookie name is stable', SESSION_CONFIG.COOKIE_NAME);
  }
  if (SESSION_CONFIG.SESSION_TTL_MS !== 7 * 24 * 60 * 60 * 1000) {
    fail_('default TTL is 7 days', `got ${SESSION_CONFIG.SESSION_TTL_MS}`);
  } else {
    ok('default TTL is 7 days', `${SESSION_CONFIG.SESSION_TTL_MS} ms`);
  }

  // === Create + lookup ===

  const { session, cookie } = createSession({ userId: 'user-1' });
  if (!session.id || session.id.length !== SESSION_CONFIG.SESSION_BYTES * 2) {
    fail_('session id is 64 hex chars', `got: ${session.id}`);
  } else {
    ok('session id is 64 hex chars', session.id.slice(0, 16) + '...');
  }
  if (session.userId !== 'user-1') {
    fail_('session userId round-trips', `got: ${session.userId}`);
  } else {
    ok('session userId round-trips', session.userId);
  }
  if (cookie.httpOnly !== true) {
    fail_('cookie is HttpOnly', 'httpOnly is false');
  } else {
    ok('cookie is HttpOnly', 'httpOnly=true');
  }
  if (cookie.sameSite !== 'Lax') {
    fail_('cookie SameSite=Lax', `got: ${cookie.sameSite}`);
  } else {
    ok('cookie SameSite=Lax', cookie.sameSite);
  }
  if (cookie.path !== '/') {
    fail_('cookie path=/', `got: ${cookie.path}`);
  } else {
    ok('cookie path=/', cookie.path);
  }
  if (cookie.secure !== false) {
    fail_('cookie secure=false in non-production', `got: ${cookie.secure}`);
  } else {
    ok('cookie secure=false in non-production', 'secure=false');
  }

  const lookedUp = getSession(session.id);
  if (!lookedUp) {
    fail_('getSession returns the created session', 'null');
  } else if (lookedUp.userId !== 'user-1') {
    fail_('getSession userId matches', `got: ${lookedUp.userId}`);
  } else {
    ok('getSession returns the created session', `userId=${lookedUp.userId}`);
  }

  // === Two sessions have different ids ===

  const { session: s2 } = createSession({ userId: 'user-1' });
  if (s2.id === session.id) {
    fail_('two sessions have different ids', 'duplicate id');
  } else {
    ok('two sessions have different ids', `${session.id.slice(0, 8)}... vs ${s2.id.slice(0, 8)}...`);
  }

  // === Get-session on missing/empty/garbage ===

  if (getSession('') !== null) {
    fail_('getSession("") returns null', 'non-null');
  } else {
    ok('getSession("") returns null', 'null');
  }
  if (getSession('not-a-real-session-id') !== null) {
    fail_('getSession with non-existent id returns null', 'non-null');
  } else {
    ok('getSession with non-existent id returns null', 'null');
  }

  // === Delete ===

  if (!deleteSession(session.id)) {
    fail_('deleteSession returns true on existing session', 'returned false');
  } else {
    ok('deleteSession returns true on existing session', 'true');
  }
  if (getSession(session.id) !== null) {
    fail_('getSession returns null after deletion', 'non-null');
  } else {
    ok('getSession returns null after deletion', 'null');
  }
  if (deleteSession(session.id)) {
    fail_('deleteSession returns false on already-deleted session', 'returned true');
  } else {
    ok('deleteSession returns false on already-deleted session', 'false');
  }

  // === deleteSessionsForUser ===

  createSession({ userId: 'user-2' });
  createSession({ userId: 'user-2' });
  createSession({ userId: 'user-2' });
  createSession({ userId: 'user-3' });
  const removed = deleteSessionsForUser('user-2');
  if (removed !== 3) {
    fail_('deleteSessionsForUser removes all sessions for the user', `got: ${removed}`);
  } else {
    ok('deleteSessionsForUser removes all sessions for the user', `${removed} removed`);
  }

  // user-3 should still have their session
  const s3Result = createSession({ userId: 'user-3' });
  if (!getSession(s3Result.session.id)) {
    fail_('deleteSessionsForUser does not affect other users', 'user-3 session gone');
  } else {
    ok('deleteSessionsForUser does not affect other users', 'user-3 session still present');
  }

  // === Expired sessions ===

  // Create a session with a 1ms TTL, then sleep so it expires.
  const { session: shortSession } = createSession({ userId: 'user-4', ttlMs: 1 });
  await new Promise((r) => setTimeout(r, 50));
  if (getSession(shortSession.id) !== null) {
    fail_('getSession returns null for expired session', 'non-null');
  } else {
    ok('getSession returns null for expired session', 'null');
  }

  // === Input validation ===

  let threw = false;
  try {
    createSession({ userId: '' });
  } catch (e) {
    threw = e instanceof Error && e.message.includes('userId');
  }
  if (!threw) {
    fail_('createSession with empty userId throws', 'no throw');
  } else {
    ok('createSession with empty userId throws', 'threw');
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);

  // Cleanup
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('UNEXPECTED:', e);
  process.exit(1);
});
