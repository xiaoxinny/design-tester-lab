/**
 * Tests for src/lib/model-credentials.ts (BYOK CRUD) and src/lib/audit.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  addCredential,
  listCredentials,
  getCredentialMeta,
  getDecryptedCredential,
  deleteCredential,
  touchCredential,
  CredentialError,
} from '../src/lib/model-credentials';
import { logEvent, readEvents } from '../src/lib/audit';
import { getDb, closeDb } from '../src/db/client';
import { hashPassword } from '../src/lib/password';

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

async function expectThrow(label: string, fn: () => unknown | Promise<unknown>, expectedStatus: number): Promise<void> {
  try {
    await fn();
    fail_(label, 'expected throw, got nothing');
  } catch (e) {
    if (e instanceof CredentialError && e.statusCode === expectedStatus) {
      ok(label, `${e.statusCode} "${e.message}"`);
    } else {
      fail_(label, `wrong error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// 32-byte encryption key
const encKey = Buffer.alloc(32, 0x37);

const tmpDir = mkdtempSync(join(tmpdir(), 'creds-test-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
Object.assign(process.env, { NODE_ENV: 'test' });
delete process.env.AUTH_DISABLED;
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });

async function seedUser(id: string, email: string): Promise<void> {
  const hash = await hashPassword('test-password-12chars');
  await getDb().run(
    'INSERT OR REPLACE INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    id, email, hash,
  );
}

async function main(): Promise<void> {
  await seedUser('user-1', 'user-1@test.local');
  await seedUser('user-2', 'user-2@test.local');

  // === addCredential basics ===

  const c1 = await addCredential({
    userId: 'user-1',
    provider: 'anthropic',
    label: 'work-anthropic',
    key: 'sk-ant-fake-7890',
    encryptionKey: encKey,
  });
  if (!c1.id || c1.id.length !== 32) {
    fail_('addCredential returns a 32-char hex id', `got: ${c1.id}`);
  } else {
    ok('addCredential returns a 32-char hex id', c1.id);
  }
  if (c1.provider !== 'anthropic') {
    fail_('addCredential stores provider', `got: ${c1.provider}`);
  } else {
    ok('addCredential stores provider', c1.provider);
  }
  if (c1.label !== 'work-anthropic') {
    fail_('addCredential stores label', `got: ${c1.label}`);
  } else {
    ok('addCredential stores label', c1.label);
  }
  if (c1.baseUrl !== null) {
    fail_('addCredential leaves baseUrl null for anthropic', `got: ${c1.baseUrl}`);
  } else {
    ok('addCredential leaves baseUrl null for anthropic', 'null');
  }

  // === Encryption at rest ===

  // The stored encrypted_key in the DB should NOT contain the plaintext
  const row = await getDb().get<{ encrypted_key: string }>(
    'SELECT encrypted_key FROM model_credentials WHERE id = ?',
    c1.id,
  );
  if (!row) {
    fail_('encrypted_key row exists in DB', 'row missing');
    return;
  }
  if (row.encrypted_key.includes('sk-ant-fake-7890')) {
    fail_('encrypted_key in DB does not contain plaintext', 'leaked');
  } else {
    ok('encrypted_key in DB does not contain plaintext', 'no leak');
  }
  if (!/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(row.encrypted_key)) {
    fail_('encrypted_key follows <iv>:<ct>:<tag> format', `got: ${row.encrypted_key.slice(0, 40)}...`);
  } else {
    ok('encrypted_key follows <iv>:<ct>:<tag> format', row.encrypted_key.slice(0, 30) + '...');
  }

  // === Round-trip: getDecryptedCredential returns the original ===

  const decrypted = await getDecryptedCredential(c1.id, 'user-1', encKey);
  if (!decrypted) {
    fail_('getDecryptedCredential returns the row', 'null');
  } else if (decrypted.key !== 'sk-ant-fake-7890') {
    fail_('getDecryptedCredential returns the original key', `got: ${decrypted.key.slice(0, 20)}...`);
  } else {
    ok('getDecryptedCredential returns the original key', 'match');
  }

  // === Wrong-key decryption fails ===

  const wrongKey = Buffer.alloc(32, 0x99);
  await expectThrow(
    'decryption with wrong encryption key fails with 500',
    () => getDecryptedCredential(c1.id, 'user-1', wrongKey),
    500,
  );

  // === Cross-user isolation ===

  // getDecryptedCredential returns null for cross-user access — silently
  // indistinguishable from "row does not exist" (no info leak between users).
  const crossDecrypt = await getDecryptedCredential(c1.id, 'user-2', encKey);
  if (crossDecrypt !== null) {
    fail_("user-2 cannot read user-1's credential (returns null)", 'leaked');
  } else {
    ok("user-2 cannot read user-1's credential (returns null)", 'null');
  }
  const cross = await getCredentialMeta(c1.id, 'user-2');
  if (cross !== null) {
    fail_("user-2 cannot read user-1's metadata (returns null)", 'leaked');
  } else {
    ok("user-2 cannot read user-1's metadata (returns null)", 'null');
  }

  // === List ===

  const list1 = await listCredentials('user-1');
  if (list1.length !== 1 || list1[0]!.id !== c1.id) {
    fail_('listCredentials returns the right rows for user-1', `got ${list1.length} rows`);
  } else {
    ok('listCredentials returns the right rows for user-1', '1 row');
  }
  // Verify list does NOT include encrypted_key
  if ('encryptedKey' in list1[0]!) {
    fail_('listCredentials does not leak encrypted_key', 'leaked');
  } else {
    ok('listCredentials does not leak encrypted_key', 'no leak');
  }

  const list2 = await listCredentials('user-2');
  if (list2.length !== 0) {
    fail_('user-2 sees zero credentials', `got: ${list2.length}`);
  } else {
    ok('user-2 sees zero credentials', 'empty');
  }

  // === Provider validation ===

  await expectThrow(
    'invalid provider fails with 400',
    () =>
      addCredential({
        userId: 'user-1',
        provider: 'bogus' as never,
        label: 'x',
        key: 'y',
        encryptionKey: encKey,
      }),
    400,
  );

  await expectThrow(
    'empty label fails with 400',
    () =>
      addCredential({
        userId: 'user-1',
        provider: 'openai',
        label: '   ',
        key: 'k',
        encryptionKey: encKey,
      }),
    400,
  );

  await expectThrow(
    'empty key fails with 400',
    () =>
      addCredential({
        userId: 'user-1',
        provider: 'openai',
        label: 'k',
        key: '',
        encryptionKey: encKey,
      }),
    400,
  );

  await expectThrow(
    'ollama provider without baseUrl fails with 400',
    () =>
      addCredential({
        userId: 'user-1',
        provider: 'ollama',
        label: 'local',
        key: 'k',
        encryptionKey: encKey,
      }),
    400,
  );

  // ollama WITH baseUrl succeeds
  const c2 = await addCredential({
    userId: 'user-1',
    provider: 'ollama',
    label: 'local-ollama',
    key: 'ollama-fake-key',
    baseUrl: 'http://localhost:11434',
    encryptionKey: encKey,
  });
  if (c2.baseUrl !== 'http://localhost:11434') {
    fail_('ollama credential stores baseUrl', `got: ${c2.baseUrl}`);
  } else {
    ok('ollama credential stores baseUrl', c2.baseUrl);
  }

  // === Duplicate label rejected ===

  await expectThrow(
    'duplicate label for the same user fails with 409',
    () =>
      addCredential({
        userId: 'user-1',
        provider: 'anthropic',
        label: 'work-anthropic',
        key: 'sk-other',
        encryptionKey: encKey,
      }),
    409,
  );

  // === Delete ===

  if (!(await deleteCredential(c1.id, 'user-1'))) {
    fail_('deleteCredential returns true for existing row', 'false');
  } else {
    ok('deleteCredential returns true for existing row', 'true');
  }
  if (await deleteCredential(c1.id, 'user-1')) {
    fail_('deleteCredential returns false for already-deleted', 'true');
  } else {
    ok('deleteCredential returns false for already-deleted', 'false');
  }
  if (await getCredentialMeta(c1.id, 'user-1')) {
    fail_('getCredentialMeta returns null after delete', 'non-null');
  } else {
    ok('getCredentialMeta returns null after delete', 'null');
  }

  // cross-user delete blocked
  const c3 = await addCredential({
    userId: 'user-1',
    provider: 'openai',
    label: 'openai-key',
    key: 'sk-openai',
    encryptionKey: encKey,
  });
  if (await deleteCredential(c3.id, 'user-2')) {
    fail_('user-2 cannot delete user-1 credential', 'leaked');
  } else {
    ok('user-2 cannot delete user-1 credential', 'blocked');
  }
  if (!(await deleteCredential(c3.id, 'user-1'))) {
    fail_('user-1 can delete own credential', 'failed');
  } else {
    ok('user-1 can delete own credential', 'true');
  }

  // === touchCredential ===

  const c4 = await addCredential({
    userId: 'user-1',
    provider: 'google',
    label: 'google-key',
    key: 'sk-google',
    encryptionKey: encKey,
  });
  const before = await getCredentialMeta(c4.id, 'user-1');
  if (before?.lastUsedAt !== null) {
    fail_('new credential has lastUsedAt=null', `got: ${before?.lastUsedAt}`);
  } else {
    ok('new credential has lastUsedAt=null', 'null');
  }
  await touchCredential(c4.id, 'user-1');
  const after = await getCredentialMeta(c4.id, 'user-1');
  if (!after?.lastUsedAt || after.lastUsedAt <= 0) {
    fail_('touchCredential sets lastUsedAt', `got: ${after?.lastUsedAt}`);
  } else {
    ok('touchCredential sets lastUsedAt', String(after.lastUsedAt));
  }

  // === audit log ===

  // Write some events
  await logEvent({ userId: 'user-1', action: 'login_success', targetType: 'session', targetId: 'session-abc' });
  await logEvent({ userId: null, action: 'login_failure_unknown_email', targetType: 'auth', metadata: { ip: '1.2.3.4' } });
  await logEvent({
    userId: 'user-1',
    action: 'credential_added',
    targetType: 'credential',
    targetId: c4.id,
    metadata: { provider: 'google', label: 'google-key' },
  });

  const user1Events = await readEvents({ userId: 'user-1' });
  if (user1Events.length !== 2) {
    fail_('readEvents filters by userId', `got: ${user1Events.length}`);
  } else {
    ok('readEvents filters by userId', `${user1Events.length} events`);
  }

  // readEvents requires userId; passing none throws.
  let threwNoUserId = false;
  try {
    // @ts-expect-error: testing the runtime guard
    await readEvents();
  } catch {
    threwNoUserId = true;
  }
  if (!threwNoUserId) {
    fail_('readEvents without userId throws', 'no-throw');
  } else {
    ok('readEvents without userId throws', 'throws');
  }
  // The null-userId event was not associated with user-1, so it won't
  // appear in user-1's readEvents. Verify the schema can store it by
  // checking the row count directly.
  const directQuery = await getDb().get<{ c: number }>(
    'SELECT COUNT(*) as c FROM audit_log WHERE action = ? AND user_id IS NULL',
    'login_failure_unknown_email',
  );
  if (directQuery?.c !== 1) {
    fail_('audit row allows null userId (DB-level check)', `got: ${directQuery?.c}`);
  } else {
    ok('audit row allows null userId (DB-level check)', 'null');
  }

  // audit log fails-closed: errors must not break the caller
  let threw = false;
  try {
    // logEvent wraps errors internally; verify the type tightening — typos
    // like 'credental_added' (note: typo intentional) should fail compile.
    await logEvent({ userId: 'user-1', action: 'login_success' });
  } catch {
    threw = true;
  }
  if (threw) {
    fail_('logEvent never throws', 'threw');
  } else {
    ok('logEvent never throws', 'no-throw');
  }

  // === FK cascade: deleting the user deletes their credentials ===

  // Add a credential to user-2
  const c5 = await addCredential({
    userId: 'user-2',
    provider: 'anthropic',
    label: 'user-2-cred',
    key: 'sk-u2',
    encryptionKey: encKey,
  });
  const before2 = await listCredentials('user-2');
  if (before2.length !== 1) {
    fail_('user-2 has 1 credential before user delete', `got: ${before2.length}`);
  } else {
    ok('user-2 has 1 credential before user delete', '1');
  }
  // Delete user-2
  await getDb().run('DELETE FROM users WHERE id = ?', 'user-2');
  const after2 = await listCredentials('user-2');
  if (after2.length !== 0) {
    fail_('user-2 credentials are cascade-deleted with the user', `got: ${after2.length}`);
  } else {
    ok('user-2 credentials are cascade-deleted with the user', '0');
  }
  if (await getDecryptedCredential(c5.id, 'user-2', encKey)) {
    fail_('decrypted credential also gone after user delete', 'leaked');
  } else {
    ok('decrypted credential also gone after user delete', 'gone');
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
