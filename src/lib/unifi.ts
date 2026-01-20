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
import { normalizeMac } from './utils'
import { UNIFI_DEFAULT_PORT, UNIFI_DEFAULT_IP, GUEST_AUTH_DURATION_MINUTES } from './constants'

const CONTROLLER_URL =
  process.env.UNIFI_CONTROLLER_URL || `https://${UNIFI_DEFAULT_IP}:${UNIFI_DEFAULT_PORT}`
const USERNAME = process.env.UNIFI_USERNAME || 'admin'
const PASSWORD = process.env.UNIFI_PASSWORD || ''
const SITE = process.env.UNIFI_SITE || 'default'
const SKIP_SSL = process.env.UNIFI_SKIP_SSL_VERIFY === 'true'

// Create custom https agent with connection pooling and keep-alive
const httpsAgent = new https.Agent({
  rejectUnauthorized: !SKIP_SSL,
  keepAlive: true,
  keepAliveMsecs: 30000, // Keep connections alive for 30 seconds
  maxSockets: 10, // Allow up to 10 concurrent connections
  maxFreeSockets: 5, // Keep up to 5 idle connections in the pool
  timeout: 60000, // Connection timeout: 60 seconds
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
   * Authenticate with the Unifi Controller and establish a session.
   *
   * This method is idempotent - if already logged in, it returns immediately.
   * On successful login, it extracts session cookies and CSRF token for subsequent requests.
   *
   * **Session Management:**
   * - Cookies are stored in `this.cookies` for session persistence
   * - CSRF token is extracted from `csrf_token` cookie using regex
   * - `isLoggedIn` flag prevents unnecessary login attempts
   *
   * **CSRF Token Extraction:**
   * Parses the `Set-Cookie` header to find `csrf_token=<value>` and extracts the value.
   * The regex `/csrf_token=([^;]+)/` matches everything between `=` and `;`.
   *
   * **SSL Configuration:**
   * Uses custom HTTPS agent with `rejectUnauthorized: false` for self-signed certificates.
   * This is common for home Unifi Controllers that use self-signed certs.
   *
   * @returns Promise resolving to true on success, false on failure
   *
   * @example
   * ```typescript
   * const unifi = new UnifiController()
   * const success = await unifi.login()
   * if (!success) {
   *   console.error('Failed to authenticate with Unifi Controller')
   * }
   * ```
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
   * Make an authenticated HTTP request to the Unifi Controller.
   *
   * This private method handles all API communication with automatic session management
   * and retry logic. It ensures the client is logged in before making requests and
   * automatically re-authenticates if the session expires (401 response).
   *
   * **Auto-Login:** If not logged in, calls `login()` before making the request.
   *
   * **Auto-Retry on 401:** If the server returns 401 (Unauthorized), the method:
   * 1. Marks session as expired (`isLoggedIn = false`)
   * 2. Clears cookies
   * 3. Recursively calls itself (which triggers re-login via auto-login)
   * 4. **Important:** Only retries ONCE - the `retryCount` parameter prevents infinite loops
   *
   * **CSRF Protection:** Includes `X-Csrf-Token` header if CSRF token was extracted during login.
   *
   * **Generic Return Type:** Uses TypeScript generics to type the response data.
   * Callers specify the expected response shape: `request<AuthResponse>('/api/login')`
   *
   * @template T - The expected response data type
   * @param endpoint - API endpoint path (e.g., '/api/s/default/cmd/stamgr')
   * @param method - HTTP method (GET or POST), defaults to GET
   * @param body - Optional request body for POST requests
   * @param retryCount - Internal parameter to prevent infinite retry loops (default: 0)
   * @returns Promise resolving to parsed response data, or null on failure
   *
   * @example
   * ```typescript
   * // GET request with typed response
   * interface Client { mac: string; ip: string }
   * const clients = await this.request<{ data: Client[] }>('/api/s/default/stat/sta')
   *
   * // POST request with body
   * const result = await this.request('/api/s/default/cmd/stamgr', 'POST', {
   *   cmd: 'authorize-guest',
   *   mac: 'aa:bb:cc:dd:ee:ff',
   * })
   * ```
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>,
    retryCount: number = 0
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

      if (response.status === 401 && retryCount < 1) {
        // Session expired, re-login and retry once
        this.isLoggedIn = false
        this.cookies = []
        return this.request(endpoint, method, body, retryCount + 1)
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
  async authorizeGuest(
    mac: string,
    minutes: number = GUEST_AUTH_DURATION_MINUTES
  ): Promise<boolean> {
    const normalizedMac = normalizeMac(mac)

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
    const normalizedMac = normalizeMac(mac)

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
    const normalizedMac = normalizeMac(mac)

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
    const normalizedMac = normalizeMac(mac)
    const clients = await this.getActiveClients()
    return clients.find((c) => c.mac.toLowerCase() === normalizedMac.toLowerCase()) || null
  }

  /**
   * Get DPI (Deep Packet Inspection) stats for a client
   */
  async getDPIStats(mac: string): Promise<UnifiDPIStats | null> {
    const normalizedMac = normalizeMac(mac)

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
