/**
 * The remote-access surface, end to end: the pairing API over the routes a
 * desktop and a phone actually call, the gated `/remote` channel with real
 * loopback upstreams, and the mounted row following a live settings save.
 *
 * These are the wire contracts a refactor must never move, so they are pinned
 * here rather than per module.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'
import { PairingService } from '../src/pairing/pairing.ts'
import { PAIR_PATHS } from '../src/http/paths.ts'
import { makeRoutes } from '../src/http/routes.ts'
import { makeRemoteApiRoutes } from '../src/http/remote-api.ts'
import { apply, inject, name } from '../lib/host.js'
import { REMOTE_WEB_UI_PAIRING } from '../src/pairing/pairing-access.ts'
import { callRoute, RouteResponse, routeRequest } from './support.mjs'

const NOW = 1_700_000_000_000

/**
 * A loopback-reachable service with a frozen clock.
 * @param {object} [options] - service options.
 * @param {boolean} [options.reachable] - whether any base exists.
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

/** Pair one device through the service and return its id. */
function pairDevice(service) {
  const { token } = service.issue()
  const result = service.accept(token)
  assert.equal(result.ok, true)
  return result.deviceId
}

/**
 * Register the route family and index it by path.
 * @param {PairingService} service - the service.
 * @param {object} [overrides] - extra route dependencies.
 * @returns {Array<object>} the routes.
 */
function routesOf(service, overrides = {}) {
  return makeRoutes({
    service,
    tunnelTokenStored: () => true,
    lanBindStatus: () => ({ profile: 'web', setting: null }),
    indexDocument: async (deviceId) => `<!doctype html><html><head><title>shell</title></head><body>${deviceId}</body></html>`,
    ...overrides,
  })
}

/**
 * Call one route from a recorded table.
 * @param {Array<object>} routes - the routes.
 * @param {string} path - the path to call.
 * @param {object} init - request fields.
 * @returns {Promise<RouteResponse>} the response.
 */
async function call(routes, path, init) {
  const route = routes.find(candidate => candidate.path === path)
  assert.ok(route, `no route registered for ${path}`)
  return callRoute(route.handler, init, new RouteResponse())
}

/** A desktop request (loopback socket and Host). */
const desktop = { remoteAddress: '127.0.0.1', headers: { host: '127.0.0.1:3080' } }
/** A phone request whose authority the service advertises. */
const lan = { remoteAddress: '192.168.1.9', headers: { host: '192.168.1.5:3080' } }

test('the QR is minted for the desktop only, and names a reachable base', async () => {
  const service = makeService()
  const routes = routesOf(service)

  const issued = await call(routes, PAIR_PATHS.issue, { ...desktop, method: 'POST', body: {} })
  assert.equal(issued.statusCode, 200)
  assert.equal(issued.json.url, `https://phone.example/pair-accept?pair=${issued.json.token}`)
  assert.equal(issued.json.expiresAt, NOW + 60_000)
  assert.deepEqual(issued.json.lanAddresses, [])

  assert.equal((await call(routes, PAIR_PATHS.issue, { ...lan, method: 'POST', body: {} })).statusCode, 403)
  assert.equal((await call(routes, PAIR_PATHS.issue, { ...desktop })).statusCode, 405)
  assert.equal((await call(routesOf(service, { enabled: () => false }), PAIR_PATHS.issue, { ...desktop, method: 'POST', body: {} })).statusCode, 503)

  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const unknown = await call(routes, PAIR_PATHS.issue, { ...desktop, method: 'POST', body: { address: '10.9.9.9' } })
  assert.equal(unknown.json.code, 'unknown-address')
  const choosable = await call(routes, PAIR_PATHS.issue, { ...desktop, method: 'POST', body: { address: '192.168.1.5' } })
  assert.match(choosable.json.url, /^http:\/\/192\.168\.1\.5:3080\/pair-accept\?pair=/)
  const missing = await call(routesOf(makeService({ reachable: false })), PAIR_PATHS.issue, { ...desktop, method: 'POST', body: {} })
  assert.equal(missing.statusCode, 409)
})

test('accept sets the device cookie on its transport, within a per-source budget', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const routes = routesOf(service)
  const { token } = service.issue()

  const accepted = await call(routes, PAIR_PATHS.accept, { ...desktop, method: 'POST', body: { token } })
  assert.equal(accepted.statusCode, 200)
  assert.match(accepted.cookies[0], /^dsh_pair=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/)
  const { token: tlsToken } = service.issue()
  const tls = await call(routes, PAIR_PATHS.accept, {
    ...desktop,
    method: 'POST',
    body: { token: tlsToken },
    headers: { ...desktop.headers, 'x-forwarded-proto': 'https' },
  })
  assert.match(tls.cookies[0], /; Secure$/)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await call(routes, PAIR_PATHS.accept, { ...lan, method: 'POST', body: { token: 'guess' } })).statusCode, 404)
  }
  const limited = await call(routes, PAIR_PATHS.accept, { ...lan, method: 'POST', body: { token: 'guess' } })
  assert.equal(limited.statusCode, 429)
})

test('status splits the view by credential, and a heartbeat needs a live device', async () => {
  const service = makeService()
  service.setLanBases([{ address: '192.168.1.5', base: 'http://192.168.1.5:3080' }])
  const deviceId = pairDevice(service)
  const routes = routesOf(service)

  const local = await call(routes, PAIR_PATHS.status, { ...desktop })
  assert.equal(local.json.phase, 'connected')
  assert.deepEqual(local.json.lanAddresses, ['192.168.1.5'])
  assert.equal(local.json.tunnelTokenStored, true)
  assert.equal(local.json.devices, undefined)

  const remote = await call(routes, PAIR_PATHS.status, { ...lan, headers: { ...lan.headers, cookie: `dsh_pair=${deviceId}` } })
  assert.equal(remote.json.paired, true)

  const anonymous = await call(routes, PAIR_PATHS.status, { ...lan })
  assert.deepEqual(Object.keys(anonymous.json).sort(), ['lanAvailable', 'ok', 'paired', 'phase', 'requirePairingForLan'])

  const live = await call(routes, PAIR_PATHS.heartbeat, { ...lan, method: 'POST', body: {}, headers: { ...lan.headers, cookie: `dsh_pair=${deviceId}` } })
  assert.equal(live.statusCode, 200)
  const unpaired = await call(routes, PAIR_PATHS.heartbeat, { ...lan, method: 'POST', body: {} })
  assert.equal(unpaired.statusCode, 401)
})

test('the switch pauses, the stop action unpairs, and the stream stays on the desktop', async () => {
  const service = makeService()
  const routes = routesOf(service)

  assert.equal((await call(routes, PAIR_PATHS.revoke, { ...desktop, method: 'POST', body: { deviceId: 'ghost' } })).json.code, 'unknown-device')
  const revokedId = pairDevice(service)
  const keptId = pairDevice(service)
  assert.equal((await call(routes, PAIR_PATHS.revoke, { ...desktop, method: 'POST', body: { deviceId: revokedId } })).statusCode, 200)
  assert.equal(service.hasDevice(revokedId), false)

  // The master switch is a pause: no QR, no open streams, pairings kept.
  service.pause()
  assert.equal(service.hasDevice(keptId), true, 'pausing keeps the pairing')
  assert.equal(service.activeToken(), undefined, 'pausing drops the QR token')
  const paused = routesOf(service, { enabled: () => false })
  assert.equal((await call(paused, PAIR_PATHS.status, { ...desktop })).json.phase, 'stopped')
  assert.equal(service.deviceCount(), 1, 'the paused row still has its device')

  // The stop action is the explicit one that forgets the devices.
  assert.equal((await call(routes, PAIR_PATHS.stop, { ...lan, method: 'POST', body: {} })).statusCode, 403)
  assert.equal((await call(routes, PAIR_PATHS.stop, { ...desktop, method: 'POST', body: {} })).statusCode, 200)
  assert.equal(service.hasDevice(keptId), false)

  assert.equal((await call(routes, PAIR_PATHS.lanBind, { ...lan })).statusCode, 403)
  assert.equal((await call(routes, PAIR_PATHS.lanBind, { ...desktop })).json.profile, 'web')

  const stream = await call(routes, PAIR_PATHS.events, { ...desktop })
  assert.match(stream.headers['content-type'], /text\/event-stream/)
  const payload = JSON.parse(stream.text.slice('data: '.length).split('\n\n')[0])
  assert.equal(payload.type, 'state')
})

test('the QR entry hands the app a one-time grant, never the device id', async () => {
  const service = makeService()
  const routes = routesOf(service)
  const { token } = service.issue()
  const navigation = { ...desktop, headers: { ...desktop.headers, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } }

  const accept = await call(routes, PAIR_PATHS.acceptPage, { ...navigation, url: `/pair-accept?pair=${token}` })
  assert.equal(accept.statusCode, 303)
  assert.match(accept.headers.location, /^http:\/\/127\.0\.0\.1:3080\/pair-app\?grant=[A-Za-z0-9_-]+$/)
  assert.match(accept.cookies[0], /^dsh_pair=[^;]+;/)

  const location = new URL(accept.headers.location)
  const landing = await call(routes, PAIR_PATHS.appPage, { ...navigation, url: `${location.pathname}${location.search}` })
  assert.equal(landing.statusCode, 200)
  assert.match(landing.text, /sessionStorage\.setItem\("dsh-remote-device",/)
  assert.doesNotMatch(landing.text, /\?device=/)

  const replay = await call(routes, PAIR_PATHS.appPage, { ...navigation, url: `${location.pathname}${location.search}` })
  assert.match(replay.text, /Pairing link invalid/)

  const worker = await call(routes, PAIR_PATHS.appServiceWorker, { ...navigation, url: PAIR_PATHS.appServiceWorker })
  assert.equal(worker.headers['service-worker-allowed'], '/')
  assert.match(worker.text, /dsh-remote-shell-v1/)
})

/**
 * Listen on an ephemeral loopback port.
 * @param {http.Server} server - the server.
 * @returns {Promise<number>} the bound port.
 */
function listen(server) {
  return new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(server.address().port) }) })
}

test('the gated channel refuses the unpaired and re-issues the paired to loopback', async () => {
  const service = makeService()
  const innerRequests = []
  const inner = http.createServer((req, res) => {
    innerRequests.push({ url: req.url, headers: req.headers })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
  })
  const innerPort = await listen(inner)
  let enabled = true
  const [route] = makeRemoteApiRoutes({
    service,
    port: innerPort,
    enabled: () => enabled,
    auth: { ready: async () => 'dsh-auth-test=1', invalidate() {} },
  })
  const outer = http.createServer((req, res) => { route.handler(req, res) })
  const outerPort = await listen(outer)
  const base = `http://127.0.0.1:${outerPort}`
  try {
    const refused = await fetch(`${base}/remote/api/session.list`)
    assert.equal(refused.status, 403)
    assert.equal((await refused.json()).result.error.code, 'unpaired')
    assert.equal(innerRequests.length, 0)

    const deviceId = pairDevice(service)
    const paired = await fetch(`${base}/remote/api/session.list?limit=5`, {
      headers: { cookie: `dsh_pair=${deviceId}`, 'x-dsh-remote-device': 'stale', 'x-caller': 'dropped' },
    })
    assert.equal(paired.status, 200)
    assert.equal(innerRequests.length, 1)
    assert.equal(innerRequests[0].url, '/api/session.list?limit=5')
    assert.equal(innerRequests[0].headers.cookie, 'dsh-auth-test=1')
    assert.equal(innerRequests[0].headers['sec-fetch-site'], 'same-origin')
    assert.equal(innerRequests[0].headers['x-caller'], undefined)

    for (const path of ['/remote/api/plugin-manager/list', '/remote/api/update/check']) {
      const denied = await fetch(`${base}${path}`, { headers: { cookie: `dsh_pair=${deviceId}` } })
      assert.equal(denied.status, 403, path)
    }
    assert.equal(innerRequests.length, 1, 'a local-only path never reaches the inner API')

    // The master switch is enforced here, not by forgetting the device: the same
    // live cookie is refused while remote access is off, and the pairing remains.
    enabled = false
    const paused = await fetch(`${base}/remote/api/session.list`, { headers: { cookie: `dsh_pair=${deviceId}` } })
    assert.equal(paused.status, 403)
    assert.equal((await paused.json()).result.error.code, 'disabled')
    assert.equal(service.hasDevice(deviceId), true, 'the pairing outlives the switch')
    assert.equal(innerRequests.length, 1)
  } finally {
    await new Promise((resolve) => { outer.close(resolve) })
    await new Promise((resolve) => { inner.close(resolve) })
  }
})

test('applying the row mounts its surfaces and follows a live save', async () => {
  const effects = []
  const routes = []
  const upgrades = []
  const provided = new Map()
  const listeners = new Map()
  const ctx = {
    // An all-interfaces bind is what makes a QR mintable at all.
    webServer: {
      host: '0.0.0.0',
      port: 42137,
      register: (route) => { routes.push(route); return () => {} },
      registerUpgrade: (route) => { upgrades.push(route); return () => {} },
    },
    connection: { authenticatedUrl: () => 'http://127.0.0.1:42137/?token=inner' },
    effect(callback) {
      const dispose = callback()
      effects.push(dispose)
      let done = false
      return () => { if (!done) { done = true; dispose?.() } }
    },
    on(event, callback) {
      listeners.set(event, [...(listeners.get(event) ?? []), callback])
      return () => {}
    },
    get: () => undefined,
    provide(serviceName, value) {
      provided.set(serviceName, value)
      return () => { provided.delete(serviceName) }
    },
  }
  const fence = { get: () => true }
  const ttl = { get: () => 120_000 }
  apply(ctx, { tokenTtlMs: ttl, requirePairingForLan: fence })

  assert.equal(name, 'remote-web-ui')
  assert.deepEqual(inject, ['webServer', 'typertGateway', 'connection'])
  const paths = new Set(routes.map(route => route.path))
  for (const path of [PAIR_PATHS.issue, PAIR_PATHS.accept, PAIR_PATHS.acceptPage, PAIR_PATHS.appPage, '/remote']) {
    assert.ok(paths.has(path), `${path} is registered`)
  }
  assert.ok(upgrades.some(route => route.path === '/remote/api/remote.mux'))
  assert.equal(typeof provided.get(REMOTE_WEB_UI_PAIRING)?.isPairedDevice, 'function')

  const local = { remoteAddress: '127.0.0.1', headers: { host: '127.0.0.1:42137' } }
  const before = await call(routes, PAIR_PATHS.status, { ...local })
  assert.equal(before.json.requirePairingForLan, true)

  // A live settings save lands on the running instance: the Host commits the
  // new value into the volatile reference and announces it, not a remount.
  fence.get = () => false
  ttl.get = () => 300_000
  for (const listener of listeners.get('loader/volatile-update')) listener([['requirePairingForLan', 'tokenTtlMs']])
  const after = await call(routes, PAIR_PATHS.status, { ...local })
  assert.equal(after.json.requirePairingForLan, false, 'the save reached the running row without a remount')

  // A mint needs a reachable base; the machine's own interfaces decide whether
  // one exists here, so the TTL leg only runs when it does.
  if (after.json.lanAvailable) {
    const issued = await call(routes, PAIR_PATHS.issue, { ...local, method: 'POST', body: {} })
    assert.equal(issued.statusCode, 200)
    assert.ok(issued.json.expiresAt - Date.now() > 200_000)
  }

  for (const dispose of effects) dispose()
})
