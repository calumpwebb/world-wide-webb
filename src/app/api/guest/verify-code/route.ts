import { NextRequest, NextResponse } from 'next/server'
import { db, verificationCodes, users, guests } from '@/lib/db'
import { sendAdminNotification } from '@/lib/email'
import { logger } from '@/lib/logger'
import { unifi } from '@/lib/unifi'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID, timingSafeEqual } from 'crypto'
import { ONE_DAY_MS, CODE_VERIFICATION_MAX_ATTEMPTS_DEFAULT } from '@/lib/constants'
import { isValidMac } from '@/lib/utils'
import { isDisposableEmail } from '@/lib/disposable-domains'

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
})

const MAX_ATTEMPTS = parseInt(
  process.env.RATE_LIMIT_CODE_ATTEMPTS || String(CODE_VERIFICATION_MAX_ATTEMPTS_DEFAULT)
)
const GUEST_AUTH_DAYS = parseInt(process.env.GUEST_AUTH_DURATION_DAYS || '7')
const ALLOW_OFFLINE_AUTH = process.env.ALLOW_OFFLINE_AUTH === 'true'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = requestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { email, code } = result.data
    const normalizedEmail = email.toLowerCase().trim()

    // Find the verification code
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
      // Log failed attempt
      logger.authFail({
        ipAddress: logger.getClientIP(request.headers),
        email: normalizedEmail,
        reason: 'no_valid_code',
      })

      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      )
    }

    // Additional defensive check for code field
    if (!verification.code || verification.code.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check attempt count
    if ((verification.attempts || 0) >= MAX_ATTEMPTS) {
      // Invalidate the code
      try {
        db.update(verificationCodes)
          .set({ used: true })
          .where(eq(verificationCodes.id, verification.id))
          .run()
      } catch (err) {
        console.error('Failed to invalidate verification code:', err)
      }

      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.', expired: true },
        { status: 400 }
      )
    }

    // Verify the code using constant-time comparison to prevent timing attacks
    const isCodeValid =
      verification.code.length === code.length &&
      timingSafeEqual(Buffer.from(verification.code), Buffer.from(code))

    if (!isCodeValid) {
      // Increment attempts
      try {
        db.update(verificationCodes)
          .set({ attempts: (verification.attempts || 0) + 1 })
          .where(eq(verificationCodes.id, verification.id))
          .run()
      } catch (err) {
        console.error('Failed to increment verification attempts:', err)
      }

      const remainingAttempts = MAX_ATTEMPTS - (verification.attempts || 0) - 1

      // Log failed attempt
      logger.authFail({
        ipAddress: logger.getClientIP(request.headers),
        email: normalizedEmail,
        reason: 'wrong_code',
        remainingAttempts,
      })

      return NextResponse.json(
        {
          error: `Invalid code. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`,
        },
        { status: 400 }
      )
    }

    // Code is valid - mark as used
    try {
      db.update(verificationCodes)
        .set({ used: true })
        .where(eq(verificationCodes.id, verification.id))
        .run()
    } catch (err) {
      console.error('Failed to mark verification code as used:', err)
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
    }

    // Get or create user
    let user = db.select().from(users).where(eq(users.email, normalizedEmail)).get()

    if (!user) {
      try {
        const userId = randomUUID()
        const isDisposable = isDisposableEmail(normalizedEmail)

        db.insert(users)
          .values({
            id: userId,
            email: normalizedEmail,
            name: verification.name,
            role: 'guest',
            emailVerified: true,
            isDisposableEmail: isDisposable,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .run()
        user = db.select().from(users).where(eq(users.id, userId)).get()

        // Log if disposable email was allowed through
        if (isDisposable) {
          console.log('Disposable email flagged:', { email: normalizedEmail, userId })
        }
      } catch (err) {
        console.error('Failed to create user:', err)
        return NextResponse.json(
          { error: 'User creation failed. Please try again.' },
          { status: 500 }
        )
      }
    }

    if (!user) {
      throw new Error('Failed to create user')
    }

    // Calculate expiration
    const now = new Date()
    const expiresAt = new Date(now.getTime() + GUEST_AUTH_DAYS * ONE_DAY_MS)
    const macAddress = verification.macAddress || ''
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined

    // Validate MAC address format if provided
    if (macAddress && !isValidMac(macAddress)) {
      return NextResponse.json(
        { error: 'Invalid MAC address format. Please try again or contact support.' },
        { status: 400 }
      )
    }

    if (!macAddress) {
      console.warn('No MAC address provided - network authorization will be skipped', {
        email: normalizedEmail,
      })
    }

    // CRITICAL: Authorize MAC on Unifi Controller FIRST (before database insert)
    // This prevents database/network state mismatch where guest is authorized in DB but not on network
    let unifiAuthorized = false
    let unifiError: string | null = null
    if (macAddress) {
      try {
        unifiAuthorized = await unifi.authorizeGuest(macAddress, GUEST_AUTH_DAYS * 24 * 60)
        if (!unifiAuthorized) {
          const errorMsg = 'Network authorization failed'
          console.warn('Unifi authorization failed for MAC:', macAddress)

          if (!ALLOW_OFFLINE_AUTH) {
            // Fail-fast mode: reject the request
            logger.authFail({
              userId: user.id,
              ipAddress: logger.getClientIP(request.headers),
              email: normalizedEmail,
              reason: 'unifi_authorization_failed',
              macAddress,
            })
            return NextResponse.json(
              {
                error:
                  errorMsg +
                  '. Please ensure you are connected to the guest network and try again.',
                recoverySteps: [
                  'Verify you are connected to the guest WiFi network',
                  'Try disconnecting and reconnecting to the network',
                  'Contact the network administrator if the problem persists',
                ],
              },
              { status: 503 }
            )
          }

          // Graceful degradation mode: warn but continue
          unifiError = errorMsg + '. You may need to reconnect to the network.'
        }
      } catch (err) {
        const errorMsg = 'Network authorization error'
        console.error('Unifi authorization error:', err)

        if (!ALLOW_OFFLINE_AUTH) {
          // Fail-fast mode: reject the request
          logger.authFail({
            userId: user.id,
            ipAddress: logger.getClientIP(request.headers),
            email: normalizedEmail,
            reason: 'unifi_connection_error',
            macAddress,
          })
          return NextResponse.json(
            {
              error: errorMsg + '. The network controller is currently unavailable.',
              recoverySteps: [
                'Wait a few minutes and try again',
                'Verify the network is operational',
                'Contact the network administrator if the problem persists',
              ],
            },
            { status: 503 }
          )
        }

        // Graceful degradation mode: warn but continue
        unifiError = errorMsg + '. Please reconnect to the network.'
      }
    }

    // Only save to database AFTER Unifi authorization succeeds (or if offline mode is enabled)
    // Check if this MAC already exists for the user
    const existingGuest = db
      .select()
      .from(guests)
      .where(and(eq(guests.userId, user.id), eq(guests.macAddress, macAddress)))
      .get()

    try {
      if (existingGuest) {
        // Update existing authorization
        db.update(guests)
          .set({
            expiresAt,
            lastSeen: now,
            authCount: (existingGuest.authCount || 1) + 1,
            ipAddress,
          })
          .where(eq(guests.id, existingGuest.id))
          .run()
      } else {
        // Create new guest authorization
        db.insert(guests)
          .values({
            userId: user.id,
            macAddress,
            ipAddress,
            deviceInfo: request.headers.get('user-agent') || undefined,
            authorizedAt: now,
            expiresAt,
            authCount: 1,
          })
          .run()
      }
    } catch (err) {
      console.error('Failed to create/update guest authorization:', err)
      return NextResponse.json(
        { error: 'Failed to authorize device. Please try again.' },
        { status: 500 }
      )
    }

    // Log success
    logger.authSuccess({
      userId: user.id,
      macAddress,
      ipAddress,
      email: normalizedEmail,
      name: verification.name || undefined,
      expiresAt,
      isReturning: !!existingGuest,
      unifiAuthorized,
    })

    // Send admin notification (fire and forget)
    sendAdminNotification({
      name: verification.name || 'Guest',
      email: normalizedEmail,
      macAddress,
      ipAddress,
      authorizedAt: now,
      expiresAt,
    }).catch((err) => console.error('Failed to send admin notification:', err))

    return NextResponse.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      user: {
        name: user.name,
        email: user.email,
      },
      warning: unifiError || undefined,
    })
  } catch (error) {
    console.error('Error in verify-code:', error)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
