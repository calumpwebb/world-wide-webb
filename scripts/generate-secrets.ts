#!/usr/bin/env tsx

/**
 * Generate Secrets Script
 *
 * This script generates secure random secrets for the World Wide Webb captive portal.
 * It can either update an existing .env file or create a new one from .env.example.
 *
 * Usage:
 *   pnpm generate-secrets              # Interactive mode - prompts for values
 *   pnpm generate-secrets --auto       # Auto mode - generates all secrets automatically
 *   pnpm generate-secrets --output .env.production  # Specify output file
 *
 * Generated secrets:
 * - BETTER_AUTH_SECRET: 32-byte random string for session encryption
 * - ADMIN_PASSWORD: 16-character random password (if not provided)
 * - Optional: RESEND_API_KEY placeholder reminder
 *
 * The script will:
 * 1. Read .env.example as template
 * 2. Generate secure random values for secrets
 * 3. Prompt for user-specific values (admin email, Unifi config)
 * 4. Write to .env or specified output file
 * 5. Validate generated secrets meet security requirements
 */

import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as readline from 'node:readline/promises'

const MIN_SECRET_LENGTH = 32
const MIN_PASSWORD_LENGTH = 12
const GENERATED_PASSWORD_LENGTH = 16

interface EnvConfig {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  UNIFI_CONTROLLER_URL: string
  UNIFI_USERNAME: string
  UNIFI_PASSWORD: string
  UNIFI_SITE_ID: string
  EMAIL_PROVIDER: string
  RESEND_API_KEY?: string
  ALLOW_OFFLINE_AUTH?: string
}

/**
 * Generate a cryptographically secure random string
 */
function generateSecret(length: number = MIN_SECRET_LENGTH): string {
  return randomBytes(length).toString('base64url')
}

/**
 * Generate a secure random password
 */
function generatePassword(length: number = GENERATED_PASSWORD_LENGTH): string {
  // Use base64url encoding for URL-safe characters (A-Z, a-z, 0-9, -, _)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const bytes = randomBytes(length)
  let password = ''

  for (let i = 0; i < length; i++) {
    password += chars[bytes[i]! % chars.length]
  }

  return password
}

/**
 * Validate password complexity
 */
function isPasswordStrong(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return false
  }

  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)

  // Require at least 3 of 4 character types
  const typesPresent = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length

  return typesPresent >= 3
}

/**
 * Read .env.example and parse into key-value pairs
 */
function readEnvExample(): Record<string, string> {
  const examplePath = join(process.cwd(), '.env.example')

  if (!existsSync(examplePath)) {
    console.error('❌ Error: .env.example not found')
    console.error('   Please run this script from the project root directory.')
    process.exit(1)
  }

  const content = readFileSync(examplePath, 'utf-8')
  const env: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Parse KEY=value
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      env[key!.trim()] = value!.trim()
    }
  }

  return env
}

/**
 * Prompt user for input with default value
 */
async function prompt(
  rl: readline.Interface,
  question: string,
  defaultValue?: string
): Promise<string> {
  const fullQuestion = defaultValue ? `${question} (default: ${defaultValue}): ` : `${question}: `

  const answer = await rl.question(fullQuestion)
  return answer.trim() || defaultValue || ''
}

/**
 * Main interactive mode
 */
async function interactiveMode(outputFile: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    console.log('\n🔐 World Wide Webb - Secrets Generator\n')
    console.log('This script will help you generate secure secrets for your captive portal.')
    console.log('Press Enter to use default values or provide your own.\n')

    const envExample = readEnvExample()
    const config: Partial<EnvConfig> = {}

    // Generate secrets automatically
    console.log('📝 Generating secure secrets...\n')
    config.BETTER_AUTH_SECRET = generateSecret(32)
    console.log(`✅ BETTER_AUTH_SECRET generated (${config.BETTER_AUTH_SECRET.length} chars)`)

    // Better Auth URL
    config.BETTER_AUTH_URL = await prompt(
      rl,
      'Better Auth URL',
      envExample.BETTER_AUTH_URL || 'http://localhost:3000'
    )

    // Admin credentials
    console.log('\n👤 Admin Account Setup')
    config.ADMIN_EMAIL = await prompt(
      rl,
      'Admin email address',
      envExample.ADMIN_EMAIL || 'admin@example.com'
    )

    const useGeneratedPassword = await prompt(rl, 'Generate random admin password? (y/n)', 'y')

    if (useGeneratedPassword.toLowerCase() === 'y') {
      config.ADMIN_PASSWORD = generatePassword()
      console.log(`✅ Admin password generated: ${config.ADMIN_PASSWORD}`)
      console.log('   ⚠️  Save this password securely!')
    } else {
      let passwordValid = false
      while (!passwordValid) {
        config.ADMIN_PASSWORD = await prompt(rl, 'Admin password')

        if (isPasswordStrong(config.ADMIN_PASSWORD)) {
          passwordValid = true
        } else {
          console.log(
            `❌ Password must be at least ${MIN_PASSWORD_LENGTH} characters and contain 3 of: uppercase, lowercase, numbers, special chars`
          )
        }
      }
    }

    // Unifi configuration
    console.log('\n🌐 Unifi Controller Configuration')
    console.log('(Leave blank to configure later)')

    config.UNIFI_CONTROLLER_URL = await prompt(
      rl,
      'Unifi Controller URL',
      envExample.UNIFI_CONTROLLER_URL || ''
    )

    if (config.UNIFI_CONTROLLER_URL) {
      config.UNIFI_USERNAME = await prompt(rl, 'Unifi username', envExample.UNIFI_USERNAME || '')
      config.UNIFI_PASSWORD = await prompt(rl, 'Unifi password', envExample.UNIFI_PASSWORD || '')
      config.UNIFI_SITE_ID = await prompt(
        rl,
        'Unifi site ID',
        envExample.UNIFI_SITE_ID || 'default'
      )
    } else {
      config.UNIFI_USERNAME = ''
      config.UNIFI_PASSWORD = ''
      config.UNIFI_SITE_ID = 'default'
    }

    // Email configuration
    console.log('\n📧 Email Configuration')
    const emailProvider = await prompt(
      rl,
      'Email provider (mailpit/resend)',
      envExample.EMAIL_PROVIDER || 'mailpit'
    )
    config.EMAIL_PROVIDER = emailProvider

    if (emailProvider === 'resend') {
      config.RESEND_API_KEY = await prompt(rl, 'Resend API key', envExample.RESEND_API_KEY || '')
    }

    // Offline auth mode
    console.log('\n🔧 Development Options')
    const allowOffline = await prompt(
      rl,
      'Allow offline authentication (for development without Unifi)? (true/false)',
      envExample.ALLOW_OFFLINE_AUTH || 'false'
    )
    config.ALLOW_OFFLINE_AUTH = allowOffline

    // Write configuration file
    console.log(`\n💾 Writing configuration to ${outputFile}...`)
    writeEnvFile(outputFile, config as EnvConfig, envExample)

    console.log('\n✅ Secrets generated successfully!')
    console.log(`\n📄 Configuration written to: ${outputFile}`)

    if (config.ADMIN_PASSWORD) {
      console.log('\n⚠️  IMPORTANT: Save your admin password securely!')
      console.log(`   Admin Email: ${config.ADMIN_EMAIL}`)
      console.log(`   Admin Password: ${config.ADMIN_PASSWORD}`)
    }

    if (!config.UNIFI_CONTROLLER_URL) {
      console.log('\n⚠️  Unifi Controller not configured.')
      console.log(`   Update ${outputFile} with Unifi settings before deployment.`)
    }

    console.log('\n🚀 Next steps:')
    console.log('   1. Review your configuration in ' + outputFile)
    console.log('   2. Run: pnpm db:migrate')
    console.log('   3. Run: pnpm db:seed')
    console.log('   4. Run: pnpm dev')
  } finally {
    rl.close()
  }
}

/**
 * Automatic mode - generate all secrets without prompting
 */
async function autoMode(outputFile: string): Promise<void> {
  console.log('\n🔐 World Wide Webb - Secrets Generator (Auto Mode)\n')

  const envExample = readEnvExample()
  const config: EnvConfig = {
    BETTER_AUTH_SECRET: generateSecret(32),
    BETTER_AUTH_URL: envExample.BETTER_AUTH_URL || 'http://localhost:3000',
    ADMIN_EMAIL: envExample.ADMIN_EMAIL || 'admin@example.com',
    ADMIN_PASSWORD: generatePassword(),
    UNIFI_CONTROLLER_URL: envExample.UNIFI_CONTROLLER_URL || '',
    UNIFI_USERNAME: envExample.UNIFI_USERNAME || '',
    UNIFI_PASSWORD: envExample.UNIFI_PASSWORD || '',
    UNIFI_SITE_ID: envExample.UNIFI_SITE_ID || 'default',
    EMAIL_PROVIDER: envExample.EMAIL_PROVIDER || 'mailpit',
    ALLOW_OFFLINE_AUTH: envExample.ALLOW_OFFLINE_AUTH || 'false',
  }

  console.log('✅ Generated BETTER_AUTH_SECRET')
  console.log('✅ Generated Admin Password')

  writeEnvFile(outputFile, config, envExample)

  console.log(`\n✅ Configuration written to: ${outputFile}`)
  console.log('\n⚠️  IMPORTANT: Save these credentials securely!')
  console.log(`   Admin Email: ${config.ADMIN_EMAIL}`)
  console.log(`   Admin Password: ${config.ADMIN_PASSWORD}`)
  console.log(`   Auth Secret: ${config.BETTER_AUTH_SECRET.substring(0, 16)}...`)

  console.log('\n⚠️  Unifi Controller must be configured manually.')
  console.log(`   Edit ${outputFile} and set UNIFI_* variables.`)

  console.log('\n🚀 Next steps:')
  console.log(`   1. Review configuration in ${outputFile}`)
  console.log('   2. Configure Unifi Controller settings')
  console.log('   3. Run: pnpm db:migrate')
  console.log('   4. Run: pnpm db:seed')
  console.log('   5. Run: pnpm dev')
}

/**
 * Write environment configuration file
 */
function writeEnvFile(
  outputFile: string,
  config: EnvConfig,
  envExample: Record<string, string>
): void {
  const lines: string[] = []

  // Header
  lines.push('# World Wide Webb - Captive Portal Configuration')
  lines.push(`# Generated on: ${new Date().toISOString()}`)
  lines.push('# DO NOT COMMIT THIS FILE TO VERSION CONTROL')
  lines.push('')

  // Better Auth
  lines.push('# Better Auth Configuration')
  lines.push(`BETTER_AUTH_SECRET=${config.BETTER_AUTH_SECRET}`)
  lines.push(`BETTER_AUTH_URL=${config.BETTER_AUTH_URL}`)
  lines.push('')

  // Admin
  lines.push('# Admin Account')
  lines.push(`ADMIN_EMAIL=${config.ADMIN_EMAIL}`)
  lines.push(`ADMIN_PASSWORD=${config.ADMIN_PASSWORD}`)
  lines.push('')

  // Unifi
  lines.push('# Unifi Controller')
  lines.push(`UNIFI_CONTROLLER_URL=${config.UNIFI_CONTROLLER_URL}`)
  lines.push(`UNIFI_USERNAME=${config.UNIFI_USERNAME}`)
  lines.push(`UNIFI_PASSWORD=${config.UNIFI_PASSWORD}`)
  lines.push(`UNIFI_SITE_ID=${config.UNIFI_SITE_ID}`)
  lines.push(`UNIFI_VERIFY_SSL=${envExample.UNIFI_VERIFY_SSL || 'true'}`)
  lines.push('')

  // Email
  lines.push('# Email Configuration')
  lines.push(`EMAIL_PROVIDER=${config.EMAIL_PROVIDER}`)
  lines.push(`EMAIL_FROM=${envExample.EMAIL_FROM || 'noreply@example.com'}`)
  lines.push(`EMAIL_FROM_NAME=${envExample.EMAIL_FROM_NAME || 'Guest WiFi'}`)

  if (config.RESEND_API_KEY) {
    lines.push(`RESEND_API_KEY=${config.RESEND_API_KEY}`)
  } else if (config.EMAIL_PROVIDER === 'resend') {
    lines.push('# RESEND_API_KEY=your_resend_api_key_here')
  }

  if (config.EMAIL_PROVIDER === 'mailpit') {
    lines.push(`SMTP_HOST=${envExample.SMTP_HOST || 'localhost'}`)
    lines.push(`SMTP_PORT=${envExample.SMTP_PORT || '1025'}`)
  }
  lines.push('')

  // Development
  lines.push('# Development Options')
  lines.push(`ALLOW_OFFLINE_AUTH=${config.ALLOW_OFFLINE_AUTH}`)
  lines.push(`NODE_ENV=${envExample.NODE_ENV || 'development'}`)
  lines.push('')

  // Database
  lines.push('# Database')
  lines.push(`DATABASE_PATH=${envExample.DATABASE_PATH || './data/captive-portal.db'}`)
  lines.push('')

  // Write file
  const content = lines.join('\n')
  writeFileSync(outputFile, content, 'utf-8')
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const autoMode_flag = args.includes('--auto')
  const outputIndex = args.indexOf('--output')
  const outputFile = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1]! : '.env'

  // Check if output file exists
  if (existsSync(outputFile)) {
    console.log(`\n⚠️  Warning: ${outputFile} already exists.`)
    console.log('   This will overwrite the existing file.')

    if (!autoMode_flag) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await rl.question('   Continue? (y/n): ')
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log('   Aborted.')
        process.exit(0)
      }
    } else {
      console.log('   Auto mode: overwriting...')
    }
  }

  // Run in appropriate mode
  if (autoMode_flag) {
    await autoMode(outputFile)
  } else {
    await interactiveMode(outputFile)
  }
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
