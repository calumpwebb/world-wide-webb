'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wifi,
  WifiOff,
  Laptop,
  Smartphone,
  Router,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Pencil,
  Check,
  X,
  Clock,
  Calendar,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function formatTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt)
  const now = new Date()
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h`
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDeviceIcon(deviceInfo?: string, nickname?: string) {
  const info = (deviceInfo || nickname || '').toLowerCase()
  if (info.includes('iphone') || info.includes('android') || info.includes('phone')) {
    return <Smartphone className="h-6 w-6" />
  }
  if (info.includes('router') || info.includes('gateway')) {
    return <Router className="h-6 w-6" />
  }
  return <Laptop className="h-6 w-6" />
}

function getSignalBars(strength?: number): number {
  if (strength === undefined) return 0
  if (strength >= -50) return 4
  if (strength >= -60) return 3
  if (strength >= -70) return 2
  return 1
}

function DeviceManagementContent() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [editingDevice, setEditingDevice] = useState<number | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/devices')
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices)
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

        await fetchDevices()
        setIsLoading(false)
      } catch {
        router.push('/')
      }
    }

    checkAuth()
  }, [router, fetchDevices])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchDevices()
    setIsRefreshing(false)
    toast.success('Devices refreshed')
  }

  const startEditing = (device: Device) => {
    setEditingDevice(device.id)
    setEditNickname(device.nickname || '')
  }

  const cancelEditing = () => {
    setEditingDevice(null)
    setEditNickname('')
  }

  const saveNickname = async (deviceId: number) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/portal/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: editNickname.trim() || null }),
      })

      if (response.ok) {
        toast.success('Device name updated')
        setEditingDevice(null)
        await fetchDevices()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update device')
      }
    } catch {
      toast.error('Failed to update device')
    } finally {
      setIsSaving(false)
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

  const activeDevices = devices.filter((d) => !d.isExpired)
  const expiredDevices = devices.filter((d) => d.isExpired)

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/portal')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Your Devices</h1>
              <p className="text-sm text-muted-foreground">
                {devices.length} device{devices.length !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Active Devices */}
        {activeDevices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-500" />
                Active Devices
              </CardTitle>
              <CardDescription>Devices with valid network authorization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeDevices.map((device) => (
                <div
                  key={device.id}
                  className={`rounded-lg border p-4 ${
                    device.isOnline ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-1 ${device.isOnline ? 'text-green-500' : 'text-muted-foreground'}`}
                      >
                        {getDeviceIcon(device.deviceInfo, device.nickname)}
                      </div>
                      <div className="space-y-1">
                        {editingDevice === device.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              placeholder="Device name"
                              className="h-8 w-48"
                              maxLength={50}
                              autoFocus
                              disabled={isSaving}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveNickname(device.id)
                                if (e.key === 'Escape') cancelEditing()
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => saveNickname(device.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={cancelEditing}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {device.nickname || 'Unnamed Device'}
                              {device.isOnline && (
                                <span className="ml-2 inline-flex items-center text-xs text-green-500">
                                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                                  Online
                                </span>
                              )}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEditing(device)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <p className="font-mono text-sm text-muted-foreground">
                          {device.macAddress}
                        </p>
                        {device.ipAddress && (
                          <p className="text-sm text-muted-foreground">IP: {device.ipAddress}</p>
                        )}
                      </div>
                    </div>

                    {/* Signal Strength */}
                    {device.isOnline && device.signalStrength && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className={`w-1 rounded-sm ${
                              bar <= getSignalBars(device.signalStrength)
                                ? 'bg-green-500'
                                : 'bg-muted'
                            }`}
                            style={{ height: `${bar * 4 + 4}px` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details Row */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeRemaining(device.expiresAt)} remaining</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Authorized {formatDate(device.authorizedAt)}</span>
                    </div>
                    {device.authCount > 1 && (
                      <div className="flex items-center gap-1">
                        <History className="h-4 w-4" />
                        <span>Authorized {device.authCount} times</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Expired Devices */}
        {expiredDevices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <WifiOff className="h-5 w-5" />
                Expired Devices
              </CardTitle>
              <CardDescription>
                Devices with expired authorization. Re-authenticate to renew access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {expiredDevices.map((device) => (
                <div key={device.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 text-muted-foreground">
                      {getDeviceIcon(device.deviceInfo, device.nickname)}
                    </div>
                    <div className="flex-1 space-y-1">
                      {editingDevice === device.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editNickname}
                            onChange={(e) => setEditNickname(e.target.value)}
                            placeholder="Device name"
                            className="h-8 w-48"
                            maxLength={50}
                            autoFocus
                            disabled={isSaving}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNickname(device.id)
                              if (e.key === 'Escape') cancelEditing()
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => saveNickname(device.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={cancelEditing}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-muted-foreground">
                            {device.nickname || 'Unnamed Device'}
                          </h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startEditing(device)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="font-mono text-sm text-muted-foreground">{device.macAddress}</p>
                      <p className="text-sm text-muted-foreground">
                        Expired {formatDate(device.expiresAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/')}
                      className="shrink-0"
                    >
                      Renew
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {devices.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Laptop className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No devices found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Devices will appear here after you authenticate on the guest network.
              </p>
              <Button className="mt-4" onClick={() => router.push('/')}>
                Connect a Device
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

export default function DeviceManagementPage() {
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
      <DeviceManagementContent />
    </Suspense>
  )
}
