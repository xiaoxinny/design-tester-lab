import { test, expect } from '@playwright/test'

test.describe('Credentials management', () => {
  const testEmail = `cred-e2e-${Date.now()}@test.local`
  const testPassword = 'testpassword123'

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto('/signup')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('#password', testPassword)
    await page.fill('#confirm-password', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(300)
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  })

  test('credentials page is accessible from sidebar', async ({ page }) => {
    await page.click('text=Credentials')
    await expect(page).toHaveURL(/\/credentials/)
    await expect(page.locator('h1')).toContainText('Credentials')
  })

  test('credentials page shows empty state when no credentials exist', async ({ page }) => {
    await page.goto('/credentials')
    await expect(page.locator('text=No credentials yet')).toBeVisible()
  })

  test('can add a new credential', async ({ page }) => {
    await page.goto('/credentials')
    await page.click('button:has-text("Add credential")')
    
    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Fill form
    await page.selectOption('select[name="provider"]', 'openai')
    await page.fill('input[name="label"]', 'My OpenAI Key')
    await page.fill('input[name="key"]', 'sk-test-key-1234567890')
    
    // Submit
    await page.click('[role="dialog"] button[type="submit"]')
    
    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
    
    // Wait a bit for refetch
    await page.waitForTimeout(500)
    
    // Verify credential appears — use data-testid to ensure we're looking at credential cards
    await expect(page.locator('[data-testid="delete-credential"]')).toHaveCount(1, { timeout: 5000 })
  })

  test('can add a credential with custom base URL', async ({ page }) => {
    await page.goto('/credentials')
    await page.click('button:has-text("Add credential")')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    await page.selectOption('select[name="provider"]', 'custom')
    await page.fill('input[name="label"]', 'Local Ollama')
    await page.fill('input[name="key"]', 'ollama-local-key')
    await page.fill('input[name="baseUrl"]', 'http://localhost:11434/v1')
    await page.click('[role="dialog"] button[type="submit"]')
    
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)
    
    // Newly added credential should exist (count at least 1)
    await expect(page.locator('[data-testid="delete-credential"]')).not.toHaveCount(0, { timeout: 5000 })
  })

  test('can delete a credential', async ({ page }) => {
    await page.goto('/credentials')

    // First add a credential to delete
    await page.click('button:has-text("Add credential")')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.selectOption('select[name="provider"]', 'anthropic')
    await page.fill('input[name="label"]', 'To Delete')
    await page.fill('input[name="key"]', 'sk-delete-test')
    await page.click('[role="dialog"] button[type="submit"]')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Wait for credentials to load
    await expect(page.locator('[data-testid="delete-credential"]').first()).toBeVisible({ timeout: 5000 })
    const countBefore = await page.locator('[data-testid="delete-credential"]').count()
    
    // Click delete on the first credential
    await page.locator('[data-testid="delete-credential"]').first().click()
    
    // Confirm deletion dialog
    await expect(page.locator('text=Are you sure')).toBeVisible()
    await page.click('button:has-text("Delete")')
    
    // Count should decrease by 1
    await expect(page.locator('[data-testid="delete-credential"]')).toHaveCount(countBefore - 1, { timeout: 5000 })
  })

  test('shows validation error for empty fields', async ({ page }) => {
    await page.goto('/credentials')
    await page.click('button:has-text("Add credential")')
    
    // Try to submit with empty required fields — browser validation will prevent submit
    await page.click('[role="dialog"] button[type="submit"]')
    
    // Dialog should still be open (form didn't submit due to required validation)
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })
})
