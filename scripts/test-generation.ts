/**
 * Tests for src/lib/generation/runner.ts + apply-stack.ts.
 *
 * Single end-to-end test: seed a user, add a credential, install a
 * mocked fetch, call runGeneration, assert:
 *   - run row exists with the right fields
 *   - audit log contains credential_used
 *   - credential last_used_at was bumped
 *   - augmentation stack was applied (system prompt reaches the mock)
 *   - provider failure path also saves a run row
 *   - decryption failure logs credential_decryption_failed
 *   - missing augmentation id throws
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { runGeneration, GenerationError } from '../src/lib/generation/runner';
import { resolveStack, AugmentationResolverError } from '../src/lib/augmentations/apply-stack';
import { getDb, closeDb } from '../src/db/client';
import { hashPassword } from '../src/lib/password';
import { addCredential } from '../src/lib/model-credentials';
import { readEvents } from '../src/lib/audit';

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

const tmpDir = mkdtempSync(join(tmpdir(), 'gen-test-'));
process.env.DATABASE_URL = join(tmpDir, 'test.db');
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = ENC_KEY;
delete process.env.AUTH_DISABLED;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
execFileSync('pnpm', ['exec', 'tsx', 'src/db/push.ts'], { stdio: 'inherit' });
execFileSync('pnpm', ['exec', 'tsx', 'src/db/seed.ts'], { stdio: 'inherit' });

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}
let captured: CapturedCall[] = [];
let nextResponse: { status: number; body: unknown } | Error = {
  status: 200,
  body: {
    id: 'resp-1',
    content: [{ type: 'text', text: '<div>hello</div>' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  },
};

function installFetch(): void {
  captured = [];
  (globalThis as unknown as { fetch: (url: string, opts: RequestInit) => Promise<Response> }).fetch =
    async (url: string, opts: RequestInit) => {
      const headers: Record<string, string> = {};
      if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers)) {
          headers[k.toLowerCase()] = String(v);
        }
      }
      let body: unknown;
      if (typeof opts.body === 'string') {
        try {
          body = JSON.parse(opts.body);
        } catch {
          body = opts.body;
        }
      }
      captured.push({ url, method: opts.method ?? 'GET', headers, body });
      if (nextResponse instanceof Error) throw nextResponse;
      return new Response(JSON.stringify(nextResponse.body), {
        status: nextResponse.status,
        headers: { 'content-type': 'application/json' },
      });
    };
}

async function seedUser(id: string, email: string): Promise<void> {
  const hash = await hashPassword('test-password-12chars');
  getDb()
    .prepare('INSERT OR REPLACE INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .run(id, email, hash);
}

function row<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T {
  return getDb().prepare(sql).get(...params) as T;
}

async function main(): Promise<void> {
  await seedUser('user-1', 'user-1@test.local');
  installFetch();

  const encKey = Buffer.from(ENC_KEY, 'base64');

  // Add a credential for the runner to use.
  const credential = addCredential({
    userId: 'user-1',
    provider: 'anthropic',
    label: 'work',
    key: '***',
    encryptionKey: encKey,
  });

  // === resolveStack: empty stack returns empty string ===
  if (resolveStack([]) !== '') {
    fail_('resolveStack returns empty string for empty stack', 'non-empty');
  } else {
    ok('resolveStack returns empty string for empty stack', "''");
  }

  // === resolveStack: missing augmentation throws ===
  let threw = false;
  try {
    resolveStack([{ id: 'does-not-exist', version: '1.0.0' }]);
  } catch (e) {
    threw = e instanceof AugmentationResolverError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('resolveStack throws on missing augmentation id', 'no-throw');
  } else {
    ok('resolveStack throws on missing augmentation id', '400');
  }

  // === resolveStack: real stack ===
  // The seed has 8 augmentations. Pull two that we know exist.
  const realAugs = getDb()
    .prepare("SELECT id, version FROM augmentations WHERE id IN ('none', 'shadcn-tokens')")
    .all() as Array<{ id: string; version: string }>;
  if (realAugs.length !== 2) {
    fail_('seed contains expected augmentations', `got: ${realAugs.length}`);
  } else {
    const resolved = resolveStack(realAugs);
    if (resolved.length < 100) {
      fail_('resolveStack returns non-trivial text for real stack', `len=${resolved.length}`);
    } else {
      ok('resolveStack returns non-trivial text for real stack', `len=${resolved.length}`);
    }
  }

  // === Happy path: full generation ===

  // Reset the audit log so we count just this run's events.
  // (We don't have a clear function; instead, count from the end of the
  // file, which is good enough because the test uses a fresh tmp DB.)
  const auditBefore = readEvents({ userId: 'user-1' }).length;

  // The previous test runs (test-model-credentials, test-credentials-handlers)
  // share the same `data/design-tester-lab.db` via test scripts. The
  // augmentation row was deleted by addCredential... no, addCredential
  // doesn't touch augmentations. The seed is loaded fresh per test.
  // Read the system_prompt for 'shadcn-tokens' so we can verify the
  // system prompt actually reached the provider.
  const sysPrompt = row<{ system_prompt: string }>(
    "SELECT system_prompt FROM augmentations WHERE id = 'shadcn-tokens'",
  ).system_prompt;

  const result = await runGeneration({
    userId: 'user-1',
    promptBody: 'a simple button',
    promptId: null,
    modelCredentialId: credential.id,
    modelId: 'claude-sonnet-4-5',
    augmentationStack: [{ id: 'shadcn-tokens', version: '1.0.0' }],
    params: { maxTokens: 1024, temperature: 0.7 },
  });

  // Verify the run row.
  const runRow = row<{
    id: string;
    user_id: string;
    prompt_body: string;
    model_credential_id: string;
    model_id: string;
    generated_html: string;
    generated_tokens_used: number;
    duration_ms: number;
    augmentation_stack: string;
  }>('SELECT * FROM runs WHERE id = ?', result.runId);
  if (!runRow) {
    fail_('run row created', 'no row');
  } else {
    if (runRow.user_id !== 'user-1') {
      fail_('run row has user_id', `got: ${runRow.user_id}`);
    } else {
      ok('run row has user_id', 'user-1');
    }
    if (runRow.prompt_body !== 'a simple button') {
      fail_('run row has prompt_body', `got: ${runRow.prompt_body}`);
    } else {
      ok('run row has prompt_body', 'a simple button');
    }
    if (runRow.model_credential_id !== credential.id) {
      fail_('run row has model_credential_id', `got: ${runRow.model_credential_id}`);
    } else {
      ok('run row has model_credential_id', credential.id);
    }
    if (runRow.model_id !== 'claude-sonnet-4-5') {
      fail_('run row has model_id', `got: ${runRow.model_id}`);
    } else {
      ok('run row has model_id', 'claude-sonnet-4-5');
    }
    if (runRow.generated_html !== '<div>hello</div>') {
      fail_('run row has generated_html', `got: ${runRow.generated_html}`);
    } else {
      ok('run row has generated_html', '<div>hello</div>');
    }
    if (runRow.generated_tokens_used !== 150) {
      fail_('run row has total tokens', `got: ${runRow.generated_tokens_used}`);
    } else {
      ok('run row has total tokens (100+50)', '150');
    }
    if (!runRow.augmentation_stack.includes('shadcn-tokens')) {
      fail_('run row stores augmentation stack', `got: ${runRow.augmentation_stack}`);
    } else {
      ok('run row stores augmentation stack', 'present');
    }
  }

  // Verify the captured request: URL + system prompt.
  if (captured.length !== 1) {
    fail_('runner made exactly one fetch call', `got: ${captured.length}`);
  } else {
    ok('runner made exactly one fetch call', '1');
    const req = captured[0]!;
    if (req.url !== 'https://api.anthropic.com/v1/messages') {
      fail_('runner calls Anthropic /v1/messages', `got: ${req.url}`);
    } else {
      ok('runner calls Anthropic /v1/messages', 'match');
    }
    if (req.headers['x-api-key'] !== '***') {
      fail_('runner passes decrypted key in x-api-key', `got: ${req.headers['x-api-key']}`);
    } else {
      ok('runner passes decrypted key in x-api-key', 'sk-ant-test');
    }
    const reqBody = req.body as Record<string, unknown>;
    if (reqBody.system !== sysPrompt) {
      fail_('runner passes resolved system prompt', `got: ${String(reqBody.system).slice(0, 40)}...`);
    } else {
      ok('runner passes resolved system prompt', 'matches augmentation text');
    }
    if (reqBody.temperature !== 0.7) {
      fail_('runner passes temperature parameter', `got: ${reqBody.temperature}`);
    } else {
      ok('runner passes temperature parameter', '0.7');
    }
  }

  // Verify credential.last_used_at was bumped.
  const cred = row<{ last_used_at: number | null }>(
    'SELECT last_used_at FROM model_credentials WHERE id = ?',
    credential.id,
  );
  if (!cred.last_used_at || cred.last_used_at <= 0) {
    fail_('credential last_used_at was bumped', `got: ${cred.last_used_at}`);
  } else {
    ok('credential last_used_at was bumped', String(cred.last_used_at));
  }

  // Verify the audit log.
  const auditAfter = readEvents({ userId: 'user-1' });
  const credentialUsed = auditAfter.find((e) => e.action === 'credential_used');
  if (!credentialUsed) {
    fail_('credential_used audit event was written', 'no event');
  } else if (credentialUsed.targetId !== credential.id) {
    fail_('credential_used audit event references the credential', `got: ${credentialUsed.targetId}`);
  } else if (credentialUsed.metadata?.runId !== result.runId) {
    fail_('credential_used audit metadata contains runId', JSON.stringify(credentialUsed.metadata));
  } else {
    ok('credential_used audit event was written with right targetId and runId', credentialUsed.targetId ?? '');
  }
  if (auditAfter.length <= auditBefore) {
    fail_('audit log gained at least one new event', `before=${auditBefore} after=${auditAfter.length}`);
  } else {
    ok('audit log gained at least one new event', `+${auditAfter.length - auditBefore}`);
  }

  // === Provider failure path: still saves a run row ===

  nextResponse = { status: 500, body: 'upstream broken' };
  let providerErr: GenerationError | null = null;
  try {
    await runGeneration({
      userId: 'user-1',
      promptBody: 'try this',
      promptId: null,
      modelCredentialId: credential.id,
      modelId: 'claude-sonnet-4-5',
      augmentationStack: [],
    });
  } catch (e) {
    if (e instanceof GenerationError) providerErr = e;
  }
  if (providerErr?.statusCode !== 502) {
    fail_('provider 500 maps to 502', `got: ${providerErr?.statusCode}`);
  } else {
    ok('provider 500 maps to 502', '502');
  }
  // The failed run was still saved. Find the most recent run for this credential
  // and user — it should be the failed one.
  const failedRun = row<{
    id: string;
    generated_html: string | null;
    lint_report: string | null;
  }>(
    `SELECT id, generated_html, lint_report FROM runs
     WHERE user_id = ? AND model_credential_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    'user-1',
    credential.id,
  );
  if (!failedRun) {
    fail_('failed run still saved a row', 'no row');
  } else {
    if (failedRun.generated_html !== null) {
      fail_('failed run has null generated_html', `got: ${failedRun.generated_html}`);
    } else {
      ok('failed run has null generated_html', 'null');
    }
    if (!failedRun.lint_report) {
      fail_('failed run has lint_report capturing the error', 'null');
    } else {
      const lr = JSON.parse(failedRun.lint_report) as { error: string; status: number };
      if (lr.status !== 502) {
        fail_('failed run lint_report has right status', `got: ${lr.status}`);
      } else {
        ok('failed run lint_report has right status', '502');
      }
    }
  }

  // === Decryption failure path: logs credential_decryption_failed ===

  // Force a decryption failure by rotating the env key.
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 0xff).toString('base64');
  let decryptErr: GenerationError | null = null;
  try {
    await runGeneration({
      userId: 'user-1',
      promptBody: 'should fail',
      promptId: null,
      modelCredentialId: credential.id,
      modelId: 'claude-sonnet-4-5',
      augmentationStack: [],
    });
  } catch (e) {
    if (e instanceof GenerationError) decryptErr = e;
  }
  if (decryptErr?.statusCode !== 500) {
    fail_('decryption failure maps to 500', `got: ${decryptErr?.statusCode}`);
  } else {
    ok('decryption failure maps to 500', '500');
  }
  if (decryptErr && !decryptErr.message.toLowerCase().includes('decrypt')) {
    fail_('decryption failure message mentions decrypt', decryptErr.message);
  } else {
    ok('decryption failure message mentions decrypt', 'matches');
  }
  // Audit log
  const decryptAudit = readEvents({ userId: 'user-1' }).find(
    (e) => e.action === 'credential_decryption_failed',
  );
  if (!decryptAudit) {
    fail_('credential_decryption_failed audit event was written', 'no event');
  } else {
    ok('credential_decryption_failed audit event was written', decryptAudit.targetId ?? '');
  }
  // Restore env so subsequent tests work
  process.env.ENCRYPTION_KEY = ENC_KEY;

  // === Missing augmentation id in stack ===

  threw = false;
  try {
    await runGeneration({
      userId: 'user-1',
      promptBody: 'try',
      promptId: null,
      modelCredentialId: credential.id,
      modelId: 'claude-sonnet-4-5',
      augmentationStack: [{ id: 'shadcn-tokens', version: '1.0.0' }, { id: 'bogus', version: '1.0.0' }],
    });
  } catch (e) {
    threw = e instanceof GenerationError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('missing augmentation in stack throws 400', 'no-throw');
  } else {
    ok('missing augmentation in stack throws 400', '400');
  }

  // === Missing credential id ===

  nextResponse = { status: 200, body: { content: [{ type: 'text', text: 'x' }], usage: {} } };
  threw = false;
  try {
    await runGeneration({
      userId: 'user-1',
      promptBody: 'try',
      promptId: null,
      modelCredentialId: 'not-a-real-id',
      modelId: 'claude-sonnet-4-5',
      augmentationStack: [],
    });
  } catch (e) {
    threw = e instanceof GenerationError && e.statusCode === 500;
  }
  if (!threw) {
    fail_('missing credential id throws 500', 'no-throw');
  } else {
    ok('missing credential id throws 500', '500');
  }

  // === Input validation ===

  for (const [label, input, expectedCode] of [
    [
      'empty userId',
      {
        userId: '',
        promptBody: 'x',
        modelCredentialId: credential.id,
        modelId: 'm',
        augmentationStack: [],
      },
      500,
    ],
    [
      'empty promptBody',
      {
        userId: 'user-1',
        promptBody: '',
        modelCredentialId: credential.id,
        modelId: 'm',
        augmentationStack: [],
      },
      500,
    ],
    [
      'empty modelCredentialId',
      {
        userId: 'user-1',
        promptBody: 'x',
        modelCredentialId: '',
        modelId: 'm',
        augmentationStack: [],
      },
      500,
    ],
    [
      'empty modelId',
      {
        userId: 'user-1',
        promptBody: 'x',
        modelCredentialId: credential.id,
        modelId: '',
        augmentationStack: [],
      },
      500,
    ],
  ] as Array<[string, Parameters<typeof runGeneration>[0], number]>) {
    nextResponse = { status: 200, body: { content: [{ type: 'text', text: 'x' }], usage: {} } };
    threw = false;
    try {
      await runGeneration(input);
    } catch (e) {
      threw = e instanceof GenerationError && e.statusCode === expectedCode;
    }
    if (!threw) {
      fail_(`${label} throws ${expectedCode}`, 'no-throw');
    } else {
      ok(`${label} throws ${expectedCode}`, String(expectedCode));
    }
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