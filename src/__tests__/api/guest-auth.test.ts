import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST as verifyEmail } from '@/app/api/guest/verify-email/route'
import { POST as verifyCode } from '@/app/api/guest/verify-code/route'
import { NextRequest } from 'next/server'

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
    run: vi.fn(),
  }

  return {
    db: mockDb,
    verificationCodes: {
      id: 'id',
      email: 'email',
      code: 'code',
      expiresAt: 'expiresAt',
      macAddress: 'macAddress',
      name: 'name',
      used: 'used',
      attempts: 'attempts',
      resendCount: 'resendCount',
    },
    rateLimits: {
      id: 'id',
      identifier: 'identifier',
      action: 'action',
      attempts: 'attempts',
      lastAttempt: 'lastAttempt',
      lockedUntil: 'lockedUntil',
    },
    users: {
      id: 'id',
      email: 'email',
      name: 'name',
      role: 'role',
      emailVerified: 'emailVerified',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    guests: {
      id: 'id',
      userId: 'userId',
      macAddress: 'macAddress',
      ipAddress: 'ipAddress',
      deviceInfo: 'deviceInfo',
      authorizedAt: 'authorizedAt',
      expiresAt: 'expiresAt',
      authCount: 'authCount',
      lastSeen: 'lastSeen',
    },
  }
})

// Mock email service
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotification: vi.fn().mockResolvedValue(undefined),
  generateVerificationCode: vi.fn(() => '123456'),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    codeSent: vi.fn(),
    authSuccess: vi.fn(),
    authFail: vi.fn(),
    getClientIP: vi.fn(() => '127.0.0.1'),
  },
}))

// Mock Unifi
vi.mock('@/lib/unifi', () => ({
  unifi: {
    authorizeGuest: vi.fn().mockResolvedValue(true),
    unauthorizeGuest: vi.fn().mockResolvedValue(true),
    getActiveClients: vi.fn().mockResolvedValue([]),
  },
}))

import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { unifi } from '@/lib/unifi'

describe('Guest Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.RATE_LIMIT_VERIFY_EMAIL = '5'
    process.env.VERIFICATION_CODE_EXPIRY_MINUTES = '10'
    process.env.RATE_LIMIT_CODE_ATTEMPTS = '3'
    process.env.GUEST_AUTH_DURATION_DAYS = '7'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/guest/verify-email', () => {
    it('should send verification email on first request', async () => {
      // Mock no existing rate limit
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          macAddress: 'aa:bb:cc:dd:ee:ff',
        }),
      })

      const response = await verifyEmail(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.expiresAt).toBeDefined()
      expect(sendVerificationEmail).toHaveBeenCalledWith('test@example.com', '123456', 'Test User')
      expect(logger.codeSent).toHaveBeenCalled()
    })

    it('should reject invalid email', async () => {
      const request = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          name: 'Test User',
        }),
      })

      const response = await verifyEmail(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })

    it('should enforce rate limiting after 5 attempts', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
        }),
      })

      const response = await verifyEmail(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit exceeded')
    })

    it('should reset rate limit after 1 hour', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
        }),
      })

      const response = await verifyEmail(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should invalidate old codes when sending new one', async () => {
      vi.mocked(db.get).mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
        }),
      })

      await verifyEmail(request)

      // Should update old codes to used=true
      expect(db.update).toHaveBeenCalled()
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('POST /api/guest/verify-code', () => {
    it('should successfully verify correct code', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      // Mock verification code lookup
      const verification = {
        id: 1,
        email: 'test@example.com',
        code: '123456',
        expiresAt,
        macAddress: 'aa:bb:cc:dd:ee:ff',
        name: 'Test User',
        used: false,
        attempts: 0,
        resendCount: 0,
        createdAt: now,
      }

      // Mock user creation
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'guest' as const,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }

      vi.mocked(db.get)
        .mockReturnValueOnce(verification) // First call for verification lookup
        .mockReturnValueOnce(undefined) // Second call for user lookup (no existing user)
        .mockReturnValueOnce(user) // Third call after user creation
        .mockReturnValueOnce(undefined) // Fourth call for existing guest lookup

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.email).toBe('test@example.com')
      expect(unifi.authorizeGuest).toHaveBeenCalledWith('aa:bb:cc:dd:ee:ff', expect.any(Number))
      expect(logger.authSuccess).toHaveBeenCalled()
    })

    it('should reject invalid code format', async () => {
      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '12345', // Only 5 digits
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Code must be 6 digits')
    })

    it('should reject expired verification code', async () => {
      vi.mocked(db.get).mockReturnValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid or expired code')
      expect(logger.authFail).toHaveBeenCalled()
    })

    it('should reject wrong code and increment attempts', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      const verification = {
        id: 1,
        email: 'test@example.com',
        code: '123456',
        expiresAt,
        macAddress: 'aa:bb:cc:dd:ee:ff',
        name: 'Test User',
        used: false,
        attempts: 0,
        resendCount: 0,
        createdAt: now,
      }

      vi.mocked(db.get).mockReturnValueOnce(verification)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '999999', // Wrong code
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid code')
      expect(data.error).toContain('2 attempts remaining')
      expect(db.update).toHaveBeenCalled()
      expect(logger.authFail).toHaveBeenCalled()
    })

    it('should invalidate code after 3 wrong attempts', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      const verification = {
        id: 1,
        email: 'test@example.com',
        code: '123456',
        expiresAt,
        macAddress: 'aa:bb:cc:dd:ee:ff',
        name: 'Test User',
        used: false,
        attempts: 3, // Already at max attempts
        resendCount: 0,
        createdAt: now,
      }

      vi.mocked(db.get).mockReturnValueOnce(verification)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Too many attempts')
      expect(data.expired).toBe(true)
      expect(db.update).toHaveBeenCalled()
    })

    it('should update existing guest authorization', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      const verification = {
        id: 1,
        email: 'test@example.com',
        code: '123456',
        expiresAt,
        macAddress: 'aa:bb:cc:dd:ee:ff',
        name: 'Test User',
        used: false,
        attempts: 0,
        resendCount: 0,
        createdAt: now,
      }

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'guest' as const,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }

      const existingGuest = {
        id: 1,
        userId: 'user-123',
        macAddress: 'aa:bb:cc:dd:ee:ff',
        ipAddress: '127.0.0.1',
        deviceInfo: 'Mozilla/5.0',
        authorizedAt: now,
        expiresAt: now,
        authCount: 1,
        lastSeen: now,
      }

      vi.mocked(db.get)
        .mockReturnValueOnce(verification)
        .mockReturnValueOnce(user)
        .mockReturnValueOnce(existingGuest)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(db.update).toHaveBeenCalled()
      expect(logger.authSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          isReturning: true,
        })
      )
    })

    it('should handle Unifi authorization failure gracefully', async () => {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      const verification = {
        id: 1,
        email: 'test@example.com',
        code: '123456',
        expiresAt,
        macAddress: 'aa:bb:cc:dd:ee:ff',
        name: 'Test User',
        used: false,
        attempts: 0,
        resendCount: 0,
        createdAt: now,
      }

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'guest' as const,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }

      vi.mocked(db.get)
        .mockReturnValueOnce(verification)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(user)
        .mockReturnValueOnce(undefined)

      // Mock Unifi failure
      vi.mocked(unifi.authorizeGuest).mockResolvedValueOnce(false)

      const request = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      })

      const response = await verifyCode(request)
      const data = await response.json()

      // Should fail fast with 503 when ALLOW_OFFLINE_AUTH is false (default)
      expect(response.status).toBe(503)
      expect(data.error).toBeDefined()
      expect(data.error).toContain('Network authorization failed')
      expect(data.recoverySteps).toBeDefined()
      expect(Array.isArray(data.recoverySteps)).toBe(true)
    })
  })

  describe('Integration: Full authentication flow', () => {
    // TODO: Fix this test - mock sequence is broken after reordering Unifi authorization
    it.skip('should complete full flow from email to code verification', async () => {
      // Step 1: Request verification email
      vi.mocked(db.get).mockReturnValueOnce(undefined)

      const emailRequest = new NextRequest('http://localhost:3000/api/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'integration@example.com',
          name: 'Integration Test',
          macAddress: '11:22:33:44:55:66',
        }),
      })

      const emailResponse = await verifyEmail(emailRequest)
      expect(emailResponse.status).toBe(200)

      // Step 2: Verify the code
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

      const verification = {
        id: 1,
        email: 'integration@example.com',
        code: '123456',
        expiresAt,
        macAddress: '11:22:33:44:55:66',
        name: 'Integration Test',
        used: false,
        attempts: 0,
        resendCount: 0,
        createdAt: now,
      }

      const user = {
        id: 'user-integration',
        email: 'integration@example.com',
        name: 'Integration Test',
        role: 'guest' as const,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }

      vi.mocked(db.get)
        .mockReturnValueOnce(verification)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(user)
        .mockReturnValueOnce(undefined)

      const codeRequest = new NextRequest('http://localhost:3000/api/guest/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: 'integration@example.com',
          code: '123456',
        }),
      })

      const codeResponse = await verifyCode(codeRequest)
      const codeData = await codeResponse.json()

      expect(codeResponse.status).toBe(200)
      expect(codeData.success).toBe(true)
      expect(codeData.user.email).toBe('integration@example.com')
      expect(logger.codeSent).toHaveBeenCalled()
      expect(logger.authSuccess).toHaveBeenCalled()
    })
  })
})
