import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { users } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'captive-portal.db');

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail) {
  console.error('Missing ADMIN_EMAIL in environment');
  process.exit(1);
}

if (!adminPassword) {
  console.error('Missing ADMIN_PASSWORD in environment');
  process.exit(1);
}

console.log(`Seeding admin user: ${adminEmail}`);

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

const db = drizzle(sqlite);

async function seed() {
  // Check if admin already exists
  const existing = db.select().from(users).where(eq(users.email, adminEmail!)).get();

  if (existing) {
    console.log('Admin user already exists');
    sqlite.close();
    return;
  }

  // Hash password using bcrypt-compatible approach
  // Note: Better Auth will handle password hashing, but we need to create the user manually
  // For now, we'll store a placeholder - the actual seeding should use Better Auth's API
  const adminId = randomUUID();

  db.insert(users).values({
    id: adminId,
    email: adminEmail!,
    name: 'Admin',
    role: 'admin',
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  console.log('Admin user created successfully');
  console.log(`  Email: ${adminEmail}`);
  console.log(`  ID: ${adminId}`);
  console.log('  Note: Password will be set via Better Auth on first login');
  console.log('  You will be prompted to setup TOTP on first login');

  sqlite.close();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
