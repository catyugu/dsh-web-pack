/**
 * The mounted row, end to end: `apply` against a fake host registers the route
 * families and the pairing access sibling plugins look up, answers a pairing
 * request over the registered table, and follows a live settings save through
 * the volatile reference the Host commits into.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, inject, name } from '../lib/host.js'
import { PAIR_PATHS } from '../src/http/paths.ts'
import { REMOTE_WEB_UI_PAIRING } from '../src/pairing/pairing-access.ts'
import { REMOTE_DEVICE_HEADER } from '../src/http/remote-methods.ts'
import { callRoute, RouteResponse, routeRequest } from './support.mjs'

/**
 * A host context with the surfaces the row touches: a webserver that records
 * registrations, a fiber effect registry, event listeners and provided
 * services.
 * @returns {object} the fake context and what it recorded.
 */
function makeHost() {
  const effects = []
  const routes = []
  const upgrades = []
  const provided = new Map()
  const listeners = new Map()
  const ctx = {
    webServer: {
      // An all-interfaces bind is what makes a QR mintable at all; the row
      // samples the machine's LAN literals from it.
      host: '0.0.0.0',
      port: 42137,
      register(route) {
        routes.push(route)
        return () => {}
      },
      registerUpgrade(route) {
        upgrades.push(route)
        return () => {}
      },
    },
    connection: { authenticatedUrl: () => 'http://127.0.0.1:42137/?token=inner' },
    effect(callback) {
      const dispose = callback()
      effects.push(dispose)
      let done = false
      return () => {
        if (done) return
        done = true
        dispose?.()
      }
    },
    on(event, callback) {
      const list = listeners.get(event) ?? []
      list.push(callback)
      listeners.set(event, list)
      return () => {}
    },
    get() {
      return undefined
    },
    provide(serviceName, value) {
      provided.set(serviceName, value)
      return () => { provided.delete(serviceName) }
    },
  }
  return { ctx, effects, routes, upgrades, provided, listeners }
}

/**
 * Call one registered route handler.
 * @param {Array<object>} routes - the registered route table.
 * @param {string} path - the route path.
 * @param {object} init - request fields for support.routeRequest.
 * @returns {Promise<RouteResponse>} the response.
 */
async function call(routes, path, init) {
  const route = routes.find(candidate => candidate.path === path)
  assert.ok(route, `no route registered for ${path}`)
  return callRoute(route.handler, init, new RouteResponse())
}

test('applying the row mounts its routes, its pairing access and its listeners', async () => {
  const host = makeHost()
  const ttl = { get: () => 120_000 }
  apply(host.ctx, { tokenTtlMs: ttl })

  assert.equal(name, 'remote-web-ui')
  assert.deepEqual(inject, ['webServer', 'typertGateway', 'connection'])

  const paths = new Set(host.routes.map(route => route.path))
  for (const path of [PAIR_PATHS.issue, PAIR_PATHS.accept, PAIR_PATHS.status, PAIR_PATHS.events, PAIR_PATHS.acceptPage, PAIR_PATHS.appPage]) {
    assert.ok(paths.has(path), `${path} is registered`)
  }
  assert.ok(paths.has('/remote'), 'the gated channel is registered')
  assert.ok(host.upgrades.some(route => route.path === '/remote/api/remote.mux'), 'the event-stream upgrade is registered')
  assert.equal(typeof host.provided.get(REMOTE_WEB_UI_PAIRING)?.isPairedDevice, 'function')
  assert.ok((host.listeners.get('loader/volatile-update') ?? []).length === 1, 'the row follows volatile saves')

  const desktop = { remoteAddress: '127.0.0.1', headers: { host: '127.0.0.1:42137' } }
  const issued = await call(host.routes, PAIR_PATHS.issue, { ...desktop, method: 'POST', body: {} })
  assert.equal(issued.statusCode, 200)
  assert.ok(issued.json.expiresAt - Date.now() <= 120_000, 'the first mint uses the config the row was mounted with')

  // A live settings save lands on the running instance: the Host commits the
  // new value into the volatile reference and announces it, not a remount.
  ttl.get = () => 300_000
  for (const listener of host.listeners.get('loader/volatile-update')) listener([['tokenTtlMs']])
  const reissued = await call(host.routes, PAIR_PATHS.issue, { ...desktop, method: 'POST', body: {} })
  assert.equal(reissued.statusCode, 200)
  assert.ok(reissued.json.expiresAt - Date.now() > 200_000, 'the save reached the mint without a remount')

  const status = await call(host.routes, PAIR_PATHS.status, {
    ...desktop,
    headers: { ...desktop.headers, [REMOTE_DEVICE_HEADER]: 'unpaired-device' },
  })
  assert.equal(status.statusCode, 200)
  assert.equal(status.json.paired, false)

  for (const dispose of host.effects) dispose()
})
