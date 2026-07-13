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

export const dynamic = 'force-dynamic';

function getAuthedUserId(req: NextRequest): string {
  // Convert requireUser's AuthError (401) into CredentialsHandlerError so
  // the route's catch maps it to a 401 response. Without this, an expired
  // or malformed cookie becomes a 500 (Next.js default for an uncaught
  // exception thrown from a route handler).
  try {
    return requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    }).userId;
  } catch {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  try {
    const userId = getAuthedUserId(req);
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
  try {
    const userId = getAuthedUserId(req);
    const result = handleListCredentials(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}