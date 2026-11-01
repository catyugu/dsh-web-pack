/**
 * The settings model's contract: what a save writes, what blocks it, and what
 * survives a refusal. These are the behaviors the card's users see, pinned
 * before the UI was cut down to a renderer.
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
  const state = {
    status,
    base: { ...base },
    user: { ...user },
    writable: true,
    revision: 1,
  }
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
  return { form, mutations, replies, state, listeners }
}

test('an edit is a staged draft, not an overridden value, until it differs', () => {
  const { form } = makeForm({ user: { tunnelHost: 'https://old.example' } })
  const model = new RemoteSettingsModel(form)
  assert.equal(model.getState().dirty, false)
  assert.equal(model.getState().fields.tunnelHost.overridden, true)
  assert.equal(model.getState().fields.tunnelHost.text, 'https://old.example')

  model.edit('tunnelHost', 'https://new.example')
  const state = model.getState()
  assert.equal(state.dirty, true)
  assert.equal(state.fields.tunnelHost.text, 'https://new.example')
  assert.equal(state.fields.tunnelHost.overridden, true)
  model.dispose()
})

test('a draft the field refuses blocks the save instead of being dropped', async () => {
  const { form, mutations } = makeForm({ base: { tokenTtlMs: 600_000 } })
  const model = new RemoteSettingsModel(form)
  model.edit('tokenTtlMs', 'soon')
  assert.equal(model.getState().invalid, true)
  assert.equal(model.getState().fields.tokenTtlMs.invalid, true)

  await model.save()
  assert.deepEqual(mutations, [])
  assert.equal(model.getState().dirty, true, 'the refused draft stays for correction')
  model.dispose()
})

test('a save writes the whole batch as one atomic mutation', async () => {
  const { form, mutations, state } = makeForm({ base: { enabled: true, tunnel: 'off' } })
  const model = new RemoteSettingsModel(form)
  model.edit('enabled', 'false')
  model.edit('tunnel', 'named')
  model.edit('tunnelHost', 'https://dsh.example.com')

  await model.save()
  assert.equal(mutations.length, 1)
  assert.deepEqual(mutations[0], [
    { op: 'set', path: ['enabled'], value: false },
    { op: 'set', path: ['tunnel'], value: 'named' },
    { op: 'set', path: ['tunnelHost'], value: 'https://dsh.example.com' },
  ])
  assert.deepEqual(state.user, { enabled: false, tunnel: 'named', tunnelHost: 'https://dsh.example.com' })

  const after = model.getState()
  assert.equal(after.dirty, false)
  assert.equal(after.failed, false)
  assert.equal(after.fields.enabled.text, 'false')
  assert.equal(after.fields.tunnel.text, 'named')
  model.dispose()
})

test('a refused batch keeps every draft and reports the failure', async () => {
  const { form, replies } = makeForm({ base: { enabled: true } })
  const model = new RemoteSettingsModel(form)
  replies.push('refuse')
  model.edit('enabled', 'false')

  await model.save()
  const state = model.getState()
  assert.equal(state.failed, true)
  assert.equal(state.dirty, true)
  assert.equal(state.fields.enabled.text, 'false')
  model.dispose()
})

test('a rejecting transport surfaces its message', async () => {
  const { form, replies } = makeForm({ base: { enabled: true } })
  const model = new RemoteSettingsModel(form)
  replies.push('reject')
  model.edit('enabled', 'false')

  await model.save()
  const state = model.getState()
  assert.equal(state.failed, true)
  assert.equal(state.failedReason, 'the bridge is down')
  assert.equal(state.dirty, true)
  model.dispose()
})

test('a save pressed mid-flight runs again and can recover', async () => {
  const { form, replies, mutations } = makeForm({ base: { enabled: true } })
  const model = new RemoteSettingsModel(form)
  let release
  const gate = new Promise((resolve) => { release = resolve })
  replies.push({ wait: gate, refuse: true })
  model.edit('enabled', 'false')

  const first = model.save()
  const second = model.save()
  release()
  await first
  await second

  assert.equal(mutations.length, 2, 'the queued save ran once the first settled')
  assert.equal(model.getState().dirty, false, 'the second save landed the edit')
  model.dispose()
})

test('reset writes a clear only for a field the user layer holds', async () => {
  const { form, mutations, state } = makeForm({
    base: { tunnelHost: 'https://base.example' },
    user: { tunnelHost: 'https://mine.example' },
  })
  const model = new RemoteSettingsModel(form)
  model.reset('tunnelHost')
  assert.equal(model.getState().fields.tunnelHost.overridden, false)

  await model.save()
  assert.deepEqual(mutations[0], [{ op: 'unset', path: ['tunnelHost'] }])
  assert.deepEqual(state.user, {})
  assert.equal(model.getState().fields.tunnelHost.text, 'https://base.example')
  model.dispose()
})

test('a redacted secret is judged by the mutation settling', async () => {
  const { form, mutations } = makeForm({ base: { tunnelToken: '' } })
  const model = new RemoteSettingsModel(form)
  model.edit('tunnelToken', 'secret-value')

  await model.save()
  assert.deepEqual(mutations[0], [{ op: 'set', path: ['tunnelToken'], value: 'secret-value' }])
  const state = model.getState()
  assert.equal(state.failed, false)
  assert.equal(state.dirty, false, 'the Host never echoes a secret, so settling is the only signal')
  model.dispose()
})

test('a loading namespace renders nothing, and discard drops the drafts', () => {
  const { form } = makeForm({ status: 'loading' })
  const model = new RemoteSettingsModel(form)
  assert.equal(model.getState().available, false)
  model.dispose()

  const ready = makeForm({ base: { enabled: true } })
  const second = new RemoteSettingsModel(ready.form)
  second.edit('enabled', 'false')
  second.discard()
  assert.equal(second.getState().dirty, false)
  assert.equal(second.getState().fields.enabled.text, 'true')
  second.dispose()
})
