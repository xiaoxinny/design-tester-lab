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
    userId = requireUser({
      authDisabled: resolveEnv().authDisabled,
      cookieHeader: req.headers.get('cookie'),
    }).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const limited = applyRateLimit(req, 'credentials.read', userId)
  if (limited) return limited

  // Query params for filtering
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const runs = getDb().prepare(
    'SELECT id, prompt_body, model_id, augmentation_stack, generated_html, lint_report, user_rating, user_notes, duration_ms, generated_tokens_used, is_public, share_slug, created_at FROM runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, limit, offset) as Array<{
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
  }>

  const total = (getDb().prepare('SELECT COUNT(*) as count FROM runs WHERE user_id = ?').get(userId) as { count: number }).count

  return NextResponse.json({
    runs: runs.map(r => ({
      ...r,
      augmentationStack: JSON.parse(r.augmentation_stack || '[]'),
      lintReport: r.lint_report ? JSON.parse(r.lint_report) : null,
      isPublic: Boolean(r.is_public),
    })),
    total,
    limit,
    offset,
  })
}