import { test, expect } from '@playwright/test'

test.describe('OAuth buttons', () => {
  test('login page shows OAuth buttons when Supabase is configured', async ({ page }) => {
    await page.goto('/login')
    // OAuth section should be visible (the "Or continue with" divider)
    // This only works if the dev server has NEXT_PUBLIC_SUPABASE_URL set
    // When Supabase vars are NOT set, OAuth buttons should be hidden
    const oauthSection = page.locator('[data-testid="oauth-section"]')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      await expect(oauthSection).toBeVisible()
      await expect(page.locator('button:has-text("Google")')).toBeVisible()
    } else {
      // In local mode (no Supabase), OAuth section should not exist
      await expect(oauthSection).not.toBeVisible()
    }
  })

  test('signup page shows OAuth buttons when Supabase is configured', async ({ page }) => {
    await page.goto('/signup')
    const oauthSection = page.locator('[data-testid="oauth-section"]')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      await expect(oauthSection).toBeVisible()
    } else {
      await expect(oauthSection).not.toBeVisible()
    }
  })
})
