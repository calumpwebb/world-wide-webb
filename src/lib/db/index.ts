import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { join } from 'path'

// Get database path from environment or use default
const dbPath =
  process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'captive-portal.db')

// Create database connection with WAL mode for better concurrent access
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

// Create Drizzle ORM instance with schema
export const db = drizzle(sqlite, { schema })

// Re-export schema for convenience
export * from './schema'
