/**
 * The settings model's contract: what a save writes, what blocks it, and what
 * survives a refusal — the behaviors the card's users see.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RemoteSettingsModel } from '../src/client/settings/remote-settings.ts'

/**
 * A fake configuration form with a user layer over a base layer, so the model's
 * read-back judgment exercises the same view the Host serves.
 * @param {object} [options] - form options.
 * @param {object} [options.base] - the profile-layer values.
 * @param {object} [options.user] - the user-layer values already written.
 * @param {string} [options.status] - form status.
 * @returns {object} the form and the test's controls.
 */
function makeForm({ base = {}, user = {}, status = 'ready' } = {}) {
  const state = { status, base: { ...base }, user: { ...user }, writable: true, revision: 1 }
  const listeners = new Set()
  const mutations = []
  const replies = []
  const notify = () => { for (const listener of [...listeners]) listener() }
  const value = () => ({ ...state.base, ...state.user })
  const form = {
    getSnapshot: () => ({
      status: state.status,
      value: value(),
      base: { ...state.base },
      user: { ...state.user },
      revision: state.revision,
      writable: state.writable,
      mode: 'host',
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: async () => true,
    unset: async () => true,
    mutate: async (ops) => {
      mutations.push(structuredClone(ops))
      const reply = replies.shift()
      if (reply === 'reject') throw new Error('the bridge is down')
      if (reply === 'refuse') return false
      if (reply !== undefined && reply.wait !== undefined) {
        await reply.wait
        if (reply.refuse === true) return false
      }
      for (const op of ops) {
        if (op.op === 'set') state.user[op.path[0]] = op.value
        else delete state.user[op.path[0]]
      }
      state.revision += 1
      notify()
      return true
    },
  }
  return { form, mutations, replies, state }
}

test('staging shows the draft, marks overrides, and refuses invalid text', async () => {
  const { form, mutations } = makeForm({
    base: { tokenTtlMs: 600_000, tunnelHost: 'https://base.example' },
    user: { tunnelHost: 'https://old.example' },
  })
  const model = new RemoteSettingsModel(form)
  assert.equal(model.getState().dirty, false)
  // useSyncExternalStore compares snapshots by identity: a fresh object per call
  // reads as an endless change and aborts the rendered tree.
  assert.equal(model.getState(), model.getState())
  const before = model.getState()
  assert.equal(model.getState().fields.tunnelHost.overridden, true)
  assert.equal(model.getState().fields.tokenTtlMs.text, '600000')

  model.edit('tunnelHost', 'https://new.example')
  assert.notEqual(model.getState(), before, 'a change produces a new snapshot')
  model.edit('tokenTtlMs', 'soon')
  const state = model.getState()
  assert.equal(state.dirty, true)
  assert.equal(state.fields.tunnelHost.text, 'https://new.example')
  assert.equal(state.fields.tokenTtlMs.invalid, true)
  assert.equal(state.invalid, true)

  await model.save()
  assert.deepEqual(mutations, [], 'an invalid draft blocks the save instead of being dropped')
  assert.equal(model.getState().dirty, true, 'the refused draft stays for correction')

  model.discard()
  assert.equal(model.getState().dirty, false)
  assert.equal(model.getState().fields.tunnelHost.text, 'https://old.example')
  model.dispose()
})

test('a save is one atomic mutation, and a refusal keeps every draft', async () => {
  const { form, mutations, replies } = makeForm({ base: { enabled: true, tunnel: 'off' } })
  const model = new RemoteSettingsModel(form)
  model.edit('enabled', 'false')
  model.edit('tunnel', 'named')
  model.edit('tunnelHost', 'https://dsh.example.com')

  await model.save()
  assert.deepEqual(mutations[0], [
    { op: 'set', path: ['enabled'], value: false },
    { op: 'set', path: ['tunnel'], value: 'named' },
    { op: 'set', path: ['tunnelHost'], value: 'https://dsh.example.com' },
  ])
  assert.equal(model.getState().dirty, false)

  replies.push('refuse')
  model.edit('enabled', 'true')
  await model.save()
  assert.equal(model.getState().failed, true)
  assert.equal(model.getState().dirty, true, 'a refused batch keeps its drafts')

  replies.push('reject')
  await model.save()
  assert.equal(model.getState().failedReason, 'the bridge is down')

  // A save pressed mid-flight runs once the first settles, and can recover.
  let release
  const wait = new Promise((resolve) => { release = resolve })
  replies.push({ wait, refuse: true })
  const queued = model.save()
  const pressed = model.save()
  release()
  await queued
  await pressed
  assert.equal(mutations.length, 5)
  assert.equal(model.getState().dirty, false, 'the queued save landed the edit')
  model.dispose()
})

test('a reset writes only the clear it can honor, and a secret is judged by settling', async () => {
  const { form, mutations, state } = makeForm({
    base: { tunnelHost: 'https://base.example', tunnelToken: '', enabled: true },
    user: { tunnelHost: 'https://mine.example' },
  })
  const model = new RemoteSettingsModel(form)
  model.reset('tunnelHost')
  assert.equal(model.getState().fields.tunnelHost.overridden, false)
  await model.save()
  assert.deepEqual(mutations[0], [{ op: 'unset', path: ['tunnelHost'] }])
  assert.deepEqual(state.user, {})
  assert.equal(model.getState().fields.tunnelHost.text, 'https://base.example')

  model.edit('tunnelToken', 'secret-value')
  await model.save()
  assert.deepEqual(mutations[1], [{ op: 'set', path: ['tunnelToken'], value: 'secret-value' }])
  assert.equal(model.getState().dirty, false, 'the Host never echoes a secret, so settling is the only signal')

  const loading = makeForm({ status: 'loading' })
  const early = new RemoteSettingsModel(loading.form)
  assert.equal(early.getState().available, false, 'a loading namespace renders nothing')
  model.dispose()
  early.dispose()
})
