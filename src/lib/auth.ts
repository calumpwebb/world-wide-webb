import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { db } from './db'
import * as schema from './db/schema'
import bcrypt from 'bcryptjs'

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
        const salt = await bcrypt.genSalt(10)
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
        period: 30,
        digits: 6,
      },
      backupCodeOptions: {
        amount: 10, // Generate 10 backup codes
        length: 10, // 10 characters each
      },
    }),
  ],

  // Session config
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
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
