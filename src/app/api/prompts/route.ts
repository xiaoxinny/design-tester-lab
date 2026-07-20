import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { requireUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const env = resolveEnv()
  let userId: string | null = null

  // Try to get the authenticated user, but don't require it
  try {
    const user = requireUser({
      authDisabled: env.authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })
    userId = user.userId
  } catch {
    // Not authenticated — only return system prompts
  }

  // Query system prompts (visible to everyone)
  const systemPrompts = getDb().prepare(
    'SELECT id, title, body, category, difficulty, expected_tokens FROM prompts WHERE is_system = 1 ORDER BY category, title'
  ).all() as Array<{
    id: string
    title: string
    body: string
    category: string | null
    difficulty: string | null
    expected_tokens: number | null
  }>

  // Query user's own prompts (if authenticated)
  let userPrompts: typeof systemPrompts = []
  if (userId) {
    userPrompts = getDb().prepare(
      'SELECT id, title, body, category, difficulty, expected_tokens FROM prompts WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as typeof systemPrompts
  }

  return NextResponse.json({
    system: systemPrompts,
    user: userPrompts,
  })
}
