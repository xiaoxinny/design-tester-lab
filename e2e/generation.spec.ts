import { test, expect } from '@playwright/test'

test.describe('Generation workspace', () => {
  const testEmail = `gen-e2e-${Date.now()}@test.local`
  const testPassword = 'testpassword123'

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('#password', testPassword)
    await page.fill('#confirm-password', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(300)
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 20000 })
  })

  test('generate page is accessible from sidebar', async ({ page }) => {
    await page.click('text=Generate')
    await expect(page).toHaveURL(/\/generate/)
    await expect(page.locator('h1')).toContainText('Generate')
  })

  test('generate page shows prompt input area', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.locator('textarea[name="prompt"]')).toBeVisible()
  })

  test('generate page shows augmentation picker with categories', async ({ page }) => {
    await page.goto('/generate')
    // The 3 augmentation categories should be visible
    await expect(page.locator('h3:has-text("Tokens")')).toBeVisible()
    await expect(page.locator('h3:has-text("Principles")')).toBeVisible()
    await expect(page.locator('h3:has-text("Behavior")')).toBeVisible()
  })

  test('augmentation picker shows seeded augmentations', async ({ page }) => {
    await page.goto('/generate')
    // Some of the 8 seeded augmentations should be visible
    await expect(page.locator('text=shadcn-tokens').first()).toBeVisible()
    await expect(page.locator('text=constitution-tier-1-2').first()).toBeVisible()
  })

  test('selecting conflicting augmentations disables the conflicting one', async ({ page }) => {
    await page.goto('/generate')
    // shadcn-tokens conflicts with m3-tokens and better-design-default
    // Click shadcn-tokens to select it
    await page.locator('[data-augmentation-id="shadcn-tokens"]').click()
    // m3-tokens should now be disabled (it conflicts with shadcn-tokens)
    await expect(page.locator('[data-augmentation-id="m3-tokens"]')).toBeDisabled()
  })

  test('generate page shows model selector (requires credential)', async ({ page }) => {
    await page.goto('/generate')
    // Should show a credential/model selector area
    await expect(page.locator('h2:has-text("Model")')).toBeVisible()
  })

  test('generate button is disabled without required fields', async ({ page }) => {
    await page.goto('/generate')
    // Generate button should be disabled when prompt is empty or no credential selected
    const generateBtn = page.locator('button:has-text("Generate")')
    await expect(generateBtn).toBeDisabled()
  })

  test('typing a prompt enables checking for generate readiness', async ({ page }) => {
    await page.goto('/generate')
    await page.fill('textarea[name="prompt"]', 'Create a dashboard with charts')
    // Still disabled because no credential is selected
    const generateBtn = page.locator('button:has-text("Generate")')
    await expect(generateBtn).toBeDisabled()
  })
})
