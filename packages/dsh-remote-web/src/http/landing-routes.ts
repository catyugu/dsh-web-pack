/**
 * The phone-facing landing pages: the QR entry (`/pair-accept`), the cookieless
 * app landing (`/pair-app`), and the reopen service worker.
 *
 * The entry is reached with a one-time grant, never with the device id itself:
 * /pair-accept mints a short-lived, single-consume grant and redirects to
 * /pair-app?grant=<g>, and only the landing's own response carries the device
 * credential into the shell. The device cookie stays the primary credential;
 * the grant only keeps a live session credential out of the URL, the address
 * bar, and every log on the redirect path.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { PairingService } from '../pairing/pairing.ts'
import { readCookie } from '../pairing/gate.ts'
import type { PairGrantStore } from '../pairing/pair-grant.ts'
import { deviceCookieOf, isHttpsRequest } from './http.ts'
import { PAIR_PATHS } from './paths.ts'
import { appServiceWorkerScript } from './reopen-worker.ts'
import { REMOTE_HOST_GRANT_GLOBAL } from './remote-channel-rules.ts'
import { logEntryRefusal, privateLanHostOf, type AcceptRateLimiter, type PairingFences } from './fence.ts'

/** The storage key the capture script writes the device credential to. */
export const APP_DEVICE_STORAGE_KEY = 'dsh-remote-device'

/**
 * The cookieless device credential: pass the device id from the /pair-app URL
 * into sessionStorage (and localStorage for tab reloads) before any app script
 * runs — same key the boot patch and the channel gate read. The replaceState
 * to '/' hides the credential URL from the address bar and leaves the SPA at
 * its canonical root path. The reopen service worker is registered in the same
 * breath: later navigations to '/' (history, bookmark, tab restore) must not
 * fall through to the harness index gate, which the cookieless flow can never
 * satisfy.
 * @param deviceId - the device session id to hand the shell.
 * @returns the inline script.
 */
export function appShellCaptureScript(deviceId: string): string {
  const safeId = JSON.stringify(deviceId)
  const grantGlobal = JSON.stringify(REMOTE_HOST_GRANT_GLOBAL)
  const register = `try{if('serviceWorker' in navigator){navigator.serviceWorker.register(${JSON.stringify(PAIR_PATHS.appServiceWorker)},{scope:'/'}).catch(function(e){})}}catch(e){}`
  return `<script>(function(){try{sessionStorage.setItem(${JSON.stringify(APP_DEVICE_STORAGE_KEY)},${safeId});}catch(e){}try{history.replaceState(null,'','/')}catch(e){}try{window[${grantGlobal}]=true}catch(e){}${register}})()</script>`
}

/**
 * Patch the official index document with the device-capture script. The script
 * goes immediately after the opening <head> tag, ahead of the harness-injected
 * parse-time channel boot patch: that patch installs the transport host-mode
 * hook only when this server-served marker is already set, so host mode is
 * granted by the device-gated landing instead of being asserted from the origin.
 * @param html - the official shell.
 * @param deviceId - the device session id to hand it.
 * @returns the patched shell.
 */
export function patchAppShell(html: string, deviceId: string): string {
  const script = appShellCaptureScript(deviceId)
  const head = /<head[^>]*>/i.exec(html)
  if (head === null) return script + html
  const end = head.index + head[0].length
  return html.slice(0, end) + script + html.slice(end)
}

/**
 * The dead-end guard for a failed /pair-accept and for a dead reopen (the
 * reopen service worker serves this page at `/` when the pairing no longer
 * passes): a device without a live pairing has no harness browser-auth cookie,
 * so a redirect to bare `/` would land on the harness browser-auth 401 page
 * ("authentication required"), which reads like a broken server. Serve a plain
 * bilingual explanation instead; an already-paired device keeps the old
 * behavior and is sent on to the app.
 * @returns the refusal page.
 */
function pairingFailurePage(): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    '<title>Pairing link invalid</title></head>',
    '<body style="font-family:system-ui,sans-serif;padding:24px;max-width:32em;margin:0 auto;line-height:1.6">',
    '<p><strong>配对已失效，或配对链接已过期。</strong></p>',
    '<p>请在桌面端打开远程控制面板，刷新二维码后重新扫码；重新配对后本机即可恢复访问。</p>',
    '<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">',
    '<p><strong>This pairing has expired or the link is no longer valid.</strong></p>',
    '<p>Open the remote panel on the desktop, refresh the QR code, and scan again — re-pairing restores access on this device.</p>',
    '</body></html>',
  ].join('')
}

/**
 * The request origin (https when a tunnel edge says so).
 * @param req - the request whose origin is rebuilt.
 * @returns the origin URL.
 */
function appOrigin(req: IncomingMessage): string {
  const origin = `http://${req.headers.host ?? '127.0.0.1'}`
  return isHttpsRequest(req) ? origin.replace('http://', 'https://') : origin
}

/** Landing-page dependencies (test seam). */
export interface LandingRoutesDeps {
  /** The pairing service. */
  service: PairingService
  /** The source/authorization fences. */
  fences: PairingFences
  /** The per-source accept budget. */
  limiter: AcceptRateLimiter
  /** The one-time grant table behind the /pair-accept → /pair-app redirect. */
  grants: PairGrantStore
  /**
   * The official index document to serve on the /pair-app landing. The plugin
   * fetches it from the inner loopback with its own credential and patches it
   * with the device-capture script, so a paired device loads the app shell
   * WITHOUT passing the harness index gate. Undefined drops the landing and its
   * service worker (tests).
   */
  indexDocument?: (deviceId: string) => Promise<string | undefined>
}

/**
 * Build the phone-facing page routes.
 * @param deps - service, fences, limiter, grants and the shell source.
 * @returns the exact routes to register on webServer.
 */
export function makeLandingRoutes(deps: LandingRoutesDeps): WebRoute[] {
  const { service, fences, grants } = deps

  const requireMethod = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (req.method === method) return true
    res.writeHead(405)
    res.end()
    return false
  }

  const refusePlain = (res: ServerResponse, text: string, status = 403): void => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(text)
  }

  /**
   * The QR entry: navigate here with ?pair=<token>. Sets the device cookie,
   * then redirects to the app landing on a one-time grant, so a LAN device that
   * has never seen this authority boots the paired official UI in one chain.
   */
  const handleAcceptPage = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'GET')) return
    const privateHost = privateLanHostOf(req, true)
    if (!fences.lan(req, true) && privateHost === undefined) {
      logEntryRefusal(req, PAIR_PATHS.acceptPage, 'untrusted-host')
      refusePlain(res, 'forbidden')
      return
    }
    if (deps.limiter.limited(req, 'page')) {
      refusePlain(res, 'rate limited', 429)
      return
    }
    const url = new URL(req.url ?? '/', 'http://pair.invalid')
    const token = url.searchParams.get('pair') ?? ''
    const ua = req.headers['user-agent']
    const result = token === '' ? { ok: false as const, code: 'invalid' as const } : service.accept(token, typeof ua === 'string' ? ua : undefined)
    if (!result.ok) {
      if (!fences.lan(req, true)) {
        logEntryRefusal(req, PAIR_PATHS.acceptPage, 'untrusted-host-after-invalid-token')
        refusePlain(res, 'forbidden')
        return
      }
      // accept() refuses only expired/unknown/stopped tokens: a consumed token
      // stays re-usable until its expiry or replacement, so a mobile flow that
      // split across cookie contexts (camera preview, in-app browser, system
      // browser) can re-pair from the same link. A failure here means the link
      // is truly dead: an already-paired device is sent on to the app, everyone
      // else gets the bilingual explanation page instead of the harness 401
      // dead end.
      const deviceId = readCookie(req.headers.cookie, service.config.cookieName)
      if (deviceId !== undefined && service.hasDevice(deviceId)) {
        const { grant } = grants.issue(deviceId)
        res.writeHead(303, { location: `${appOrigin(req)}/pair-app?grant=${encodeURIComponent(grant)}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
      res.end(pairingFailurePage())
      return
    }
    if (privateHost !== undefined) fences.remember(privateHost)
    // Land the paired device on the cookieless app page: the official shell
    // served by this plugin. The URL carries a one-time grant, never the device
    // id — a session credential must not travel in a URL — and the landing's
    // own response hands the device id to the shell.
    const { grant } = grants.issue(result.deviceId)
    res.writeHead(303, {
      location: `${appOrigin(req)}/pair-app?grant=${encodeURIComponent(grant)}`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'set-cookie': [deviceCookieOf(req, service.config.cookieName, result.deviceId)],
    })
    res.end()
  }

  /**
   * The cookieless app landing. A paired device (a one-time grant minted by
   * /pair-accept, or a live pairing cookie on a reopen) receives the official
   * index shell patched with the device-capture script; the shell itself is the
   * official document and carries no data, so serving it needs only the device
   * credential.
   */
  const handleAppPage = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!requireMethod(req, res, 'GET')) return
    if (!fences.lan(req, true)) {
      logEntryRefusal(req, PAIR_PATHS.appPage, 'untrusted-host')
      refusePlain(res, 'forbidden')
      return
    }
    if (deps.limiter.limited(req, 'page')) {
      refusePlain(res, 'rate limited', 429)
      return
    }
    const url = new URL(req.url ?? '/', 'http://pair.invalid')
    // The one-time grant is spent before anything else: a replayed or expired
    // grant resolves to nothing, so a leaked landing URL can never be re-run.
    // The cookie stays the primary credential for a reopen (the service
    // worker's network-first navigation carries it).
    const grantedDevice = grants.consume(url.searchParams.get('grant') ?? undefined)
    const cookieDevice = readCookie(req.headers.cookie, service.config.cookieName)
    const id = (grantedDevice !== undefined && service.touchDevice(grantedDevice))
      ? grantedDevice
      : (cookieDevice !== undefined && service.touchDevice(cookieDevice))
        ? cookieDevice
        : undefined
    if (id === undefined) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
      res.end(pairingFailurePage())
      return
    }
    const html = await deps.indexDocument?.(id).catch(() => undefined)
    if (html === undefined) {
      refusePlain(res, 'remote device app unavailable', 502)
      return
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'set-cookie': [deviceCookieOf(req, service.config.cookieName, id)],
    })
    res.end(patchAppShell(html, id))
  }

  /**
   * The reopen service worker script. Same phone-facing fence as the app page
   * but no rate limit and no device check: the script is inert logic (no
   * secrets, no data), and browsers re-fetch it on navigations for update
   * checks, which must not trip a brute-force budget. no-store keeps the update
   * check meaningful across deploys.
   */
  const handleAppServiceWorker = (req: IncomingMessage, res: ServerResponse): void => {
    if (!requireMethod(req, res, 'GET')) return
    if (!fences.lan(req, true)) {
      refusePlain(res, 'forbidden')
      return
    }
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      // Defensive: the root-level script path already allows a `/` scope, the
      // header keeps that explicit for engines that want it stated.
      'service-worker-allowed': '/',
    })
    res.end(appServiceWorkerScript())
  }

  const routes: WebRoute[] = [
    { kind: 'exact', path: PAIR_PATHS.acceptPage, handler: handleAcceptPage },
  ]
  if (deps.indexDocument !== undefined) {
    routes.push({ kind: 'exact', path: PAIR_PATHS.appPage, handler: handleAppPage })
    // The reopen worker is only meaningful when the app landing it re-serves
    // exists (same condition as /pair-app).
    routes.push({ kind: 'exact', path: PAIR_PATHS.appServiceWorker, handler: handleAppServiceWorker })
  }
  return routes
}
