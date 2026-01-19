/**
 * Server and service configuration constants
 */

// Unifi Controller defaults
export const UNIFI_DEFAULT_PORT = 8443
export const UNIFI_DEFAULT_IP = '192.168.1.1' // Default gateway IP for common routers

// Email service defaults
export const SMTP_DEFAULT_PORT = 1025 // Mailpit default
export const MAILPIT_API_PORT = 8025 // Mailpit web UI / API port

// Pagination defaults
export const PAGINATION_DEFAULT_LIMIT = 20 // Default items per page for lists

// Health check timeouts (in milliseconds)
export const UNIFI_HEALTH_CHECK_TIMEOUT_MS = 5000
export const MAILPIT_HEALTH_CHECK_TIMEOUT_MS = 3000
export const EMAIL_HEALTH_CHECK_TIMEOUT_MS = 3000
