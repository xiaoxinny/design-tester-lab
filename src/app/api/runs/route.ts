import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { requireUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req)
  if (preLimited) return preLimited

  let userId: string
  try {
    userId = (await requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const limited = applyRateLimit(req, 'credentials.read', userId)
  if (limited) return limited

  // Query params for filtering (clamp to valid range, reject NaN)
  const url = new URL(req.url)
  const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10)
  const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100)
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0)

  const db = getDb()
  const runs = await db.all<{
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
    'SELECT id, prompt_body, model_id, augmentation_stack, generated_html, lint_report, user_rating, user_notes, duration_ms, generated_tokens_used, is_public, share_slug, created_at FROM runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    userId, limit, offset,
  )

  const totalRow = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM runs WHERE user_id = ?',
    userId,
  )
  const total = totalRow?.count ?? 0

  function safeJson(raw: string | null, fallback: unknown = null): unknown {
    if (!raw) return fallback
    try { return JSON.parse(raw) } catch { return fallback }
  }

  return NextResponse.json({
    runs: runs.map(r => ({
      ...r,
      augmentationStack: safeJson(r.augmentation_stack, []),
      lintReport: safeJson(r.lint_report),
      isPublic: Boolean(r.is_public),
    })),
    total,
    limit,
    offset,
  })
}
