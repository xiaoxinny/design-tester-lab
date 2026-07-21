import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUser } from '@/lib/auth-guard'
import { resolveEnv } from '@/lib/env'
import { SESSION_COOKIE_NAME } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const env = resolveEnv()
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  const cookieHeader = sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie.value}` : null
  const user = await getCurrentUser({
    authDisabled: env.authDisabled,
    cookieHeader,
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <Sidebar />
      {/* Mobile: top padding for the fixed header bar; Desktop: left margin for sidebar */}
      <main className="pt-14 md:pt-0 md:ml-56 min-h-screen p-6">
        {children}
      </main>
    </div>
  )
}
