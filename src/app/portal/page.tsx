'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wifi,
  Clock,
  Laptop,
  Smartphone,
  Router,
  Shield,
  Activity,
  Loader2,
  RefreshCw,
  LogOut,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

interface Device {
  id: number
  macAddress: string
  ipAddress?: string
  nickname?: string
  deviceInfo?: string
  authorizedAt: string
  expiresAt: string
  lastSeen?: string
  authCount: number
  isOnline: boolean
  isExpired: boolean
  signalStrength?: number
}

interface DeviceStats {
  total: number
  active: number
  online: number
  expired: number
}

function formatTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt)
  const now = new Date()
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h remaining`
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDeviceIcon(deviceInfo?: string, nickname?: string) {
  const info = (deviceInfo || nickname || '').toLowerCase()
  if (info.includes('iphone') || info.includes('android') || info.includes('phone')) {
    return <Smartphone className="h-5 w-5" />
  }
  if (info.includes('router') || info.includes('gateway')) {
    return <Router className="h-5 w-5" />
  }
  return <Laptop className="h-5 w-5" />
}

function getSignalColor(strength?: number): string {
  if (strength === undefined) return 'text-muted-foreground'
  if (strength >= -50) return 'text-green-500'
  if (strength >= -70) return 'text-yellow-500'
  return 'text-red-500'
}

function PortalDashboardContent() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [stats, setStats] = useState<DeviceStats>({ total: 0, active: 0, online: 0, expired: 0 })

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/devices')
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices)
        setStats(data.stats)
      } else if (response.status === 401) {
        router.push('/')
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error)
      toast.error('Failed to fetch devices')
    }
  }, [router])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession()

        if (!session.data?.user) {
          router.push('/')
          return
        }

        setUser({
          name: session.data.user.name || undefined,
          email: session.data.user.email || undefined,
        })

        await fetchDevices()
        setIsLoading(false)
      } catch {
        router.push('/')
      }
    }

    checkAuth()
  }, [router, fetchDevices])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (isLoading) return

    const interval = setInterval(() => {
      fetchDevices()
    }, 30000)

    return () => clearInterval(interval)
  }, [isLoading, fetchDevices])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchDevices()
    setIsRefreshing(false)
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      router.push('/')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your devices...
        </div>
      </main>
    )
  }

  // Find the primary active device (most recently authorized, not expired)
  const activeDevices = devices.filter((d) => !d.isExpired)
  const primaryDevice = activeDevices.length > 0 ? activeDevices[0] : null

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Welcome{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Connection Status Card */}
        {primaryDevice ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-green-500">
                    <Wifi className="h-5 w-5" />
                    Connected to Guest Network
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {formatTimeRemaining(primaryDevice.expiresAt)}
                  </p>
                </div>
                {primaryDevice.isOnline && (
                  <div className="text-right">
                    <p className="text-sm text-green-500">Online</p>
                    {primaryDevice.signalStrength && (
                      <p className={`text-xs ${getSignalColor(primaryDevice.signalStrength)}`}>
                        {primaryDevice.signalStrength} dBm
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <div>
                <h2 className="font-semibold text-yellow-500">No Active Authorization</h2>
                <p className="text-sm text-muted-foreground">
                  Your network access has expired. Please re-authenticate to continue.
                </p>
              </div>
              <Button onClick={() => router.push('/')} className="ml-auto">
                Re-authenticate
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">With valid authorization</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Now</CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.online}</div>
              <p className="text-xs text-muted-foreground">Currently connected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Laptop className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Devices List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Devices</CardTitle>
                <CardDescription>
                  Devices you&apos;ve connected to the guest network
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/portal/devices')}>
                Manage
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No devices found</p>
            ) : (
              <div className="space-y-3">
                {devices.slice(0, 5).map((device) => (
                  <div
                    key={device.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      device.isExpired
                        ? 'border-border bg-muted/30 opacity-60'
                        : device.isOnline
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-muted-foreground">
                        {getDeviceIcon(device.deviceInfo, device.nickname)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {device.nickname || device.macAddress}
                          {device.isOnline && (
                            <span className="ml-2 inline-flex items-center text-xs text-green-500">
                              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                              Online
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {device.macAddress}
                          {device.ipAddress && ` • ${device.ipAddress}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {device.isExpired ? (
                        <p className="text-sm text-muted-foreground">Expired</p>
                      ) : (
                        <>
                          <p className="text-sm">{formatTimeRemaining(device.expiresAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {formatDate(device.expiresAt)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {devices.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push('/portal/devices')}
                  >
                    View all {devices.length} devices
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Need help?</p>
                <p>
                  Your access is valid for 7 days. To renew, simply return to the login page and
                  verify your email again. Each device can be authorized separately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function PortalDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </main>
      }
    >
      <PortalDashboardContent />
    </Suspense>
  )
}
