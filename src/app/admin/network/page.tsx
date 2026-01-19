'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wifi,
  WifiOff,
  Signal,
  Router,
  Laptop,
  Smartphone,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Shield,
  ShieldOff,
  Cable,
  Radio,
  Activity,
  Download,
  Upload,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

interface NetworkClient {
  mac: string
  name: string
  ip: string
  hostname?: string
  signalStrength?: number
  rssi?: number
  noise?: number
  txRate?: number
  rxRate?: number
  txBytes?: number
  rxBytes?: number
  uptime?: number
  lastSeen: string
  firstSeen?: string
  isAuthorized: boolean
  isGuest: boolean
  isWired: boolean
  channel?: number
  radio?: string
  essid?: string
  apMac?: string
  guest?: {
    userId: string
    userName: string | null
    userEmail: string | null
    expiresAt: string
    nickname: string | null
  }
}

interface NetworkStats {
  total: number
  guests: number
  wired: number
  wireless: number
  authorized: number
}

interface DPICategory {
  id: number
  name: string
  rxFormatted: string
  txFormatted: string
  totalFormatted: string
  totalBytes: number
}

interface DPIData {
  mac: string
  categories: DPICategory[]
  totalRx: string
  totalTx: string
  available: boolean
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatUptime(seconds?: number): string {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatRate(kbps?: number): string {
  if (!kbps) return 'N/A'
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(0)} Mbps`
  return `${kbps} Kbps`
}

function getSignalColor(strength?: number): string {
  if (strength === undefined) return 'text-muted-foreground'
  if (strength >= 70) return 'text-green-500'
  if (strength >= 40) return 'text-yellow-500'
  return 'text-red-500'
}

function getSignalIcon(strength?: number, isWired?: boolean) {
  if (isWired) return <Cable className="h-4 w-4 text-blue-500" />
  if (strength === undefined) return <Signal className="h-4 w-4 text-muted-foreground" />
  if (strength >= 70) return <Signal className="h-4 w-4 text-green-500" />
  if (strength >= 40) return <Signal className="h-4 w-4 text-yellow-500" />
  return <Signal className="h-4 w-4 text-red-500" />
}

function getDeviceIcon(client: NetworkClient) {
  if (client.isWired) return <Router className="h-5 w-5 text-blue-500" />
  // Try to guess device type from hostname
  const hostname = (client.hostname || client.name || '').toLowerCase()
  if (hostname.includes('iphone') || hostname.includes('android') || hostname.includes('phone')) {
    return <Smartphone className="h-5 w-5 text-muted-foreground" />
  }
  return <Laptop className="h-5 w-5 text-muted-foreground" />
}

function NetworkMonitoringContent() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [clients, setClients] = useState<NetworkClient[]>([])
  const [stats, setStats] = useState<NetworkStats>({
    total: 0,
    guests: 0,
    wired: 0,
    wireless: 0,
    authorized: 0,
  })
  const [unifiConnected, setUnifiConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [dpiData, setDpiData] = useState<Record<string, DPIData>>({})
  const [loadingDpi, setLoadingDpi] = useState<string | null>(null)

  const fetchNetworkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/network/status')
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
        setStats(data.stats || { total: 0, guests: 0, wired: 0, wireless: 0, authorized: 0 })
        setUnifiConnected(data.unifiConnected)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch network status:', error)
      toast.error('Failed to fetch network status')
    }
  }, [])

  const fetchDPIStats = async (mac: string) => {
    if (dpiData[mac]) return // Already fetched

    setLoadingDpi(mac)
    try {
      const response = await fetch(`/api/admin/dpi?mac=${encodeURIComponent(mac)}`)
      if (response.ok) {
        const data = await response.json()
        setDpiData((prev) => ({ ...prev, [mac]: data }))
      }
    } catch (error) {
      console.error('Failed to fetch DPI stats:', error)
    } finally {
      setLoadingDpi(null)
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession()
        const user = session.data?.user as { role?: string; twoFactorEnabled?: boolean } | undefined

        if (!session.data?.user || user?.role !== 'admin' || !user?.twoFactorEnabled) {
          router.push('/admin/login')
          return
        }

        await fetchNetworkStatus()
        setIsLoading(false)
      } catch {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router, fetchNetworkStatus])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (isLoading || !autoRefresh) return

    const interval = setInterval(() => {
      fetchNetworkStatus()
    }, 30000)

    return () => clearInterval(interval)
  }, [isLoading, autoRefresh, fetchNetworkStatus])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchNetworkStatus()
    setIsRefreshing(false)
  }

  const handleClientExpand = (mac: string) => {
    if (expandedClient === mac) {
      setExpandedClient(null)
    } else {
      setExpandedClient(mac)
      fetchDPIStats(mac)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading network status...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Network Monitoring</h1>
              <p className="text-sm text-muted-foreground">
                {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Connection Status */}
        {!unifiConnected && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="flex items-center gap-3 py-4">
              <WifiOff className="h-5 w-5 text-yellow-500" />
              <p className="text-sm text-yellow-500">
                Unable to connect to Unifi Controller. Showing cached data only.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Router className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Connected now</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authorized</CardTitle>
              <Shield className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.authorized}</div>
              <p className="text-xs text-muted-foreground">Known guests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guest Network</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.guests}</div>
              <p className="text-xs text-muted-foreground">On guest VLAN</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wireless</CardTitle>
              <Radio className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.wireless}</div>
              <p className="text-xs text-muted-foreground">WiFi clients</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wired</CardTitle>
              <Cable className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.wired}</div>
              <p className="text-xs text-muted-foreground">Ethernet clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Clients
            </CardTitle>
            <CardDescription>
              Real-time view of all connected devices. Click to expand for details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No devices connected</p>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => (
                  <div key={client.mac} className="rounded-lg border border-border">
                    {/* Client Row */}
                    <button
                      onClick={() => handleClientExpand(client.mac)}
                      className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        {getDeviceIcon(client)}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{client.name}</p>
                            {client.isAuthorized ? (
                              <Shield className="h-4 w-4 text-green-500" />
                            ) : (
                              <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">{client.mac}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden text-right md:block">
                          <p className="text-sm">{client.ip}</p>
                          {client.essid && (
                            <p className="text-xs text-muted-foreground">{client.essid}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getSignalIcon(client.signalStrength, client.isWired)}
                          <span className={`text-sm ${getSignalColor(client.signalStrength)}`}>
                            {client.isWired
                              ? 'Wired'
                              : client.signalStrength !== undefined
                                ? `${client.signalStrength}%`
                                : 'N/A'}
                          </span>
                        </div>
                        {expandedClient === client.mac ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedClient === client.mac && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* Connection Info */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium">Connection Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">IP Address</p>
                                <p className="font-mono">{client.ip}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Hostname</p>
                                <p className="font-mono text-xs">{client.hostname || 'N/A'}</p>
                              </div>
                              {!client.isWired && (
                                <>
                                  <div>
                                    <p className="text-muted-foreground">Signal (RSSI)</p>
                                    <p>
                                      {client.rssi !== undefined ? `${client.rssi} dBm` : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Channel</p>
                                    <p>
                                      {client.channel || 'N/A'}
                                      {client.radio && ` (${client.radio})`}
                                    </p>
                                  </div>
                                </>
                              )}
                              <div>
                                <p className="text-muted-foreground">TX Rate</p>
                                <p>{formatRate(client.txRate)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">RX Rate</p>
                                <p>{formatRate(client.rxRate)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-muted-foreground">Uptime</p>
                                  <p>{formatUptime(client.uptime)}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Data Used</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <Download className="h-3 w-3 text-green-500" />
                                  {formatBytes(client.rxBytes || 0)}
                                  <Upload className="h-3 w-3 text-blue-500" />
                                  {formatBytes(client.txBytes || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Guest Info */}
                            {client.guest && (
                              <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                                <h5 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-500">
                                  <Shield className="h-4 w-4" />
                                  Authorized Guest
                                </h5>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Name</p>
                                    <p>{client.guest.userName || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="truncate">{client.guest.userEmail || 'N/A'}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-muted-foreground">Expires</p>
                                    <p>{new Date(client.guest.expiresAt).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* DPI Stats */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium">Traffic Analysis (DPI)</h4>
                            {loadingDpi === client.mac ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading traffic data...
                              </div>
                            ) : dpiData[client.mac]?.available ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-1">
                                    <Download className="h-3 w-3 text-green-500" />
                                    <span>{dpiData[client.mac].totalRx}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Upload className="h-3 w-3 text-blue-500" />
                                    <span>{dpiData[client.mac].totalTx}</span>
                                  </div>
                                </div>
                                {dpiData[client.mac].categories.length > 0 ? (
                                  <div className="space-y-2">
                                    {dpiData[client.mac].categories.slice(0, 6).map((cat) => (
                                      <div
                                        key={cat.id}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <span className="text-muted-foreground">{cat.name}</span>
                                        <span className="font-mono text-xs">
                                          {cat.totalFormatted}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No category data available
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                DPI data not available for this device
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Close Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-4"
                          onClick={() => setExpandedClient(null)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function NetworkMonitoringPage() {
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
      <NetworkMonitoringContent />
    </Suspense>
  )
}
