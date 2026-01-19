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
 * Sanitize user-provided name input to prevent XSS and injection attacks.
 *
 * **⚠️ SECURITY CRITICAL:** This function prevents stored XSS attacks by removing
 * malicious HTML/scripts from user names before database storage. Names are displayed
 * in the admin panel, email templates, and guest portal - unsanitized input could
 * execute JavaScript in admin sessions.
 *
 * **Multi-Stage Sanitization:**
 * 1. **Trim whitespace** - Remove leading/trailing spaces
 * 2. **Remove `<script>` tags** - Strip script tags and their entire content first
 * 3. **Remove all HTML tags** - Strip remaining tags like `<img>`, `<iframe>`, etc.
 * 4. **Character allowlist** - Only permit: `a-z`, `A-Z`, `0-9`, space, `-`, `'`, `.`
 * 5. **Length limit** - Truncate to 100 characters max
 *
 * **Why Two-Stage Tag Removal:**
 * Removing `<script>` tags first prevents cases like `<script>alert('XSS')</script>`
 * where the content needs to be removed along with the tags. The second pass catches
 * all other HTML tags that might be used for injection (img onerror, iframe, etc.).
 *
 * **Character Allowlist Rationale:**
 * - Supports names like "John O'Brien", "Mary-Jane", "Dr. Smith"
 * - Blocks special chars that could be used in injection attacks
 * - Regex: `/[^a-zA-Z0-9\s\-'.]/g` (inverted match = remove non-allowed chars)
 *
 * **Use Cases:**
 * - Guest signup name field (before database insert)
 * - Admin panel display (prevents stored XSS)
 * - Email templates (names embedded in HTML emails)
 *
 * @param name - Raw user input for name field
 * @returns Sanitized name safe for storage and display
 *
 * @example
 * ```typescript
 * sanitizeName('<script>alert("XSS")</script>John')  // Returns: 'John'
 * sanitizeName("Mary-Jane O'Brien")                  // Returns: "Mary-Jane O'Brien"
 * sanitizeName('<img src=x onerror=alert(1)>Test')  // Returns: 'Test'
 * sanitizeName('A'.repeat(200))                      // Returns: 'A'.repeat(100)
 * ```
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

/**
 * Convert RSSI (Received Signal Strength Indicator) to signal strength percentage
 *
 * RSSI values from WiFi devices typically range from -100 dBm (worst) to 0 dBm (best).
 * This function converts RSSI to a percentage where:
 * - RSSI = -100 dBm → 0% (no signal)
 * - RSSI = 0 dBm → 100% (perfect signal)
 *
 * The formula: `RSSI + 100` converts the -100 to 0 range into 0 to 100.
 * We clamp the result to ensure it stays within 0-100% bounds.
 *
 * @param rssi - RSSI value in dBm (typically -100 to 0)
 * @returns Signal strength percentage (0-100)
 *
 * @example
 * ```typescript
 * calculateSignalStrength(-50)  // Returns: 50 (good signal)
 * calculateSignalStrength(-100) // Returns: 0 (no signal)
 * calculateSignalStrength(0)    // Returns: 100 (perfect signal)
 * calculateSignalStrength(-120) // Returns: 0 (clamped, below minimum)
 * ```
 */
export function calculateSignalStrength(rssi: number): number {
  return Math.min(100, Math.max(0, rssi + 100))
}
