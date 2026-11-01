/**
 * The reopen service worker, driven in a bare VM: CacheStorage is shared by
 * every worker and page of the origin, so these checks pin what the worker is
 * allowed to delete and what it must forget when a pairing is refused.
 */
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { test } from 'node:test'
import { appServiceWorkerScript } from '../src/http/reopen-worker.ts'

const SHELL = 'dsh-remote-shell-v1'
const SHELL_KEY = '/dsh-remote-shell'

/** A response stub good enough for the worker's `ok` / `clone()` use. */
function response(ok, marker) {
  return { ok, marker, clone() { return response(ok, marker) } }
}

/**
 * Run the worker script in a fresh realm with a fake CacheStorage.
 * @param fetchImpl - stands in for the network.
 * @returns the registered listeners and the two name-keyed cache views.
 */
function loadWorker(fetchImpl) {
  const listeners = new Map()
  const caches = new Map()
  const api = {
    keys: async () => [...caches.keys()],
    delete: async (name) => caches.delete(name),
    open: async (name) => {
      const bucket = caches.get(name) ?? new Map()
      caches.set(name, bucket)
      return { put: async (key, value) => { bucket.set(key, value) } }
    },
    match: async (key) => {
      for (const bucket of caches.values()) if (bucket.has(key)) return bucket.get(key)
      return undefined
    },
  }
  const context = vm.createContext({
    self: {
      addEventListener: (type, listener) => { listeners.set(type, listener) },
      caches: api,
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined,
    },
    fetch: fetchImpl,
    URL,
    console,
  })
  vm.runInContext(appServiceWorkerScript(), context)
  return { listeners, caches }
}

/** Dispatch one event and resolve with the promise it handed to waitUntil/respondWith. */
function dispatch(listeners, type, event) {
  let settled
  listeners.get(type)({
    ...event,
    waitUntil: (promise) => { settled = Promise.resolve(promise) },
    respondWith: (promise) => { settled = Promise.resolve(promise) },
  })
  return settled
}

test('activate prunes only this worker\'s own shell caches', async () => {
  const { listeners, caches } = loadWorker(async () => response(true))
  caches.set('dsh-remote-shell-v0', new Map())
  caches.set(SHELL, new Map())
  caches.set('dsh-app-shell', new Map())
  caches.set('workbox-precache-v2', new Map())

  await dispatch(listeners, 'activate', {})

  assert.equal(caches.has('dsh-remote-shell-v0'), false, 'an older shell cache is pruned')
  assert.equal(caches.has(SHELL), true, 'the current shell cache survives')
  assert.equal(caches.has('dsh-app-shell'), true, 'a foreign cache that merely looks similar survives')
  assert.equal(caches.has('workbox-precache-v2'), true, 'an unrelated cache survives')
})

test('a refused pairing drops the cached shell instead of serving it offline', async () => {
  const { listeners, caches } = loadWorker(async (input) => {
    // The /pair-app check is refused (revoked device); the navigation itself
    // is passed through to the server, which owns the real answer.
    if (String(input) === '/pair-app') return response(false)
    return response(true, 'passthrough')
  })
  const shell = new Map([[SHELL_KEY, response(true, 'cached-shell')]])
  caches.set(SHELL, shell)

  const settled = await dispatch(listeners, 'fetch', {
    request: { method: 'GET', mode: 'navigate', url: 'https://phone.example/' },
  })

  assert.equal(settled.marker, 'passthrough', 'the navigation is passed through, never the stale shell')
  assert.equal(caches.has(SHELL), false, 'the shell (and the device id inside it) is forgotten')
})

test('a live pairing caches the shell and serves it', async () => {
  const { listeners, caches } = loadWorker(async () => response(true, 'live-shell'))
  const settled = await dispatch(listeners, 'fetch', {
    request: { method: 'GET', mode: 'navigate', url: 'https://phone.example/' },
  })

  assert.equal(settled.marker, 'live-shell')
  assert.equal(caches.get(SHELL).has(SHELL_KEY), true, 'the fresh shell is cached for an offline open')
})

test('non-navigation requests are left alone', async () => {
  const { listeners } = loadWorker(async () => { throw new Error('the worker must not fetch') })
  assert.equal(dispatch(listeners, 'fetch', {
    request: { method: 'GET', mode: 'cors', url: 'https://phone.example/api/x' },
  }), undefined)
})
