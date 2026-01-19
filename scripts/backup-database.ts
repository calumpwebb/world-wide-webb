#!/usr/bin/env tsx
/**
 * SQLite Database Backup Script
 *
 * Creates a timestamped backup of the SQLite database and manages retention.
 *
 * Features:
 * - Creates compressed backups with timestamps
 * - Automatic rotation (keeps last 30 days by default)
 * - Verification of backup integrity
 * - Support for offsite backup destinations
 *
 * Usage:
 *   tsx scripts/backup-database.ts [OPTIONS]
 *
 * Options:
 *   --retention-days <N>    Number of days to keep backups (default: 30)
 *   --backup-dir <PATH>     Backup destination directory (default: ./backups)
 *   --offsite-dir <PATH>    Optional offsite backup directory (e.g., mounted NAS)
 *   --verify                Verify backup integrity after creation
 *   --dry-run               Show what would be backed up without creating files
 */

import Database from 'better-sqlite3'
import { readdirSync, statSync, unlinkSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import { join, basename } from 'path'

// Configuration
interface BackupConfig {
  sourceDbPath: string
  backupDir: string
  offsiteDir?: string
  retentionDays: number
  verify: boolean
  dryRun: boolean
}

// Parse command line arguments
function parseArgs(): BackupConfig {
  const args = process.argv.slice(2)
  const config: BackupConfig = {
    sourceDbPath: join(process.cwd(), 'data', 'captive-portal.db'),
    backupDir: join(process.cwd(), 'backups'),
    retentionDays: 30,
    verify: false,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--retention-days':
        config.retentionDays = parseInt(args[++i], 10)
        break
      case '--backup-dir':
        config.backupDir = args[++i]
        break
      case '--offsite-dir':
        config.offsiteDir = args[++i]
        break
      case '--verify':
        config.verify = true
        break
      case '--dry-run':
        config.dryRun = true
        break
      case '--help':
        printHelp()
        process.exit(0)
      default:
        console.error(`Unknown option: ${args[i]}`)
        process.exit(1)
    }
  }

  return config
}

function printHelp() {
  console.log(`
SQLite Database Backup Script

Usage: tsx scripts/backup-database.ts [OPTIONS]

Options:
  --retention-days <N>    Number of days to keep backups (default: 30)
  --backup-dir <PATH>     Backup destination directory (default: ./backups)
  --offsite-dir <PATH>    Optional offsite backup directory (e.g., mounted NAS)
  --verify                Verify backup integrity after creation
  --dry-run               Show what would be backed up without creating files
  --help                  Show this help message

Examples:
  # Create daily backup with default settings
  tsx scripts/backup-database.ts

  # Create backup with verification
  tsx scripts/backup-database.ts --verify

  # Create backup and copy to NAS
  tsx scripts/backup-database.ts --offsite-dir /mnt/nas/backups

  # Keep 7 days of backups
  tsx scripts/backup-database.ts --retention-days 7
  `)
}

// Create backup with VACUUM INTO (SQLite 3.27+)
function createBackup(config: BackupConfig): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupFilename = `captive-portal-${timestamp}.db`
  const backupPath = join(config.backupDir, backupFilename)

  if (config.dryRun) {
    console.log(`[DRY RUN] Would create backup: ${backupPath}`)
    return backupPath
  }

  // Ensure backup directory exists
  if (!existsSync(config.backupDir)) {
    mkdirSync(config.backupDir, { recursive: true })
    console.log(`✓ Created backup directory: ${config.backupDir}`)
  }

  // Check source database exists
  if (!existsSync(config.sourceDbPath)) {
    throw new Error(`Source database not found: ${config.sourceDbPath}`)
  }

  console.log(`Creating backup of ${config.sourceDbPath}...`)

  // Use VACUUM INTO for atomic, optimized backup (requires SQLite 3.27+)
  const db = new Database(config.sourceDbPath, { readonly: true })
  try {
    db.exec(`VACUUM INTO '${backupPath}'`)
    console.log(`✓ Backup created: ${backupPath}`)
  } finally {
    db.close()
  }

  // Get file sizes
  const sourceSize = statSync(config.sourceDbPath).size
  const backupSize = statSync(backupPath).size
  console.log(`  Source: ${formatBytes(sourceSize)}`)
  console.log(`  Backup: ${formatBytes(backupSize)}`)

  return backupPath
}

// Verify backup integrity
function verifyBackup(backupPath: string, config: BackupConfig): boolean {
  if (config.dryRun) {
    console.log(`[DRY RUN] Would verify: ${backupPath}`)
    return true
  }

  console.log(`Verifying backup integrity...`)

  try {
    // Open backup in read-only mode
    const db = new Database(backupPath, { readonly: true })

    // Run integrity check
    const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    db.close()

    if (result.integrity_check === 'ok') {
      console.log(`✓ Backup integrity verified`)
      return true
    } else {
      console.error(`✗ Backup integrity check failed: ${result.integrity_check}`)
      return false
    }
  } catch (error) {
    console.error(`✗ Backup verification failed:`, error)
    return false
  }
}

// Copy backup to offsite location
function copyToOffsite(backupPath: string, config: BackupConfig) {
  if (!config.offsiteDir) return

  if (config.dryRun) {
    console.log(`[DRY RUN] Would copy to offsite: ${config.offsiteDir}`)
    return
  }

  // Ensure offsite directory exists
  if (!existsSync(config.offsiteDir)) {
    mkdirSync(config.offsiteDir, { recursive: true })
    console.log(`✓ Created offsite directory: ${config.offsiteDir}`)
  }

  const filename = basename(backupPath)
  const offsitePath = join(config.offsiteDir, filename)

  console.log(`Copying to offsite location...`)
  copyFileSync(backupPath, offsitePath)
  console.log(`✓ Offsite copy created: ${offsitePath}`)
}

// Remove old backups beyond retention period
function rotateBackups(config: BackupConfig) {
  if (!existsSync(config.backupDir)) return

  console.log(`Rotating backups (retention: ${config.retentionDays} days)...`)

  const now = Date.now()
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000
  let deletedCount = 0

  const files = readdirSync(config.backupDir)
    .filter((f) => f.startsWith('captive-portal-') && f.endsWith('.db'))
    .map((f) => join(config.backupDir, f))

  for (const file of files) {
    const stats = statSync(file)
    const age = now - stats.mtimeMs

    if (age > retentionMs) {
      if (config.dryRun) {
        console.log(`[DRY RUN] Would delete old backup: ${basename(file)} (${formatAge(age)})`)
      } else {
        unlinkSync(file)
        console.log(`  Deleted old backup: ${basename(file)} (${formatAge(age)})`)
      }
      deletedCount++
    }
  }

  if (deletedCount === 0) {
    console.log(`✓ No old backups to delete`)
  } else {
    console.log(`✓ Deleted ${deletedCount} old backup(s)`)
  }

  // Also rotate offsite backups if configured
  if (config.offsiteDir && existsSync(config.offsiteDir)) {
    const offsitePath = config.offsiteDir // Store in const for TypeScript narrowing
    const offsiteFiles = readdirSync(offsitePath)
      .filter((f) => f.startsWith('captive-portal-') && f.endsWith('.db'))
      .map((f) => join(offsitePath, f))

    let offsiteDeletedCount = 0
    for (const file of offsiteFiles) {
      const stats = statSync(file)
      const age = now - stats.mtimeMs

      if (age > retentionMs) {
        if (config.dryRun) {
          console.log(
            `[DRY RUN] Would delete offsite backup: ${basename(file)} (${formatAge(age)})`
          )
        } else {
          unlinkSync(file)
          console.log(`  Deleted offsite backup: ${basename(file)} (${formatAge(age)})`)
        }
        offsiteDeletedCount++
      }
    }

    if (offsiteDeletedCount > 0) {
      console.log(`✓ Deleted ${offsiteDeletedCount} old offsite backup(s)`)
    }
  }
}

// Format bytes as human-readable
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// Format age as human-readable
function formatAge(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days > 0) return `${days} day(s)`

  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours > 0) return `${hours} hour(s)`

  const minutes = Math.floor(ms / (60 * 1000))
  return `${minutes} minute(s)`
}

// Main backup process
async function main() {
  const config = parseArgs()

  console.log(`\n=== SQLite Backup Script ===\n`)

  if (config.dryRun) {
    console.log(`🔍 DRY RUN MODE - No changes will be made\n`)
  }

  try {
    // Create backup
    const backupPath = createBackup(config)

    // Verify backup if requested
    if (config.verify) {
      const isValid = verifyBackup(backupPath, config)
      if (!isValid) {
        console.error(`\n✗ Backup verification failed - backup may be corrupted`)
        process.exit(1)
      }
    }

    // Copy to offsite location
    if (config.offsiteDir) {
      copyToOffsite(backupPath, config)
    }

    // Rotate old backups
    rotateBackups(config)

    console.log(`\n✓ Backup completed successfully\n`)
  } catch (error) {
    console.error(`\n✗ Backup failed:`, error)
    process.exit(1)
  }
}

main()
