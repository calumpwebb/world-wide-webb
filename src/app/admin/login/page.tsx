'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, Loader2, Eye, EyeOff, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof formSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requiresTOTP, setRequiresTOTP] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      })

      if (result.error) {
        // Check if TOTP is required
        if (
          result.error.message?.includes('two-factor') ||
          result.error.code === 'TWO_FACTOR_REQUIRED'
        ) {
          setRequiresTOTP(true)
          setIsLoading(false)
          return
        }
        setError(result.error.message || 'Invalid email or password')
        setIsLoading(false)
        return
      }

      // Check if user is admin - role is stored as additional field
      const session = await authClient.getSession()
      const user = session.data?.user as { role?: string; twoFactorEnabled?: boolean } | undefined
      if (user?.role !== 'admin') {
        await authClient.signOut()
        setError('Access denied. Admin privileges required.')
        setIsLoading(false)
        return
      }

      // Check if 2FA is set up (redirect to setup if not)
      if (!user?.twoFactorEnabled) {
        router.push('/admin/setup-2fa')
        return
      }

      router.push('/admin')
    } catch {
      setError('Login failed. Please try again.')
      setIsLoading(false)
    }
  }

  const handleTOTPSubmit = async () => {
    if (totpCode.length !== 6) return

    setIsLoading(true)
    setError('')

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      })

      if (result.error) {
        setError(result.error.message || 'Invalid verification code')
        setTotpCode('')
        setIsLoading(false)
        return
      }

      router.push('/admin')
    } catch {
      setError('Verification failed. Please try again.')
      setTotpCode('')
      setIsLoading(false)
    }
  }

  const handleBackupCodeSubmit = async () => {
    if (backupCode.length < 8) return

    setIsLoading(true)
    setError('')

    try {
      const result = await authClient.twoFactor.verifyBackupCode({
        code: backupCode,
      })

      if (result.error) {
        setError(result.error.message || 'Invalid backup code')
        setBackupCode('')
        setIsLoading(false)
        return
      }

      router.push('/admin')
    } catch {
      setError('Verification failed. Please try again.')
      setBackupCode('')
      setIsLoading(false)
    }
  }

  if (requiresTOTP) {
    // Backup code mode
    if (useBackupCode) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md border-border bg-card">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Key className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold">Recovery Code</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter one of your backup codes to sign in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup">Backup Code</Label>
                <Input
                  id="backup"
                  type="text"
                  placeholder="Enter backup code"
                  value={backupCode}
                  onChange={(e) => {
                    setBackupCode(e.target.value.trim())
                  }}
                  disabled={isLoading}
                  className="h-14 text-center font-mono text-lg"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                onClick={handleBackupCodeSubmit}
                className="w-full"
                disabled={backupCode.length < 8 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Backup Code'
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setUseBackupCode(false)
                  setBackupCode('')
                  setError('')
                }}
              >
                Use authenticator app instead
              </Button>
            </CardContent>
          </Card>
        </main>
      )
    }

    // TOTP mode (default)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp">Verification Code</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setTotpCode(value)
                  if (value.length === 6) {
                    handleTOTPSubmit()
                  }
                }}
                disabled={isLoading}
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={handleTOTPSubmit}
              className="w-full"
              disabled={totpCode.length !== 6 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setUseBackupCode(true)
                setTotpCode('')
                setError('')
              }}
            >
              <Key className="mr-2 h-4 w-4" />
              Lost your device? Use backup code
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setRequiresTOTP(false)
                setTotpCode('')
                setError('')
              }}
            >
              Back to login
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
          <CardTitle className="text-2xl font-semibold">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to manage the guest WiFi network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                disabled={isLoading}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">World Wide Webb Admin Panel</p>
    </main>
  )
}
