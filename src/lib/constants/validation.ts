/**
 * Input Validation Constants
 *
 * Length limits and validation rules for user input fields.
 * Centralized to ensure consistency across forms and API validation.
 */

// User Profile Validation
export const MAX_NAME_LENGTH = 100 // Maximum characters for user name field
export const MIN_PASSWORD_LENGTH = 8 // Minimum characters for password (admin)

// Device Management Validation
export const MAX_DEVICE_NICKNAME_LENGTH = 50 // Maximum characters for device nickname

// MAC Address Validation
export const MAC_ADDRESS_LENGTH = 12 // Expected length (hex digits, no separators)
export const MAC_ADDRESS_PATTERN = /^[0-9a-fA-F]{12}$/ // Regex for validation
