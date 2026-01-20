import { describe, it, expect } from 'vitest'
import { isDisposableEmail, DISPOSABLE_EMAIL_ERROR } from '@/lib/disposable-domains'

describe('Disposable Email Detection', () => {
  describe('isDisposableEmail', () => {
    it('should detect common disposable email domains', () => {
      const disposableEmails = [
        'test@10minutemail.com',
        'user@guerrillamail.com',
        'temp@tempmail.com',
        'fake@mailinator.com',
        'throwaway@yopmail.com',
        'test@getnada.com',
        'spam@maildrop.cc',
        'fake@temp-mail.org',
      ]

      disposableEmails.forEach((email) => {
        expect(isDisposableEmail(email)).toBe(true)
      })
    })

    it('should not flag legitimate email domains', () => {
      const legitimateEmails = [
        'user@gmail.com',
        'contact@example.com',
        'admin@company.org',
        'support@outlook.com',
        'info@yahoo.com',
        'hello@protonmail.ch', // Different TLD from blocked protonmail.com
        'test@custom-domain.com',
      ]

      legitimateEmails.forEach((email) => {
        expect(isDisposableEmail(email)).toBe(false)
      })
    })

    it('should be case-insensitive', () => {
      expect(isDisposableEmail('Test@10MinuteMail.COM')).toBe(true)
      expect(isDisposableEmail('USER@GUERRILLAMAIL.COM')).toBe(true)
      expect(isDisposableEmail('Fake@TEMPMAIL.com')).toBe(true)
    })

    it('should handle emails with leading/trailing whitespace', () => {
      expect(isDisposableEmail('  test@10minutemail.com  ')).toBe(true)
      expect(isDisposableEmail('\tuser@tempmail.com\n')).toBe(true)
    })

    it('should handle invalid email formats gracefully', () => {
      expect(isDisposableEmail('not-an-email')).toBe(false)
      expect(isDisposableEmail('')).toBe(false)
      expect(isDisposableEmail('@')).toBe(false)
      expect(isDisposableEmail('user@')).toBe(false)
      expect(isDisposableEmail('@domain.com')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isDisposableEmail('user@sub.10minutemail.com')).toBe(false) // Subdomain not blocked
      expect(isDisposableEmail('10minutemail.com@gmail.com')).toBe(false) // Domain in local part
    })

    it('should handle non-string inputs gracefully', () => {
      // @ts-expect-error - Testing runtime behavior with invalid types
      expect(isDisposableEmail(null)).toBe(false)
      // @ts-expect-error - Testing runtime behavior with invalid types
      expect(isDisposableEmail(undefined)).toBe(false)
      // @ts-expect-error - Testing runtime behavior with invalid types
      expect(isDisposableEmail(123)).toBe(false)
    })
  })

  describe('DISPOSABLE_EMAIL_ERROR', () => {
    it('should provide a user-friendly error message', () => {
      expect(DISPOSABLE_EMAIL_ERROR).toBe(
        'Disposable email addresses are not allowed. Please use a permanent email address.'
      )
    })
  })

  describe('Blocklist coverage', () => {
    it('should include popular temporary email services', () => {
      const popularServices = [
        '10minutemail.com',
        'guerrillamail.com',
        'tempmail.com',
        'mailinator.com',
        'yopmail.com',
        'temp-mail.org',
        'throwaway.email',
        'trashmail.com',
        'sharklasers.com',
        'getnada.com',
      ]

      popularServices.forEach((domain) => {
        expect(isDisposableEmail(`test@${domain}`)).toBe(true)
      })
    })

    it('should include known abuse-prone domains', () => {
      const abuseDomains = ['cock.li', 'protonmail.com']

      abuseDomains.forEach((domain) => {
        expect(isDisposableEmail(`test@${domain}`)).toBe(true)
      })
    })

    it('should include variations of common services', () => {
      const variations = [
        'guerrillamail.net',
        'guerrillamail.org',
        'guerrillamail.biz',
        '10minutemail.net',
        'yopmail.fr',
        'yopmail.net',
      ]

      variations.forEach((domain) => {
        expect(isDisposableEmail(`test@${domain}`)).toBe(true)
      })
    })
  })
})
