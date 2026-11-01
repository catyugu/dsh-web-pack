/**
 * The gated remote channel, end to end: an unpaired caller must never reach
 * the inner API, a paired one is re-issued loopback-shaped with the process
 * credential, and the control planes that stay local are refused before any
 * byte is forwarded.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'
import { PairingService } from '../src/pairing/pairing.ts'
import { makeRemoteApiRoutes } from '../src/http/remote-api.ts'

/** A service with a frozen clock and one public base. */
function makeService() {
  const service = new PairingService({
    tokenTtlMs: 60_000,
    offlineAfterMs: 25_000,
    cookieName: 'dsh_pair',
    devicesFile: undefined,
  }, {
    now: () => 1_700_000_000_000,
    randomToken: () => Math.random().toString(16).slice(2),
  })
  service.setPublicBaseUrl('https://phone.example')
  return service
}

/** Pair one device and return its id. */
function pairDevice(service) {
  const { token } = service.issue()
  const result = service.accept(token)
  assert.equal(result.ok, true)
  return result.deviceId
}

/**
 * Listen on an ephemeral loopback port.
 * @param {http.Server} server - the server to listen.
 * @returns {Promise<number>} the bound port.
 */
function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port)
    })
  })
}

/**
 * Stand up an inner upstream plus the gated outer channel.
 * @param {object} [options] - wiring options.
 * @param {PairingService} [options.service] - the pairing service.
 * @param {string} [options.innerCookie] - credential the inner auth resolves.
 * @returns {Promise<object>} the two ports, the recorded inner requests and a closer.
 */
async function standUp({ service = makeService(), innerCookie = 'dsh-auth-test=1' } = {}) {
  const innerRequests = []
  const inner = http.createServer((req, res) => {
    innerRequests.push({ url: req.url, headers: req.headers, method: req.method })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
  })
  const innerPort = await listen(inner)
  const [route] = makeRemoteApiRoutes({
    service,
    port: innerPort,
    auth: { ready: async () => innerCookie, invalidate() {} },
  })
  const outer = http.createServer((req, res) => { route.handler(req, res) })
  const outerPort = await listen(outer)
  return {
    service,
    innerRequests,
    innerPort,
    outerPort,
    base: `http://127.0.0.1:${outerPort}`,
    close: () => Promise.all([
      new Promise((resolve) => { outer.close(resolve) }),
      new Promise((resolve) => { inner.close(resolve) }),
    ]),
  }
}

test('an unpaired caller is refused before anything is forwarded', async () => {
  const harness = await standUp()
  try {
    const refused = await fetch(`${harness.base}/remote/api/session.list`)
    assert.equal(refused.status, 403)
    const body = await refused.json()
    assert.equal(body.type, 'server-response')
    assert.equal(body.result.error.code, 'unpaired')
    assert.equal(harness.innerRequests.length, 0)

    const deviceId = pairDevice(harness.service)
    harness.service.revoke(deviceId)
    const revoked = await fetch(`${harness.base}/remote/api/session.list`, {
      headers: { cookie: `dsh_pair=${deviceId}` },
    })
    assert.equal(revoked.status, 403)
    assert.equal(harness.innerRequests.length, 0)
  } finally {
    await harness.close()
  }
})

test('a paired caller is re-issued as a loopback request with the process credential', async () => {
  const harness = await standUp()
  try {
    const deviceId = pairDevice(harness.service)
    const paired = await fetch(`${harness.base}/remote/api/session.list?limit=5`, {
      headers: {
        cookie: `dsh_pair=${deviceId}`,
        'x-dsh-remote-device': 'stale-header',
        'x-caller': 'dropped',
        origin: 'https://phone.example',
      },
    })
    assert.equal(paired.status, 200)
    assert.deepEqual(await paired.json(), { ok: true })
    assert.equal(harness.innerRequests.length, 1)
    const [inner] = harness.innerRequests
    assert.equal(inner.url, '/api/session.list?limit=5')
    assert.equal(inner.headers.host, `127.0.0.1:${harness.innerPort}`)
    assert.equal(inner.headers.cookie, 'dsh-auth-test=1')
    assert.equal(inner.headers['sec-fetch-site'], 'same-origin')
    assert.equal(inner.headers.origin, undefined)
    assert.equal(inner.headers['x-caller'], undefined)
  } finally {
    await harness.close()
  }
})

test('the control planes stay physically local even for a paired device', async () => {
  const harness = await standUp()
  try {
    const deviceId = pairDevice(harness.service)
    for (const path of ['/remote/api/plugin-manager/list', '/remote/api/update/check', '/remote/api/pair/issue']) {
      const denied = await fetch(`${harness.base}${path}`, { headers: { cookie: `dsh_pair=${deviceId}` } })
      assert.equal(denied.status, 403, path)
      const body = await denied.json()
      assert.equal(body.result.error.code, 'forbidden')
      assert.match(body.result.error.message, /stays physically local/)
    }
    assert.equal(harness.innerRequests.length, 0)

    const root = await fetch(`${harness.base}/remote`, { headers: { cookie: `dsh_pair=${deviceId}` } })
    assert.equal(root.status, 404)
    assert.equal(harness.innerRequests.length, 0)
  } finally {
    await harness.close()
  }
})
