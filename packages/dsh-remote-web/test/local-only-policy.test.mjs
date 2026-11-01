/**
 * The local-only policy of the gated `/remote` channel. One server-side table
 * decides what a paired remote desktop may reach; the browser half only routes
 * on the same rules, so these checks pin the server side of that contract.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LOCAL_ONLY_PREFIXES,
  WEB_UI_SETTINGS_BRIDGE_PATH,
  localOnlyDenial,
  policyPathOf,
} from '../src/http/remote-methods.ts'

test('the settings bridge is local-only on the server too', () => {
  // The browser half already refuses to rewrite this prefix; a paired device
  // could otherwise reach it directly and bypass the declared policy.
  assert.ok(LOCAL_ONLY_PREFIXES.includes(WEB_UI_SETTINGS_BRIDGE_PATH))
  assert.notEqual(localOnlyDenial('/api/dsh-web-ui-settings/read'), undefined)
  assert.notEqual(localOnlyDenial(`${WEB_UI_SETTINGS_BRIDGE_PATH}/write`), undefined)
})

test('ordinary API paths stay reachable', () => {
  for (const path of ['/api/session.list', '/api/remote.mux', '/api/settings/read', '/api/pairing-notes']) {
    assert.equal(localOnlyDenial(path), undefined, path)
  }
})

test('the prefix boundary is a path segment, not a string prefix', () => {
  // `/api/updateX` is a different route, not the self-update installer.
  assert.equal(localOnlyDenial('/api/updateX'), undefined)
  assert.equal(localOnlyDenial('/api/plugin-managerX'), undefined)
  assert.notEqual(localOnlyDenial('/api/update/apply'), undefined)
})

test('case, duplicate slashes and dot segments cannot slip past the policy', () => {
  for (const path of [
    '/API/PAIR/new',
    '//api//pair//new',
    '/api/./pair/new',
    '/api/%70air/new',
    '/api/./update',
    '/api/x/../update',
    '/API/PLUGIN-MANAGER/install',
    '/api/dsh-web-ui-settings',
  ]) {
    assert.notEqual(localOnlyDenial(path), undefined, path)
  }
})

test('the normalization is what the policy compares', () => {
  assert.equal(policyPathOf('/API//Pair/./new?x=1'), '/api/pair/new')
  assert.equal(policyPathOf('/api//'), '/api')
  assert.equal(policyPathOf(''), '/')
  // A malformed escape must not throw on the request path.
  assert.equal(policyPathOf('/api/%E0%A4%A'), '/api/%e0%a4%a')
})
