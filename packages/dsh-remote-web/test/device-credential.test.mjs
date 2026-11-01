/**
 * Device credentials on the gated channel: which one wins when a request
 * carries two, what a revoked device gets, and what survives a restart. A
 * stale cookie shadowing a live header is the case the cookieless flow hits
 * when a browser starts sending an old cookie again.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PairingService } from '../src/pairing/pairing.ts'
import { pairedDeviceIdOf } from '../src/http/remote-api.ts'
import { REMOTE_DEVICE_HEADER } from '../src/http/remote-methods.ts'
import { sanitizeUserAgent } from '../src/pairing/device-store.ts'

/** A service with a frozen clock, a reachable base, and no device store on disk. */
function makeService() {
  const now = 1_700_000_000_000
  const service = new PairingService({
    tokenTtlMs: 60_000,
    offlineAfterMs: 25_000,
    cookieName: 'dsh_pair',
    devicesFile: undefined,
  }, {
    now: () => now,
    randomToken: () => Math.random().toString(16).slice(2),
  })
  // `issue()` refuses to mint without a reachable base; a fake public host is
  // enough for these checks.
  service.setPublicBaseUrl('https://phone.example')
  return service
}

/** Pair one device and return its id. */
function pair(service) {
  const { token } = service.issue()
  const result = service.accept(token)
  assert.equal(result.ok, true)
  return result.deviceId
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

test('the cookie is preferred while it is live', () => {
  const service = makeService()
  const cookieDevice = pair(service)
  const headerDevice = pair(service)
  assert.equal(pairedDeviceIdOf(request(cookieDevice, headerDevice), service), cookieDevice)
})

test('a stale cookie does not shadow a live header', () => {
  const service = makeService()
  const stale = pair(service)
  const live = pair(service)
  service.revoke(stale)

  assert.equal(pairedDeviceIdOf(request(stale, live), service), live)
})

test('a stale cookie alone is refused', () => {
  const service = makeService()
  const stale = pair(service)
  service.revoke(stale)
  assert.equal(pairedDeviceIdOf(request(stale, undefined), service), undefined)
})

test('no credential at all is refused', () => {
  const service = makeService()
  assert.equal(pairedDeviceIdOf(request(undefined, undefined), service), undefined)
})

test('an unknown header device is refused', () => {
  const service = makeService()
  assert.equal(pairedDeviceIdOf(request(undefined, 'no-such-device'), service), undefined)
})

test('a paired device survives a restart until it is revoked', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-remote-devices-'))
  const devicesFile = join(home, 'devices.json')
  try {
    const config = {
      tokenTtlMs: 60_000,
      offlineAfterMs: 25_000,
      cookieName: 'dsh_pair',
      devicesFile,
    }
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
    const again = new PairingService(config)
    assert.equal(again.hasDevice(accepted.deviceId), false, 'a revocation survives the restart too')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a corrupt device store loads empty instead of refusing to boot', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-remote-devices-'))
  const devicesFile = join(home, 'devices.json')
  try {
    writeFileSync(devicesFile, '{not json')
    const service = new PairingService({ tokenTtlMs: 60_000, offlineAfterMs: 25_000, cookieName: 'dsh_pair', devicesFile })
    assert.equal(service.deviceCount(), 0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a user agent is sanitized before it is stored', () => {
  assert.equal(sanitizeUserAgent('  Mozilla\u0000/5.0 \n phone '), 'Mozilla /5.0 phone')
  assert.equal(sanitizeUserAgent(undefined), undefined)
  assert.equal(sanitizeUserAgent('x'.repeat(400)).length, 180)
})
