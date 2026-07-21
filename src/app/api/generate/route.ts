/**
 * POST /api/generate
 *
 * Body: {
 *   promptBody: string,
 *   promptId?: string | null,
 *   modelCredentialId: string,
 *   modelId: string,
 *   augmentationStack: Array<{ id: string, version: string }>,
 *   params?: { maxTokens?, temperature?, topP? },
 *   timeoutMs?: number
 * }
 *
 * Returns 200 with { runId, generatedHtml, inputTokens, outputTokens,
 * durationMs, providerResponseId } on success.
 *
 * Errors:
 *   400 invalid input or unknown augmentation in stack
 *   401 not authenticated
 *   404 model credential not found
 *   500 decryption failure or other internal error
 *   502 upstream provider error
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runGeneration, GenerationError } from '@/lib/generation/runner';
import { resolveEnv } from '@/lib/env';
import { requireUser } from '@/lib/auth-guard';
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http';

export const dynamic = 'force-dynamic';

const GenerateBody = z.object({
  promptBody: z.string().min(1),
  promptId: z.string().nullable().optional(),
  modelCredentialId: z.string().min(1),
  modelId: z.string().min(1),
  augmentationStack: z.array(
    z.object({
      id: z.string().min(1),
      version: z.string().min(1),
    }),
  ),
  params: z
    .object({
      maxTokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional(),
    })
    .optional(),
  timeoutMs: z.number().int().positive().max(5 * 60_000).optional(),
});

async function getAuthedUserId(req: NextRequest): Promise<string> {
  try {
    return (await requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })).userId;
  } catch {
    // 401 is signalled by throwing a GenerationError so the route's catch
    // maps it to the right status code.
    throw new GenerationError('not authenticated', 401);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Pre-auth, per-IP cheap bucket. Catches "no cookie" hammering before
  // the session-DB lookup in getAuthedUserId.
  const preLimited = applyPreAuthRateLimit(req);
  if (preLimited) return preLimited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = GenerateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    userId = await getAuthedUserId(req);
  } catch (e) {
    if (e instanceof GenerationError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
  // Per-user rate limit on the most expensive route. 10/minute default
  // -- a real user generates, reviews, generates, reviews. Higher than
  // that and they're either scripting or compromised.
  const limited = applyRateLimit(req, 'generate', userId);
  if (limited) return limited;

  try {
    const result = await runGeneration({
      userId,
      ...parsed.data,
    });
    return NextResponse.json(
      {
        runId: result.runId,
        generatedHtml: result.generatedHtml,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: result.durationMs,
        providerResponseId: result.providerResponseId,
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof GenerationError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    throw e;
  }
}
