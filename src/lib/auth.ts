import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { db } from './db'
import * as schema from './db/schema'
import bcrypt from 'bcryptjs'
import {
  BCRYPT_SALT_ROUNDS,
  TOTP_PERIOD_SECONDS,
  BACKUP_CODES_AMOUNT,
  BACKUP_CODE_LENGTH,
  VERIFICATION_CODE_LENGTH,
  SEVEN_DAYS_MS,
  ONE_DAY_MS,
} from './constants'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      // Map plural exports to singular names expected by Better Auth
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),

  // Email + Password for admin
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Admin is pre-verified
    password: {
      hash: async (password: string) => {
        const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS)
        return bcrypt.hash(password, salt)
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        return bcrypt.compare(password, hash)
      },
    },
  },

  // TOTP 2FA for admin
  plugins: [
    twoFactor({
      issuer: 'World Wide Webb',
      otpOptions: {
        period: TOTP_PERIOD_SECONDS,
        digits: VERIFICATION_CODE_LENGTH,
      },
      backupCodeOptions: {
        amount: BACKUP_CODES_AMOUNT,
        length: BACKUP_CODE_LENGTH,
      },
    }),
  ],

  // Session config
  session: {
    expiresIn: SEVEN_DAYS_MS / 1000, // 7 days (in seconds for Better Auth)
    updateAge: ONE_DAY_MS / 1000, // Update every 24 hours (in seconds)
  },

  // Secret for session encryption
  secret: process.env.BETTER_AUTH_SECRET,

  // User fields
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'guest',
        input: false, // Don't allow user to set role directly
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
