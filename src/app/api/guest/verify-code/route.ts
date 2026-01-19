import { NextRequest, NextResponse } from 'next/server';
import { db, verificationCodes, users, guests, activityLogs } from '@/lib/db';
import { sendAdminNotification } from '@/lib/email';
import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

const MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_CODE_ATTEMPTS || '3');
const GUEST_AUTH_DAYS = parseInt(process.env.GUEST_AUTH_DURATION_DAYS || '7');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, code } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

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
      .get();

    if (!verification) {
      // Log failed attempt
      db.insert(activityLogs)
        .values({
          eventType: 'auth_fail',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          details: JSON.stringify({ email: normalizedEmail, reason: 'no_valid_code' }),
        })
        .run();

      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check attempt count
    if ((verification.attempts || 0) >= MAX_ATTEMPTS) {
      // Invalidate the code
      db.update(verificationCodes)
        .set({ used: true })
        .where(eq(verificationCodes.id, verification.id))
        .run();

      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.', expired: true },
        { status: 400 }
      );
    }

    // Verify the code
    if (verification.code !== code) {
      // Increment attempts
      db.update(verificationCodes)
        .set({ attempts: (verification.attempts || 0) + 1 })
        .where(eq(verificationCodes.id, verification.id))
        .run();

      const remainingAttempts = MAX_ATTEMPTS - (verification.attempts || 0) - 1;

      // Log failed attempt
      db.insert(activityLogs)
        .values({
          eventType: 'auth_fail',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          details: JSON.stringify({ email: normalizedEmail, reason: 'wrong_code', remainingAttempts }),
        })
        .run();

      return NextResponse.json(
        {
          error: `Invalid code. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`,
        },
        { status: 400 }
      );
    }

    // Code is valid - mark as used
    db.update(verificationCodes)
      .set({ used: true })
      .where(eq(verificationCodes.id, verification.id))
      .run();

    // Get or create user
    let user = db.select().from(users).where(eq(users.email, normalizedEmail)).get();

    if (!user) {
      const userId = randomUUID();
      db.insert(users)
        .values({
          id: userId,
          email: normalizedEmail,
          name: verification.name,
          role: 'guest',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
      user = db.select().from(users).where(eq(users.id, userId)).get();
    }

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Calculate expiration
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GUEST_AUTH_DAYS * 24 * 60 * 60 * 1000);
    const macAddress = verification.macAddress || '';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    // Check if this MAC already exists for the user
    const existingGuest = db
      .select()
      .from(guests)
      .where(and(eq(guests.userId, user.id), eq(guests.macAddress, macAddress)))
      .get();

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
        .run();
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
        .run();
    }

    // TODO: Authorize MAC on Unifi Controller
    // await unifi.authorizeGuest(macAddress, GUEST_AUTH_DAYS * 24 * 60 * 60);

    // Log success
    db.insert(activityLogs)
      .values({
        userId: user.id,
        macAddress,
        eventType: 'auth_success',
        ipAddress,
        details: JSON.stringify({
          name: verification.name,
          email: normalizedEmail,
          expiresAt: expiresAt.toISOString(),
          isReturning: !!existingGuest,
        }),
      })
      .run();

    // Send admin notification (fire and forget)
    sendAdminNotification({
      name: verification.name || 'Guest',
      email: normalizedEmail,
      macAddress,
      ipAddress,
      authorizedAt: now,
      expiresAt,
    }).catch((err) => console.error('Failed to send admin notification:', err));

    return NextResponse.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Error in verify-code:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
