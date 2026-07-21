/**
 * Generation runner.
 *
 * One function (`runGeneration`) that:
 *   1. Decrypts the user's BYOK credential.
 *   2. Resolves the augmentation stack to a system-prompt fragment.
 *   3. Calls the provider via callProvider().
 *   4. Saves a row in `runs` with the result (or the failure reason).
 *   5. Updates last_used_at on the credential.
 *   6. Logs credential_used / credential_decryption_failed in the audit log.
 *
 * The runner is transport-agnostic. The HTTP route in
 * `src/app/api/generate/route.ts` wraps it.
 *
 * Failure handling: a provider error still saves a run row so the user
 * can see the attempt in their history. The run row's `generated_html`
 * is null; the error is reported in the return value. A credential
 * decrypt error is fatal (no run row) — the caller did not pass a
 * valid credential.
 */
import { randomBytes } from 'node:crypto';
import { getDb } from '../../db/client';
import { getDecryptedCredential, CredentialError, getCredentialMeta } from '../model-credentials';
import { resolveStack, type AugmentationRef, AugmentationResolverError } from '../augmentations/apply-stack';
import { callProvider, ProviderError } from '../providers/openai-compatible';
import { logEvent } from '../audit';
import type { Provider } from '../model-credentials';

export class GenerationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GenerationError';
    this.statusCode = statusCode;
  }
}

export interface RunGenerationInput {
  userId: string;
  promptBody: string;
  /** Reference to the prompts table row, if the run was started from a saved prompt. Null/undefined for ad-hoc. */
  promptId?: string | null;
  modelCredentialId: string;
  modelId: string;
  augmentationStack: AugmentationRef[];
  params?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };
  timeoutMs?: number;
}

export interface RunGenerationResult {
  runId: string;
  generatedHtml: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  providerResponseId: string | null;
}

/**
 * Run a generation. Returns the run id and the result.
 *
 * Errors:
 *   - AugmentationResolverError (400) if a stack ref is not in the table
 *   - CredentialError (500) if the credential cannot be decrypted
 *   - ProviderError (4xx/5xx) if the upstream call fails — but the run
 *     row is still saved with the failure reason, so the user can see it
 *   - GenerationError (500) for any other internal failure
 */
export async function runGeneration(input: RunGenerationInput): Promise<RunGenerationResult> {
  if (!input.userId) {
    throw new GenerationError('userId is required', 500);
  }
  if (!input.promptBody) {
    throw new GenerationError('promptBody is required', 500);
  }
  if (!input.modelCredentialId) {
    throw new GenerationError('modelCredentialId is required', 500);
  }
  if (!input.modelId) {
    throw new GenerationError('modelId is required', 500);
  }

  const runId = randomBytes(16).toString('hex');
  const start = Date.now();

  // 1. Resolve augmentation stack first — fail fast if the user's stack
  //    references an id that was removed from the seed.
  let systemPrompt: string;
  try {
    systemPrompt = await resolveStack(input.augmentationStack);
  } catch (e) {
    if (e instanceof AugmentationResolverError) {
      throw new GenerationError(e.message, e.statusCode);
    }
    throw e;
  }

  // 2. Decrypt the credential. If this fails, the credential row exists
  //    but the encryption key is wrong (or the row was tampered with).
  //    We log credential_decryption_failed but do NOT save a run row —
  //    we have no model to attribute the failure to.
  const meta = await getCredentialMeta(input.modelCredentialId, input.userId);
  if (!meta) {
    // Same 500 as decrypt-failure below to close the credential-existence
    // oracle. The detail goes into the audit log only.
    await logEvent({
      userId: input.userId,
      action: 'credential_used',
      targetType: 'credential',
      targetId: input.modelCredentialId,
      metadata: { result: 'not_found' },
    });
    throw new GenerationError('model credential could not be decrypted (ENCRYPTION_KEY may be wrong)', 500);
  }

  // Pull ENCRYPTION_KEY from the env. The runner does not import resolveEnv
  // directly to keep the test surface small; the route layer resolves env.
  const encryptionKey = readEncryptionKeyFromEnv();
  if (!encryptionKey) {
    throw new GenerationError('ENCRYPTION_KEY is not set in the environment', 500);
  }

  let credentialWithKey;
  try {
    credentialWithKey = await getDecryptedCredential(input.modelCredentialId, input.userId, encryptionKey);
  } catch (e) {
    if (e instanceof CredentialError) {
      await logEvent({
        userId: input.userId,
        action: 'credential_decryption_failed',
        targetType: 'credential',
        targetId: input.modelCredentialId,
      });
      throw new GenerationError(
        'model credential could not be decrypted (ENCRYPTION_KEY may be wrong)',
        500,
      );
    }
    throw e;
  }
  if (!credentialWithKey) {
    // Same status code as decryption failure to prevent an oracle
    // that distinguishes "credential does not exist" from "credential
    // exists but is unreadable". The detail goes into the audit log
    // via credential_used / credential_decryption_failed, not the
    // response.
    await logEvent({
      userId: input.userId,
      action: 'credential_used',
      targetType: 'credential',
      targetId: input.modelCredentialId,
      metadata: { result: 'not_found' },
    });
    throw new GenerationError('model credential could not be decrypted (ENCRYPTION_KEY may be wrong)', 500);
  }

  // 3. Call the provider.
  let result: Awaited<ReturnType<typeof callProvider>>;
  try {
    result = await callProvider({
      provider: meta.provider,
      apiKey: credentialWithKey.key,
      modelId: input.modelId,
      systemPrompt,
      userPrompt: input.promptBody,
      params: input.params,
      timeoutMs: input.timeoutMs,
      baseUrl: meta.baseUrl ?? undefined,
    });
  } catch (e) {
    // Provider failed. Save the run row with the failure (no generatedHtml,
    // captured error message) and re-raise. A save failure here must not
    // mask the original error.
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStatus = e instanceof ProviderError ? e.statusCode : 502;
    const durationMs = Date.now() - start;
    try {
      await saveRunRowInternal({
        runId,
        userId: input.userId,
        promptId: input.promptId ?? null,
        promptBody: input.promptBody,
        modelCredentialId: input.modelCredentialId,
        modelId: input.modelId,
        augmentationStack: input.augmentationStack,
        generatedHtml: null,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        lintReport: { error: errMsg, status: errStatus },
      });
    } catch (saveErr) {
      // If even the failure-row save fails, log and continue. The user
      // gets a 502 either way; losing one audit row is preferable to
      // masking the original error.
      // eslint-disable-next-line no-console
      console.error('[generation] failed to save failed-run row:', saveErr);
    }
    throw new GenerationError(errMsg, errStatus);
  }

  const durationMs = Date.now() - start;

  // 4. Run the deterministic lint on the generated HTML. Failures here
  //    must not fail the run -- the user still gets their generation,
  //    just with no lint report.
  let lintReportJson: string | null = null;
  try {
    const { runLint } = await import('../lint/runner');
    const lintReport = runLint(result.text);
    lintReportJson = JSON.stringify(lintReport);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[generation] lint failed:', e);
  }

  // 5. Save the successful run row, bump last_used_at, write audit log.
  //    Postgres has no synchronous `db.transaction()` API in the DbClient
  //    yet, so the two writes are sequential awaits. They are not in an
  //    atomic transaction, so a crash between them leaves a run row
  //    without the touch update (or vice versa). For now this is
  //    acceptable; proper transaction support can be added later.
  await saveRunRowInternal({
    runId,
    userId: input.userId,
    promptId: input.promptId ?? null,
    promptBody: input.promptBody,
    modelCredentialId: input.modelCredentialId,
    modelId: input.modelId,
    augmentationStack: input.augmentationStack,
    generatedHtml: result.text,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs,
    lintReport: lintReportJson,
  });
  await touchCredentialInternal(input.modelCredentialId, input.userId);

  // 6. Audit log: credential was successfully used. Audit is
  //    fail-soft internally; we don't need to guard the await.
  await logEvent({
    userId: input.userId,
    action: 'credential_used',
    targetType: 'credential',
    targetId: input.modelCredentialId,
    metadata: { runId, modelId: input.modelId },
  });

  return {
    runId,
    generatedHtml: result.text,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs,
    providerResponseId: result.providerResponseId,
  };
}

// =====================================================================
// Helpers
// =====================================================================

function readEncryptionKeyFromEnv(): Buffer | null {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) return null;
  return buf;
}

async function touchCredentialInternal(credentialId: string, userId: string): Promise<void> {
  await getDb().run(
    'UPDATE model_credentials SET last_used_at = ? WHERE id = ? AND user_id = ?',
    Date.now(),
    credentialId,
    userId,
  );
}

interface SaveRunRowInput {
  runId: string;
  userId: string;
  promptId?: string | null;
  promptBody: string;
  modelCredentialId: string;
  modelId: string;
  augmentationStack: AugmentationRef[];
  generatedHtml: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  /** JSON-encoded lint report (string), or a {error, status} object for the
   * failure path. null means no lint was run. */
  lintReport: string | { error: string; status: number } | null;
}

async function saveRunRowInternal(input: SaveRunRowInput): Promise<void> {
  // lintReport is already a JSON-encoded string when set by the success
  // path, or an object on the failure path. The DB column is TEXT; we
  // store either a string as-is or stringify the failure object once.
  const lintReportColumn: string | null =
    input.lintReport === null
      ? null
      : typeof input.lintReport === 'string'
        ? input.lintReport
        : JSON.stringify(input.lintReport);
  await getDb().run(
    `INSERT INTO runs
      (id, user_id, prompt_id, prompt_body, model_credential_id, model_id,
       model_params, augmentation_stack, generated_html, generated_tokens_used,
       duration_ms, lint_report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.runId,
    input.userId,
    input.promptId ?? null,
    input.promptBody,
    input.modelCredentialId,
    input.modelId,
    '{}',
    JSON.stringify(input.augmentationStack),
    input.generatedHtml,
    input.inputTokens + input.outputTokens,
    input.durationMs,
    lintReportColumn,
  );
}

// Re-export the Provider type for the route layer
export type { Provider };
