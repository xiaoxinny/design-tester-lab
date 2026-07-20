import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return NextResponse.json({
    supabaseEnabled: Boolean(supabaseUrl),
    providers: supabaseUrl ? ['github', 'google'] : [],
    magicLinkEnabled: Boolean(supabaseUrl),
  })
}
