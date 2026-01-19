# E2E Tests with Playwright

This directory contains end-to-end tests for the World Wide Webb captive portal using Playwright.

## Prerequisites

- Node.js and pnpm installed
- Project dependencies installed (`pnpm install`)
- Playwright browsers installed (run `pnpm exec playwright install chromium`)

## Running Tests

### All tests
```bash
pnpm test:e2e
```

### With UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### In headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Debug mode
```bash
pnpm test:e2e:debug
```

### Specific test file
```bash
pnpm test:e2e e2e/guest-signup.spec.ts
```

### Specific browser
```bash
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

## Test Structure

### Guest Flow Tests (`guest-signup.spec.ts`)
- **Landing page display**: Validates email form, name field, submit button
- **Email validation**: Tests invalid email formats
- **Name validation**: Tests required name field
- **Verification navigation**: Tests successful navigation to verification page
- **Rate limiting**: Tests rate limit enforcement (5 requests per hour)
- **Verification code input**: Tests 6-digit code input UI
- **Code format validation**: Tests 6-digit requirement
- **Resend code**: Tests resend button with 30s cooldown
- **Success page**: Tests welcome message and expiry information

### Admin Flow Tests (`admin-login.spec.ts`)
- **Login form display**: Validates email and password fields
- **Field validation**: Tests required field validation
- **Email format validation**: Tests email format requirements
- **Incorrect credentials**: Tests error handling for wrong credentials
- **TOTP setup redirect**: Tests first-time login TOTP setup flow
- **TOTP setup page**: Tests QR code display and verification
- **TOTP code validation**: Tests 6-digit TOTP code format
- **Dashboard access**: Tests authentication requirement and successful login

## Environment Variables

Tests use the following environment variables (optional):

- `ADMIN_EMAIL`: Admin email for login tests (default: `admin@example.com`)
- `ADMIN_PASSWORD`: Admin password for login tests (default: `admin123`)
- `SKIP_TOTP_SETUP_TEST`: Set to `true` to skip TOTP setup tests if already configured
- `CI`: Set to `true` in CI environments for optimized test runs

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Web Server**: Automatically starts `pnpm dev` before tests
- **Browsers**: Chromium, Firefox, WebKit (Desktop and Mobile viewports)
- **Parallel Execution**: Tests run in parallel by default
- **Retries**: 2 retries on CI, 0 locally
- **Trace**: Captured on first retry for debugging

## Test Organization

Each test file follows this structure:

1. **Imports**: Playwright test utilities
2. **Test suites**: Grouped by feature area (`test.describe`)
3. **Before hooks**: Setup before each test (`test.beforeEach`)
4. **Test cases**: Individual test scenarios (`test()`)
5. **Assertions**: Using Playwright's `expect` API

## Best Practices

- **Isolation**: Each test is independent and doesn't rely on others
- **Cleanup**: Tests don't leave state that affects other tests
- **Selectors**: Use accessible selectors (role, label) over CSS selectors
- **Wait strategies**: Use Playwright's auto-waiting instead of manual timeouts
- **Assertions**: Use descriptive assertions with clear error messages

## Debugging

### View test results
```bash
pnpm exec playwright show-report
```

### Run with debug console
```bash
pnpm test:e2e:debug
```

### Take screenshots on failure
Screenshots are automatically captured on test failures in the `test-results/` directory.

### View traces
Traces are captured on first retry. View them with:
```bash
pnpm exec playwright show-trace test-results/[test-name]/trace.zip
```

## CI Integration

Tests are configured to run efficiently in CI:

- Single worker (no parallelization to avoid conflicts)
- 2 retries for flaky test resilience
- Automatic web server startup
- HTML report generation

Example GitHub Actions workflow:
```yaml
- name: Install dependencies
  run: pnpm install

- name: Install Playwright browsers
  run: pnpm exec playwright install chromium

- name: Run E2E tests
  run: pnpm test:e2e
  env:
    CI: true
```

## Coverage

Current E2E test coverage:

- ✅ Guest email verification flow
- ✅ Guest code verification and validation
- ✅ Guest success page
- ✅ Rate limiting enforcement
- ✅ Admin login form
- ✅ Admin TOTP setup
- ✅ Admin dashboard access

## Future Test Areas

- Guest portal dashboard (device management)
- Admin guest management (revoke, extend)
- Admin network monitoring
- Admin activity logs
- Guest device nickname editing
- Admin settings (password change, TOTP regeneration)
