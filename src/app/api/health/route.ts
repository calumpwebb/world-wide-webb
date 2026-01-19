import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { UNIFI_HEALTH_CHECK_TIMEOUT_MS, MAILPIT_HEALTH_CHECK_TIMEOUT_MS } from '@/lib/constants'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: CheckResult
    unifi: CheckResult
    email: CheckResult
  }
  version: string
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn'
  message?: string
  latencyMs?: number
}

// Check database connectivity
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    // Simple query to check database connectivity
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .get()
    const latencyMs = Date.now() - start

    if (result === undefined) {
      return { status: 'fail', message: 'Query returned undefined', latencyMs }
    }

    return { status: 'pass', latencyMs }
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown database error',
      latencyMs: Date.now() - start,
    }
  }
}

// Check Unifi Controller connectivity
async function checkUnifi(): Promise<CheckResult> {
  const controllerUrl = process.env.UNIFI_CONTROLLER_URL

  if (!controllerUrl) {
    return { status: 'warn', message: 'Unifi controller URL not configured' }
  }

  const start = Date.now()
  try {
    // Just check if the controller is reachable (don't fully authenticate)
    const response = await fetch(controllerUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(UNIFI_HEALTH_CHECK_TIMEOUT_MS),
      // Skip SSL verification for self-signed certs
      // @ts-expect-error - Node.js specific fetch option
      rejectUnauthorized: process.env.UNIFI_SKIP_SSL_VERIFY !== 'true',
    })

    const latencyMs = Date.now() - start

    // Unifi returns various status codes, but if we got any response it's reachable
    if (response.ok || response.status < 500) {
      return { status: 'pass', latencyMs }
    }

    return { status: 'warn', message: `Unifi returned status ${response.status}`, latencyMs }
  } catch (error) {
    const latencyMs = Date.now() - start

    // Self-signed cert errors are expected if not configured to skip
    if (error instanceof Error && error.message.includes('self-signed')) {
      return { status: 'warn', message: 'Self-signed certificate (expected)', latencyMs }
    }

    // Timeout or connection refused
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.message.includes('ECONNREFUSED'))
    ) {
      return { status: 'fail', message: 'Unifi controller unreachable', latencyMs }
    }

    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    }
  }
}

// Check email service configuration
async function checkEmail(): Promise<CheckResult> {
  const provider = process.env.EMAIL_PROVIDER || 'mailpit'

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { status: 'fail', message: 'Resend API key not configured' }
    }
    // For Resend, just check if the API key is set (don't make API call to avoid rate limits)
    return { status: 'pass', message: 'Resend configured' }
  }

  // For Mailpit, check SMTP connectivity
  const smtpHost = process.env.SMTP_HOST || 'localhost'
  const smtpPort = parseInt(process.env.SMTP_PORT || '1025')

  const start = Date.now()
  try {
    // Quick TCP check to SMTP port
    const response = await fetch(`http://${smtpHost}:8025/api/v1/info`, {
      method: 'GET',
      signal: AbortSignal.timeout(MAILPIT_HEALTH_CHECK_TIMEOUT_MS),
    }).catch(() => null)

    const latencyMs = Date.now() - start

    if (response?.ok) {
      return { status: 'pass', message: 'Mailpit reachable', latencyMs }
    }

    // Mailpit might not have the API endpoint, but SMTP should still work
    return {
      status: 'warn',
      message: `Mailpit at ${smtpHost}:${smtpPort} (API unavailable)`,
      latencyMs,
    }
  } catch {
    return {
      status: 'warn',
      message: `Mailpit at ${smtpHost}:${smtpPort} (connection status unknown)`,
      latencyMs: Date.now() - start,
    }
  }
}

export async function GET() {
  try {
    // Run all health checks in parallel
    const [database, unifi, email] = await Promise.all([
      checkDatabase(),
      checkUnifi(),
      checkEmail(),
    ])

    // Determine overall status
    const checks = { database, unifi, email }
    const statuses = Object.values(checks).map((c) => c.status)

    let status: HealthCheck['status'] = 'healthy'
    if (statuses.some((s) => s === 'fail')) {
      status = 'unhealthy'
    } else if (statuses.some((s) => s === 'warn')) {
      status = 'degraded'
    }

    const health: HealthCheck = {
      status,
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || '0.1.0',
    }

    // Return appropriate HTTP status
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503

    return NextResponse.json(health, { status: httpStatus })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
