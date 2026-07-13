/**
 * GET /api/credentials/[id]
 * DELETE /api/credentials/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleGetCredential, handleDeleteCredential, CredentialsHandlerError } from '@/lib/credentials-handlers';
import { requireUser } from '@/lib/auth-guard';
import { resolveEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

function getAuthedUserId(req: NextRequest): string {
  try {
    return requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    }).userId;
  } catch {
    throw new CredentialsHandlerError('not authenticated', 401);
  }
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const userId = getAuthedUserId(req);
    const credential = handleGetCredential(userId, ctx.params.id);
    return NextResponse.json({ credential }, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const userId = getAuthedUserId(req);
    handleDeleteCredential(userId, ctx.params.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    if (e instanceof CredentialsHandlerError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}