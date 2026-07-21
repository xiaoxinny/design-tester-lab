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
    const user = await requireUser({
      authDisabled: env.authDisabled,
      cookieHeader: req.headers.get('cookie'),
    })
    userId = user.userId
  } catch {
    // Not authenticated — only return system prompts
  }

  const db = getDb()

  // Query system prompts (visible to everyone)
  const systemPrompts = await db.all<{
    id: string
    title: string
    body: string
    category: string | null
    difficulty: string | null
    expected_tokens: number | null
  }>(
    'SELECT id, title, body, category, difficulty, expected_tokens FROM prompts WHERE is_system = 1 ORDER BY category, title',
  )

  // Query user's own prompts (if authenticated)
  let userPrompts: typeof systemPrompts = []
  if (userId) {
    userPrompts = await db.all<{
      id: string
      title: string
      body: string
      category: string | null
      difficulty: string | null
      expected_tokens: number | null
    }>(
      'SELECT id, title, body, category, difficulty, expected_tokens FROM prompts WHERE user_id = ? ORDER BY created_at DESC',
      userId,
    )
  }

  return NextResponse.json({
    system: systemPrompts,
    user: userPrompts,
  })
}
