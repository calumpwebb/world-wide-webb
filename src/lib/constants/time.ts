/**
 * Time duration constants
 * All values in milliseconds for consistency
 */

// Base units
export const ONE_SECOND_MS = 1000
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS
export const ONE_DAY_MS = 24 * ONE_HOUR_MS

// Specific durations
export const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS
export const THIRTY_MINUTES_MS = 30 * ONE_MINUTE_MS
export const THIRTY_SECONDS_MS = 30 * ONE_SECOND_MS

// Multi-day periods
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS

// Common time units for conversions
export const SECONDS_PER_MINUTE = 60
export const MINUTES_PER_HOUR = 60
export const HOURS_PER_DAY = 24
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR

// Guest authorization duration (7 days in minutes)
export const GUEST_AUTH_DURATION_MINUTES = 7 * HOURS_PER_DAY * MINUTES_PER_HOUR
