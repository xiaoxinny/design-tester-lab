import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Explicit list of enabled OAuth providers (comma-separated)
  // Example: AUTH_PROVIDERS=github,google
  const providersRaw = process.env.AUTH_PROVIDERS || ''
  const providers = providersRaw
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean)

  return NextResponse.json({
    supabaseEnabled: Boolean(supabaseUrl && supabaseKey),
    providers,
    magicLinkEnabled: Boolean(supabaseUrl && supabaseKey),
  })
}
