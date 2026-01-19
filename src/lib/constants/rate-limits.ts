/**
 * Rate limiting constants
 * Default values for rate limit configurations
 */

// Guest verification rate limits
export const VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT = 5
export const RESEND_CODE_MAX_ATTEMPTS_DEFAULT = 3
export const CODE_VERIFICATION_MAX_ATTEMPTS_DEFAULT = 3
export const RESEND_CODE_COOLDOWN_SECONDS_DEFAULT = 30

// Admin authentication rate limits
export const LOGIN_MAX_ATTEMPTS_DEFAULT = 5
export const ADMIN_LOGIN_MAX_ATTEMPTS_DEFAULT = 5
