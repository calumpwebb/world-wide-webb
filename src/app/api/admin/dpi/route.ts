import { NextRequest, NextResponse } from 'next/server'
import { unifi } from '@/lib/unifi'
import { z } from 'zod'
import { requireAdmin, AdminAuthError } from '@/lib/session'

export const dynamic = 'force-dynamic'

// DPI category names from Unifi
const DPI_CATEGORIES: Record<number, string> = {
  0: 'Unknown',
  1: 'Web',
  3: 'Gaming',
  4: 'Social Media',
  5: 'Video',
  6: 'Voip',
  7: 'P2P',
  8: 'Email',
  9: 'File Transfer',
  10: 'News',
  11: 'Business',
  12: 'Productivity',
  13: 'Security',
  18: 'Streaming',
  19: 'E-Commerce',
  20: 'Cloud',
}

const querySchema = z.object({
  mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]?){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address'),
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const mac = searchParams.get('mac')

    const result = querySchema.safeParse({ mac })
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const dpiStats = await unifi.getDPIStats(result.data.mac)

    if (!dpiStats) {
      return NextResponse.json({
        mac: result.data.mac,
        categories: [],
        applications: [],
        totalRx: '0 B',
        totalTx: '0 B',
        available: false,
      })
    }

    // Process categories
    const categories = (dpiStats.by_cat || [])
      .map((cat) => ({
        id: cat.cat,
        name: DPI_CATEGORIES[cat.cat] || `Category ${cat.cat}`,
        rxBytes: cat.rx_bytes,
        txBytes: cat.tx_bytes,
        rxFormatted: formatBytes(cat.rx_bytes),
        txFormatted: formatBytes(cat.tx_bytes),
        totalBytes: cat.rx_bytes + cat.tx_bytes,
        totalFormatted: formatBytes(cat.rx_bytes + cat.tx_bytes),
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes)

    // Process applications (top 20)
    const applications = (dpiStats.by_app || [])
      .map((app) => ({
        id: app.app,
        categoryId: app.cat,
        categoryName: DPI_CATEGORIES[app.cat] || `Category ${app.cat}`,
        rxBytes: app.rx_bytes,
        txBytes: app.tx_bytes,
        rxFormatted: formatBytes(app.rx_bytes),
        txFormatted: formatBytes(app.tx_bytes),
        totalBytes: app.rx_bytes + app.tx_bytes,
        totalFormatted: formatBytes(app.rx_bytes + app.tx_bytes),
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 20)

    // Calculate totals
    const totalRx = categories.reduce((sum, c) => sum + c.rxBytes, 0)
    const totalTx = categories.reduce((sum, c) => sum + c.txBytes, 0)

    return NextResponse.json({
      mac: result.data.mac,
      categories,
      applications,
      totalRx: formatBytes(totalRx),
      totalTx: formatBytes(totalTx),
      totalRxBytes: totalRx,
      totalTxBytes: totalTx,
      available: true,
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('DPI API error:', error)
    return NextResponse.json({ error: 'Failed to fetch DPI stats' }, { status: 500 })
  }
}
