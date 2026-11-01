/**
 * The pairing fence: who may reach the pairing surfaces, and how often.
 *
 * The /api/pair routes must be reachable from the desktop and from a phone
 * whose authority is one the QR links advertise, but not from an arbitrary
 * origin. The predicates here mirror the connection package's internal fence
 * semantics (Host/Origin based, DNS-rebinding and cross-site defense) scoped to
 * the literals this plugin actually advertises: loopback, its live LAN bases,
 * its configured public host, plus operator-configured extra hosts.
 */

import type { IncomingMessage } from 'node:http'
import type { PairingService } from '../pairing/pairing.ts'
import type { PairGrantStore } from '../pairing/pair-grant.ts'
import { isLoopbackAddress } from './loopback.ts'
import { isLoopbackClient, readCookie } from '../pairing/gate.ts'

/**
 * Browser-trust fence for the /api/pair routes: the Host must be ours and any
 * attached browser markers must be same-origin.
 * @param request - the node HTTP request.
 * @param trustedHosts - non-loopback authorities this surface serves: exact
 * `host:port`, or port-less `host` matching any port.
 * @returns true when the Host is ours (loopback or trusted) and any attached
 * browser markers are same-origin.
 */
export function isTrustedApiRequest(request: IncomingMessage, trustedHosts: readonly string[]): boolean {
  if (!isTrustedHost(request, trustedHosts)) return false
  // Cross-site fence: an explicit cross-site marker is refused regardless of
  // Origin (modern browsers label the initiator on every fetch).
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  // Origin fence: when a browser attaches an Origin it must be exactly this
  // authority; absent Origin is fine — the Host fence already bound it.
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === new URL(`http://${request.headers.host ?? ''}`).host
  } catch {
    return false
  }
}

/**
 * Whether the request's Host is an authority this surface serves: loopback, or
 * a trusted entry (exact `host:port`, or port-less `host` matching any port).
 * The browser-marker checks stay in {@link isTrustedApiRequest}: a pairing
 * entry page is a navigation, and its authority is the token or device
 * credential it carries, not who linked to it.
 * @param request - the node HTTP request.
 * @param trustedHosts - non-loopback authorities this surface serves.
 * @returns true when the Host is ours.
 */
export function isTrustedHost(request: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  const hostname = hostUrl.hostname
  return isLoopbackClient(request) || trustedHosts.some(entry => {
    // A port-less entry matches the hostname on any port; an exact host:port
    // entry matches that authority verbatim (WHATWG normalization both sides).
    // A malformed entry (a config or DSH_REMOTE_TRUSTED_HOSTS typo) contributes
    // no trust instead of throwing out of the fence.
    let entryUrl: URL
    try {
      entryUrl = new URL(`http://${entry}`)
    } catch {
      return false
    }
    return entryUrl.port === '' ? entryUrl.hostname === hostname : entryUrl.host === hostUrl.host
  })
}

/**
 * Whether the request is a top-level document navigation — the shape every
 * phone uses to open a pairing link. Browsers label it `Sec-Fetch-Mode:
 * navigate` with `Sec-Fetch-Dest: document`; in-app browsers (WeChat, and
 * anything else wrapping a WKWebView) additionally attach `Sec-Fetch-Site:
 * cross-site` or an opaque `Origin: null`, which the API fence must keep
 * refusing but which says nothing about a document navigation: the pairing
 * token or the device id in the URL is what authorizes it.
 * @param request - the node HTTP request.
 * @returns true for a top-level document navigation.
 */
export function isTopLevelDocumentNavigation(request: IncomingMessage): boolean {
  return request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document'
}

/**
 * Whether a hostname represents a private local-area network (RFC 1918 / ULA /
 * mDNS / loopback). Supports pairing in container-bridged (Docker) or
 * NAT-proxied topologies where the host machine's LAN IP or proxy domain
 * differs from the container's internal sampled network interface.
 * @param hostname - the hostname to classify.
 * @returns true for a private or local hostname.
 */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim()
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.lan') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  ) {
    return true
  }
  let ip = normalized
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1)
  if (ip === '::1' || ip === '127.0.0.1') return true
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true
  const parts = ip.split('.').map(Number)
  if (parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  return false
}

/**
 * Whether an incoming request is non-cross-site: no cross-site fetch metadata,
 * and an Origin that matches the Host when one is attached.
 * @param request - the node HTTP request.
 * @returns true when the request carries no cross-site marker.
 */
export function isNonCrossSite(request: IncomingMessage): boolean {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    const originUrl = new URL(origin)
    const hostUrl = new URL(`http://${host}`)
    return originUrl.host === hostUrl.host
  } catch {
    return false
  }
}

/**
 * The private-LAN fallback authority of a request: its Host header when the
 * hostname is private/local and the browser markers are non-cross-site, else
 * undefined. The accept paths and the lanFence fallback use this to serve
 * container-bridged and reverse-proxy topologies whose Host is not among the
 * advertised or configured authorities.
 * @param request - the node HTTP request.
 * @param navigation - whether the request is a top-level document navigation.
 * @returns the Host authority, or undefined when the request is not a private
 * one we can adopt.
 */
export function privateLanHostOf(request: IncomingMessage, navigation = false): string | undefined {
  const host = request.headers.host
  if (typeof host !== 'string') return undefined
  let hostName = ''
  try {
    hostName = new URL(`http://${host}`).hostname
  } catch {
    return undefined
  }
  if (hostName === '' || !isPrivateOrLocalHostname(hostName)) return undefined
  // A top-level navigation is judged by its credential, not by the initiator
  // marker (see isTopLevelDocumentNavigation); every other request keeps the
  // non-cross-site requirement.
  if (!(navigation && isTopLevelDocumentNavigation(request)) && !isNonCrossSite(request)) return undefined
  return host
}

/**
 * Cap on the dynamically trusted hosts (see {@link addBounded}): room for
 * every legitimate router/proxy aliasing shape, small enough that a flood of
 * distinct private Host headers cannot grow the table unboundedly.
 */
export const MAX_DYNAMIC_TRUSTED_HOSTS = 64

/**
 * FIFO-bounded Set insert: past `max` entries the oldest one is evicted
 * (a Set iterates in insertion order). The dynamic trusted-host table is fed
 * by caller-controlled Host headers, so it must stay bounded; an evicted
 * legitimate host re-adds itself on that device's next gated request.
 * @param set - the bounded set.
 * @param value - the value to add.
 * @param max - the size cap.
 */
export function addBounded(set: Set<string>, value: string, max: number): void {
  if (set.has(value)) return
  if (set.size >= max) {
    const oldest = set.values().next().value
    if (oldest !== undefined) set.delete(oldest)
  }
  set.add(value)
}

/**
 * The host authority of a configured public base URL, e.g.
 * `foo.trycloudflare.com` from `https://foo.trycloudflare.com`. Undefined when
 * the URL does not parse — a malformed config then simply contributes no fence
 * entry (and the panel falls back to LAN-only URLs).
 * @param url - the configured public base URL (or undefined).
 * @returns the `host[:port]` authority the fence should trust.
 */
export function publicHostOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  try {
    return new URL(url).host
  } catch {
    return undefined
  }
}

/**
 * Reasons a phone-facing entry page refused a request, logged once per shape
 * so a real device failure is diagnosable from the host console without a
 * debug build. Keyed by `reason|host|path`; bounded by construction.
 */
const loggedEntryRefusals = new Set<string>()

/**
 * Log one entry-page refusal (first occurrence per shape) and cap the set.
 * @param request - the refused request.
 * @param path - the entry path that refused it.
 * @param reason - why the fence refused.
 */
export function logEntryRefusal(request: IncomingMessage, path: string, reason: string): void {
  const key = `${reason}|${request.headers.host ?? ''}|${path}`
  if (loggedEntryRefusals.has(key) || loggedEntryRefusals.size >= 64) return
  loggedEntryRefusals.add(key)
  const markers = [
    `sec-fetch-site=${request.headers['sec-fetch-site'] ?? '-'}`,
    `sec-fetch-mode=${request.headers['sec-fetch-mode'] ?? '-'}`,
    `sec-fetch-dest=${request.headers['sec-fetch-dest'] ?? '-'}`,
    `origin=${request.headers.origin ?? '-'}`,
  ].join(' ')
  console.log(`dsh-remote-web: refused ${path} from host ${request.headers.host ?? '-'} (${reason}; ${markers})`)
}

/**
 * Per-source-IP accept rate limit (brute-force defense in depth). The POST
 * accept and the GET entry page count separately: a QR re-scan must not
 * consume a brute-force budget that belongs to token guessing, and vice versa.
 */
export interface AcceptRateLimiter {
  /**
   * Count one attempt and report whether the source is over its budget.
   * @param req - the request being limited.
   * @param bucket - which flow this attempt belongs to.
   * @returns true when the attempt must be refused.
   */
  limited(req: IncomingMessage, bucket: 'page' | 'api'): boolean
}

/** Cap on live accept buckets: a caller-influenced key must not grow the table. */
export const MAX_ACCEPT_BUCKETS = 1024
/** Attempts one source may make inside one window, per bucket. */
const ACCEPT_MAX_ATTEMPTS = 10
/** Length of the rate-limit window. */
const ACCEPT_WINDOW_MS = 30_000
/** Longest forwarded hop kept in a bucket key (the header is caller-sized). */
const MAX_FORWARDED_KEY_CHARS = 64

/**
 * The rate-limit bucket key for one accept attempt (pure; unit-tested).
 * A forwarded hop separates buckets behind the auto-tunnel (every internet
 * client arrives from 127.0.0.1 there) — but only for loopback peers, since a
 * direct LAN client can rotate the header freely. The caller passes the hop it
 * trusts (the edge-appended LAST one; see {@link createAcceptRateLimiter}).
 * @param socketIp - the socket peer address.
 * @param forwarded - the trusted XFF hop, already trimmed, if any.
 * @param bucket - page (GET /pair-accept) vs api (POST /api/pair/accept).
 * @returns the bucket key.
 */
export function acceptLimitKey(socketIp: string, forwarded: string | undefined, bucket: 'page' | 'api'): string {
  if (isLoopbackAddress(socketIp) && forwarded !== undefined && forwarded !== '') {
    return `${bucket}|${socketIp}|${forwarded.slice(0, MAX_FORWARDED_KEY_CHARS)}`
  }
  return `${bucket}|${socketIp}`
}

/**
 * Build the accept rate limiter.
 *
 * Buckets are pruned from the FRONT of the insertion-ordered table (the oldest
 * window sits there because a re-armed bucket is re-inserted at the tail), so
 * pruning is amortized O(1) per request; past the hard cap the oldest bucket is
 * evicted. A legitimate client that loses its bucket merely starts a fresh
 * window.
 * @returns the limiter.
 */
export function createAcceptRateLimiter(): AcceptRateLimiter {
  const attempts = new Map<string, { count: number; windowStart: number }>()

  const prune = (nowMs: number): void => {
    while (attempts.size > 0) {
      const oldest = attempts.keys().next().value
      if (oldest === undefined) break
      const attempt = attempts.get(oldest)
      if (attempt !== undefined && nowMs - attempt.windowStart <= ACCEPT_WINDOW_MS) break
      attempts.delete(oldest)
    }
    while (attempts.size > MAX_ACCEPT_BUCKETS) {
      const oldest = attempts.keys().next().value
      if (oldest === undefined) break
      attempts.delete(oldest)
    }
  }

  return {
    limited(req, bucket) {
      const socketIp = (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? 'unknown'
      // XFF is honored only for loopback peers (the tunnel edge). It is
      // untrusted for authentication and never grants access. Only the LAST hop
      // is used: an edge APPENDS the address it saw, so any earlier hop is
      // whatever the client sent — keying on the first one let an attacker
      // rotate the header for a fresh budget per request.
      const hops = typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')
        : []
      const forwarded = (hops[hops.length - 1] ?? '').trim()
      const key = acceptLimitKey(socketIp, forwarded, bucket)
      const nowMs = Date.now()
      prune(nowMs)
      const entry = attempts.get(key)
      if (entry === undefined || nowMs - entry.windowStart > ACCEPT_WINDOW_MS) {
        // Re-insert at the tail so insertion order stays window order.
        attempts.delete(key)
        attempts.set(key, { count: 1, windowStart: nowMs })
        return false
      }
      entry.count += 1
      return entry.count > ACCEPT_MAX_ATTEMPTS
    },
  }
}

/** The fences both route families consult. */
export interface PairingFences {
  /** Loopback-only fence: the desktop panel's control endpoints. */
  loopback(req: IncomingMessage): boolean
  /**
   * Phone-facing fence: loopback, the service's live LAN literals, the
   * configured public host, extra trusted hosts, or dynamically adopted hosts.
   * A navigation relaxes the browser-marker checks for a top-level document
   * navigation (the pairing entry pages), never for an API or subresource.
   */
  lan(req: IncomingMessage, navigation?: boolean): boolean
  /** Adopt a private Host authority this device proved it can reach. */
  remember(host: string): void
}

/** Inputs the phone-facing fence reads per request. */
export interface FenceDeps {
  /** The pairing service whose device table and bases are consulted. */
  service: PairingService
  /** Extra trusted non-loopback hosts (from config or environment). */
  trustedHosts?: readonly string[] | (() => readonly string[])
  /** The one-time grant table behind the /pair-accept → /pair-app redirect. */
  grants: PairGrantStore
}

/**
 * Build the fences.
 * @param deps - the service, extra hosts and grant table.
 * @returns the two fences plus the dynamic-host adoption hook.
 */
export function createPairingFences(deps: FenceDeps): PairingFences {
  const dynamicTrustedHosts = new Set<string>()
  return {
    loopback: req => isTrustedApiRequest(req, []),
    lan: (req, navigation = false) => {
      const publicHost = publicHostOf(deps.service.publicBaseUrl)
      // The service's LAN bases re-read per request: a hot rebind (the lan-bind
      // toggle) updates them mid-process, and the fence must follow.
      const bases = deps.service.lanAddresses
      const extraHosts = typeof deps.trustedHosts === 'function' ? deps.trustedHosts() : (deps.trustedHosts ?? [])
      const combined = [
        ...bases,
        ...(publicHost !== undefined ? [publicHost] : []),
        ...extraHosts,
        ...dynamicTrustedHosts,
      ]
      if (navigation && isTopLevelDocumentNavigation(req) ? isTrustedHost(req, combined) : isTrustedApiRequest(req, combined)) return true

      // A valid paired device cookie (or grant) from a private LAN host means
      // the device proved it can reach this authority (a service restart, a
      // container bridge, a NAT proxy): trust it and remember it.
      const privateLanHost = privateLanHostOf(req, navigation)
      if (privateLanHost !== undefined) {
        const cookieDeviceId = readCookie(req.headers.cookie, deps.service.config.cookieName)
        let queryDeviceId: string | null = null
        let queryGrant: string | undefined
        try {
          const params = new URL(req.url ?? '/', 'http://pair.invalid').searchParams
          queryDeviceId = params.get('device')
          queryGrant = params.get('grant') ?? undefined
        } catch {}
        // The app landing carries a one-time grant instead of the device id;
        // peek (never spend) so the fence can trust an authority whose Host is
        // not among the advertised ones.
        const granted = deps.grants.peek(queryGrant)
        const deviceId = cookieDeviceId ?? queryDeviceId ?? granted ?? undefined
        if (deviceId !== undefined && deps.service.hasDevice(deviceId)) {
          addBounded(dynamicTrustedHosts, privateLanHost, MAX_DYNAMIC_TRUSTED_HOSTS)
          return true
        }
      }
      return false
    },
    remember(host) {
      addBounded(dynamicTrustedHosts, host, MAX_DYNAMIC_TRUSTED_HOSTS)
    },
  }
}
