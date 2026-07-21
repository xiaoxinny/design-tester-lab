import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { requireUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

const MAX_NOTES_LENGTH = 10000

function safeJsonParse(raw: string | null, fallback: unknown = null): unknown {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req)
  if (preLimited) return preLimited
  let userId: string
  try {
    userId = (await requireUser({ authDisabled: resolveEnv().authDisabled, cookieHeader: req.headers.get('cookie') })).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  const limited = applyRateLimit(req, 'credentials.read', userId)
  if (limited) return limited

  const { id } = await ctx.params
  const run = await getDb().get<{
    id: string
    prompt_body: string
    model_id: string
    augmentation_stack: string
    generated_html: string | null
    lint_report: string | null
    user_rating: number | null
    user_notes: string | null
    duration_ms: number | null
    generated_tokens_used: number | null
    is_public: number
    share_slug: string | null
    created_at: number
  }>(
    'SELECT id, prompt_body, model_id, augmentation_stack, generated_html, lint_report, user_rating, user_notes, duration_ms, generated_tokens_used, is_public, share_slug, created_at FROM runs WHERE id = ? AND user_id = ?',
    id, userId,
  )

  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    run: {
      id: run.id,
      prompt_body: run.prompt_body,
      model_id: run.model_id,
      augmentationStack: safeJsonParse(run.augmentation_stack, []),
      generated_html: run.generated_html,
      lintReport: safeJsonParse(run.lint_report),
      user_rating: run.user_rating,
      user_notes: run.user_notes,
      duration_ms: run.duration_ms,
      generated_tokens_used: run.generated_tokens_used,
      isPublic: Boolean(run.is_public),
      share_slug: run.share_slug,
      created_at: run.created_at,
    },
  })
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req)
  if (preLimited) return preLimited
  let userId: string
  try {
    userId = (await requireUser({ authDisabled: resolveEnv().authDisabled, cookieHeader: req.headers.get('cookie') })).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  const limited = applyRateLimit(req, 'credentials.write', userId)
  if (limited) return limited
  const { id } = await ctx.params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const updates: string[] = []
  const params: (string | number)[] = []

  // Validate rating explicitly
  if ('userRating' in body) {
    const rating = body.userRating
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'userRating must be an integer between 1 and 5' }, { status: 400 })
    }
    updates.push('user_rating = ?')
    params.push(rating)
  }

  // Validate notes with length cap
  if ('userNotes' in body) {
    if (typeof body.userNotes !== 'string') {
      return NextResponse.json({ error: 'userNotes must be a string' }, { status: 400 })
    }
    if (body.userNotes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: `userNotes must be at most ${MAX_NOTES_LENGTH} characters` }, { status: 400 })
    }
    updates.push('user_notes = ?')
    params.push(body.userNotes)
  }

  if (updates.length === 0) return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })

  params.push(id, userId)
  const result = await getDb().run('UPDATE runs SET ' + updates.join(', ') + ' WHERE id = ? AND user_id = ?', ...params)
  if (result.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
