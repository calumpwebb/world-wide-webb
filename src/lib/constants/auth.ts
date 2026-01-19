/**
 * Authentication-related constants
 */

// Password hashing
export const BCRYPT_SALT_ROUNDS = 10

// TOTP (Time-based One-Time Password) configuration
export const TOTP_PERIOD_SECONDS = 30
export const TOTP_WINDOW = 1 // Allow 1 step before/after for clock skew

// Backup codes
export const BACKUP_CODES_AMOUNT = 10
export const BACKUP_CODE_LENGTH = 10

// Verification code configuration
export const VERIFICATION_CODE_LENGTH = 6
export const VERIFICATION_CODE_EXPIRY_MINUTES = 10

// Guest authorization defaults
export const GUEST_AUTH_DEFAULT_DAYS = 7
export const MAX_GUEST_EXTEND_DAYS = 30
