import { test, expect } from '@playwright/test'

test.describe('Admin Login Flow', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto('/admin/login')
  })

  test('should display admin login form', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Admin/i)

    // Check for login form elements
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should show validation errors
    await expect(page.getByText(/email.*required/i)).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    // Fill in invalid email
    await page.getByLabel(/email/i).fill('invalid-email')
    await page.getByLabel(/password/i).fill('password123')

    // Try to submit
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should show email validation error
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test('should handle incorrect credentials', async ({ page }) => {
    // Fill in incorrect credentials
    await page.getByLabel(/email/i).fill('wrong@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')

    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible()
  })

  test('should redirect to TOTP setup on first login', async ({ page }) => {
    // This test assumes a fresh admin account without TOTP configured
    // Skip if TOTP is already set up
    test.skip(
      process.env.SKIP_TOTP_SETUP_TEST === 'true',
      'Skipping TOTP setup test as admin already configured'
    )

    // Fill in valid credentials
    await page.getByLabel(/email/i).fill(adminEmail)
    await page.getByLabel(/password/i).fill(adminPassword)

    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Should redirect to TOTP setup page
    await expect(page).toHaveURL(/\/admin\/setup-2fa/)

    // Should show QR code or setup instructions
    await expect(page.getByText(/authenticator|google|authy|2fa/i)).toBeVisible()
  })
})

test.describe('Admin TOTP Setup Flow', () => {
  test('should display TOTP setup page', async ({ page }) => {
    // Navigate directly to TOTP setup (would normally require auth)
    await page.goto('/admin/setup-2fa')

    // If redirected to login, we're not authenticated
    if (page.url().includes('/login')) {
      test.skip()
      return
    }

    // Should show setup instructions
    await expect(page.getByText(/authenticator|scan.*code/i)).toBeVisible()

    // Should show QR code or manual entry key
    await expect(
      page.locator('img[alt*="QR"]').or(page.getByText(/manual.*entry|secret.*key/i))
    ).toBeVisible()

    // Should show TOTP input field
    await expect(page.getByLabel(/code|token|otp/i)).toBeVisible()

    // Should show verify button
    await expect(page.getByRole('button', { name: /verify|confirm|enable/i })).toBeVisible()
  })

  test('should validate TOTP code format', async ({ page }) => {
    await page.goto('/admin/setup-2fa')

    if (page.url().includes('/login')) {
      test.skip()
      return
    }

    // Try to submit invalid code
    const totpInput = page.getByLabel(/code|token|otp/i)
    await totpInput.fill('12345') // Only 5 digits instead of 6

    await page.getByRole('button', { name: /verify|confirm|enable/i }).click()

    // Should show validation error
    await expect(page.getByText(/6.*digit|invalid.*code/i)).toBeVisible()
  })

  test('should handle incorrect TOTP code', async ({ page }) => {
    await page.goto('/admin/setup-2fa')

    if (page.url().includes('/login')) {
      test.skip()
      return
    }

    // Submit wrong code
    const totpInput = page.getByLabel(/code|token|otp/i)
    await totpInput.fill('000000')

    await page.getByRole('button', { name: /verify|confirm|enable/i }).click()

    // Should show error
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible()
  })
})

test.describe('Admin Dashboard Access', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  test('should require authentication to access dashboard', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/admin')

    // Should redirect to login
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('should display dashboard after successful login', async ({ page }) => {
    test.skip(
      !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD,
      'Admin credentials not provided'
    )

    // Login first
    await page.goto('/admin/login')
    await page.getByLabel(/email/i).fill(adminEmail)
    await page.getByLabel(/password/i).fill(adminPassword)
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // If TOTP is required, this test needs manual intervention
    if (page.url().includes('/setup-2fa')) {
      test.skip()
      return
    }

    // Should be on dashboard
    await expect(page).toHaveURL(/\/admin$/)

    // Should show dashboard elements
    await expect(page.getByText(/dashboard|overview|guests/i)).toBeVisible()

    // Should show stats/metrics
    await expect(page.getByText(/active|total|authorized/i)).toBeVisible()
  })
})
