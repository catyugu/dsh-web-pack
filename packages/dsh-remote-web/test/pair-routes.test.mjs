/**
 * The remote-access HTTP contract: which path answers what, over which
 * transport, with which body. These are the routes a phone and the desktop
 * panel depend on, so they are pinned before the internal rewrite: a
 * refactor may move the code, never the wire.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PairingService } from '../src/pairing/pairing.ts'
import { makeRoutes, PAIR_PATHS } from '../src/http/routes.ts'
import { callRoute } from './support.mjs'

const NOW = 1_700_000_000_000

/**
 * A loopback-reachable service with a frozen clock.
 * @param {object} [options] - service overrides.
 * @param {boolean} [options.reachable] - whether a public base exists at all.
 * @returns {PairingService} the service.
 */
function makeService({ reachable = true } = {}) {
  const service = new PairingService({
    tokenTtlMs: 60_000,
    offlineAfterMs: 25_000,
    cookieName: 'dsh_pair',
    devicesFile: undefined,
  }, {
    now: () => NOW,
    randomToken: () => Math.random().toString(16).slice(2),
  })
  if (reachable) service.setPublicBaseUrl('https://phone.example')
  return service
}

/**
 * Register the route family and index it by path.
 * @param {PairingService} service - the pairing service.
 * @param {object} [overrides] - extra route dependencies.
 * @returns {Map<string, Function>} one handler per exact path.
 */
function routesOf(service, overrides = {}) {
  const routes = makeRoutes({
    service,
    tunnelTokenStored: () => true,
    lanBindStatus: () => ({ profile: 'web', setting: null }),
    indexDocument: async (deviceId) => `<!doctype html><html><head><title>shell</title></head><body>${deviceId}</body></html>`,
    ...overrides,
  })
  return new Map(routes.map((route) => [route.path, route.handler]))
}

/** A request from the desktop at loopback. */
const desktop = { remoteAddress: '127.0.0.1', headers: { host: '127.0.0.1:3080' } }

/** A request from a LAN phone whose authority the service advertises. */
const lan = { remoteAddress: '192.168.1.9', headers: { host: '192.168.1.5:3080' } }

/** Pair one device through the service and return its id. */
function pairDevice(service) {
  const { token } = service.issue()
  const result = service.accept(token)
  assert.equal(result.ok, true)
  return result.deviceId
}

test('the issue route mints a QR link, and only for the desktop', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const response = await callRoute(routes.get(PAIR_PATHS.issue), { ...desktop, method: 'POST', body: {} })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json.ok, true)
  assert.match(response.json.token, /^[0-9a-f]+$/)
  assert.equal(response.json.url, `https://phone.example/pair-accept?pair=${response.json.token}`)
  assert.equal(response.json.expiresAt, NOW + 60_000)
  assert.deepEqual(response.json.lanAddresses, [])

  const refused = await callRoute(routes.get(PAIR_PATHS.issue), { ...lan, method: 'POST', body: {} })
  assert.equal(refused.statusCode, 403)
  assert.equal(refused.json.code, 'forbidden')

  const wrongMethod = await callRoute(routes.get(PAIR_PATHS.issue), { ...desktop })
  assert.equal(wrongMethod.statusCode, 405)

  const disabled = routesOf(service, { enabled: () => false })
  const stopped = await callRoute(disabled.get(PAIR_PATHS.issue), { ...desktop, method: 'POST', body: {} })
  assert.equal(stopped.statusCode, 503)
  assert.equal(stopped.json.code, 'disabled')
})

test('an unknown LAN address is a bad request, a base-less service is lan-required', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const routes = routesOf(service)

  const unknown = await callRoute(routes.get(PAIR_PATHS.issue), {
    ...desktop,
    method: 'POST',
    body: { address: '10.9.9.9' },
  })
  assert.equal(unknown.statusCode, 400)
  assert.equal(unknown.json.code, 'unknown-address')

  const choosable = await callRoute(routes.get(PAIR_PATHS.issue), {
    ...desktop,
    method: 'POST',
    body: { address: '192.168.1.5' },
  })
  assert.equal(choosable.statusCode, 200)
  assert.match(choosable.json.url, /^http:\/\/192\.168\.1\.5:3080\/pair-accept\?pair=/)

  const unreachable = makeService({ reachable: false })
  const missing = await callRoute(routesOf(unreachable).get(PAIR_PATHS.issue), { ...desktop, method: 'POST', body: {} })
  assert.equal(missing.statusCode, 409)
  assert.equal(missing.json.code, 'lan-required')
})

test('accept mints the device cookie, and the transport decides Secure', async () => {
  const service = makeService()
  const routes = routesOf(service)
  const { token } = service.issue()

  const accepted = await callRoute(routes.get(PAIR_PATHS.accept), { ...desktop, method: 'POST', body: { token } })
  assert.equal(accepted.statusCode, 200)
  const [cookie] = accepted.cookies
  assert.match(cookie, /^dsh_pair=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/)

  const { token: secondToken } = service.issue()
  const tls = await callRoute(routes.get(PAIR_PATHS.accept), {
    ...desktop,
    method: 'POST',
    body: { token: secondToken },
    headers: { ...desktop.headers, 'x-forwarded-proto': 'https' },
  })
  assert.match(tls.cookies[0], /; Secure$/)

  const invalid = await callRoute(routes.get(PAIR_PATHS.accept), { ...desktop, method: 'POST', body: { token: 'nope' } })
  assert.equal(invalid.statusCode, 404)
  assert.equal(invalid.json.code, 'invalid')
})

test('the accept route is rate limited per source address', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const routes = routesOf(service)
  const handler = routes.get(PAIR_PATHS.accept)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await callRoute(handler, { ...lan, method: 'POST', body: { token: 'guess' } })
    assert.equal(response.statusCode, 404)
  }
  const limited = await callRoute(handler, { ...lan, method: 'POST', body: { token: 'guess' } })
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.json.code, 'rate-limited')
})

test('heartbeat answers only for a live device cookie', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const routes = routesOf(service)
  const deviceId = pairDevice(service)

  const live = await callRoute(routes.get(PAIR_PATHS.heartbeat), {
    ...lan,
    method: 'POST',
    body: {},
    headers: { ...lan.headers, cookie: `dsh_pair=${deviceId}` },
  })
  assert.equal(live.statusCode, 200)

  const anonymous = await callRoute(routes.get(PAIR_PATHS.heartbeat), { ...lan, method: 'POST', body: {} })
  assert.equal(anonymous.statusCode, 401)
  assert.equal(anonymous.json.code, 'unpaired')
})

test('status gives the desktop the full view and the LAN only its pairing facts', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const deviceId = pairDevice(service)
  const routes = routesOf(service)

  const local = await callRoute(routes.get(PAIR_PATHS.status), { ...desktop })
  assert.equal(local.statusCode, 200)
  assert.equal(local.json.paired, false)
  assert.equal(local.json.phase, 'connected')
  assert.deepEqual(local.json.lanAddresses, ['192.168.1.5'])
  assert.equal(local.json.tunnelTokenStored, true)
  assert.equal(local.json.devices, undefined)
  assert.equal(local.json.requirePairingForLan, true)

  const remote = await callRoute(routes.get(PAIR_PATHS.status), {
    ...lan,
    headers: { ...lan.headers, cookie: `dsh_pair=${deviceId}` },
  })
  assert.equal(remote.statusCode, 200)
  assert.equal(remote.json.paired, true)
  assert.deepEqual(remote.json.lanAddresses, ['192.168.1.5'])

  const anonymous = await callRoute(routes.get(PAIR_PATHS.status), { ...lan })
  assert.equal(anonymous.statusCode, 200)
  assert.deepEqual(Object.keys(anonymous.json).sort(), ['lanAvailable', 'ok', 'paired', 'phase', 'requirePairingForLan'])
})

test('revoke and stop are desktop-only and report what they did', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const unknown = await callRoute(routes.get(PAIR_PATHS.revoke), { ...desktop, method: 'POST', body: { deviceId: 'ghost' } })
  assert.equal(unknown.statusCode, 404)
  assert.equal(unknown.json.code, 'unknown-device')

  const deviceId = pairDevice(service)
  const revoked = await callRoute(routes.get(PAIR_PATHS.revoke), { ...desktop, method: 'POST', body: { deviceId } })
  assert.equal(revoked.statusCode, 200)
  assert.equal(service.hasDevice(deviceId), false)

  const refused = await callRoute(routes.get(PAIR_PATHS.stop), { ...lan, method: 'POST', body: {} })
  assert.equal(refused.statusCode, 403)

  const stopped = await callRoute(routes.get(PAIR_PATHS.stop), { ...desktop, method: 'POST', body: {} })
  assert.equal(stopped.statusCode, 200)
  assert.equal(service.snapshot().phase, 'stopped')
})

test('the QR entry hands the app a one-time grant, never the device id', async () => {
  const service = makeService()
  const routes = routesOf(service)
  const { token } = service.issue()

  const accept = await callRoute(routes.get(PAIR_PATHS.acceptPage), {
    ...desktop,
    url: `/pair-accept?pair=${token}`,
    headers: { ...desktop.headers, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(accept.statusCode, 303)
  assert.match(accept.headers.location, /^http:\/\/127\.0\.0\.1:3080\/pair-app\?grant=[A-Za-z0-9_-]+$/)
  const [deviceCookie] = accept.cookies
  assert.match(deviceCookie, /^dsh_pair=[^;]+;/)

  const location = new URL(accept.headers.location)
  const landing = await callRoute(routes.get(PAIR_PATHS.appPage), {
    ...desktop,
    url: `${location.pathname}${location.search}`,
    headers: { ...desktop.headers, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(landing.statusCode, 200)
  assert.match(landing.headers['content-type'], /text\/html/)
  assert.match(landing.text, /sessionStorage\.setItem\("dsh-remote-device",/)
  assert.match(landing.text, /history\.replaceState\(null,'','\/'\)/)
  assert.doesNotMatch(landing.text, /\?device=/)

  const replay = await callRoute(routes.get(PAIR_PATHS.appPage), {
    ...desktop,
    url: `${location.pathname}${location.search}`,
    headers: { ...desktop.headers, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(replay.statusCode, 200)
  assert.match(replay.text, /Pairing link invalid/)
})

test('the reopen worker is served next to the landing, with a root scope', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const worker = await callRoute(routes.get(PAIR_PATHS.appServiceWorker), {
    ...desktop,
    url: PAIR_PATHS.appServiceWorker,
    headers: { ...desktop.headers, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(worker.statusCode, 200)
  assert.match(worker.headers['content-type'], /text\/javascript/)
  assert.equal(worker.headers['service-worker-allowed'], '/')
  assert.match(worker.text, /dsh-remote-shell-v1/)
})

test('the desktop status stream opens with a snapshot frame', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const stream = await callRoute(routes.get(PAIR_PATHS.events), { ...desktop })
  assert.equal(stream.statusCode, 200)
  assert.match(stream.headers['content-type'], /text\/event-stream/)
  const [frame] = stream.text.split('\n\n')
  assert.match(frame, /^data: /)
  const payload = JSON.parse(frame.slice('data: '.length))
  assert.equal(payload.type, 'state')
  assert.equal(payload.phase, 'stopped')
})

test('lan-bind facts are loopback-only', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const local = await callRoute(routes.get(PAIR_PATHS.lanBind), { ...desktop })
  assert.equal(local.statusCode, 200)
  assert.equal(local.json.profile, 'web')

  const remote = await callRoute(routes.get(PAIR_PATHS.lanBind), { ...lan })
  assert.equal(remote.statusCode, 403)
})
