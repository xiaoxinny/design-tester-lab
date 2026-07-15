/**
 * Tests for src/lib/credentials-handlers.ts.
 *
 * Pattern: standalone, runs via `tsx`. Pure-Node, no test framework.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  handleAddCredential,
  handleListCredentials,
  handleGetCredential,
  handleDeleteCredential,
  CredentialsHandlerError,
} from '../src/lib/credentials-handlers';
import { getDb, closeDb } from '../src/db/client';
import { hashPassword } from '../src/lib/password';
import { readEvents } from '../src/lib/audit';
import { resolveEnv, _resetEnvForTests } from '../src/lib/env';

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

const ENC_KEY = Buffer.alloc(32, 0x42).toString('base64');
const SESSION_SECRET = Buffer.alloc(32, 0x99).toString('base64');

const tmpDir = mkdtempSync(join(tmpdir(), 'creds-handlers-test-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ENCRYPTION_KEY = ENC_KEY;
process.env.SESSION_SECRET = SESSION_SECRET;
delete process.env.AUTH_DISABLED;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
_resetEnvForTests();
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });

async function seedUser(id: string, email: string): Promise<void> {
  const hash = await hashPassword('test-password-12chars');
  getDb()
    .prepare('INSERT OR REPLACE INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .run(id, email, hash);
}

async function main(): Promise<void> {
  await seedUser('user-1', 'user-1@test.local');
  await seedUser('user-2', 'user-2@test.local');

  // === Auth gating ===

  let threw = false;
  try {
    await handleAddCredential('', { provider: 'anthropic', label: 'x', key: 'k' });
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 401;
  }
  if (!threw) {
    fail_('handleAddCredential with empty userId throws 401', 'no-throw');
  } else {
    ok('handleAddCredential with empty userId throws 401', '401');
  }
  threw = false;
  try {
    handleListCredentials('');
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 401;
  }
  if (!threw) {
    fail_('handleListCredentials with empty userId throws 401', 'no-throw');
  } else {
    ok('handleListCredentials with empty userId throws 401', '401');
  }

  // === Validation ===

  threw = false;
  try {
    await handleAddCredential('user-1', { provider: 'bogus' as never, label: 'x', key: 'k' });
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('add with invalid provider throws 400', 'no-throw');
  } else {
    ok('add with invalid provider throws 400', '400');
  }

  threw = false;
  try {
    await handleAddCredential('user-1', { provider: 'openai', label: '', key: 'k' });
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('add with empty label throws 400', 'no-throw');
  } else {
    ok('add with empty label throws 400', '400');
  }

  threw = false;
  try {
    await handleAddCredential('user-1', { provider: 'ollama', label: 'local', key: 'k' });
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('add ollama without baseUrl throws 400', 'no-throw');
  } else {
    ok('add ollama without baseUrl throws 400', '400');
  }

  threw = false;
  try {
    await handleAddCredential('user-1', { provider: 'openai', label: 'openai', key: 'sk-x', baseUrl: 'not-a-url' });
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('add with malformed baseUrl throws 400', 'no-throw');
  } else {
    ok('add with malformed baseUrl throws 400', '400');
  }

  // === Happy path ===

  const c1 = await handleAddCredential('user-1', {
    provider: 'anthropic',
    label: 'work-anthropic',
    key: 'sk-ant-secret',
  });
  if (c1.userId !== 'user-1') {
    fail_('add returns the right user', `got: ${c1.userId}`);
  } else {
    ok('add returns the right user', c1.userId);
  }

  // === Audit log written on add ===

  const eventsAfterAdd = readEvents({ userId: 'user-1' });
  const addEvent = eventsAfterAdd.find((e) => e.action === 'credential_added');
  if (!addEvent) {
    fail_('credential_added audit event was written', 'no event');
  } else if (addEvent.targetId !== c1.id) {
    fail_('credential_added audit event references the right credential', `got: ${addEvent.targetId}`);
  } else {
    ok('credential_added audit event was written with right targetId', addEvent.targetId);
  }

  // === Listing ===

  const list1 = handleListCredentials('user-1');
  if (list1.credentials.length !== 1) {
    fail_('list returns the right number of credentials', `got: ${list1.credentials.length}`);
  } else {
    ok('list returns the right number of credentials', '1');
  }
  // Verify list does not leak the encrypted key
  if ('encryptedKey' in list1.credentials[0]!) {
    fail_('list does not leak encrypted_key', 'leaked');
  } else {
    ok('list does not leak encrypted_key', 'no-leak');
  }

  // === Get one ===

  const get1 = handleGetCredential('user-1', c1.id);
  if (get1.id !== c1.id) {
    fail_('get returns the right credential', `got: ${get1.id}`);
  } else {
    ok('get returns the right credential', get1.id);
  }

  // === Cross-user isolation ===

  const list2 = handleListCredentials('user-2');
  if (list2.credentials.length !== 0) {
    fail_("user-2 sees zero of user-1's credentials", `got: ${list2.credentials.length}`);
  } else {
    ok("user-2 sees zero of user-1's credentials", 'empty');
  }

  threw = false;
  try {
    handleGetCredential('user-2', c1.id);
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 404;
  }
  if (!threw) {
    fail_("user-2 cannot get user-1's credential", 'no-throw');
  } else {
    ok("user-2 cannot get user-1's credential", '404');
  }

  threw = false;
  try {
    handleDeleteCredential('user-2', c1.id);
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 404;
  }
  if (!threw) {
    fail_("user-2 cannot delete user-1's credential", 'no-throw');
  } else {
    ok("user-2 cannot delete user-1's credential", '404');
  }

  // === Delete ===

  handleDeleteCredential('user-1', c1.id);
  const eventsAfterDelete = readEvents({ userId: 'user-1' });
  const deleteEvent = eventsAfterDelete.find((e) => e.action === 'credential_deleted');
  if (!deleteEvent) {
    fail_('credential_deleted audit event was written', 'no event');
  } else {
    ok('credential_deleted audit event was written', deleteEvent.targetId ?? '');
  }

  const listAfterDelete = handleListCredentials('user-1');
  if (listAfterDelete.credentials.length !== 0) {
    fail_('list after delete is empty', `got: ${listAfterDelete.credentials.length}`);
  } else {
    ok('list after delete is empty', '0');
  }

  // Deleting again returns 404
  threw = false;
  try {
    handleDeleteCredential('user-1', c1.id);
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 404;
  }
  if (!threw) {
    fail_('delete on missing credential throws 404', 'no-throw');
  } else {
    ok('delete on missing credential throws 404', '404');
  }

  // === Empty credentialId on delete ===

  threw = false;
  try {
    handleDeleteCredential('user-1', '');
  } catch (e) {
    threw = e instanceof CredentialsHandlerError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('delete with empty credentialId throws 400', 'no-throw');
  } else {
    ok('delete with empty credentialId throws 400', '400');
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