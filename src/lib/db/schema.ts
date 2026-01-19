import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

// Better Auth User Table
export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
  name: text('name'),
  password: text('password'), // NULL for guests (passwordless)
  role: text('role', { enum: ['guest', 'admin'] })
    .notNull()
    .default('guest'),
  twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).default(false),
  twoFactorSecret: text('twoFactorSecret'), // TOTP secret (admin only)
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Better Auth Session Table
export const sessions = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Better Auth Account Table (for OAuth providers, if needed)
export const accounts = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Better Auth Verification Table
export const verifications = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Two-Factor Authentication (TOTP for admin)
export const twoFactors = sqliteTable('twoFactor', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes'), // JSON array of backup codes
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Guest Network Authorization
export const guests = sqliteTable(
  'guests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    macAddress: text('macAddress').notNull(),
    ipAddress: text('ipAddress'),
    deviceInfo: text('deviceInfo'), // User agent, device type
    authorizedAt: integer('authorizedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    lastSeen: integer('lastSeen', { mode: 'timestamp' }),
    authCount: integer('authCount').default(1),
    nickname: text('nickname'), // User-editable device name
  },
  (table) => ({
    macIdx: index('idx_guests_mac').on(table.macAddress),
    expiresIdx: index('idx_guests_expires').on(table.expiresAt),
    userIdx: index('idx_guests_user').on(table.userId),
  })
)

// Email Verification Codes (2FA for guest auth)
export const verificationCodes = sqliteTable(
  'verification_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    code: text('code').notNull(), // 6-digit code
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    used: integer('used', { mode: 'boolean' }).default(false),
    attempts: integer('attempts').default(0), // Track wrong attempts
    resendCount: integer('resendCount').default(0),
    lastResentAt: integer('lastResentAt', { mode: 'timestamp' }),
    macAddress: text('macAddress'), // Store MAC for authorization
    name: text('name'), // Guest name for user creation
    createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => ({
    emailIdx: index('idx_verification_email').on(table.email),
    codeIdx: index('idx_verification_code').on(table.code),
  })
)

// Activity Logs
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId').references(() => users.id, { onDelete: 'set null' }),
    macAddress: text('macAddress'),
    eventType: text('eventType', {
      enum: [
        'connect',
        'disconnect',
        'auth_success',
        'auth_fail',
        'admin_revoke',
        'admin_extend',
        'code_sent',
        'code_resent',
        'admin_login',
        'admin_logout',
      ],
    }).notNull(),
    ipAddress: text('ipAddress'),
    details: text('details'), // JSON with event details
    createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('idx_logs_user').on(table.userId),
    typeIdx: index('idx_logs_type').on(table.eventType),
    createdIdx: index('idx_logs_created').on(table.createdAt),
  })
)

// Rate Limiting
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    identifier: text('identifier').notNull(), // email or IP
    action: text('action').notNull(), // 'verify' | 'resend' | 'login'
    attempts: integer('attempts').default(0),
    lastAttempt: integer('lastAttempt', { mode: 'timestamp' }),
    lockedUntil: integer('lockedUntil', { mode: 'timestamp' }),
  },
  (table) => ({
    identifierIdx: index('idx_rate_identifier').on(table.identifier, table.action),
  })
)

// Network Statistics (cached from Unifi)
export const networkStats = sqliteTable(
  'network_stats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    macAddress: text('macAddress').notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    bytesReceived: integer('bytesReceived').default(0),
    bytesSent: integer('bytesSent').default(0),
    domains: text('domains'), // JSON array of domains visited
    signalStrength: integer('signalStrength'), // RSSI
    apMacAddress: text('apMacAddress'), // Connected AP
  },
  (table) => ({
    macIdx: index('idx_stats_mac').on(table.macAddress),
    timestampIdx: index('idx_stats_timestamp').on(table.timestamp),
  })
)

// Type exports for use in application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Guest = typeof guests.$inferSelect
export type NewGuest = typeof guests.$inferInsert
export type VerificationCode = typeof verificationCodes.$inferSelect
export type NewVerificationCode = typeof verificationCodes.$inferInsert
export type ActivityLog = typeof activityLogs.$inferSelect
export type NewActivityLog = typeof activityLogs.$inferInsert
