import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'OAuth not configured' }, { status: 404 })
  }
  let body: { provider: string; redirectTo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const origin = req.headers.get('origin') || req.nextUrl.origin
  const callbackUrl = body.redirectTo
    ? `${origin}${body.redirectTo}`
    : `${origin}/api/auth/callback`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: body.provider as any,
    options: { redirectTo: callbackUrl },
  })
  if (error || !data?.url) {
    return NextResponse.json({ error: error?.message ?? 'oauth_init_failed' }, { status: 400 })
  }
  return NextResponse.json({ url: data.url })
}