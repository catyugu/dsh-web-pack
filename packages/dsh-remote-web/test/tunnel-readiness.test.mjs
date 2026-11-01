/**
 * The settings card's only real decision logic: when a `named` tunnel is
 * complete enough to save. Pinned here because the token is stored redacted —
 * the form can never display it, so "a token exists" has to arrive from the
 * host instead of an empty input.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { namedTunnelProblem } from '../src/client/settings/tunnel-readiness.ts'

test('a complete named tunnel has nothing to report', () => {
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: 'https://dsh.example.com',
    tokenDraft: 'eyJfYWtlIjoxfQ',
    tokenStored: false,
  }), undefined)
})

test('a stored token keeps the decision complete when the field is empty', () => {
  // The reported bug: the form cannot read the secret back, so an empty field
  // next to a stored token used to render "token missing" and block the save.
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: 'https://dsh.example.com',
    tokenDraft: '',
    tokenStored: true,
  }), undefined)
})

test('a missing host is named before a missing token', () => {
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: '',
    tokenDraft: '',
    tokenStored: false,
  }), 'settings.tunnelHostMissing')
})

test('a host that is not an http(s) URL is refused', () => {
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: 'dsh.example.com',
    tokenDraft: 'secret',
    tokenStored: false,
  }), 'settings.tunnelHostInvalid')
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: 'ftp://dsh.example.com',
    tokenDraft: 'secret',
    tokenStored: false,
  }), 'settings.tunnelHostInvalid')
})

test('a named tunnel with neither a draft nor a stored token reports the token', () => {
  assert.equal(namedTunnelProblem({
    tunnel: 'named',
    host: 'https://dsh.example.com',
    tokenDraft: '   ',
    tokenStored: false,
  }), 'settings.tunnelTokenMissing')
})

test('the other modes never report a problem', () => {
  for (const tunnel of ['off', 'quick', '']) {
    assert.equal(namedTunnelProblem({
      tunnel,
      host: '',
      tokenDraft: '',
      tokenStored: false,
    }), undefined, tunnel)
  }
})
