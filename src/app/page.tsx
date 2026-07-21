import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import { getCurrentUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const env = resolveEnv()
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const cookieHeader = sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie.value}` : null
  const user = await getCurrentUser({
    authDisabled: env.authDisabled,
    cookieHeader,
  })

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}