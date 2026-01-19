'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Ban,
  Clock,
  Wifi,
  WifiOff,
  ArrowLeft,
  RefreshCw,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'

interface Guest {
  id: number
  mac: string
  ip: string | null
  device: string | null
  nickname: string | null
  authorizedAt: string
  expiresAt: string
  lastSeen: string | null
  authCount: number
  isActive: boolean
  isOnline: boolean
  user: {
    id: string
    name: string | null
    email: string | null
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function GuestManagementContent() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [guests, setGuests] = useState<Guest[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedGuests, setSelectedGuests] = useState<Set<number>>(new Set())
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const fetchGuests = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...(search && { search }),
          ...(statusFilter !== 'all' && { status: statusFilter }),
        })

        const response = await fetch(`/api/admin/guests?${params}`)
        if (response.ok) {
          const data = await response.json()
          setGuests(data.guests)
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('Failed to fetch guests:', error)
        toast.error('Failed to fetch guests')
      }
    },
    [search, statusFilter]
  )

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession()
        const user = session.data?.user as { role?: string; twoFactorEnabled?: boolean } | undefined

        if (!session.data?.user || user?.role !== 'admin' || !user?.twoFactorEnabled) {
          router.push('/admin/login')
          return
        }

        await fetchGuests()
        setIsLoading(false)
      } catch {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router, fetchGuests])

  const handleSearch = () => {
    setSelectedGuests(new Set())
    fetchGuests(1)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchGuests(pagination.page)
    setIsRefreshing(false)
    toast.success('Guest list refreshed')
  }

  const handlePageChange = (newPage: number) => {
    setSelectedGuests(new Set())
    fetchGuests(newPage)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGuests(new Set(guests.map((g) => g.id)))
    } else {
      setSelectedGuests(new Set())
    }
  }

  const handleSelectGuest = (guestId: number, checked: boolean) => {
    const newSelected = new Set(selectedGuests)
    if (checked) {
      newSelected.add(guestId)
    } else {
      newSelected.delete(guestId)
    }
    setSelectedGuests(newSelected)
  }

  const handleRevoke = async () => {
    if (selectedGuests.size === 0) return

    setIsRevoking(true)
    try {
      const response = await fetch('/api/admin/guests/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: Array.from(selectedGuests) }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Revoked ${data.revoked} guest(s)`)
        setSelectedGuests(new Set())
        await fetchGuests(pagination.page)
      } else {
        toast.error(data.error || 'Failed to revoke guests')
      }
    } catch (error) {
      console.error('Revoke error:', error)
      toast.error('Failed to revoke guests')
    } finally {
      setIsRevoking(false)
      setShowRevokeDialog(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeRemaining = (expiresAt: string) => {
    const expiry = new Date(expiresAt)
    const now = new Date()
    const diff = expiry.getTime() - now.getTime()

    if (diff <= 0) return 'Expired'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading guests...
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
              <h1 className="text-2xl font-semibold">Guest Management</h1>
              <p className="text-sm text-muted-foreground">{pagination.total} total guests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {selectedGuests.size > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowRevokeDialog(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Revoke ({selectedGuests.size})
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or MAC..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Guest List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Authorized Guests
            </CardTitle>
            <CardDescription>Manage guest access to the network</CardDescription>
          </CardHeader>
          <CardContent>
            {guests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No guests found</p>
            ) : (
              <div className="space-y-4">
                {/* Select All */}
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Checkbox
                    checked={selectedGuests.size === guests.length && guests.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Select all</span>
                </div>

                {/* Guest Items */}
                {guests.map((guest) => (
                  <div
                    key={guest.id}
                    className={`flex items-start gap-4 rounded-lg border p-4 ${
                      selectedGuests.has(guest.id) ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      checked={selectedGuests.has(guest.id)}
                      onCheckedChange={(checked) => handleSelectGuest(guest.id, checked as boolean)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {guest.nickname || guest.user.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">{guest.user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {guest.isOnline ? (
                            <span className="flex items-center gap-1 text-xs text-green-500">
                              <Wifi className="h-3 w-3" />
                              Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <WifiOff className="h-3 w-3" />
                              Offline
                            </span>
                          )}
                          {guest.isActive ? (
                            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                              <Clock className="h-3 w-3" />
                              {getTimeRemaining(guest.expiresAt)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                              Expired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">MAC Address</p>
                          <p className="font-mono text-xs">{guest.mac}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">IP Address</p>
                          <p className="font-mono text-xs">{guest.ip || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Authorized</p>
                          <p className="text-xs">{formatDate(guest.authorizedAt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Auth Count</p>
                          <p className="text-xs">{guest.authCount} time(s)</p>
                        </div>
                      </div>
                    </div>
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

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Guest Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for {selectedGuests.size} guest(s)? This will
              immediately disconnect them from the network.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Access'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default function GuestManagementPage() {
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
      <GuestManagementContent />
    </Suspense>
  )
}
