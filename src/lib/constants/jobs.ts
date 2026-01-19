/**
 * Background job interval constants
 * All intervals in milliseconds
 */

import { ONE_MINUTE_MS, ONE_HOUR_MS } from './time'

// Connection and network sync intervals
export const CONNECTION_SYNC_INTERVAL_MS = 1 * ONE_MINUTE_MS
export const DPI_CACHE_INTERVAL_MS = 5 * ONE_MINUTE_MS
export const AUTH_SYNC_INTERVAL_MS = 5 * ONE_MINUTE_MS

// Cleanup and maintenance intervals
export const CLEANUP_INTERVAL_MS = 5 * ONE_MINUTE_MS
export const EXPIRY_REMINDER_INTERVAL_MS = 12 * ONE_HOUR_MS

// Data retention periods
export const CLEANUP_RETENTION_DAYS = 30

// DPI stats configuration
export const DPI_TOP_APPS_LIMIT = 10
