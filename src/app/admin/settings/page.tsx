'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Loader2,
  Shield,
  Key,
  Lock,
  Download,
  RefreshCw,
  Check,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth-client'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants/validation'
import { SUCCESS_MESSAGE_DURATION_MS } from '@/lib/constants/ui'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // TOTP regeneration state
  const [showResetTOTPDialog, setShowResetTOTPDialog] = useState(false)
  const [resetTOTPPassword, setResetTOTPPassword] = useState('')
  const [isResettingTOTP, setIsResettingTOTP] = useState(false)
  const [totpError, setTotpError] = useState('')

  // Backup codes state
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false)
  const [backupCodesPassword, setBackupCodesPassword] = useState('')
  const [isGeneratingBackupCodes, setIsGeneratingBackupCodes] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([])
  const [backupCodesError, setBackupCodesError] = useState('')

  const checkAuth = useCallback(async () => {
    try {
      const session = await authClient.getSession()
      const user = session.data?.user as
        | {
            role?: string
            twoFactorEnabled?: boolean
            mustChangePassword?: boolean
            email?: string
          }
        | undefined

      if (!session.data?.user) {
        router.push('/admin/login')
        return
      }

      if (user?.role !== 'admin') {
        await authClient.signOut()
        router.push('/admin/login')
        return
      }

      if (user?.mustChangePassword) {
        router.push('/admin/change-password')
        return
      }

      if (!user?.twoFactorEnabled) {
        router.push('/admin/setup-2fa')
        return
      }

      setUserEmail(user?.email || '')
      setIsLoading(false)
    } catch {
      router.push('/admin/login')
    }
  }, [router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      })

      if (result.error) {
        setPasswordError(result.error.message || 'Failed to change password')
        setIsChangingPassword(false)
        return
      }

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsChangingPassword(false)

      // Clear success message after configured delay
      setTimeout(() => setPasswordSuccess(false), SUCCESS_MESSAGE_DURATION_MS)
    } catch {
      setPasswordError('Failed to change password. Please try again.')
      setIsChangingPassword(false)
    }
  }

  const handleResetTOTP = async () => {
    setTotpError('')

    if (!resetTOTPPassword) {
      setTotpError('Password is required')
      return
    }

    setIsResettingTOTP(true)

    try {
      // First disable 2FA
      const disableResult = await authClient.twoFactor.disable({
        password: resetTOTPPassword,
      })

      if (disableResult.error) {
        setTotpError(disableResult.error.message || 'Failed to disable 2FA')
        setIsResettingTOTP(false)
        return
      }

      // Close dialog and redirect to setup page
      setShowResetTOTPDialog(false)
      setResetTOTPPassword('')
      router.push('/admin/setup-2fa')
    } catch {
      setTotpError('Failed to reset 2FA. Please try again.')
      setIsResettingTOTP(false)
    }
  }

  const handleGenerateBackupCodes = async () => {
    setBackupCodesError('')

    if (!backupCodesPassword) {
      setBackupCodesError('Password is required')
      return
    }

    setIsGeneratingBackupCodes(true)

    try {
      const result = await authClient.twoFactor.generateBackupCodes({
        password: backupCodesPassword,
      })

      if (result.error) {
        setBackupCodesError(result.error.message || 'Failed to generate backup codes')
        setIsGeneratingBackupCodes(false)
        return
      }

      if (result.data?.backupCodes) {
        setNewBackupCodes(result.data.backupCodes)
      }
      setBackupCodesPassword('')
      setIsGeneratingBackupCodes(false)
    } catch {
      setBackupCodesError('Failed to generate backup codes. Please try again.')
      setIsGeneratingBackupCodes(false)
    }
  }

  const handleDownloadBackupCodes = () => {
    const timestamp = new Date().toISOString()
    const content = `World Wide Webb - Backup Codes
================================
Generated: ${timestamp}

Keep these codes safe. Each code can only be used once.
These codes replace any previously generated backup codes.

${newBackupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

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

  const closeBackupCodesDialog = () => {
    setShowBackupCodesDialog(false)
    setBackupCodesPassword('')
    setNewBackupCodes([])
    setBackupCodesError('')
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading settings...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your admin account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword}
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                <Check className="h-4 w-4" />
                Password changed successfully
              </div>
            )}

            <Button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword || isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>Manage your TOTP authenticator and backup codes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">2FA Enabled</p>
                  <p className="text-sm text-muted-foreground">
                    Your account is protected with TOTP
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setShowResetTOTPDialog(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Authenticator
              </Button>
              <Button variant="outline" onClick={() => setShowBackupCodesDialog(true)}>
                <Key className="mr-2 h-4 w-4" />
                Generate New Backup Codes
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Resetting your authenticator will require you to scan a new QR code. Your existing
              backup codes will be invalidated when you generate new ones.
            </p>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium">Administrator</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2FA Status</span>
                <span className="font-medium text-green-500">Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset TOTP Dialog */}
      <Dialog open={showResetTOTPDialog} onOpenChange={setShowResetTOTPDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Reset Authenticator
            </DialogTitle>
            <DialogDescription>
              This will disable your current 2FA setup. You&apos;ll need to scan a new QR code to
              re-enable it. Enter your password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetTOTPPassword}
                onChange={(e) => setResetTOTPPassword(e.target.value)}
                disabled={isResettingTOTP}
                placeholder="Enter your password"
              />
            </div>
            {totpError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {totpError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetTOTPDialog(false)
                setResetTOTPPassword('')
                setTotpError('')
              }}
              disabled={isResettingTOTP}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetTOTP}
              disabled={!resetTOTPPassword || isResettingTOTP}
            >
              {isResettingTOTP ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset 2FA'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodesDialog} onOpenChange={closeBackupCodesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {newBackupCodes.length > 0 ? 'New Backup Codes' : 'Generate Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {newBackupCodes.length > 0
                ? 'Save these codes in a secure location. They replace your previous codes.'
                : 'This will generate new backup codes and invalidate any existing ones.'}
            </DialogDescription>
          </DialogHeader>

          {newBackupCodes.length > 0 ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {newBackupCodes.map((code, i) => (
                    <div key={i} className="rounded bg-background px-2 py-1 text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Each code can only be used once.
              </p>
              <Button variant="outline" className="w-full" onClick={handleDownloadBackupCodes}>
                <Download className="mr-2 h-4 w-4" />
                Download Backup Codes
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="backup-password">Password</Label>
                <Input
                  id="backup-password"
                  type="password"
                  value={backupCodesPassword}
                  onChange={(e) => setBackupCodesPassword(e.target.value)}
                  disabled={isGeneratingBackupCodes}
                  placeholder="Enter your password"
                />
              </div>
              {backupCodesError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {backupCodesError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {newBackupCodes.length > 0 ? (
              <Button onClick={closeBackupCodesDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeBackupCodesDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateBackupCodes}
                  disabled={!backupCodesPassword || isGeneratingBackupCodes}
                >
                  {isGeneratingBackupCodes ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Codes'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
