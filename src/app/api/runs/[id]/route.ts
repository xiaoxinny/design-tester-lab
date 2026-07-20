import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { requireUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'
import { applyRateLimit, applyPreAuthRateLimit } from '@/lib/rate-limit-http'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req)
  if (preLimited) return preLimited
  let userId: string
  try {
    userId = requireUser({ authDisabled: resolveEnv().authDisabled, cookieHeader: req.headers.get('cookie') }).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  const { id } = await ctx.params
  const run = getDb().prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(id, userId) as any
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ run: { ...run, augmentationStack: JSON.parse(run.augmentation_stack || '[]'), lintReport: run.lint_report ? JSON.parse(run.lint_report) : null, isPublic: Boolean(run.is_public) } })
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const preLimited = applyPreAuthRateLimit(req)
  if (preLimited) return preLimited
  let userId: string
  try {
    userId = requireUser({ authDisabled: resolveEnv().authDisabled, cookieHeader: req.headers.get('cookie') }).userId
  } catch {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  const limited = applyRateLimit(req, 'credentials.write', userId)
  if (limited) return limited
  const { id } = await ctx.params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  // Only allow updating rating and notes
  const updates: string[] = []
  const params: any[] = []
  if (typeof body.userRating === 'number' && body.userRating >= 1 && body.userRating <= 5) {
    updates.push('user_rating = ?')
    params.push(body.userRating)
  }
  if (typeof body.userNotes === 'string') {
    updates.push('user_notes = ?')
    params.push(body.userNotes)
  }
  if (updates.length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })

  params.push(id, userId)
  const result = getDb().prepare('UPDATE runs SET ' + updates.join(', ') + ' WHERE id = ? AND user_id = ?').run(...params)
  if (result.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}