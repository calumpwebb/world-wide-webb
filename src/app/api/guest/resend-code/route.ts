import { NextRequest, NextResponse } from 'next/server'
import { db, verificationCodes } from '@/lib/db'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { logger } from '@/lib/logger'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
})

const RESEND_COOLDOWN = parseInt(process.env.RATE_LIMIT_RESEND_COOLDOWN || '30') * 1000
const MAX_RESENDS_PER_HOUR = parseInt(process.env.MAX_RESENDS_PER_HOUR || '3')
const CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '10')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = requestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { email } = result.data
    const normalizedEmail = email.toLowerCase().trim()
    const now = Date.now()

    // Find the most recent verification code for this email
    const verification = db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, normalizedEmail),
          eq(verificationCodes.used, false),
          gt(verificationCodes.expiresAt, new Date())
        )
      )
      .get()

    if (!verification) {
      return NextResponse.json(
        { error: 'No pending verification found. Please start over.' },
        { status: 400 }
      )
    }

    // Check cooldown
    if (verification.lastResentAt) {
      const timeSinceLastResend = now - verification.lastResentAt.getTime()
      if (timeSinceLastResend < RESEND_COOLDOWN) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastResend) / 1000)
        return NextResponse.json(
          {
            error: `Please wait ${waitSeconds} seconds before requesting another code.`,
            canResendAt: new Date(
              verification.lastResentAt.getTime() + RESEND_COOLDOWN
            ).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    // Check resend count
    if ((verification.resendCount || 0) >= MAX_RESENDS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many resend attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Generate new code
    const newCode = generateVerificationCode()
    const expiresAt = new Date(now + CODE_EXPIRY_MINUTES * 60 * 1000)

    // Update the verification record with new code
    db.update(verificationCodes)
      .set({
        code: newCode,
        expiresAt,
        attempts: 0, // Reset attempts
        resendCount: (verification.resendCount || 0) + 1,
        lastResentAt: new Date(),
      })
      .where(eq(verificationCodes.id, verification.id))
      .run()

    // Send email
    await sendVerificationEmail(normalizedEmail, newCode, verification.name || 'Guest')

    // Log code resent event
    logger.codeResent({
      ipAddress: logger.getClientIP(request.headers),
      email: normalizedEmail,
      resendCount: (verification.resendCount || 0) + 1,
    })

    return NextResponse.json({
      success: true,
      message: 'New verification code sent',
      canResendAt: new Date(now + RESEND_COOLDOWN).toISOString(),
    })
  } catch (error) {
    console.error('Error in resend-code:', error)
    return NextResponse.json({ error: 'Failed to resend code. Please try again.' }, { status: 500 })
  }
}
