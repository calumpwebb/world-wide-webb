import { describe, it, expect } from 'vitest'
import { sanitizeName, escapeHtml, isValidMac, normalizeMac, sanitizeEmail } from '@/lib/utils'

describe('Input Sanitization', () => {
  describe('sanitizeName', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeName('<script>alert("xss")</script>John')).toBe('John')
      expect(sanitizeName('John<b>Doe</b>')).toBe('JohnDoe')
    })

    it('should remove special characters except safe ones', () => {
      expect(sanitizeName("John O'Brien")).toBe("John O'Brien")
      expect(sanitizeName('Mary-Jane')).toBe('Mary-Jane')
      expect(sanitizeName('Dr. Smith')).toBe('Dr. Smith')
      expect(sanitizeName('John@Doe#Test')).toBe('JohnDoeTest')
    })

    it('should trim whitespace', () => {
      expect(sanitizeName('  John Doe  ')).toBe('John Doe')
    })

    it('should enforce max length of 100 characters', () => {
      const longName = 'A'.repeat(150)
      expect(sanitizeName(longName)).toHaveLength(100)
    })

    it('should handle empty or whitespace-only input', () => {
      expect(sanitizeName('')).toBe('')
      expect(sanitizeName('   ')).toBe('')
    })
  })

  describe('escapeHtml', () => {
    it('should escape dangerous HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      )
      expect(escapeHtml("It's <b>bold</b> & 'quoted'")).toBe(
        'It&#039;s &lt;b&gt;bold&lt;&#x2F;b&gt; &amp; &#039;quoted&#039;'
      )
    })

    it('should handle normal text', () => {
      expect(escapeHtml('John Doe')).toBe('John Doe')
    })
  })

  describe('isValidMac', () => {
    it('should validate correct MAC addresses', () => {
      expect(isValidMac('aa:bb:cc:dd:ee:ff')).toBe(true)
      expect(isValidMac('AA:BB:CC:DD:EE:FF')).toBe(true)
      expect(isValidMac('aa-bb-cc-dd-ee-ff')).toBe(true)
      expect(isValidMac('aabbccddeeff')).toBe(true)
    })

    it('should reject invalid MAC addresses', () => {
      expect(isValidMac('not-a-mac')).toBe(false)
      expect(isValidMac('aa:bb:cc:dd:ee')).toBe(false) // Too short
      expect(isValidMac('aa:bb:cc:dd:ee:ff:11')).toBe(false) // Too long (14 hex chars)
      expect(isValidMac('zz:bb:cc:dd:ee:ff')).toBe(false) // Invalid hex
      expect(isValidMac('')).toBe(false)
    })
  })

  describe('normalizeMac', () => {
    it('should normalize to lowercase with colons', () => {
      expect(normalizeMac('AA:BB:CC:DD:EE:FF')).toBe('aa:bb:cc:dd:ee:ff')
      expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('aa:bb:cc:dd:ee:ff')
      expect(normalizeMac('aabbccddeeff')).toBe('aa:bb:cc:dd:ee:ff')
    })
  })

  describe('sanitizeEmail', () => {
    it('should escape HTML and trim', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com')
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com')
      expect(sanitizeEmail('<script>@example.com')).toBe('&lt;script&gt;@example.com')
    })
  })
})
