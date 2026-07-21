import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDb } from '@/db/client'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/session'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  // Prefer configured app origin; fall back to the request origin only when
  // NEXT_PUBLIC_APP_URL is unset. This prevents an attacker-controlled
  // Host/Referer header from redirecting the user off-site.
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin

  const code = url.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createSupabaseServerClient()
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !sessionData.user?.email) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }

  // Reject unverified emails: an attacker who controls a victim's email
  // address must not be able to sign in as that victim just because they
  // can receive the verification mail first.
  if (!sessionData.user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/login?error=email_unverified', origin))
  }

  const email = sessionData.user.email
  const db = getDb()

  // Find or create user in our users table.
  // SECURITY: do NOT auto-link an OAuth sign-in to an existing email/password
  // account. Silent linking would let any attacker who controls a victim's
  // mailbox OAuth into the victim's account without ever knowing the
  // password. Existing email/password users must sign in with their password
  // and link OAuth explicitly from settings.
  const existing = await db.get<{ id: string }>(
    'SELECT id FROM users WHERE email = ?',
    email,
  )

  let user: { id: string }
  if (existing) {
    return NextResponse.redirect(
      new URL('/login?error=account_exists', origin),
    )
  } else {
    const id = randomBytes(16).toString('hex')
    // OAuth users get a random unguessable password hash (they authenticate via OAuth, not password)
    const placeholderHash = '=19=65536,t=3,p=4$' + randomBytes(16).toString('base64') + '$' + randomBytes(32).toString('base64')
    await db.run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      id, email, placeholderHash,
    )
    user = { id }
  }

  // Create a session in our sessions table
  const { session, cookie } = await createSession({ userId: user.id })

  // Set the session cookie and redirect to dashboard
  const response = NextResponse.redirect(new URL('/dashboard', origin))
  response.cookies.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
    path: cookie.path,
    expires: cookie.expires,
  })
  return response
}
