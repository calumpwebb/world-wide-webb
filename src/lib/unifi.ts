/**
 * Unifi Controller Client
 *
 * Handles communication with the Unifi Controller API for:
 * - Guest authorization (MAC address allowlisting)
 * - Guest revocation
 * - Active client listing
 * - DPI statistics
 *
 * Uses the Unifi Controller REST API (v1/v2)
 */

import https from 'https'

const CONTROLLER_URL = process.env.UNIFI_CONTROLLER_URL || 'https://192.168.1.1:8443'
const USERNAME = process.env.UNIFI_USERNAME || 'admin'
const PASSWORD = process.env.UNIFI_PASSWORD || ''
const SITE = process.env.UNIFI_SITE || 'default'
const SKIP_SSL = process.env.UNIFI_SKIP_SSL_VERIFY === 'true'

// Create custom https agent to skip SSL verification for self-signed certs
const httpsAgent = new https.Agent({
  rejectUnauthorized: !SKIP_SSL,
})

interface UnifiClient {
  mac: string
  ip?: string
  hostname?: string
  name?: string
  oui?: string
  is_guest?: boolean
  is_wired?: boolean
  authorized?: boolean
  signal?: number
  rssi?: number
  noise?: number
  tx_bytes?: number
  rx_bytes?: number
  tx_rate?: number
  rx_rate?: number
  uptime?: number
  last_seen?: number
  first_seen?: number
  ap_mac?: string
  essid?: string
  channel?: number
  radio?: string
  _uptime_by_ugw?: number
}

interface UnifiDPIStats {
  mac: string
  by_cat?: Array<{
    cat: number
    rx_bytes: number
    tx_bytes: number
    rx_packets: number
    tx_packets: number
  }>
  by_app?: Array<{
    app: number
    cat: number
    rx_bytes: number
    tx_bytes: number
    rx_packets: number
    tx_packets: number
  }>
}

class UnifiController {
  private cookies: string[] = []
  private csrfToken: string = ''
  private isLoggedIn = false

  /**
   * Login to the Unifi Controller
   */
  async login(): Promise<boolean> {
    if (this.isLoggedIn) return true

    try {
      const response = await fetch(`${CONTROLLER_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: USERNAME,
          password: PASSWORD,
        }),
        // @ts-expect-error - Node.js fetch supports agent
        agent: httpsAgent,
      })

      if (!response.ok) {
        console.error('Unifi login failed:', response.status, response.statusText)
        return false
      }

      // Extract cookies for session
      const setCookies = response.headers.getSetCookie?.() || []
      this.cookies = setCookies

      // Extract CSRF token if present
      const csrfCookie = setCookies.find((c) => c.includes('csrf_token'))
      if (csrfCookie) {
        const match = csrfCookie.match(/csrf_token=([^;]+)/)
        if (match) {
          this.csrfToken = match[1]
        }
      }

      this.isLoggedIn = true
      return true
    } catch (error) {
      console.error('Unifi login error:', error)
      return false
    }
  }

  /**
   * Make an authenticated request to the controller
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T | null> {
    if (!this.isLoggedIn) {
      const loggedIn = await this.login()
      if (!loggedIn) return null
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: this.cookies.join('; '),
    }

    if (this.csrfToken) {
      headers['X-Csrf-Token'] = this.csrfToken
    }

    try {
      const response = await fetch(`${CONTROLLER_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        // @ts-expect-error - Node.js fetch supports agent
        agent: httpsAgent,
      })

      if (response.status === 401) {
        // Session expired, re-login
        this.isLoggedIn = false
        this.cookies = []
        return this.request(endpoint, method, body)
      }

      if (!response.ok) {
        console.error(`Unifi request failed: ${method} ${endpoint}`, response.status)
        return null
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      console.error(`Unifi request error: ${method} ${endpoint}`, error)
      return null
    }
  }

  /**
   * Authorize a guest MAC address
   * @param mac - MAC address to authorize
   * @param minutes - Duration in minutes (default 7 days)
   */
  async authorizeGuest(mac: string, minutes: number = 60 * 24 * 7): Promise<boolean> {
    const normalizedMac = this.normalizeMac(mac)

    const result = await this.request<{ meta: { rc: string } }>(
      `/api/s/${SITE}/cmd/stamgr`,
      'POST',
      {
        cmd: 'authorize-guest',
        mac: normalizedMac,
        minutes,
      }
    )

    return result?.meta?.rc === 'ok'
  }

  /**
   * Unauthorize (revoke) a guest MAC address
   * @param mac - MAC address to revoke
   */
  async unauthorizeGuest(mac: string): Promise<boolean> {
    const normalizedMac = this.normalizeMac(mac)

    const result = await this.request<{ meta: { rc: string } }>(
      `/api/s/${SITE}/cmd/stamgr`,
      'POST',
      {
        cmd: 'unauthorize-guest',
        mac: normalizedMac,
      }
    )

    return result?.meta?.rc === 'ok'
  }

  /**
   * Kick (disconnect) a client
   * @param mac - MAC address to kick
   */
  async kickClient(mac: string): Promise<boolean> {
    const normalizedMac = this.normalizeMac(mac)

    const result = await this.request<{ meta: { rc: string } }>(
      `/api/s/${SITE}/cmd/stamgr`,
      'POST',
      {
        cmd: 'kick-sta',
        mac: normalizedMac,
      }
    )

    return result?.meta?.rc === 'ok'
  }

  /**
   * Get all active clients
   */
  async getActiveClients(): Promise<UnifiClient[]> {
    const result = await this.request<{ data: UnifiClient[] }>(`/api/s/${SITE}/stat/sta`)

    return result?.data || []
  }

  /**
   * Get all known clients (including offline)
   */
  async getAllClients(): Promise<UnifiClient[]> {
    const result = await this.request<{ data: UnifiClient[] }>(`/api/s/${SITE}/rest/user`)

    return result?.data || []
  }

  /**
   * Get a specific client by MAC
   */
  async getClient(mac: string): Promise<UnifiClient | null> {
    const normalizedMac = this.normalizeMac(mac)
    const clients = await this.getActiveClients()
    return clients.find((c) => c.mac.toLowerCase() === normalizedMac.toLowerCase()) || null
  }

  /**
   * Get DPI (Deep Packet Inspection) stats for a client
   */
  async getDPIStats(mac: string): Promise<UnifiDPIStats | null> {
    const normalizedMac = this.normalizeMac(mac)

    const result = await this.request<{ data: UnifiDPIStats[] }>(
      `/api/s/${SITE}/stat/stadpi`,
      'POST',
      {
        macs: [normalizedMac],
      }
    )

    return result?.data?.[0] || null
  }

  /**
   * Get guest authorizations
   */
  async getGuestAuthorizations(): Promise<
    Array<{
      mac: string
      authorized: boolean
      start?: number
      end?: number
    }>
  > {
    const result = await this.request<{
      data: Array<{
        mac: string
        authorized: boolean
        start?: number
        end?: number
      }>
    }>(`/api/s/${SITE}/stat/guest`)

    return result?.data || []
  }

  /**
   * Normalize MAC address to lowercase with colons
   */
  private normalizeMac(mac: string): string {
    return mac
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '')
      .replace(/(.{2})/g, '$1:')
      .slice(0, -1)
  }

  /**
   * Logout from the controller
   */
  async logout(): Promise<void> {
    if (!this.isLoggedIn) return

    await this.request('/api/logout', 'POST')
    this.isLoggedIn = false
    this.cookies = []
    this.csrfToken = ''
  }
}

// Export singleton instance
export const unifi = new UnifiController()

// Export types
export type { UnifiClient, UnifiDPIStats }
