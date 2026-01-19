/**
 * Alert threshold constants
 * Used for admin notifications and monitoring
 */

// Guest expiry alert thresholds
export const ALERT_SEVERITY_THRESHOLD = 5 // Number of guests expiring in 24h to trigger alert

// Failed authentication alert thresholds
export const FAILED_AUTH_ALERT_THRESHOLD = 3 // Failed attempts in 24h to show warning
export const CRITICAL_FAILED_AUTH_THRESHOLD = 10 // Failed attempts in 24h to show critical alert
