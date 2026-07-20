import { test, expect } from '@playwright/test'

test.describe('OAuth buttons', () => {
  test('login page uses the runtime auth config to show OAuth buttons', async ({ page }) => {
    await page.route('/api/auth/config', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          supabaseEnabled: true,
          supabaseUrl: 'https://runtime.supabase.co',
          providers: ['github', 'google'],
          magicLinkEnabled: true,
        }),
      })
    )

    await page.goto('/login')

    const oauthSection = page.locator('[data-testid="oauth-section"]')
    await expect(oauthSection).toBeVisible()
    await expect(page.getByRole('button', { name: 'Google' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'GitHub' })).toBeVisible()
  })

  test('signup page hides OAuth buttons when runtime auth is disabled', async ({ page }) => {
    await page.route('/api/auth/config', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          supabaseEnabled: false,
          supabaseUrl: null,
          providers: [],
          magicLinkEnabled: false,
        }),
      })
    )

    await page.goto('/signup')

    await expect(page.locator('[data-testid="oauth-section"]')).not.toBeVisible()
  })
})
