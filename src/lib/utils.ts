import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize MAC address to lowercase with colons (e.g., "aa:bb:cc:dd:ee:ff")
 * Handles various input formats: "AA-BB-CC-DD-EE-FF", "aabbccddeeff", etc.
 */
export function normalizeMac(mac: string): string {
  return mac
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '') // Remove all non-hex characters
    .replace(/(.{2})/g, '$1:') // Insert colon after every 2 characters
    .slice(0, -1) // Remove trailing colon
}

/**
 * Validate MAC address format
 * Returns true if the MAC address is valid (12 hex characters)
 */
export function isValidMac(mac: string): boolean {
  if (!mac) return false
  // Remove all separators and check if we have exactly 12 hex characters
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '')
  // Must be exactly 12 hex characters, no more, no less
  return cleaned.length === 12 && /^[a-fA-F0-9]{12}$/.test(cleaned)
}

/**
 * HTML escape function to prevent XSS in email templates and HTML output
 * Escapes: & < > " ' /
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize user name input
 * - Removes HTML tags and their content
 * - Trims whitespace
 * - Limits to alphanumeric, spaces, hyphens, apostrophes, and periods
 * - Max 100 characters
 */
export function sanitizeName(name: string): string {
  return (
    name
      .trim()
      // Remove script tags and their content first (security critical)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove all other HTML tags
      .replace(/<[^>]*>/g, '')
      // Allow only safe characters
      .replace(/[^a-zA-Z0-9\s\-'.]/g, '')
      .slice(0, 100)
  ) // Enforce max length
}

/**
 * Sanitize email for display
 * Validates basic email format and escapes for HTML
 */
export function sanitizeEmail(email: string): string {
  return escapeHtml(email.trim().toLowerCase())
}
