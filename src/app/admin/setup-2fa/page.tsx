'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

export default function SetupTOTPPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  useEffect(() => {
    const initTOTP = async () => {
      try {
        // Check if user is logged in
        const session = await authClient.getSession()
        if (!session.data?.user) {
          router.push('/admin/login')
          return
        }

        // Check if already has 2FA enabled
        const user = session.data.user as { twoFactorEnabled?: boolean }
        if (user.twoFactorEnabled) {
          router.push('/admin')
          return
        }

        // Enable 2FA to get the TOTP URI
        const result = await authClient.twoFactor.enable({
          password: '', // Password already verified during login
        })

        if (result.error) {
          setError(result.error.message || 'Failed to initialize 2FA setup')
          setIsLoading(false)
          return
        }

        // Extract TOTP URI and secret from result
        if (result.data?.totpURI) {
          setTotpUri(result.data.totpURI)
          // Extract secret from URI
          const secretMatch = result.data.totpURI.match(/secret=([A-Z2-7]+)/)
          if (secretMatch) {
            setTotpSecret(secretMatch[1])
          }
        }

        if (result.data?.backupCodes) {
          setBackupCodes(result.data.backupCodes)
        }

        setIsLoading(false)
      } catch (err) {
        console.error('TOTP init error:', err)
        setError('Failed to initialize 2FA setup')
        setIsLoading(false)
      }
    }

    initTOTP()
  }, [router])

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(totpSecret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = totpSecret
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleVerify = async () => {
    if (verificationCode.length !== 6) return

    setIsVerifying(true)
    setError('')

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
      })

      if (result.error) {
        setError(result.error.message || 'Invalid verification code')
        setVerificationCode('')
        setIsVerifying(false)
        return
      }

      // Show backup codes before redirecting
      if (backupCodes.length > 0) {
        setShowBackupCodes(true)
      } else {
        router.push('/admin')
      }
    } catch {
      setError('Verification failed. Please try again.')
      setVerificationCode('')
      setIsVerifying(false)
    }
  }

  const handleDownloadBackupCodes = () => {
    const timestamp = new Date().toISOString()
    const content = `World Wide Webb - Backup Codes
================================
Generated: ${timestamp}

Keep these codes safe. Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

================================
Store these codes in a secure location.
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'world-wide-webb-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleContinue = () => {
    router.push('/admin')
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Setting up two-factor authentication...
        </div>
      </main>
    )
  }

  if (showBackupCodes) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-semibold">2FA Enabled!</CardTitle>
            <CardDescription className="text-muted-foreground">
              Save your backup codes in a secure location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <div key={i} className="rounded bg-background px-2 py-1 text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Each code can only be used once. Store them securely.
            </p>

            <Button variant="outline" className="w-full" onClick={handleDownloadBackupCodes}>
              <Download className="mr-2 h-4 w-4" />
              Download Backup Codes
            </Button>

            <Button className="w-full" onClick={handleContinue}>
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">Set Up 2FA</CardTitle>
          <CardDescription className="text-muted-foreground">
            Scan the QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          {totpUri && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`}
                  alt="TOTP QR Code"
                  width={200}
                  height={200}
                  className="rounded"
                />
              </div>
            </div>
          )}

          {/* Manual Entry */}
          {totpSecret && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Or enter this code manually:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm">
                  {totpSecret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Verification */}
          <div className="space-y-2">
            <Label htmlFor="code">Enter the 6-digit code from your app</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setVerificationCode(value)
              }}
              disabled={isVerifying}
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={verificationCode.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Enable 2FA'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Use Google Authenticator, Authy, or any TOTP app
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
