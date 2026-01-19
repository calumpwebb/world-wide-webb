import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, verificationCodes, rateLimits } from '@/lib/db'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { logger } from '@/lib/logger'
import { eq, and } from 'drizzle-orm'

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  macAddress: z.string().optional(),
})

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_VERIFY_EMAIL || '5')
const CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '10')

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

    // Check rate limit
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

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

    // Save verification code
    await db.insert(verificationCodes).values({
      email,
      code,
      expiresAt,
      macAddress: macAddress || null,
      name,
      used: false,
      attempts: 0,
      resendCount: 0,
    })

    // Send verification email
    await sendVerificationEmail(email, code, name)

    // Log code sent event
    logger.codeSent({
      ipAddress: logger.getClientIP(request.headers),
      email,
      name,
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
