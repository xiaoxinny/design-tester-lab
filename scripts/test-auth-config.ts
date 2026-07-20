import { strict as assert } from 'node:assert'

async function main() {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://runtime.supabase.co'
    const { GET } = await import('../src/app/api/auth/config/route')
    const enabled = await GET()
    assert.deepEqual(await enabled.json(), {
      supabaseEnabled: true,
      supabaseUrl: 'https://runtime.supabase.co',
      providers: ['github', 'google'],
      magicLinkEnabled: true,
    })

    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const disabled = await GET()
    assert.deepEqual(await disabled.json(), {
      supabaseEnabled: false,
      supabaseUrl: null,
      providers: [],
      magicLinkEnabled: false,
    })

    console.log('OK: runtime auth config reflects the server environment')
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
