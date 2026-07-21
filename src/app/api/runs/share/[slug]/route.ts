import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { slug } = await ctx.params
  const run = await getDb().get<{ augmentation_stack: string; lint_report: string | null; is_public: number; [k: string]: unknown }>(
    'SELECT * FROM runs WHERE share_slug = ? AND is_public = 1',
    slug,
  )
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    run: {
      ...run,
      augmentationStack: JSON.parse(run.augmentation_stack || '[]'),
      lintReport: run.lint_report ? JSON.parse(run.lint_report) : null,
      isPublic: Boolean(run.is_public),
    },
  })
}
