import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  formatRateLimitError,
} from '@/lib/rate-limit'
import { db, rateLimits } from '@/lib/db'

// Mock the database
vi.mock('@/lib/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }

  return {
    db: mockDb,
    rateLimits: {
      identifier: 'identifier',
      action: 'action',
      attempts: 'attempts',
      lastAttempt: 'lastAttempt',
      lockedUntil: 'lockedUntil',
      id: 'id',
    },
  }
})

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow first attempt and create new rate limit record', async () => {
      // Mock no existing rate limit
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const result = await checkRateLimit('test@example.com', 'verify')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4) // Default limit is 5
      expect(db.insert).toHaveBeenCalled()
    })

    it('should allow subsequent attempts within limit', async () => {
      const now = new Date()
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'verify' as const,
        attempts: 3,
        lastAttempt: now,
        lockedUntil: null,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await checkRateLimit('test@example.com', 'verify')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1) // 5 - 3 - 1 = 1
      expect(db.update).toHaveBeenCalled()
    })

    it('should block when rate limit exceeded', async () => {
      const now = new Date()
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'verify' as const,
        attempts: 5,
        lastAttempt: now,
        lockedUntil: null,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await checkRateLimit('test@example.com', 'verify')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset after time window expires', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'verify' as const,
        attempts: 5,
        lastAttempt: twoHoursAgo,
        lockedUntil: null,
        createdAt: twoHoursAgo,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await checkRateLimit('test@example.com', 'verify')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(db.update).toHaveBeenCalledWith(rateLimits)
    })

    it('should enforce lockout when configured', async () => {
      const now = new Date()
      const existing = {
        id: 1,
        identifier: 'admin@example.com',
        action: 'admin_login' as const,
        attempts: 5,
        lastAttempt: now,
        lockedUntil: null,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await checkRateLimit('admin@example.com', 'admin_login')

      expect(result.allowed).toBe(false)
      expect(result.lockedUntil).toBeDefined()
    })

    it('should block when locked out', async () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 30 * 60 * 1000)
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'admin_login' as const,
        attempts: 5,
        lastAttempt: now,
        lockedUntil: futureDate,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await checkRateLimit('test@example.com', 'admin_login')

      expect(result.allowed).toBe(false)
      expect(result.lockedUntil).toEqual(futureDate)
    })
  })

  describe('resetRateLimit', () => {
    it('should delete rate limit record', async () => {
      await resetRateLimit('test@example.com', 'verify')

      expect(db.delete).toHaveBeenCalled()
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return null for non-existent rate limit', async () => {
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const result = await getRateLimitStatus('test@example.com', 'verify')

      expect(result).toBeNull()
    })

    it('should return correct status for existing rate limit', async () => {
      const now = new Date()
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'verify' as const,
        attempts: 3,
        lastAttempt: now,
        lockedUntil: null,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await getRateLimitStatus('test@example.com', 'verify')

      expect(result).toBeDefined()
      expect(result?.allowed).toBe(true)
      expect(result?.remaining).toBe(2) // 5 - 3 = 2
    })

    it('should handle locked status correctly', async () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 15 * 60 * 1000)
      const existing = {
        id: 1,
        identifier: 'test@example.com',
        action: 'admin_login' as const,
        attempts: 5,
        lastAttempt: now,
        lockedUntil: futureDate,
        createdAt: now,
      }

      vi.mocked(db.get).mockResolvedValueOnce(existing)

      const result = await getRateLimitStatus('test@example.com', 'admin_login')

      expect(result?.allowed).toBe(false)
      expect(result?.lockedUntil).toEqual(futureDate)
    })
  })

  describe('formatRateLimitError', () => {
    it('should format lockout message correctly', () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: lockedUntil,
        lockedUntil,
      }

      const message = formatRateLimitError(result)

      expect(message).toContain('Too many attempts')
      expect(message).toContain('15 minutes')
    })

    it('should format rate limit message correctly', () => {
      const resetAt = new Date(Date.now() + 60 * 60 * 1000)
      const result = {
        allowed: false,
        remaining: 0,
        resetAt,
      }

      const message = formatRateLimitError(result)

      expect(message).toContain('Rate limit exceeded')
      expect(message).toContain('60 minutes')
    })

    it('should use singular form for 1 minute', () => {
      const lockedUntil = new Date(Date.now() + 59 * 1000) // 59 seconds ~= 1 minute
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: lockedUntil,
        lockedUntil,
      }

      const message = formatRateLimitError(result)

      expect(message).toContain('1 minute')
      expect(message).not.toContain('minutes')
    })
  })

  describe('Different rate limit actions', () => {
    it('should use correct limits for verify action', async () => {
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const result = await checkRateLimit('test@example.com', 'verify')

      expect(result.remaining).toBe(4) // Default is 5 attempts
    })

    it('should use correct limits for resend action', async () => {
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const result = await checkRateLimit('test@example.com', 'resend')

      expect(result.remaining).toBe(2) // Default is 3 attempts
    })
  })
})
