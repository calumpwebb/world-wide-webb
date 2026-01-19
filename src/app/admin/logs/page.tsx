'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Download,
  Shield,
  ShieldX,
  Wifi,
  WifiOff,
  Mail,
  LogIn,
  LogOut,
  Ban,
  Clock,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

interface ActivityEvent {
  id: number
  type: string
  description: string
  timestamp: string
  user?: string
  userEmail?: string
  mac?: string
  ip?: string
  details: Record<string, unknown>
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'auth_success', label: 'Auth Success' },
  { value: 'auth_fail', label: 'Auth Failed' },
  { value: 'connect', label: 'Connected' },
  { value: 'disconnect', label: 'Disconnected' },
  { value: 'admin_revoke', label: 'Admin Revoke' },
  { value: 'admin_extend', label: 'Admin Extend' },
  { value: 'code_sent', label: 'Code Sent' },
  { value: 'code_resent', label: 'Code Resent' },
  { value: 'admin_login', label: 'Admin Login' },
  { value: 'admin_logout', label: 'Admin Logout' },
]

function getEventIcon(type: string) {
  switch (type) {
    case 'auth_success':
      return <Shield className="h-4 w-4 text-green-500" />
    case 'auth_fail':
      return <ShieldX className="h-4 w-4 text-red-500" />
    case 'connect':
      return <Wifi className="h-4 w-4 text-green-500" />
    case 'disconnect':
      return <WifiOff className="h-4 w-4 text-muted-foreground" />
    case 'admin_revoke':
      return <Ban className="h-4 w-4 text-red-500" />
    case 'admin_extend':
      return <Clock className="h-4 w-4 text-blue-500" />
    case 'code_sent':
    case 'code_resent':
      return <Mail className="h-4 w-4 text-blue-500" />
    case 'admin_login':
      return <LogIn className="h-4 w-4 text-green-500" />
    case 'admin_logout':
      return <LogOut className="h-4 w-4 text-muted-foreground" />
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />
  }
}

function getEventColor(type: string) {
  switch (type) {
    case 'auth_success':
    case 'connect':
    case 'admin_login':
      return 'border-green-500/30 bg-green-500/5'
    case 'auth_fail':
    case 'admin_revoke':
      return 'border-red-500/30 bg-red-500/5'
    case 'code_sent':
    case 'code_resent':
    case 'admin_extend':
      return 'border-blue-500/30 bg-blue-500/5'
    default:
      return 'border-border'
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function ActivityLogsContent() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)

  const fetchEvents = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...(search && { search }),
          ...(eventType !== 'all' && { type: eventType }),
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        })

        const response = await fetch(`/api/admin/activity?${params}`)
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events)
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
        toast.error('Failed to fetch activity logs')
      }
    },
    [search, eventType, startDate, endDate]
  )

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession()
        const user = session.data?.user as
          | { role?: string; twoFactorEnabled?: boolean; mustChangePassword?: boolean }
          | undefined

        if (!session.data?.user || user?.role !== 'admin') {
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

        await fetchEvents()
        setIsLoading(false)
      } catch {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router, fetchEvents])

  const handleSearch = () => {
    fetchEvents(1)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchEvents(pagination.page)
    setIsRefreshing(false)
  }

  const handlePageChange = (newPage: number) => {
    fetchEvents(newPage)
  }

  const handleClearFilters = () => {
    setSearch('')
    setEventType('all')
    setStartDate('')
    setEndDate('')
    fetchEvents(1)
  }

  const handleExportCSV = () => {
    // Generate CSV from current events
    const headers = ['Timestamp', 'Type', 'Description', 'User', 'MAC Address', 'IP Address']
    const rows = events.map((event) => [
      event.timestamp,
      event.type,
      event.description,
      event.user || '',
      event.mac || '',
      event.ip || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Activity logs exported')
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading activity logs...
        </div>
      </main>
    )
  }

  const hasActiveFilters = search || eventType !== 'all' || startDate || endDate

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
              <h1 className="text-2xl font-semibold">Activity Logs</h1>
              <p className="text-sm text-muted-foreground">{pagination.total} total events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search Row */}
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by user, email, MAC, or IP..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? 'bg-muted' : ''}
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button onClick={handleSearch}>Search</Button>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2">
                    <label className="text-sm text-muted-foreground">From:</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex flex-1 items-center gap-2">
                    <label className="text-sm text-muted-foreground">To:</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Events
            </CardTitle>
            <CardDescription>Complete log of all network and authentication events</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No events found</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className={`rounded-lg border ${getEventColor(event.type)}`}>
                    {/* Event Row */}
                    <button
                      onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                      className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        {getEventIcon(event.type)}
                        <div>
                          <p className="font-medium">{event.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.user && <span className="mr-3">{event.user}</span>}
                            {event.mac && (
                              <span className="mr-3 font-mono text-xs">{event.mac}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right md:block">
                          <p className="text-sm">{formatRelativeTime(event.timestamp)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </p>
                        </div>
                        {expandedEvent === event.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {expandedEvent === event.id && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Event Type</p>
                              <p className="font-mono text-sm">{event.type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Timestamp</p>
                              <p className="text-sm">{formatTimestamp(event.timestamp)}</p>
                            </div>
                            {event.user && (
                              <div>
                                <p className="text-xs text-muted-foreground">User</p>
                                <p className="text-sm">{event.user}</p>
                                {event.userEmail && (
                                  <p className="text-xs text-muted-foreground">{event.userEmail}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {event.mac && (
                              <div>
                                <p className="text-xs text-muted-foreground">MAC Address</p>
                                <p className="font-mono text-sm">{event.mac}</p>
                              </div>
                            )}
                            {event.ip && (
                              <div>
                                <p className="text-xs text-muted-foreground">IP Address</p>
                                <p className="font-mono text-sm">{event.ip}</p>
                              </div>
                            )}
                            {Object.keys(event.details).length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">Details</p>
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                                  {JSON.stringify(event.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page <= 1}
                        onClick={() => handlePageChange(pagination.page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => handlePageChange(pagination.page + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function ActivityLogsPage() {
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
      <ActivityLogsContent />
    </Suspense>
  )
}
