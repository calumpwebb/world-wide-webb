'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Wifi,
  Activity,
  Clock,
  LogOut,
  RefreshCw,
  Loader2,
  Shield,
  Signal,
  AlertTriangle,
  Bell,
  Info,
  X,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

interface DashboardStats {
  activeGuests: number
  totalAuthorized: number
  expiringToday: number
  totalBandwidth: string
}

interface ActiveDevice {
  mac: string
  name: string
  ip: string
  signalStrength?: number
  lastSeen: string
  authorized: boolean
}

interface ActivityEvent {
  id: number
  type: string
  description: string
  timestamp: string
  user?: string
}

interface Alert {
  id: string
  type: 'expiring' | 'failed_auth' | 'new_guest' | 'high_bandwidth'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: string
  link?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    activeGuests: 0,
    totalAuthorized: 0,
    expiringToday: 0,
    totalBandwidth: '0 GB',
  })
  const [devices, setDevices] = useState<ActiveDevice[]>([])
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // Fetch active devices
      const devicesRes = await fetch('/api/admin/devices')
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json()
        setDevices(devicesData.devices || [])
      }

      // Fetch recent activity
      const activityRes = await fetch('/api/admin/activity?limit=10')
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData.events || [])
      }

      // Fetch alerts
      const alertsRes = await fetch('/api/admin/alerts')
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData.alerts || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession()
        const user = session.data?.user as { role?: string; twoFactorEnabled?: boolean } | undefined

        if (!session.data?.user) {
          router.push('/admin/login')
          return
        }

        if (user?.role !== 'admin') {
          await authClient.signOut()
          router.push('/admin/login')
          return
        }

        if (!user?.twoFactorEnabled) {
          router.push('/admin/setup-2fa')
          return
        }

        // Fetch initial data
        await fetchDashboardData()
        setIsLoading(false)
      } catch {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router, fetchDashboardData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (isLoading) return

    const interval = setInterval(() => {
      fetchDashboardData()
    }, 30000)

    return () => clearInterval(interval)
  }, [isLoading, fetchDashboardData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchDashboardData()
    setIsRefreshing(false)
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/admin/login')
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'auth_success':
        return <Shield className="h-4 w-4 text-green-500" />
      case 'auth_fail':
        return <Shield className="h-4 w-4 text-red-500" />
      case 'connect':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'disconnect':
        return <Wifi className="h-4 w-4 text-muted-foreground" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getAlertIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getAlertBorderColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/5'
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/5'
      default:
        return 'border-blue-500/50 bg-blue-500/5'
    }
  }

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...Array.from(prev), alertId]))
  }

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts.has(alert.id))

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading dashboard...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">World Wide Webb Network Management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/admin/settings')}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {visibleAlerts.length > 0 && (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-lg border p-4 ${getAlertBorderColor(alert.severity)}`}
              >
                <div className="mt-0.5">{getAlertIcon(alert.severity)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{alert.title}</p>
                    <Bell className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  {alert.link && (
                    <Button variant="ghost" size="sm" onClick={() => router.push(alert.link!)}>
                      View
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Guests</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeGuests}</div>
              <p className="text-xs text-muted-foreground">Connected now</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Authorized</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAuthorized}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.expiringToday}</div>
              <p className="text-xs text-muted-foreground">Need renewal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bandwidth Used</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBandwidth}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Active Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Active Devices
              </CardTitle>
              <CardDescription>Currently connected guests</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No devices connected
                </p>
              ) : (
                <div className="space-y-4">
                  {devices.slice(0, 5).map((device) => (
                    <div
                      key={device.mac}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{device.name || 'Unknown Device'}</p>
                        <p className="font-mono text-xs text-muted-foreground">{device.mac}</p>
                        <p className="text-xs text-muted-foreground">IP: {device.ip}</p>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        {device.signalStrength !== undefined && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Signal className="h-3 w-3" />
                            {device.signalStrength}%
                          </div>
                        )}
                        <div
                          className={`h-2 w-2 rounded-full ${
                            device.authorized ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                  {devices.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => router.push('/admin/devices')}
                    >
                      View all {devices.length} devices
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest network events</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="mt-0.5">{getEventIcon(event.type)}</div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm">{event.description}</p>
                        {event.user && (
                          <p className="text-xs text-muted-foreground">{event.user}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push('/admin/logs')}
                  >
                    View all activity
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/guests')}>
              <Users className="mr-2 h-4 w-4" />
              Manage Guests
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/network')}>
              <Wifi className="mr-2 h-4 w-4" />
              Network Status
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/logs')}>
              <Activity className="mr-2 h-4 w-4" />
              Activity Logs
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
