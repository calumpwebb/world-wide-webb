import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { join } from 'path'
import { users, accounts } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

// Hash password using bcrypt (consistent with auth.ts)
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

const dbPath =
  process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'captive-portal.db')

const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

console.log(`Seeding admin user: ${adminEmail}`)

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

const db = drizzle(sqlite)

async function seed() {
  // Check if admin already exists
  const existing = db.select().from(users).where(eq(users.email, adminEmail)).get()

  if (existing) {
    console.log('Admin user already exists')
    sqlite.close()
    return
  }

  // Hash the password
  const hashedPassword = await hashPassword(adminPassword)
  const adminId = randomUUID()
  const accountId = randomUUID()

  // Create user with hashed password
  db.insert(users)
    .values({
      id: adminId,
      email: adminEmail,
      name: 'Admin',
      role: 'admin',
      emailVerified: true,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run()

  // Create credential account (Better Auth stores password in accounts table)
  db.insert(accounts)
    .values({
      id: accountId,
      userId: adminId,
      accountId: adminId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run()

  console.log('Admin user created successfully')
  console.log(`  Email: ${adminEmail}`)
  console.log(`  Password: ${adminPassword}`)
  console.log(`  ID: ${adminId}`)
  console.log('  You will be prompted to setup TOTP on first login')

  sqlite.close()
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
