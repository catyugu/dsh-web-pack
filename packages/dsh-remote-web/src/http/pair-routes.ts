/**
 * The device-operating half of the pairing surface: the `/api/pair` family and
 * the desktop status stream.
 *
 * The webserver matches exact paths before the connection plugin's `/api`
 * prefix, so these handlers own the full response lifecycle and apply their own
 * fence: loopback-only for the control endpoints (issue/stop/revoke/events/
 * lan-bind), loopback-or-advertised for the phone-facing ones (accept/heartbeat/
 * status). The cookie set on accept is the device identity every gated surface
 * enforces.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { UnknownLanAddressError, type PairingService, type PairingSnapshot } from '../pairing/pairing.ts'
import { isLoopbackClient, readCookie } from '../pairing/gate.ts'
import { isJsonObject, readJsonBody, writeJson, deviceCookieOf } from './http.ts'
import { PAIR_PATHS } from './paths.ts'
import { privateLanHostOf, type AcceptRateLimiter, type PairingFences } from './fence.ts'

/** Cap on pairing request bodies (tokens and workspace ids are tiny). */
const MAX_BODY_BYTES = 4096

/** One open desktop status stream. */
interface StatusStream {
  res: ServerResponse
  closed: boolean
}

/** The SSE fan-out for desktop panel status. */
export class PairingEventsStream {
  private readonly streams = new Set<StatusStream>()

  /**
   * @param service - the pairing service whose snapshots are fanned out.
   */
  constructor(service: PairingService) {
    service.onState((snapshot) => { this.push(snapshot) })
  }

  /** Open one stream; the response is owned to completion. */
  open(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    const stream: StatusStream = { res, closed: false }
    this.streams.add(stream)
    const close = (): void => {
      if (stream.closed) return
      stream.closed = true
      this.streams.delete(stream)
    }
    res.on('close', close)
    req.on('close', close)
  }

  /** Push one frame to every open stream (contained per stream). */
  push(snapshot: PairingSnapshot): void {
    const frame = `data: ${JSON.stringify({ type: 'state', ...snapshot })}\n\n`
    for (const stream of this.streams) {
      try {
        stream.res.write(frame)
      } catch {
        stream.closed = true
        this.streams.delete(stream)
      }
    }
  }

  /** Stream count (tests/diagnostics). */
  get size(): number {
    return this.streams.size
  }
}

/** Route-family dependencies (test seam). */
export interface PairRoutesDeps {
  /** The pairing service. */
  service: PairingService
  /** The source/authorization fences. */
  fences: PairingFences
  /** The per-source accept budget. */
  limiter: AcceptRateLimiter
  /** Current desktop gate policy, re-read for every status response. */
  requirePairingForLan?: boolean | (() => boolean)
  /**
   * The row's master switch, re-read per request. When false the pairing
   * endpoints stay mounted (the panel reads the stopped status and can flip
   * the switch back) but every mint is refused with `disabled`, so a disabled
   * row can never hand out a working QR. Defaults to true.
   */
  enabled?: boolean | (() => boolean)
  /**
   * Whether the host currently holds a tunnel token. The settings card cannot
   * read the secret back (the form strips redacted fields), so "already
   * configured" has to come from here — otherwise the card reads its own empty
   * input as "no token" and blocks a perfectly good save. Defaults to false.
   */
  tunnelTokenStored?: () => boolean
  /**
   * LAN-bind facts for the settings card (managed patch block state, live bind
   * host/port, firewall summary). Re-read per request so a hot-reloaded rebind
   * and a fresh toggle round are both reflected without a restart.
   * The route is loopback-only; undefined drops it (tests).
   */
  lanBindStatus?: () => Record<string, unknown>
}

/**
 * The issue payload: an optional non-empty LAN address literal.
 * @param body - the parsed request body.
 * @returns the payload, or undefined when the shape is refused.
 */
function issuePayloadOf(body: unknown): { address?: string } | undefined {
  const record = isJsonObject(body) ? body : {}
  const address = record.address
  if (address === undefined) return {}
  return typeof address === 'string' && address.length > 0 ? { address } : undefined
}

/**
 * The accept payload: the pairing token from the QR link (absent reads as an
 * empty token, which the service then refuses like any other invalid one).
 * @param body - the parsed request body.
 * @returns the payload, or undefined when the shape is refused.
 */
function acceptPayloadOf(body: unknown): { token: string } | undefined {
  const record = isJsonObject(body) ? body : {}
  const token = record.token
  if (token === undefined) return { token: '' }
  return typeof token === 'string' ? { token } : undefined
}

/**
 * The revoke payload: the device id of the session to drop.
 * @param body - the parsed request body.
 * @returns the payload, or undefined when the shape is refused.
 */
function revokePayloadOf(body: unknown): { deviceId: string } | undefined {
  const record = isJsonObject(body) ? body : {}
  const deviceId = record.deviceId
  return typeof deviceId === 'string' && deviceId.length > 0 ? { deviceId } : undefined
}

/**
 * Build the `/api/pair` route family.
 * @param deps - service, fences, limiter and the live settings facts.
 * @returns the exact routes to register on webServer.
 */
export function makePairRoutes(deps: PairRoutesDeps): WebRoute[] {
  const { service, fences } = deps
  const pairingRequired = (): boolean => typeof deps.requirePairingForLan === 'function'
    ? deps.requirePairingForLan()
    : (deps.requirePairingForLan ?? true)
  const isEnabled = (): boolean => typeof deps.enabled === 'function' ? deps.enabled() : (deps.enabled ?? true)
  const tunnelTokenStored = (): boolean => deps.tunnelTokenStored?.() === true
  const events = new PairingEventsStream(service)

  const requireMethod = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (req.method === method) return true
    res.writeHead(405)
    res.end()
    return false
  }

  const handleIssue = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'POST')) return
    if (!fences.loopback(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    // A disabled row keeps its endpoints so the panel can report the stopped
    // state and offer the switch, but it must never mint a redeemable token.
    if (!isEnabled()) {
      writeJson(res, 503, { ok: false, code: 'disabled' })
      return
    }
    const payload = issuePayloadOf(await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true }))
    if (payload === undefined) {
      writeJson(res, 400, { ok: false, code: 'bad-payload' })
      return
    }
    const { address } = payload
    try {
      // The QR link is the official Web GUI itself: after the accept round trip
      // every device — phone or PC — boots the desktop SPA, so the remote
      // surface can never drift from the official one.
      const { token, expiresAt } = service.issue(undefined, address)
      // The default base is the public (tunneled) URL when configured — a phone
      // anywhere can reach it — and the first LAN interface otherwise. An
      // explicit address always names a LAN literal.
      const base = address === undefined ? (service.publicBaseUrl ?? service.lanBaseUrl) : service.lanBaseUrlFor(address)
      if (base === undefined) throw new Error('dsh-remote-web: base unavailable')
      writeJson(res, 200, {
        ok: true,
        url: `${base}/pair-accept?pair=${token}`,
        token,
        expiresAt,
        // Every constructible base, so a multi-homed panel can switch the
        // advertised network without a second round trip.
        lanAddresses: service.lanAddresses,
        // The configured public base, when present — the panel uses it to
        // label the QR as a public (tunneled) link.
        ...(service.publicBaseUrl !== undefined ? { publicBaseUrl: service.publicBaseUrl } : {}),
      })
    } catch (error) {
      // lan-required (no bind) and unknown-address are both configuration
      // mistakes the panel should surface distinctly.
      const unknownAddress = error instanceof UnknownLanAddressError
      writeJson(res, unknownAddress ? 400 : 409, {
        ok: false,
        code: unknownAddress ? 'unknown-address' : 'lan-required',
      })
    }
  }

  const handleAccept = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'POST')) return
    // A private Host authority is admitted for a accept: the phone reached this
    // machine through it, and the token is the credential that authorizes the
    // pairing (container bridges and NAT proxies re-label the Host).
    const privateHost = privateLanHostOf(req)
    if (!fences.lan(req) && privateHost === undefined) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    if (deps.limiter.limited(req, 'api')) {
      writeJson(res, 429, { ok: false, code: 'rate-limited' })
      return
    }
    const payload = acceptPayloadOf(await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true }))
    if (payload === undefined) {
      writeJson(res, 400, { ok: false, code: 'bad-payload' })
      return
    }
    const ua = req.headers['user-agent']
    const result = service.accept(payload.token, typeof ua === 'string' ? ua : undefined)
    if (!result.ok) {
      // A failed accept is refused rather than explained to a caller the fence
      // does not serve.
      if (!fences.lan(req)) {
        writeJson(res, 403, { ok: false, code: 'forbidden' })
        return
      }
      writeJson(res, 404, { ok: false, code: result.code })
      return
    }
    if (privateHost !== undefined) fences.remember(privateHost)
    // The Secure attribute follows the transport (deviceCookieOf): off on
    // plain-HTTP LAN, where a Secure cookie is dropped by the browser, and on
    // for a tunneled request the edge stamped as https.
    writeJson(res, 200, { ok: true, deviceId: result.deviceId }, {
      'set-cookie': [deviceCookieOf(req, service.config.cookieName, result.deviceId)],
    })
  }

  const handleStop = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'POST')) return
    if (!fences.loopback(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    // The body is drained (the desktop sends none) and ignored: stop takes no
    // payload, and reading it keeps the connection reusable.
    await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true })
    service.stop()
    writeJson(res, 200, { ok: true })
  }

  const handleRevoke = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'POST')) return
    if (!fences.loopback(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    const payload = revokePayloadOf(await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true }))
    if (payload === undefined) {
      writeJson(res, 400, { ok: false, code: 'bad-payload' })
      return
    }
    if (!service.revoke(payload.deviceId)) {
      writeJson(res, 404, { ok: false, code: 'unknown-device' })
      return
    }
    writeJson(res, 200, { ok: true })
  }

  const handleHeartbeat = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'POST')) return
    if (!fences.lan(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    // The phone's heartbeat carries no payload; the body is drained so the
    // connection stays reusable.
    await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true })
    const deviceId = readCookie(req.headers.cookie, service.config.cookieName)
    if (deviceId === undefined || !service.heartbeat(deviceId)) {
      writeJson(res, 401, { ok: false, code: 'unpaired' })
      return
    }
    writeJson(res, 200, { ok: true })
  }

  const handleStatus = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'GET')) return
    if (!fences.lan(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    const deviceId = readCookie(req.headers.cookie, service.config.cookieName)
    const paired = deviceId !== undefined && service.hasDevice(deviceId)
    // The desktop (loopback) keeps the full pairing-relevant view; the LAN IP
    // literals stay behind a live pairing or loopback so an unauthenticated
    // caller on a tunnel cannot map the internal network.
    const local = isLoopbackClient(req)
    const snapshot = service.snapshot()
    // Unpaired LAN/tunnel clients get only the pairing-relevant fields; the
    // token expiry, public tunnel URL, and counts are an oracle for targeting
    // and stay behind a live device cookie. The per-device roster (ids are
    // session credentials) is never returned here — only the loopback events
    // stream carries it to the desktop panel.
    const { devices: _devices, ...rest } = snapshot
    const visible = paired || local
      ? { ...rest, tunnelTokenStored: tunnelTokenStored() }
      : { phase: snapshot.phase, lanAvailable: snapshot.lanAvailable }
    writeJson(res, 200, { ok: true, paired, requirePairingForLan: pairingRequired(), ...visible })
  }

  const handleEvents = (req: IncomingMessage, res: ServerResponse): void => {
    if (!requireMethod(req, res, 'GET')) return
    if (!fences.loopback(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    events.open(req, res)
    // Snapshot on open: a late-opening panel converges without history.
    events.push(service.snapshot())
  }

  /** LAN-bind facts for the settings card; loopback-only, read per request. */
  const handleLanBind = (req: IncomingMessage, res: ServerResponse): void => {
    if (!requireMethod(req, res, 'GET')) return
    if (!fences.loopback(req)) {
      writeJson(res, 403, { ok: false, code: 'forbidden' })
      return
    }
    writeJson(res, 200, { ok: true, ...(deps.lanBindStatus?.() ?? {}) })
  }

  const routes: WebRoute[] = [
    { kind: 'exact', path: PAIR_PATHS.issue, handler: handleIssue },
    { kind: 'exact', path: PAIR_PATHS.accept, handler: handleAccept },
    { kind: 'exact', path: PAIR_PATHS.stop, handler: handleStop },
    { kind: 'exact', path: PAIR_PATHS.revoke, handler: handleRevoke },
    { kind: 'exact', path: PAIR_PATHS.heartbeat, handler: handleHeartbeat },
    { kind: 'exact', path: PAIR_PATHS.status, handler: handleStatus },
    { kind: 'exact', path: PAIR_PATHS.events, handler: handleEvents },
  ]
  if (deps.lanBindStatus !== undefined) {
    routes.push({ kind: 'exact', path: PAIR_PATHS.lanBind, handler: handleLanBind })
  }
  return routes
}
