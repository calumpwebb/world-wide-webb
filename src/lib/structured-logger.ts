/**
 * Structured Logger for World Wide Webb
 *
 * A simple structured logging system that replaces console.log/error with
 * structured JSON logs for better observability in production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    name?: string
  }
}

class StructuredLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Human-readable format for development
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
      const errorStr = entry.error ? ` [${entry.error.name}: ${entry.error.message}]` : ''
      return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}`
    } else {
      // JSON format for production (parseable by log aggregators)
      return JSON.stringify(entry)
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    const formatted = this.formatLog(entry)

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    const errorObj = error instanceof Error ? error : undefined
    const errorContext = error && !(error instanceof Error) ? { error } : undefined
    this.log('error', message, { ...context, ...errorContext }, errorObj)
  }
}

export const structuredLogger = new StructuredLogger()
