/**
 * POST /api/credentials and GET /api/credentials
 *
 * POST body: { provider, label, key, baseUrl? }
 *   Returns 201 with the credential metadata.
 *
 * GET returns the list of credentials for the authenticated user.
 *   The encrypted key is never included.
 *
 * DELETE /api/credentials/[id] removes a credential.
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleAddCredential, handleListCredentials, CredentialsHandlerError } from '@/lib/credentials-handlers';
import { requireUser } from '@/lib/auth-guard';
import { resolveEnv } from '@/lib/env';
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http';

export const dynamic = 'force-dynamic';

async function getAuthedUserId(req: NextRequest): Promise<string> {
  // Convert requireUser's AuthError (401) into CredentialsHandlerError so
  // the route's catch maps it to a 401 response. Without this, an expired
  // or malformed cookie becomes a 500 (Next.js default for an uncaught
  // exception thrown from a route handler).
  try {
    return (await requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })).userId;
  } catch {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Pre-auth, per-IP cheap bucket. Catches "no cookie" hammering before
  // the session-DB lookup in getAuthedUserId.
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;
  // Auth first so the per-user rate limit is keyed on the userId, not
  // the IP. Auth failures (401) don't consume a token.
  let userId: string;
  try {
    userId = await getAuthedUserId(req);
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
  const limited = applyRateLimit(req, 'credentials.write', userId);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  try {
    const credential = await handleAddCredential(userId, body);
    return NextResponse.json({ credential }, { status: 201 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;
  try {
    const userId = await getAuthedUserId(req);
    const limited = applyRateLimit(req, 'credentials.read', userId);
    if (limited) return limited;
    const result = await handleListCredentials(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}
