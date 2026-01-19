# Error Code Reference

## Overview

All API errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "optional": "additional context"
  }
}
```

This document provides a comprehensive reference of all error codes, their causes, and recovery actions.

## HTTP Status Codes

### 400 Bad Request

Invalid request data, validation failure, or business logic error.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `VALIDATION_ERROR` | Invalid input data (email, name, MAC, etc.) | Check request schema, fix input format |
| `INVALID_CODE` | Verification code is wrong or expired | Request a new code via `/api/guest/verify-email` |
| `TOO_MANY_ATTEMPTS` | Exceeded 3 code verification attempts | Request a new code (old code invalidated) |
| `NO_PENDING_VERIFICATION` | No pending verification for email | Call `/api/guest/verify-email` first |
| `INVALID_MAC_ADDRESS` | MAC address format invalid | Use 12 hex chars (aabbccddeeff) |
| `GUEST_NOT_FOUND` | Guest ID does not exist | Check guest ID, may have been deleted |
| `DEVICE_NOT_FOUND` | Device ID does not exist | Check device ID |
| `INVALID_GUEST_IDS` | Guest ID array empty or invalid | Provide at least one valid guest ID |
| `INVALID_DAYS` | Days parameter out of range | Use 1-30 days |

**Example Response**:
```json
{
  "error": "Invalid email or name",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

### 401 Unauthorized

Authentication is required but not provided, or session is invalid/expired.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `AUTH_REQUIRED` | No session cookie present | Login via Better Auth (`/api/auth/sign-in`) |
| `SESSION_EXPIRED` | Session token expired | Re-authenticate (login again) |
| `INVALID_SESSION` | Session token invalid or malformed | Clear cookies and login again |

**Example Response**:
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

**Recovery Steps**:
1. Redirect user to login page (`/admin/login` for admin, landing page for guests)
2. After successful login, Better Auth sets session cookie automatically
3. Retry original request with new session cookie

### 403 Forbidden

Authenticated but insufficient permissions.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `ADMIN_REQUIRED` | Endpoint requires admin role | Use admin account (not guest) |
| `TOTP_REQUIRED` | Admin account needs TOTP 2FA setup | Complete TOTP setup at `/admin/setup-2fa` |
| `FORBIDDEN` | Generic permission denied | Check user role and permissions |
| `NOT_OWNER` | Device does not belong to user | User can only edit own devices |

**Example Response**:
```json
{
  "error": "Admin role required",
  "code": "ADMIN_REQUIRED"
}
```

**Recovery Steps**:
- `ADMIN_REQUIRED`: Login with admin account
- `TOTP_REQUIRED`: Redirect to `/admin/setup-2fa` to complete setup
- `NOT_OWNER`: User attempted to edit another user's device (block action)

### 404 Not Found

Resource does not exist.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `NOT_FOUND` | Resource (guest, device, etc.) not found | Verify ID, refresh list |

**Example Response**:
```json
{
  "error": "Guest not found",
  "code": "NOT_FOUND"
}
```

### 429 Too Many Requests

Rate limit exceeded.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `RATE_LIMIT_EXCEEDED` | Exceeded hourly rate limit | Wait for `retryAfter` seconds |
| `COOLDOWN_ACTIVE` | 30-second cooldown between resends | Wait 30 seconds |

**Example Response**:
```json
{
  "error": "Too many requests. Please try again in 45 minutes.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 2700
}
```

**Rate Limits**:

| Endpoint | Limit | Window | Cooldown |
|----------|-------|--------|----------|
| `POST /api/guest/verify-email` | 5 per email | 1 hour | None |
| `POST /api/guest/resend-code` | 3 per email | 1 hour | 30 seconds |
| `POST /api/guest/verify-code` | 3 attempts | per code | N/A (invalidates) |

**Recovery Steps**:
1. Display `retryAfter` countdown to user
2. Disable submit button until cooldown expires
3. Retry request after cooldown period

**Client-side Example**:
```typescript
async function handleRateLimit(error: any) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    const retryAfter = error.retryAfter; // seconds
    const retryAt = Date.now() + (retryAfter * 1000);

    // Show countdown timer
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      if (remaining === 0) {
        clearInterval(interval);
        enableSubmitButton();
      } else {
        updateButtonText(`Retry in ${remaining}s`);
      }
    }, 1000);
  }
}
```

### 500 Internal Server Error

Unexpected server error.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `INTERNAL_ERROR` | Unexpected server error | Retry request, contact admin if persists |
| `DATABASE_ERROR` | Database operation failed | Retry request, check health endpoint |

**Example Response**:
```json
{
  "error": "An unexpected error occurred",
  "code": "INTERNAL_ERROR"
}
```

**Recovery Steps**:
1. Retry request with exponential backoff (1s, 2s, 4s, 8s)
2. If persists, check `/api/health` for system status
3. Contact administrator if system is unhealthy

### 503 Service Unavailable

External service (Unifi, email) is unavailable.

| Error Code | Meaning | Recovery Action |
|------------|---------|-----------------|
| `UNIFI_UNAVAILABLE` | Unifi Controller unreachable | Check network, contact administrator |
| `EMAIL_SERVICE_UNAVAILABLE` | Email service (Resend/Mailpit) down | Contact administrator |

**Example Response**:
```json
{
  "error": "Unable to authorize device. Please contact administrator.",
  "code": "UNIFI_UNAVAILABLE",
  "details": {
    "recoverySteps": [
      "Check network connectivity",
      "Contact administrator if problem persists"
    ]
  }
}
```

**Recovery Steps**:
- `UNIFI_UNAVAILABLE`:
  1. Display user-friendly error message
  2. Suggest checking network connection
  3. Provide admin contact info
  4. In development with `ALLOW_OFFLINE_AUTH=true`, authorization succeeds with warning
- `EMAIL_SERVICE_UNAVAILABLE`:
  1. Display "Email service temporarily unavailable"
  2. Suggest trying again later
  3. Provide alternative contact method

## Common Error Scenarios

### Scenario 1: Expired Verification Code

**Error**:
```json
{
  "error": "Invalid or expired verification code",
  "code": "INVALID_CODE"
}
```

**Cause**: Verification code was entered after 10-minute expiry

**User Flow**:
1. User sees error message: "Code expired. Request a new one?"
2. User clicks "Resend Code" button
3. Call `POST /api/guest/resend-code` with email
4. User receives new code via email
5. User enters new code and succeeds

### Scenario 2: Too Many Failed Code Attempts

**Error**:
```json
{
  "error": "Too many failed attempts. Request a new code.",
  "code": "TOO_MANY_ATTEMPTS"
}
```

**Cause**: User entered wrong code 3 times

**User Flow**:
1. Show error: "Too many failed attempts. A new code has been sent."
2. Automatically call `POST /api/guest/resend-code`
3. Disable code input for 30 seconds (cooldown)
4. User receives new email
5. User enters new code

### Scenario 3: Rate Limit on Email Verification

**Error**:
```json
{
  "error": "Too many requests. Please try again in 45 minutes.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 2700
}
```

**Cause**: User requested verification 5 times in 1 hour

**User Flow**:
1. Display countdown: "Too many attempts. Try again in 45:00"
2. Disable email input and submit button
3. Show countdown timer
4. Enable form when countdown reaches 0
5. User can retry

**Implementation**:
```typescript
function displayRateLimitError(retryAfter: number) {
  const retryAt = new Date(Date.now() + retryAfter * 1000);

  showError(`Too many attempts. Try again at ${retryAt.toLocaleTimeString()}`);

  const countdown = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((retryAt.getTime() - Date.now()) / 1000));

    if (remaining === 0) {
      clearInterval(countdown);
      enableForm();
      showSuccess('You can try again now');
    } else {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      updateCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }, 1000);
}
```

### Scenario 4: Unifi Controller Offline

**Error**:
```json
{
  "error": "Unable to authorize device. Please contact administrator.",
  "code": "UNIFI_UNAVAILABLE",
  "details": {
    "recoverySteps": [
      "Check network connectivity",
      "Contact administrator if problem persists"
    ]
  }
}
```

**Cause**: Unifi Controller is unreachable (network issue, controller offline)

**User Flow** (Production - `ALLOW_OFFLINE_AUTH=false`):
1. Display error: "Network authorization failed. Please try again or contact support."
2. Show recovery steps from `details.recoverySteps`
3. Provide "Retry" button
4. Show admin contact information

**Developer Flow** (Development - `ALLOW_OFFLINE_AUTH=true`):
1. Authorization succeeds despite Unifi failure
2. Warning logged to console
3. Guest record created in database
4. Admin can manually sync with Unifi later

**Production Setup**:
```bash
# .env
ALLOW_OFFLINE_AUTH=false  # Fail-fast in production
```

### Scenario 5: TOTP Not Configured (Admin)

**Error**:
```json
{
  "error": "TOTP 2FA setup required",
  "code": "TOTP_REQUIRED"
}
```

**Cause**: Admin account hasn't completed TOTP setup

**User Flow**:
1. Middleware detects TOTP not configured
2. Redirect to `/admin/setup-2fa`
3. Admin scans QR code with Google Authenticator/Authy
4. Admin verifies TOTP code
5. Admin downloads backup codes
6. Redirect to original destination (`/admin`)

### Scenario 6: Session Expired (Admin)

**Error**:
```json
{
  "error": "Session expired",
  "code": "SESSION_EXPIRED"
}
```

**Cause**: Session token expired (7-day default)

**User Flow**:
1. Middleware detects expired session
2. Redirect to `/admin/login?redirect=/admin/guests` (preserve destination)
3. Admin logs in with email + password + TOTP code
4. Better Auth creates new session
5. Redirect to original destination (`/admin/guests`)

### Scenario 7: Guest Device Ownership Violation

**Error**:
```json
{
  "error": "You do not have permission to edit this device",
  "code": "NOT_OWNER"
}
```

**Cause**: Guest tried to edit another user's device (via `PATCH /api/portal/devices/{id}`)

**User Flow**:
1. Display error: "This device belongs to another account"
2. Block action (no retry possible)
3. Redirect to `/portal/devices` (own devices list)

## Error Handling Best Practices

### Client-side Error Handling

```typescript
async function apiCall(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();

      // Handle specific error codes
      switch (error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          return handleRateLimit(error);
        case 'SESSION_EXPIRED':
          return redirectToLogin();
        case 'UNIFI_UNAVAILABLE':
          return showServiceError(error);
        case 'TOTP_REQUIRED':
          return redirectToTOTPSetup();
        default:
          return showGenericError(error.error);
      }
    }

    return await response.json();
  } catch (err) {
    // Network error (no response)
    showNetworkError('Unable to connect. Check your internet connection.');
  }
}
```

### Server-side Error Responses

```typescript
// lib/errors.ts
export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
  }
}

// Usage in route handler
import { APIError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    // ... validation
    if (!isValidEmail(email)) {
      throw new APIError(
        'VALIDATION_ERROR',
        'Invalid email format',
        400,
        { field: 'email' }
      );
    }

    // ... business logic
  } catch (error) {
    if (error instanceof APIError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.status }
      );
    }

    // Unexpected error
    console.error('Unexpected error:', error);
    return Response.json(
      {
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const guests = await retryWithBackoff(() =>
  fetch('/api/admin/guests').then(r => r.json())
);
```

## Monitoring Error Rates

### Prometheus Metrics

Track error rates for alerting:

```prometheus
# Alert on high error rate
- alert: HighAPIErrorRate
  expr: |
    rate(captive_portal_auth_fail_total[5m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: High authentication failure rate
    description: "{{ $value }} failed auth attempts per second"
```

### Activity Logs

All errors are logged to `activity_logs` table:

```sql
-- Find recent auth failures
SELECT * FROM activity_logs
WHERE type = 'auth_fail'
AND created_at > datetime('now', '-1 hour')
ORDER BY created_at DESC;

-- Count errors by type
SELECT type, COUNT(*) as count
FROM activity_logs
WHERE type LIKE '%fail%'
AND created_at > datetime('now', '-24 hours')
GROUP BY type
ORDER BY count DESC;
```

## Related Documentation

- [API Documentation](./API.md) - Full API reference with examples
- [OpenAPI Specification](./API.yaml) - Machine-readable API spec
- [Monitoring Guide](./MONITORING.md) - Error alerting setup
- [Deployment Guide](../DEPLOYMENT.md) - Production error handling configuration

## Support

For unresolved errors:
1. Check `/api/health` endpoint for system status
2. Review activity logs in admin panel (`/admin/logs`)
3. Check server logs for stack traces
4. Report issues: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
