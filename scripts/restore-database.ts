#!/usr/bin/env tsx
/**
 * SQLite Database Restore Script
 *
 * Restores a SQLite database from a backup file with safety checks.
 *
 * Features:
 * - Lists available backups
 * - Verifies backup integrity before restore
 * - Creates pre-restore backup of current database
 * - Dry-run mode to preview restore
 *
 * Usage:
 *   tsx scripts/restore-database.ts [OPTIONS]
 *
 * Options:
 *   --backup-file <PATH>    Path to backup file to restore
 *   --list                  List available backups
 *   --no-backup             Skip pre-restore backup of current database
 *   --force                 Skip confirmation prompt
 *   --dry-run               Show what would be restored without making changes
 */

import Database from 'better-sqlite3'
import { existsSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import * as readline from 'readline'

// Configuration
interface RestoreConfig {
  backupFile?: string
  targetDbPath: string
  backupDir: string
  createPreRestoreBackup: boolean
  force: boolean
  dryRun: boolean
  listBackups: boolean
}

// Parse command line arguments
function parseArgs(): RestoreConfig {
  const args = process.argv.slice(2)
  const config: RestoreConfig = {
    targetDbPath: join(process.cwd(), 'data', 'captive-portal.db'),
    backupDir: join(process.cwd(), 'backups'),
    createPreRestoreBackup: true,
    force: false,
    dryRun: false,
    listBackups: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backup-file':
        config.backupFile = args[++i]
        break
      case '--backup-dir':
        config.backupDir = args[++i]
        break
      case '--list':
        config.listBackups = true
        break
      case '--no-backup':
        config.createPreRestoreBackup = false
        break
      case '--force':
        config.force = true
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
SQLite Database Restore Script

Usage: tsx scripts/restore-database.ts [OPTIONS]

Options:
  --backup-file <PATH>    Path to backup file to restore
  --backup-dir <PATH>     Backup directory to search (default: ./backups)
  --list                  List available backups and exit
  --no-backup             Skip pre-restore backup of current database
  --force                 Skip confirmation prompt
  --dry-run               Show what would be restored without making changes
  --help                  Show this help message

Examples:
  # List available backups
  tsx scripts/restore-database.ts --list

  # Restore from specific backup (with confirmation)
  tsx scripts/restore-database.ts --backup-file backups/captive-portal-2024-01-19T12-00-00.db

  # Restore without pre-restore backup (dangerous!)
  tsx scripts/restore-database.ts --backup-file <PATH> --no-backup --force

  # Preview restore without making changes
  tsx scripts/restore-database.ts --backup-file <PATH> --dry-run
  `)
}

// List available backups
function listBackups(config: RestoreConfig) {
  if (!existsSync(config.backupDir)) {
    console.log(`No backups found (directory doesn't exist): ${config.backupDir}`)
    return
  }

  const backups = readdirSync(config.backupDir)
    .filter((f) => f.startsWith('captive-portal-') && f.endsWith('.db'))
    .map((f) => {
      const path = join(config.backupDir, f)
      const stats = statSync(path)
      return {
        filename: f,
        path,
        size: stats.size,
        modified: stats.mtime,
      }
    })
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())

  if (backups.length === 0) {
    console.log(`No backups found in: ${config.backupDir}`)
    return
  }

  console.log(`\nAvailable backups (${backups.length}):\n`)
  console.log(`${'Filename'.padEnd(40)} ${'Size'.padEnd(12)} ${'Modified'.padEnd(20)}`)
  console.log('-'.repeat(75))

  for (const backup of backups) {
    console.log(
      `${backup.filename.padEnd(40)} ${formatBytes(backup.size).padEnd(12)} ${backup.modified.toISOString().slice(0, 19).replace('T', ' ')}`
    )
  }

  console.log(`\nTo restore a backup, run:`)
  console.log(`  tsx scripts/restore-database.ts --backup-file backups/<FILENAME>\n`)
}

// Verify backup integrity
function verifyBackup(backupPath: string): boolean {
  console.log(`Verifying backup integrity...`)

  try {
    const db = new Database(backupPath, { readonly: true })
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

// Create pre-restore backup
function createPreRestoreBackup(config: RestoreConfig): string {
  if (!existsSync(config.targetDbPath)) {
    console.log(`No current database to backup (${config.targetDbPath})`)
    return ''
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const preRestoreFilename = `captive-portal-pre-restore-${timestamp}.db`
  const preRestorePath = join(config.backupDir, preRestoreFilename)

  console.log(`Creating pre-restore backup...`)

  if (config.dryRun) {
    console.log(`[DRY RUN] Would create pre-restore backup: ${preRestorePath}`)
    return preRestorePath
  }

  copyFileSync(config.targetDbPath, preRestorePath)
  console.log(`✓ Pre-restore backup created: ${preRestorePath}`)

  return preRestorePath
}

// Restore database
function restoreDatabase(config: RestoreConfig) {
  if (!config.backupFile) {
    throw new Error('No backup file specified')
  }

  if (!existsSync(config.backupFile)) {
    throw new Error(`Backup file not found: ${config.backupFile}`)
  }

  console.log(`Restoring from: ${config.backupFile}`)

  if (config.dryRun) {
    console.log(`[DRY RUN] Would restore to: ${config.targetDbPath}`)
    return
  }

  // Copy backup to target location
  copyFileSync(config.backupFile, config.targetDbPath)
  console.log(`✓ Database restored successfully`)

  // Verify restored database
  const isValid = verifyBackup(config.targetDbPath)
  if (!isValid) {
    console.error(`\n⚠️  WARNING: Restored database failed integrity check!`)
    process.exit(1)
  }
}

// Confirm restore action
async function confirmRestore(config: RestoreConfig): Promise<boolean> {
  if (config.force || config.dryRun) return true

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  This will replace your current database with the backup.\n` +
        (config.createPreRestoreBackup
          ? `   A pre-restore backup will be created first.\n`
          : `   WARNING: No pre-restore backup will be created!\n`) +
        `\n   Continue? (yes/no): `,
      (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      }
    )
  })
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

// Main restore process
async function main() {
  const config = parseArgs()

  console.log(`\n=== SQLite Restore Script ===\n`)

  if (config.dryRun) {
    console.log(`🔍 DRY RUN MODE - No changes will be made\n`)
  }

  // Handle --list flag
  if (config.listBackups) {
    listBackups(config)
    process.exit(0)
  }

  // Validate backup file
  if (!config.backupFile) {
    console.error(
      `Error: No backup file specified. Use --backup-file <PATH> or --list to see available backups.\n`
    )
    printHelp()
    process.exit(1)
  }

  try {
    // Verify backup integrity
    if (!config.dryRun) {
      const isValid = verifyBackup(config.backupFile)
      if (!isValid) {
        console.error(`\n✗ Backup verification failed - cannot restore corrupted backup`)
        process.exit(1)
      }
    }

    // Confirm restore
    const confirmed = await confirmRestore(config)
    if (!confirmed) {
      console.log(`\nRestore cancelled by user\n`)
      process.exit(0)
    }

    // Create pre-restore backup
    if (config.createPreRestoreBackup) {
      createPreRestoreBackup(config)
    }

    // Restore database
    restoreDatabase(config)

    console.log(`\n✓ Restore completed successfully\n`)
    console.log(`Database location: ${config.targetDbPath}\n`)
  } catch (error) {
    console.error(`\n✗ Restore failed:`, error)
    process.exit(1)
  }
}

main()
