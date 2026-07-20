'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const providers = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
]

export function OAuthButtons() {
  const [loading, setLoading] = useState<string | null>(null)

  // Only render if Supabase is configured (NEXT_PUBLIC_ vars are inlined at build time)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null

  async function handleOAuth(provider: string) {
    setLoading(provider)
    try {
      const res = await fetch('/api/auth/oauth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setLoading(null)
      }
    } catch {
      setLoading(null)
    }
  }

  return (
    <div data-testid='oauth-section' className='mt-4'>
      <div className='relative mb-4'>
        <div className='absolute inset-0 flex items-center'>
          <div className='w-full border-t border-border' />
        </div>
        <div className='relative flex justify-center text-xs'>
          <span className='bg-surface px-2 text-text-muted'>Or continue with</span>
        </div>
      </div>
      <div className='flex flex-col gap-2'>
        {providers.map(p => (
          <Button
            key={p.id}
            type='button'
            variant='secondary'
            className='w-full'
            disabled={loading !== null}
            onClick={() => handleOAuth(p.id)}
          >
            {loading === p.id ? 'Redirecting...' : p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}