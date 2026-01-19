'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Wifi } from 'lucide-react'
import { UI_AUTO_CLOSE_DELAY_MS } from '@/lib/constants/ui'

const AUTO_CLOSE_DELAY = UI_AUTO_CLOSE_DELAY_MS

interface AuthData {
  success: boolean
  expiresAt: string
  user: {
    name: string
    email: string
  }
}

export default function SuccessPage() {
  const router = useRouter()
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [countdown, setCountdown] = useState(AUTO_CLOSE_DELAY / 1000)

  useEffect(() => {
    const stored = sessionStorage.getItem('authSuccess')
    if (!stored) {
      router.push('/')
      return
    }

    try {
      const data = JSON.parse(stored) as AuthData
      setAuthData(data)
      sessionStorage.removeItem('authSuccess')
    } catch {
      router.push('/')
    }
  }, [router])

  useEffect(() => {
    if (!authData) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Attempt to close the window (for captive portal)
          window.close()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [authData])

  const formatExpiry = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return `${days} days`
  }

  if (!authData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            You&apos;re connected!
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Welcome to World Wide Webb, {authData.user.name}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Guest WiFi Active</p>
                <p className="text-sm text-muted-foreground">
                  Access expires in {formatExpiry(authData.expiresAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-center text-sm text-muted-foreground">
            <p>
              This window will close automatically in {countdown}{' '}
              {countdown === 1 ? 'second' : 'seconds'}...
            </p>
            <p>You can now browse the internet freely.</p>
          </div>

          <Button variant="outline" className="w-full" onClick={() => window.close()}>
            Close this window
          </Button>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Need help? Contact the network administrator.
      </p>
    </main>
  )
}
