import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth-guard';
import { resolveEnv } from '@/lib/env';
import { applyPreAuthRateLimit, applyRateLimit } from '@/lib/rate-limit-http';

export const dynamic = 'force-dynamic';

type ComparisonRow = {
  id: string;
  user_id: string;
  run_a_id: string;
  run_b_id: string;
  winner: 'a' | 'b' | 'tie';
  notes: string | null;
  created_at: number;
};

function authenticate(req: NextRequest): string | NextResponse {
  try {
    return requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    }).userId;
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;

  const auth = authenticate(req);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const limited = applyRateLimit(req, 'credentials.write', userId);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  const { runAId, runBId, winner, notes } = body as Record<string, unknown>;
  if (
    typeof runAId !== 'string' || !runAId ||
    typeof runBId !== 'string' || !runBId || runAId === runBId ||
    (winner !== 'a' && winner !== 'b' && winner !== 'tie') ||
    (notes !== undefined && typeof notes !== 'string')
  ) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  const ownedRuns = getDb().prepare(
    'SELECT COUNT(*) AS count FROM runs WHERE user_id = ? AND id IN (?, ?)',
  ).get(userId, runAId, runBId) as { count: number };
  if (ownedRuns.count !== 2) {
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const comparison: ComparisonRow = {
    id: randomUUID(),
    user_id: userId,
    run_a_id: runAId,
    run_b_id: runBId,
    winner,
    notes: notes ?? null,
    created_at: Date.now(),
  };
  getDb().prepare(
    'INSERT INTO run_comparisons (id, user_id, run_a_id, run_b_id, winner, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    comparison.id,
    comparison.user_id,
    comparison.run_a_id,
    comparison.run_b_id,
    comparison.winner,
    comparison.notes,
    comparison.created_at,
  );

  return NextResponse.json({ comparison }, { status: 201 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;

  const auth = authenticate(req);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const limited = applyRateLimit(req, 'credentials.read', userId);
  if (limited) return limited;

  const comparisons = getDb().prepare(
    'SELECT id, user_id, run_a_id, run_b_id, winner, notes, created_at FROM run_comparisons WHERE user_id = ? ORDER BY created_at DESC',
  ).all(userId) as ComparisonRow[];

  return NextResponse.json({ comparisons });
}
