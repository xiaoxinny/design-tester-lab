import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  const testEmail = 'e2e-test-' + Date.now() + '@test.local'
  const testPassword = 'testpassword123'

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Log in')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('signup page renders correctly', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1')).toContainText('Create account')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('signup with mismatched passwords shows error', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('input[type="email"]', 'test@test.local')
    await page.fill('#password', 'password123')
    await page.fill('#confirm-password', 'differentpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Passwords do not match')).toBeVisible()
  })

  test('full auth flow: signup → dashboard → logout → login', async ({ page }) => {
    // Signup
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('#password', testPassword)
    await page.fill('#confirm-password', testPassword)
    await page.click('button[type="submit"]')

    // Should redirect to / which then redirects to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Logout
    await page.click('text=Log out')

    // Should redirect to /login
    await page.waitForURL(/\/login/, { timeout: 10000 })

    // Login with same credentials
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')

    // Should be back on dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'nonexistent@test.local')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Should show an error (the inline error message)
    await expect(page.locator('[aria-live="polite"]')).toBeVisible({ timeout: 5000 })
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page')
    await expect(page.locator('text=404')).toBeVisible()
    await expect(page.locator('text=Page not found')).toBeVisible()
  })
})