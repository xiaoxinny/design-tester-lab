'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const providers = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
]

export function OAuthButtons() {
  const [loading, setLoading] = useState<string | null>(null)
  const [magicEmail, setMagicEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)

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

  async function sendMagicLink() {
    if (!magicEmail || sending) return
    setSending(true)
    setMagicError(null)
    setMagicLinkSent(false)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: magicEmail }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setMagicLinkSent(true)
      } else {
        setMagicError(data.error ?? 'Failed to send magic link')
      }
    } catch {
      setMagicError('Failed to send magic link')
    } finally {
      setSending(false)
    }
  }

  return (
    <div data-testid='oauth-section' className='mt-4'>
      <div className='mb-4'>
        <p className='text-xs text-text-muted mb-2 text-center'>
          Or sign in with a magic link
        </p>
        <div className='flex gap-2'>
          <input
            type='email'
            placeholder='Email address'
            value={magicEmail}
            onChange={e => setMagicEmail(e.target.value)}
            className='flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus focus:shadow-glow disabled:opacity-50 transition-colors duration-150'
            disabled={sending}
          />
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={sendMagicLink}
            disabled={!magicEmail || sending}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        {magicLinkSent && (
          <p className='text-xs text-accent mt-2 text-center'>
            Check your email for the login link
          </p>
        )}
        {magicError && (
          <p className='text-xs text-danger mt-2 text-center'>{magicError}</p>
        )}
      </div>

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
