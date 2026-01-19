import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

const dbPath =
  process.env.DATABASE_URL?.replace('file:', '') || join(process.cwd(), 'data', 'captive-portal.db')

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
  console.log('Created data directory')
}

console.log(`Running migrations on database: ${dbPath}`)

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

const db = drizzle(sqlite)

migrate(db, { migrationsFolder: './drizzle' })

console.log('Migrations completed successfully')

sqlite.close()
