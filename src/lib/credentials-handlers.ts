/**
 * Transport-agnostic credentials API handlers.
 *
 * Mirrors auth-handlers.ts in shape: each function takes a parsed body and
 * returns a result or throws a CredentialsHandlerError. The Next.js route
 * handler in route.ts wraps these for HTTP transport.
 */
import { z } from 'zod';
import { resolveEnv } from './env';
import { addCredential, listCredentials, deleteCredential, getCredentialMeta, CredentialError, PROVIDERS, type CredentialMeta, type Provider } from './model-credentials';
import { logEvent } from './audit';

export class CredentialsHandlerError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'CredentialsHandlerError';
    this.statusCode = statusCode;
  }
}

export const AddCredentialBody = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'ollama', 'custom'] as const),
  label: z.string().min(1).max(100),
  key: z.string().min(1).max(10000),
  // SSRF defense: only http(s) URLs accepted. file://, ftp://, gopher://
  // and other schemes would let a user-supplied baseUrl reach internal
  // network endpoints (e.g. cloud metadata services) when the generation
  // runner uses it.
  baseUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'baseUrl must be an http(s) URL',
    })
    .optional(),
});

export interface ListResult {
  credentials: CredentialMeta[];
}

export async function handleAddCredential(
  userId: string,
  rawBody: unknown,
): Promise<CredentialMeta> {
  if (!userId) {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
  const parsed = AddCredentialBody.safeParse(rawBody);
  if (!parsed.success) {
    throw new CredentialsHandlerError(
      parsed.error.issues.map((i) => i.message).join(', ') || 'invalid request body',
      400,
    );
  }
  const { provider, label, key, baseUrl } = parsed.data;
  const env = resolveEnv();
  try {
    const credential = addCredential({
      userId,
      provider: provider as Provider,
      label,
      key,
      baseUrl,
      encryptionKey: env.encryptionKey,
    });
    logEvent({
      userId,
      action: 'credential_added',
      targetType: 'credential',
      targetId: credential.id,
      metadata: { provider: credential.provider, label: credential.label },
    });
    return credential;
  } catch (e) {
    if (e instanceof CredentialError) {
      throw new CredentialsHandlerError(e.message, e.statusCode);
    }
    throw e;
  }
}

export function handleListCredentials(userId: string): ListResult {
  if (!userId) {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
  return { credentials: listCredentials(userId) };
}

export function handleDeleteCredential(userId: string, credentialId: string): void {
  if (!userId) {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
  if (!credentialId) {
    throw new CredentialsHandlerError('credential id is required', 400);
  }
  // Read the metadata BEFORE deletion so the audit row records what was
  // deleted — otherwise forensic queries "what did user X delete at time T?"
  // can only see an opaque targetId with no context.
  const meta = getCredentialMeta(credentialId, userId);
  if (!meta || !deleteCredential(credentialId, userId)) {
    throw new CredentialsHandlerError('credential not found', 404);
  }
  logEvent({
    userId,
    action: 'credential_deleted',
    targetType: 'credential',
    targetId: credentialId,
    metadata: { provider: meta.provider, label: meta.label },
  });
}

export function handleGetCredential(userId: string, credentialId: string): CredentialMeta {
  if (!userId) {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
  if (!credentialId) {
    throw new CredentialsHandlerError('credential id is required', 400);
  }
  const meta = getCredentialMeta(credentialId, userId);
  if (!meta) {
    throw new CredentialsHandlerError('credential not found', 404);
  }
  return meta;
}

export { PROVIDERS };