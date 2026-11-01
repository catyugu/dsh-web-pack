/**
 * The parse-time boot patch: it runs before every module, so it duplicates the
 * channel's fetch rewrite in classic script. These checks pin the one thing
 * that must never differ from the module version — the cookieless device
 * credential rides every gated call, including a call with no init.
 */
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { test } from 'node:test'
import { buildRemoteChannelBootScript } from '../src/http/remote-channel-boot.ts'
import { REMOTE_CHANNEL_RULES as RULES } from '../src/http/remote-channel-rules.ts'

/** Install the boot script over a window-shaped stub and return what it forwarded. */
function boot(device) {
  const calls = []
  const location = {
    origin: 'https://phone.example',
    href: 'https://phone.example/',
    hostname: 'phone.example',
    protocol: 'https:',
  }
  const window = {
    location,
    document: { readyState: 'complete' },
    sessionStorage: { getItem: (key) => (key === RULES.deviceKey ? device : null) },
    setTimeout: () => 0,
    fetch: async (input, init) => {
      calls.push({ input, init })
      return { status: 200, ok: true, clone() { return this }, async json() { return {} } }
    },
  }
  const context = vm.createContext({
    window,
    document: window.document,
    location,
    URL,
    Request,
    Headers,
    Promise,
    console,
    setTimeout: () => 0,
  })
  vm.runInContext(buildRemoteChannelBootScript(), context)
  return { window, calls }
}

/** Read one forwarded header off a recorded call. */
function headerOf(call, name) {
  return new Headers(call.init?.headers ?? {}).get(name)
}

test('the boot patch rewrites gated paths onto /remote', async () => {
  const { window, calls } = boot('device-boot')
  await window.fetch('/api/session.list')
  assert.equal(String(calls[0].input), 'https://phone.example/remote/api/session.list')
})

test('a gated call with no init still carries the device credential', async () => {
  const { window, calls } = boot('device-boot')
  await window.fetch('/api/session.list')
  assert.equal(headerOf(calls[0], RULES.deviceHeader), 'device-boot')
})

test('tuple-list headers survive and gain the credential', async () => {
  const { window, calls } = boot('device-boot')
  await window.fetch('/api/session.list', { headers: [['x-trace', 'abc']] })
  assert.equal(headerOf(calls[0], 'x-trace'), 'abc')
  assert.equal(headerOf(calls[0], RULES.deviceHeader), 'device-boot')
})

test('ungated paths are forwarded untouched', async () => {
  const { window, calls } = boot('device-boot')
  await window.fetch('/pair/status')
  assert.equal(calls[0].init, undefined)
  assert.equal(String(calls[0].input), '/pair/status')
})
