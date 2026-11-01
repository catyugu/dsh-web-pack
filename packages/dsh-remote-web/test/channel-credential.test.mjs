/**
 * The browser half of the gated channel: which requests it rewrites, and the
 * credential it must attach to every one of them. The cookieless flow depends
 * entirely on this header, so the shapes that used to lose it (no init at all,
 * a Request input, tuple-list headers) are pinned here.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installRemoteChannel } from '../src/client/remote-channel.ts'
import { REMOTE_CHANNEL_RULES as RULES } from '../src/http/remote-channel-rules.ts'

/** A window-shaped stub that records what the patched fetch forwards. */
function makeWindow(device) {
  const calls = []
  const respond = async () => ({
    status: 200,
    ok: true,
    clone() { return this },
    async json() { return {} },
  })
  const window = {
    location: { origin: 'https://phone.example', href: 'https://phone.example/' },
    sessionStorage: { getItem: (key) => (key === RULES.deviceKey ? device : null) },
    WebSocket: class WebSocket {},
    fetch: async (input, init) => {
      calls.push({ input, init })
      return respond()
    },
  }
  return { window, calls }
}

/** Read one forwarded header off a recorded call. */
function headerOf(call, name) {
  const headers = call.init?.headers
  assert.ok(headers !== undefined, 'the gated call must carry an init with headers')
  return new Headers(headers).get(name)
}

test('a gated fetch without an init still carries the device credential', async () => {
  const { window, calls } = makeWindow('device-1')
  installRemoteChannel(window, {})
  await window.fetch('/api/session.list')

  assert.equal(calls.length, 1)
  assert.equal(String(calls[0].input), 'https://phone.example/remote/api/session.list')
  assert.equal(headerOf(calls[0], RULES.deviceHeader), 'device-1')
})

test('an init with tuple-list headers keeps them and gains the credential', async () => {
  const { window, calls } = makeWindow('device-2')
  installRemoteChannel(window, {})
  await window.fetch('/api/session.list', { headers: [['x-trace', 'abc']] })

  assert.equal(headerOf(calls[0], 'x-trace'), 'abc')
  assert.equal(headerOf(calls[0], RULES.deviceHeader), 'device-2')
})

test('a Request input contributes its own headers', async () => {
  const { window, calls } = makeWindow('device-3')
  installRemoteChannel(window, {})
  const request = new Request('https://phone.example/api/session.list', {
    headers: { 'x-caller': 'yes' },
  })
  await window.fetch(request)

  assert.equal(headerOf(calls[0], 'x-caller'), 'yes', 'the request headers survive the rewrite')
  assert.equal(headerOf(calls[0], RULES.deviceHeader), 'device-3')
})

test('the caller\'s headers are copied, never mutated', async () => {
  const { window } = makeWindow('device-4')
  installRemoteChannel(window, {})
  const original = new Headers({ 'x-trace': 'abc' })
  await window.fetch('/api/session.list', { headers: original })

  assert.equal(original.get(RULES.deviceHeader), null, 'the caller\'s Headers instance stays untouched')
})

test('an ungated same-origin call keeps the caller\'s init untouched', async () => {
  const { window, calls } = makeWindow('device-5')
  installRemoteChannel(window, {})
  await window.fetch('/pair/status')

  assert.equal(calls[0].init, undefined)
  assert.equal(String(calls[0].input), '/pair/status')
})

test('without a device credential nothing is added', async () => {
  const { window, calls } = makeWindow(null)
  installRemoteChannel(window, {})
  await window.fetch('/api/session.list')

  assert.equal(calls[0].init, undefined)
  assert.equal(String(calls[0].input), 'https://phone.example/remote/api/session.list')
})
