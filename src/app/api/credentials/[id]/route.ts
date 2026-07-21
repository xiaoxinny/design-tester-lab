/**
 * GET /api/credentials/[id]
 * DELETE /api/credentials/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleGetCredential, handleDeleteCredential, CredentialsHandlerError } from '@/lib/credentials-handlers';
import { requireUser } from '@/lib/auth-guard';
import { resolveEnv } from '@/lib/env';
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http';

export const dynamic = 'force-dynamic';

// Next 15 made route context params async. Await before reading.
interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getAuthedUserId(req: NextRequest): Promise<string> {
  try {
    return (await requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })).userId;
  } catch {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;
  try {
    const userId = await getAuthedUserId(req);
    const limited = applyRateLimit(req, 'credentials.read', userId);
    if (limited) return limited;
    const { id } = await ctx.params;
    const credential = await handleGetCredential(userId, id);
    return NextResponse.json({ credential }, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;
  try {
    const userId = await getAuthedUserId(req);
    const limited = applyRateLimit(req, 'credentials.write', userId);
    if (limited) return limited;
    const { id } = await ctx.params;
    await handleDeleteCredential(userId, id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}
