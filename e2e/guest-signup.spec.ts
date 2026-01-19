import { test, expect } from '@playwright/test'

test.describe('Guest Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/')
  })

  test('should display the landing page with email form', async ({ page }) => {
    // Check that the landing page loads
    await expect(page).toHaveTitle(/World Wide Webb/i)

    // Check for the main heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Check for email input field
    await expect(page.getByLabel(/email/i)).toBeVisible()

    // Check for name input field
    await expect(page.getByLabel(/name/i)).toBeVisible()

    // Check for submit button
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    // Fill in invalid email
    await page.getByLabel(/name/i).fill('Test User')
    await page.getByLabel(/email/i).fill('invalid-email')

    // Try to submit
    await page.getByRole('button', { name: /continue/i }).click()

    // Should show validation error
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test('should require name field', async ({ page }) => {
    // Fill only email
    await page.getByLabel(/email/i).fill('test@example.com')

    // Try to submit
    await page.getByRole('button', { name: /continue/i }).click()

    // Should show validation error
    await expect(page.getByText(/name.*required/i)).toBeVisible()
  })

  test('should navigate to verification page after valid submission', async ({ page }) => {
    // Fill in valid data
    await page.getByLabel(/name/i).fill('Test User')
    await page.getByLabel(/email/i).fill('test@example.com')

    // Accept terms if checkbox exists
    const termsCheckbox = page.getByLabel(/terms/i)
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit form
    await page.getByRole('button', { name: /continue/i }).click()

    // Should navigate to verification page
    await expect(page).toHaveURL(/\/verify/)

    // Should show verification code input
    await expect(page.getByText(/enter.*code/i)).toBeVisible()
  })

  test('should handle rate limiting gracefully', async ({ page }) => {
    const email = `ratelimit-${Date.now()}@example.com`

    // Submit multiple times to trigger rate limit
    for (let i = 0; i < 6; i++) {
      await page.goto('/')
      await page.getByLabel(/name/i).fill('Test User')
      await page.getByLabel(/email/i).fill(email)

      const termsCheckbox = page.getByLabel(/terms/i)
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check()
      }

      await page.getByRole('button', { name: /continue/i }).click()

      // Wait a bit between requests
      await page.waitForTimeout(500)
    }

    // Should show rate limit error
    await expect(page.getByText(/too many/i)).toBeVisible()
  })
})

test.describe('Guest Verification Flow', () => {
  test('should display verification code input', async ({ page }) => {
    // Navigate directly to verify page (in real flow, would come from landing page)
    await page.goto('/verify')

    // Should show verification UI elements
    await expect(page.getByText(/enter.*code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible()
  })

  test('should validate code format', async ({ page }) => {
    await page.goto('/verify')

    // Try to submit with invalid code
    const codeInput = page.locator('input[type="text"]').first()
    await codeInput.fill('12345') // Only 5 digits instead of 6

    await page.getByRole('button', { name: /verify/i }).click()

    // Should show validation error
    await expect(page.getByText(/6.*digit/i)).toBeVisible()
  })

  test('should handle resend code with cooldown', async ({ page }) => {
    await page.goto('/verify')

    const resendButton = page.getByRole('button', { name: /resend/i })

    // Click resend
    await resendButton.click()

    // Button should be disabled during cooldown
    await expect(resendButton).toBeDisabled()

    // Should show cooldown message
    await expect(page.getByText(/wait.*second/i)).toBeVisible()
  })
})

test.describe('Guest Success Flow', () => {
  test('should display success message', async ({ page }) => {
    await page.goto('/success')

    // Should show welcome/success message
    await expect(page.getByText(/welcome|success|connected/i)).toBeVisible()

    // Should show expiry information
    await expect(page.getByText(/7.*day|expir/i)).toBeVisible()
  })
})
