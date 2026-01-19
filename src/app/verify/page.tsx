'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 30

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('verifyEmail')
    if (!storedEmail) {
      router.push('/')
      return
    }
    setEmail(storedEmail)
    inputRef.current?.focus()
  }, [router])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    setError('')

    if (digits.length === CODE_LENGTH) {
      handleSubmit(digits)
    }
  }

  const handleSubmit = async (submittedCode?: string) => {
    const codeToSubmit = submittedCode || code
    if (codeToSubmit.length !== CODE_LENGTH || isLoading) return

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/guest/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeToSubmit }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Provide actionable error messages
        if (data.expired) {
          setError('Code has expired. Redirecting to get a new code...')
          setTimeout(() => router.push('/'), 2000)
        } else if (response.status === 429) {
          setError('Too many incorrect attempts. Please request a new code.')
        } else if (response.status === 503) {
          setError(
            'Network service unavailable. Please contact the network administrator or try again later.'
          )
        } else {
          setError(data.error || 'Invalid verification code. Please check the code and try again.')
        }
        setCode('')
        setIsLoading(false)
        return
      }

      sessionStorage.setItem('authSuccess', JSON.stringify(data))
      sessionStorage.removeItem('verifyEmail')
      sessionStorage.removeItem('verifyName')
      sessionStorage.removeItem('verifyMac')
      router.push('/success')
    } catch (err) {
      console.error('Network error during verification:', err)
      setError('Unable to verify code. Please check your internet connection and try again.')
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (isResending || resendCooldown > 0) return

    setIsResending(true)
    setError('')

    try {
      const name = sessionStorage.getItem('verifyName') || 'Guest'
      const macAddress = sessionStorage.getItem('verifyMac') || ''
      const response = await fetch('/api/guest/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          macAddress,
          agreedToTerms: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Provide actionable error messages for resend
        if (response.status === 429) {
          setError('Too many resend attempts. Please wait before requesting another code.')
        } else {
          setError(
            data.error ||
              'Failed to resend code. Please go back and start over if the problem persists.'
          )
        }
      } else {
        setResendCooldown(RESEND_COOLDOWN)
        setCode('')
      }
    } catch (err) {
      console.error('Network error during resend:', err)
      setError('Unable to resend code. Please check your internet connection and try again.')
    } finally {
      setIsResending(false)
    }
  }

  const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : ''

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Enter verification code
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to
            <br />
            <span className="font-medium text-foreground">{maskedEmail}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              disabled={isLoading}
              className="h-16 text-center font-mono text-3xl tracking-[0.5em]"
              maxLength={CODE_LENGTH}
            />
          </div>

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            onClick={() => handleSubmit()}
            className="w-full"
            disabled={code.length !== CODE_LENGTH || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify code'
            )}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0 || isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              {isResending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Code expires in 10 minutes.
        <br />
        Check your spam folder if you don&apos;t see it.
      </p>
    </main>
  )
}
