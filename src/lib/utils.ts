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
