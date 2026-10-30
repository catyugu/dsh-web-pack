/**
 * Filesystem, deletion, and plugin-lifecycle checks for the host side. Run with
 * `node test/host-check.mjs` from the package directory; it builds its own
 * `DSH_HOME` under `.test-home` and removes it afterwards.
 */
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ROUTES, apply, hideFromSessionCorpus, installSessionGuards } from '../src/host.js'
import { readLineage, removeSession, scrubHidden } from '../src/deletion.js'
import { readLog } from '../src/logs.js'
import { call, exists, fakeCtx, paths, removeHome, resetHome, seedLog, seedSession, transcript } from './support.mjs'

const projectA = '--C-Users-HUAWEI-proj-a--'
const projectB = '--C-Users-HUAWEI-proj-b--'
const TARGET = 'session-11111111-2222-3333-4444-555555555555'
const kept = 'session-99999999-8888-7777-6666-555555555555'

await resetHome()

/** The two workspaces every registry scenario starts from. */
function scopes() {
  return [
    { path: 'E:\\code\\proj-a', sessionIds: ['session-other', TARGET] },
    { path: 'E:\\code\\proj-b', sessionIds: [] },
  ]
}

try {
  // One id can exist under several project directories; every copy goes, along
  // with the projection cache, and the registry keeps no accounting for it.
  await seedSession(projectA, TARGET, { withCache: true })
  await seedSession(projectB, TARGET)
  await seedSession(projectA, kept)
  await seedSession(projectA, `${TARGET}-backup`)
  {
    const host = fakeCtx({ workspaces: scopes(), archived: [TARGET], pinned: [TARGET] })
    const hidden = new Set()
    const outcome = await removeSession(host.ctx, hidden, TARGET, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.equal(outcome.removedDirectories, 2)
    assert.equal(outcome.hidden, false, 'a cold session is gone without the listing filter')
    assert.deepEqual(outcome.forgotten, { detached: 1, unarchived: true, unpinned: true })
    assert.deepEqual(outcome.failedSteps, [])
    assert.deepEqual(host.detached, [{ sessionId: TARGET, workspace: 'E:\\code\\proj-a' }], 'only the workspace that listed the id is asked to drop it')
    assert.deepEqual(host.accounting[0].sessionIds, ['session-other'], 'the id leaves the accounting')
    assert.deepEqual(host.unarchived, [TARGET])
    assert.deepEqual(host.unpinned, [TARGET])
    assert.deepEqual([...hidden], [TARGET])
    assert.equal(await exists(join(paths.sessions, projectA, TARGET)), false)
    assert.equal(await exists(join(paths.sessions, projectB, TARGET)), false)
    assert.equal(await exists(join(paths.cache, `${TARGET}.json`)), false)
    assert.equal(await exists(join(paths.sessions, projectA, kept)), true, 'unrelated session kept')
    assert.equal(await exists(join(paths.sessions, projectA, `${TARGET}-backup`)), true, 'prefixed session kept')
    assert.deepEqual(host.events, [['api-session/removed', TARGET]])
  }

  // An id that is gone from disk and memory is reported, yet still leaves the registry.
  {
    const host = fakeCtx({ workspaces: scopes(), archived: [TARGET] })
    const outcome = await removeSession(host.ctx, new Set(), TARGET, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'missing')
    assert.equal(outcome.forgotten.unarchived, true)
    assert.deepEqual(host.events, [])
  }

  // Files already gone but the Session still attached: the row must still go.
  {
    const host = fakeCtx({ live: ['session-orphan-1'] })
    const hidden = new Set()
    const outcome = await removeSession(host.ctx, hidden, 'session-orphan-1', await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.equal(outcome.removedDirectories, 0)
    assert.equal(outcome.hidden, true)
    assert.deepEqual([...hidden], ['session-orphan-1'])
    assert.deepEqual(host.events, [['api-session/removed', 'session-orphan-1']])
  }

  // An attached Session outlives its files, so its identity is hidden instead.
  const attachedId = 'session-77777777-7777-7777-7777-777777777777'
  await seedSession(projectA, attachedId, { withCache: true })
  {
    const host = fakeCtx({ live: [attachedId] })
    const hidden = new Set()
    const outcome = await removeSession(host.ctx, hidden, attachedId, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.equal(outcome.hidden, true)
    assert.equal(await exists(join(paths.sessions, projectA, attachedId)), false)
    assert.equal(await exists(join(paths.cache, `${attachedId}.json`)), false)
    assert.deepEqual([...hidden], [attachedId])
    assert.deepEqual(host.events, [['api-session/removed', attachedId]])
  }

  // A registry that refuses, or none at all, still leaves the records deleted —
  // but a refusal is reported instead of being reported as a clean success.
  {
    const host = fakeCtx({ registry: 'throw' })
    await seedSession(projectA, 'session-registry-throw')
    const outcome = await removeSession(host.ctx, new Set(), 'session-registry-throw', await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.deepEqual(outcome.failedSteps, ['session-registry-throw: workspace accounting'])
    assert.equal(await exists(join(paths.sessions, projectA, 'session-registry-throw')), false)
    assert.equal(host.warnings.length, 1)
    assert.match(host.warnings[0], /reading the workspaces/)
  }
  {
    const host = fakeCtx({ registry: 'absent' })
    await seedSession(projectA, 'session-registry-absent')
    const outcome = await removeSession(host.ctx, new Set(), 'session-registry-absent', await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.deepEqual(outcome.failedSteps, [])
    assert.equal(await exists(join(paths.sessions, projectA, 'session-registry-absent')), false)
  }
  // One workspace refusing its detach must not keep the next one from dropping
  // the id, and the answer names the step that failed.
  {
    const id = 'session-partial-0000-1111-2222-333333333333'
    await seedSession(projectA, id)
    const host = fakeCtx({
      workspaces: [
        { path: 'E:\\code\\proj-a', sessionIds: [id] },
        { path: 'E:\\code\\proj-b', sessionIds: [id] },
      ],
      detachFails: ['E:\\code\\proj-a'],
    })
    apply(host.ctx)
    const answer = await call(host.routes, ROUTES.remove, { sessionId: id })
    assert.equal(answer.status, 200, JSON.stringify(answer.body))
    assert.deepEqual(answer.body.removedSessions, [id])
    assert.deepEqual(answer.body.failedSteps, [`${id}: workspace "E:\\code\\proj-a"`])
    assert.deepEqual(host.detached, [{ sessionId: id, workspace: 'E:\\code\\proj-b' }], 'the second workspace is still cleaned')
  }

  // A running session is refused before anything is touched.
  const busy = 'session-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  await seedSession(projectA, busy, { withCache: true })
  {
    const host = fakeCtx({ running: [busy], live: [busy] })
    const outcome = await removeSession(host.ctx, new Set(), busy, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'busy')
    assert.deepEqual(outcome.busy, [busy])
    assert.equal(await exists(join(paths.sessions, projectA, busy)), true)
    assert.equal(await exists(join(paths.cache, `${busy}.json`)), true)
    assert.deepEqual(host.events, [])
    assert.deepEqual(host.detached, [])
  }

  // An identity that is not one path segment is refused without touching disk.
  for (const bad of ['../escape', 'a/b', '', '.hidden', 'x y', 'a/../b', undefined]) {
    const outcome = await removeSession(fakeCtx().ctx, new Set(), bad, new Map())
    assert.equal(outcome.outcome, 'invalid', JSON.stringify(bad))
  }
  assert.equal(await exists(join(paths.sessions, projectA, busy)), true)
  {
    const host = fakeCtx()
    apply(host.ctx)
    const answer = await call(host.routes, ROUTES.remove, { sessionId: '../escape' })
    assert.equal(answer.status, 400)
    assert.equal(answer.body.code, 'bad-request')
  }

  // A session without a projection checkpoint still deletes.
  const plain = 'session-12341234-1234-1234-1234-123412341234'
  await seedSession(projectA, plain)
  {
    const host = fakeCtx()
    const outcome = await removeSession(host.ctx, new Set(), plain, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.deepEqual(host.events, [['api-session/removed', plain]])
  }

  // A conversation's subagent conversations are part of it: the deletion takes
  // every descendant, at any depth, and each one leaves the listings too. A
  // fork records the same lineage field without the subagent origin and stays.
  const parent = 'session-parent-0000-1111-2222-333333333333'
  const child = 'child-0000-1111-2222-333333333333'
  const grandchild = 'grandchild-0000-1111-2222-333333333333'
  const forked = 'session-fork-0000-1111-2222-333333333333'
  await seedSession(projectA, parent, { cwd: 'E:\\code\\proj-a', withCache: true })
  await seedSession(projectB, child, { cwd: 'E:\\code\\proj-a', parentSession: parent, origin: 'subagent', withCache: true })
  await seedSession(projectB, grandchild, { cwd: 'E:\\code\\proj-a', parentSession: child, origin: 'subagent' })
  await seedSession(projectA, forked, { cwd: 'E:\\code\\proj-a', parentSession: parent })
  {
    const host = fakeCtx({ workspaces: [{ path: 'E:\\code\\proj-a', sessionIds: [parent, forked] }] })
    const hidden = new Set()
    const outcome = await removeSession(host.ctx, hidden, parent, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.deepEqual(outcome.removedSessions.sort(), [parent, child, grandchild].sort())
    assert.equal(outcome.removedDirectories, 3)
    for (const [id, project] of [[parent, projectA], [child, projectB], [grandchild, projectB]]) {
      assert.equal(await exists(join(paths.sessions, project, id)), false, id)
      assert.equal(await exists(join(paths.cache, `${id}.json`)), false, `${id} cache`)
    }
    assert.equal(await exists(join(paths.sessions, projectA, forked)), true, 'a fork is an independent conversation')
    assert.deepEqual([...hidden].sort(), [parent, child, grandchild].sort())
    assert.deepEqual(host.events.map(([, id]) => id).sort(), [parent, child, grandchild].sort())
  }

  // A running descendant refuses the whole deletion: its parent may not pull the
  // log out from under work that is still appending to it.
  const busyParent = 'session-busy-parent-1111-2222-333333333333'
  const busyChild = 'busy-child-1111-2222-333333333333'
  await seedSession(projectA, busyParent)
  await seedSession(projectB, busyChild, { parentSession: busyParent, origin: 'subagent' })
  {
    const host = fakeCtx({ live: [busyParent, busyChild], running: [busyChild] })
    const outcome = await removeSession(host.ctx, new Set(), busyParent, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'busy')
    assert.deepEqual(outcome.busy, [busyChild], 'the refusal names the running descendant')
    assert.equal(await exists(join(paths.sessions, projectA, busyParent)), true)
    assert.equal(await exists(join(paths.sessions, projectB, busyChild)), true)
    assert.deepEqual(host.events, [])
  }

  // A child the process holds but has not written a log for yet is still part of
  // its parent: the deletion hides and announces it, and the flush scrub keeps
  // its log from settling.
  const heldParent = 'session-held-parent-1111-2222-333333333333'
  const heldChild = 'held-child-1111-2222-333333333333'
  {
    const host = fakeCtx({ held: [
      { id: heldParent },
      { id: heldChild, parentSession: heldParent, origin: 'subagent' },
    ] })
    const hidden = new Set()
    const outcome = await removeSession(host.ctx, hidden, heldParent, await readLineage(host.ctx))
    assert.equal(outcome.outcome, 'removed')
    assert.equal(outcome.removedDirectories, 0)
    assert.deepEqual(outcome.removedSessions.sort(), [heldChild, heldParent].sort())
    assert.deepEqual([...hidden].sort(), [heldChild, heldParent].sort())
    assert.deepEqual(host.events.map(([, id]) => id).sort(), [heldChild, heldParent].sort())
  }

  // Deleting the same identity twice in one process is not a miss: a bulk run
  // that names both a conversation and its subagent reports both as deleted.
  {
    const twice = 'session-twice-1111-2222-333333333333'
    await seedSession(projectA, twice)
    const host = fakeCtx()
    const hidden = new Set()
    const lineage = await readLineage(host.ctx)
    assert.equal((await removeSession(host.ctx, hidden, twice, lineage)).outcome, 'removed')
    const again = await removeSession(host.ctx, hidden, twice, lineage)
    assert.equal(again.outcome, 'removed', 'a repeat reports success, not a miss')
    assert.deepEqual(again.removedSessions, [])
  }

  // A hidden Session that appends once more writes its log back; the flush scrub
  // removes that copy without a preflight — a running Agent must not stop it.
  const reflushed = 'session-reflush-1111-2222-333333333333'
  {
    const host = fakeCtx({ live: [reflushed], running: [reflushed] })
    const hidden = new Set()
    assert.equal(await scrubHidden(host.ctx, hidden, reflushed), 0, 'an un-hidden identity is left alone')
    hidden.add(reflushed)
    await seedSession(projectA, reflushed)
    assert.equal(await scrubHidden(host.ctx, hidden, reflushed), 1)
    assert.equal(await exists(join(paths.sessions, projectA, reflushed)), false, 'the re-written log is dropped even while its Agent runs')
  }

  // The lifecycle events keep a deleted identity deleted.
  {
    const host = fakeCtx()
    const id = 'session-events-1111-2222-333333333333'
    const hidden = new Set([id])
    installSessionGuards(host.ctx, hidden)
    await seedSession(projectA, id)
    await host.raise('api-session/added', { sessionId: id })
    assert.deepEqual(host.events, [['api-session/removed', id]], 'a hidden row that announces itself is removed again')
    await host.raise('session/flush', { id })
    assert.equal(await exists(join(paths.sessions, projectA, id)), false, 'a flush drops the re-written log')
    await host.raise('session/created', { id })
    assert.equal(hidden.has(id), false, 'a created Session owns its identity again')
    await seedSession(projectA, id)
    await host.raise('session/flush', { id })
    assert.equal(await exists(join(paths.sessions, projectA, id)), true, 'a live identity is not scrubbed')
  }

  // The corpus filter is the only thing that can drop a still attached Session:
  // it hides the identity, and releases it once the corpus no longer has it.
  {
    const disposed = []
    const records = [
      { header: { id: 'session-keep' } },
      { header: { id: 'session-hidden' } },
    ]
    // The real engine carries the method on its prototype, which is what makes
    // the wrapper removable again.
    class Engine {
      async listSessions() {
        return records
      }
    }
    const engine = new Engine()
    const ctx = {
      logger: { warn: () => {} },
      inject: (_deps, callback) => callback({
        sessionQuery: engine,
        effect: (fn) => {
          const dispose = fn()
          if (typeof dispose === 'function') disposed.push(dispose)
        },
      }),
    }
    const hidden = new Set(['session-hidden'])
    hideFromSessionCorpus(ctx, hidden)
    assert.deepEqual(await engine.listSessions(), [{ header: { id: 'session-keep' } }])
    records.pop()
    assert.deepEqual(await engine.listSessions(), [{ header: { id: 'session-keep' } }])
    assert.deepEqual([...hidden], [], 'an identity the corpus no longer has needs no hiding')
    assert.equal(disposed.length, 1)
    disposed[0]()
    assert.equal(Object.hasOwn(engine, 'listSessions'), false, 'unmounting restores the inherited method')
    assert.deepEqual(await engine.listSessions(), [{ header: { id: 'session-keep' } }])
  }

  // An engine that owned its method before the filter gets that method back.
  {
    const engine = {
      async listSessions() {
        return [{ header: { id: 'session-own' } }]
      },
    }
    const original = engine.listSessions
    const disposers = []
    hideFromSessionCorpus({
      logger: { warn: () => {} },
      inject: (_deps, callback) => callback({
        sessionQuery: engine,
        effect: (fn) => disposers.push(fn()),
      }),
    }, new Set())
    assert.notEqual(engine.listSessions, original)
    disposers[0]()
    assert.equal(engine.listSessions, original, 'the own method is restored, not deleted')
  }

  // A torn trailing frame is tolerated by the header reader, which only needs
  // the first frame, and reported by the full reader that the attachment
  // reference set depends on.
  {
    const id = 'session-torn-1111-2222-333333333333'
    const intact = transcript(['{"type":"session","id":"' + id + '"}'])
    const torn = Buffer.concat([intact, transcript(['{"type":"tail"}']).subarray(0, 6)])
    await seedSession(projectA, id)
    await seedLog(projectB, id, torn)
    await assert.rejects(() => readLog(join(paths.sessions, projectB, id, 'session.v4.jsonl.zstd')), /ends inside a frame/)
  }

  // Every deletion left the seeded project directory with exactly the Sessions
  // it should still own.
  assert.deepEqual(
    (await readdir(join(paths.sessions, projectA))).sort(),
    [busy, busyParent, 'session-events-1111-2222-333333333333', forked, kept, `${TARGET}-backup`, 'session-torn-1111-2222-333333333333'].sort(),
  )

  console.log('cleanup: deletion checks passed')
} finally {
  await removeHome()
}


