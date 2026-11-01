/**
 * The pairing state machine: which credential authorizes a request, what
 * revocation does to an open connection, and what survives a restart.
 */
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PairingService } from '../src/pairing/pairing.ts'
import { pairedDeviceIdOf } from '../src/http/remote-api.ts'
import { REMOTE_DEVICE_HEADER } from '../src/http/remote-methods.ts'
import { sanitizeUserAgent } from '../src/pairing/device-store.ts'

/** A service whose clock the test drives. */
function makeService(overrides = {}) {
  const clock = { now: 1_700_000_000_000 }
  const service = new PairingService({
    tokenTtlMs: 60_000,
    offlineAfterMs: 25_000,
    idleExpireMs: 60_000,
    cookieName: 'dsh_pair',
    devicesFile: undefined,
    ...overrides,
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

/** A request-shaped stub with the two credential carriers. */
function request(cookie, header) {
  return {
    headers: {
      ...(cookie === undefined ? {} : { cookie: `dsh_pair=${cookie}` }),
      ...(header === undefined ? {} : { [REMOTE_DEVICE_HEADER]: header }),
    },
  }
}

test('a live cookie wins over the header, and a stale cookie never shadows a live one', () => {
  const { service } = makeService()
  const cookieDevice = pair(service)
  const headerDevice = pair(service)
  assert.equal(pairedDeviceIdOf(request(cookieDevice, headerDevice), service), cookieDevice)
  assert.equal(pairedDeviceIdOf(request(undefined, headerDevice), service), headerDevice)

  service.revoke(cookieDevice)
  assert.equal(pairedDeviceIdOf(request(cookieDevice, headerDevice), service), headerDevice)
  assert.equal(pairedDeviceIdOf(request(cookieDevice, undefined), service), undefined)
  assert.equal(pairedDeviceIdOf(request(undefined, undefined), service), undefined)
  assert.equal(pairedDeviceIdOf(request(undefined, 'no-such-device'), service), undefined)
})

test('revoking, stopping and idling out close the connections a device holds', () => {
  const { service, clock } = makeService()
  const revoked = pair(service)
  const kept = pair(service)
  const revokedCloser = closer()
  const keptCloser = closer()
  service.lease(revoked, revokedCloser.close)
  service.lease(kept, keptCloser.close)
  service.revoke(revoked)
  assert.equal(revokedCloser.count, 1)
  assert.equal(keptCloser.count, 0, "another device's socket is untouched")

  const released = closer()
  const release = service.lease(kept, released.close)
  release()
  release()
  service.stop()
  assert.equal(released.count, 0, 'a socket that ended on its own is not closed again')
  assert.equal(keptCloser.count, 1, 'stop closes what the device still holds')

  const { service: idling, clock: idleClock } = makeService()
  const device = pair(idling)
  const live = closer()
  idling.lease(device, live.close)
  idleClock.now += 120_000
  idling.sweep()
  assert.equal(live.count, 1)
  assert.equal(idling.snapshot().deviceCount, 0)

  const gone = pair(idling)
  idling.revoke(gone)
  const late = closer()
  idling.lease(gone, late.close)
  assert.equal(late.count, 1, 'a lease for an already-revoked device closes immediately')
})

test('a paired device survives a restart until it is revoked', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-remote-devices-'))
  const devicesFile = join(home, 'devices.json')
  try {
    const config = { tokenTtlMs: 60_000, offlineAfterMs: 25_000, cookieName: 'dsh_pair', devicesFile }
    const first = new PairingService(config)
    first.setPublicBaseUrl('https://phone.example')
    const { token } = first.issue()
    const accepted = first.accept(token, 'Mozilla/5.0  Phone ')
    assert.equal(accepted.ok, true)

    const restarted = new PairingService(config)
    assert.equal(restarted.hasDevice(accepted.deviceId), true, 'the cookie still authorizes after a restart')
    assert.equal(restarted.snapshot().devices[0]?.userAgent, 'Mozilla/5.0 Phone', 'the agent is stored sanitized')

    restarted.revoke(accepted.deviceId)
    assert.equal(JSON.parse(readFileSync(devicesFile, 'utf8'))[accepted.deviceId], undefined)
    assert.equal(new PairingService(config).hasDevice(accepted.deviceId), false, 'a revocation survives the restart too')

    writeFileSync(devicesFile, '{not json')
    assert.equal(new PairingService(config).deviceCount(), 0, 'a corrupt store loads empty instead of refusing to boot')
    assert.equal(sanitizeUserAgent('  Mozilla\u0000/5.0 \n phone '), 'Mozilla /5.0 phone')
    assert.equal(sanitizeUserAgent(undefined), undefined)
    assert.equal(sanitizeUserAgent('x'.repeat(400)).length, 180)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('the upgrade proxy reports its close to its owner exactly once', async () => {
  const closed = []
  const socket = new PassThrough()
  // The proxy keeps its legs alive; a plain duplex has no such knob.
  socket.setKeepAlive = () => socket
  // Port 1 refuses the upstream connection, which tears both legs down.
  const { proxyLoopbackUpgrade } = await import('../src/http/loopback-proxy.ts')
  proxyLoopbackUpgrade({ headers: {} }, socket, Buffer.alloc(0), 1, '/api/remote.mux', {
    onClosed: () => closed.push('closed'),
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.deepEqual(closed, ['closed'])
})
