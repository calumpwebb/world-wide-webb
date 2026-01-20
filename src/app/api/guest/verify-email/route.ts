import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, verificationCodes, rateLimits } from '@/lib/db'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { logger } from '@/lib/logger'
import { eq, and } from 'drizzle-orm'
import { sanitizeName, isValidMac } from '@/lib/utils'
import {
  VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT,
  VERIFICATION_CODE_EXPIRY_MINUTES,
  ONE_HOUR_MS,
} from '@/lib/constants'
import { MAX_NAME_LENGTH } from '@/lib/constants/validation'
import { isDisposableEmail, DISPOSABLE_EMAIL_ERROR } from '@/lib/disposable-domains'

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(MAX_NAME_LENGTH),
  macAddress: z.string().optional(),
})

const RATE_LIMIT = parseInt(
  process.env.RATE_LIMIT_VERIFY_EMAIL || String(VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT)
)
const CODE_EXPIRY_MINUTES = parseInt(
  process.env.VERIFICATION_CODE_EXPIRY_MINUTES || String(VERIFICATION_CODE_EXPIRY_MINUTES)
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = requestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, name, macAddress } = result.data

    // Check for disposable email domains
    const ALLOW_DISPOSABLE_EMAILS = process.env.ALLOW_DISPOSABLE_EMAILS === 'true'
    if (!ALLOW_DISPOSABLE_EMAILS && isDisposableEmail(email)) {
      logger.authFail({
        ipAddress: logger.getClientIP(request.headers),
        email,
        name,
        reason: 'disposable_email_blocked',
      })
      return NextResponse.json({ error: DISPOSABLE_EMAIL_ERROR }, { status: 400 })
    }

    // Validate MAC address if provided
    if (macAddress && !isValidMac(macAddress)) {
      return NextResponse.json({ error: 'Invalid MAC address format' }, { status: 400 })
    }

    // Sanitize name to prevent XSS
    const sanitizedName = sanitizeName(name)
    if (!sanitizedName || sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Invalid name - must contain at least one valid character' },
        { status: 400 }
      )
    }

    // Check rate limit
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS)

    const existingLimit = await db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.identifier, email), eq(rateLimits.action, 'verify')))
      .get()

    if (existingLimit) {
      // Reset if last attempt was more than an hour ago
      if (existingLimit.lastAttempt && existingLimit.lastAttempt < oneHourAgo) {
        await db
          .update(rateLimits)
          .set({ attempts: 1, lastAttempt: now, lockedUntil: null })
          .where(eq(rateLimits.id, existingLimit.id))
      } else if (existingLimit.attempts && existingLimit.attempts >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in an hour.' },
          { status: 429 }
        )
      } else {
        await db
          .update(rateLimits)
          .set({ attempts: (existingLimit.attempts || 0) + 1, lastAttempt: now })
          .where(eq(rateLimits.id, existingLimit.id))
      }
    } else {
      await db.insert(rateLimits).values({
        identifier: email,
        action: 'verify',
        attempts: 1,
        lastAttempt: now,
      })
    }

    // Invalidate any existing codes for this email
    await db
      .update(verificationCodes)
      .set({ used: true })
      .where(and(eq(verificationCodes.email, email), eq(verificationCodes.used, false)))

    // Generate new code
    const code = generateVerificationCode()
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000)

    // Save verification code with sanitized name
    await db.insert(verificationCodes).values({
      email,
      code,
      expiresAt,
      macAddress: macAddress || null,
      name: sanitizedName,
      used: false,
      attempts: 0,
      resendCount: 0,
    })

    // Send verification email with sanitized name
    await sendVerificationEmail(email, code, sanitizedName)

    // Log code sent event with sanitized name
    logger.codeSent({
      ipAddress: logger.getClientIP(request.headers),
      email,
      name: sanitizedName,
      macAddress: macAddress || undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
