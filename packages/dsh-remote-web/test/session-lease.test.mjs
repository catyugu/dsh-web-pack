/**
 * The gated channel's connection lifetime: a WebSocket is only authorized
 * while the device that opened it is. These checks pin that revoking,
 * stopping, or idle-expiring a device closes the connections it holds — the
 * audit's P0 — and that the proxy tells its owner when a pipe ends.
 */
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { PairingService } from '../src/pairing/pairing.ts'
import { proxyLoopbackUpgrade } from '../src/http/loopback-proxy.ts'

/** A service whose clock the test drives. */
function makeService() {
  const clock = { now: 1_700_000_000_000 }
  const service = new PairingService({
    tokenTtlMs: 60_000,
    offlineAfterMs: 25_000,
    idleExpireMs: 60_000,
    cookieName: 'dsh_pair',
    devicesFile: undefined,
  }, {
    now: () => clock.now,
    randomToken: () => Math.random().toString(16).slice(2),
  })
  service.setPublicBaseUrl('https://phone.example')
  return { service, clock }
}

/** Pair one device and return its id. */
function pair(service) {
  const { token } = service.issue()
  const result = service.accept(token)
  assert.equal(result.ok, true)
  return result.deviceId
}

/** A closer that records how often it ran. */
function closer() {
  const calls = { count: 0 }
  calls.close = () => { calls.count += 1 }
  return calls
}

test('revoking a device closes every connection it holds', () => {
  const { service } = makeService()
  const device = pair(service)
  const first = closer()
  const second = closer()
  service.lease(device, first.close)
  service.lease(device, second.close)

  assert.equal(service.revoke(device), true)
  assert.equal(first.count, 1)
  assert.equal(second.count, 1)
})

test('revoking one device leaves another device\'s connections alone', () => {
  const { service } = makeService()
  const revoked = pair(service)
  const kept = pair(service)
  const revokedCloser = closer()
  const keptCloser = closer()
  service.lease(revoked, revokedCloser.close)
  service.lease(kept, keptCloser.close)

  service.revoke(revoked)
  assert.equal(revokedCloser.count, 1)
  assert.equal(keptCloser.count, 0)
})

test('stop closes every leased connection', () => {
  const { service } = makeService()
  const first = pair(service)
  const second = pair(service)
  const a = closer()
  const b = closer()
  service.lease(first, a.close)
  service.lease(second, b.close)

  service.stop()
  assert.equal(a.count, 1)
  assert.equal(b.count, 1)
})

test('an idle eviction closes that device\'s connections', () => {
  const { service, clock } = makeService()
  const device = pair(service)
  const live = closer()
  service.lease(device, live.close)

  // Sweep past the idle window (the session's lastSeenAt is from `pair`).
  clock.now += 120_000
  service.sweep()

  assert.equal(live.count, 1)
  assert.equal(service.snapshot().deviceCount, 0)
})

test('a released lease is not closed again by a later revocation', () => {
  const { service } = makeService()
  const device = pair(service)
  const connection = closer()
  const release = service.lease(device, connection.close)

  release()
  release()
  service.revoke(device)
  assert.equal(connection.count, 0, 'the socket ended on its own; revocation has nothing to close')
})

test('leasing for a device that is already gone closes immediately', () => {
  const { service } = makeService()
  const device = pair(service)
  service.revoke(device)
  const connection = closer()
  service.lease(device, connection.close)
  assert.equal(connection.count, 1)
})

test('the proxy reports its close to its owner exactly once', async () => {
  const closed = []
  const socket = new PassThrough()
  // The proxy keeps its legs alive; a plain duplex has no such knob.
  socket.setKeepAlive = () => socket
  // Port 1 refuses the upstream connection, which tears both legs down.
  proxyLoopbackUpgrade({ headers: {} }, socket, Buffer.alloc(0), 1, '/api/remote.mux', {
    onClosed: () => closed.push('closed'),
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.deepEqual(closed, ['closed'])
})
