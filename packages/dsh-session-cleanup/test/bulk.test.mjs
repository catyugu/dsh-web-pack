/**
 * Route checks for the session cleanup sub-component: what a bulk run deletes,
 * how the cleanup scopes are counted, and what is refused before anything is
 * touched.
 *
 * The routes are mounted on the shared fake Host context over a seeded
 * `DSH_HOME`, so every check sees the disk the button would see.
 */
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { referencedDigests } from '../src/attachments.js'
import { ROUTES, apply } from '../src/host.js'
import { readSettings, writeSettings } from '../src/store.js'
import {
  call,
  exists,
  fakeCtx,
  headerLine,
  home,
  paths,
  removeHome,
  resetHome,
  seedAttachment,
  seedLog,
  seedSession,
  transcript,
} from './support.mjs'

const DIGEST_KEPT = 'a1'.repeat(32)
const DIGEST_DROPPED = 'b2'.repeat(32)
const DIGEST_FRESH = 'c3'.repeat(32)

const projectA = '--E-code-alpha--'
const projectB = '--E-code-gone--'
const projectC = '--E-code-live--'
const projectD = '--E-code-lineage--'
const projectE = '--E-code-torn--'

await resetHome()

try {
  const gone = await seedSession(projectB, 'session-gone', { cwd: 'E:\\code\\gone', digest: DIGEST_DROPPED, withCache: true })
  const live = await seedSession(projectC, 'session-live', { cwd: 'E:\\code\\live', digest: DIGEST_DROPPED, withCache: true })
  const removed = await seedSession(projectC, 'session-removed', { cwd: 'E:\\code\\live', digest: DIGEST_KEPT })
  const alpha = await seedSession(projectA, 'session-alpha', { cwd: 'E:\\code\\alpha', digest: DIGEST_KEPT, withCache: true })
  await rm(removed, { recursive: true, force: true })
  await seedAttachment(DIGEST_KEPT, 3_600_000)
  await seedAttachment(DIGEST_DROPPED, 3_600_000)
  await seedAttachment(DIGEST_FRESH, 0)
  await writeSettings(home, { attachments: false })

  const scopes = [
    { path: 'E:\\code\\alpha', sessionIds: ['session-alpha'] },
    { path: 'E:\\code\\live', sessionIds: [] },
  ]

  // The state route counts the two scopes without touching anything.
  {
    const { ctx, routes } = fakeCtx({ workspaces: scopes })
    apply(ctx)
    const state = await call(routes, ROUTES.state)
    assert.equal(state.status, 200, JSON.stringify(state.body))
    assert.deepEqual(state.body.counts, { orphaned: 1, detached: 1, total: 2 })
    assert.deepEqual(state.body.settings, { version: 2, attachments: false })
    assert.equal(await exists(gone), true, 'reading the inventory deletes nothing')
  }

  // Attachments off: the scope goes with its records, and the bytes stay.
  {
    const { ctx, routes } = fakeCtx({ workspaces: scopes })
    apply(ctx)
    const outcome = await call(routes, ROUTES.bulk, { scope: 'detached' })
    assert.equal(outcome.status, 200, JSON.stringify(outcome.body))
    assert.deepEqual(outcome.body.removed, ['session-live'])
    assert.equal(await exists(live), false, 'the log directory goes')
    assert.equal(await exists(join(paths.cache, 'session-live.json')), false, 'the projection cache always goes')
    assert.equal(await exists(join(paths.attachments, 'objects', DIGEST_DROPPED.slice(0, 2), DIGEST_DROPPED)), true, 'attachments off keeps the bytes')
    assert.deepEqual(outcome.body.counts, { orphaned: 1, detached: 0 })
  }

  // With the attachment switch on, the scope goes and the bytes nothing
  // references go with it — but referenced bytes and recent writes stay.
  {
    const { ctx, routes } = fakeCtx({ workspaces: scopes })
    apply(ctx)
    const saved = await call(routes, ROUTES.settings, { attachments: true })
    assert.equal(saved.status, 200)
    assert.deepEqual(saved.body.settings, { version: 2, attachments: true })
    const outcome = await call(routes, ROUTES.bulk, { scope: 'orphaned' })
    assert.equal(outcome.status, 200, JSON.stringify(outcome.body))
    assert.deepEqual(outcome.body.removed, ['session-gone'])
    assert.equal(await exists(gone), false)
    assert.equal(await exists(join(paths.cache, 'session-gone.json')), false)
    assert.equal(outcome.body.attachments.objects, 1, 'the unreferenced object is collected')
    assert.equal(await exists(join(paths.attachments, 'objects', DIGEST_DROPPED.slice(0, 2), DIGEST_DROPPED)), false)
    assert.equal(await exists(join(paths.attachments, 'files', DIGEST_DROPPED.slice(0, 2), DIGEST_DROPPED)), false)
    assert.equal(await exists(join(paths.attachments, 'objects', DIGEST_KEPT.slice(0, 2), DIGEST_KEPT)), true, 'referenced bytes stay')
    assert.equal(await exists(join(paths.attachments, 'objects', DIGEST_FRESH.slice(0, 2), DIGEST_FRESH)), true, 'a fresh upload is inside the grace window')
    assert.deepEqual(outcome.body.counts, { orphaned: 0, detached: 0 })
  }

  // A cleanup request the Host cannot classify is refused instead of guessing.
  {
    const { ctx, routes } = fakeCtx({ registry: 'absent' })
    apply(ctx)
    const state = await call(routes, ROUTES.state)
    assert.equal(state.status, 503)
    assert.equal(state.body.code, 'registry-unavailable')
  }

  // Malformed requests are refused before anything is read or deleted.
  {
    const { ctx, routes } = fakeCtx({ workspaces: [{ path: 'E:\\code\\alpha', sessionIds: [] }] })
    apply(ctx)
    for (const scope of ['all', '', 7, undefined]) {
      const outcome = await call(routes, ROUTES.bulk, { scope })
      assert.equal(outcome.status, 400, JSON.stringify(scope))
      assert.equal(outcome.body.code, 'bad-request')
    }
    for (const sessionIds of [[], ['ok', 7], 'session-alpha', {}]) {
      const outcome = await call(routes, ROUTES.bulk, { sessionIds })
      assert.equal(outcome.status, 400, JSON.stringify(sessionIds))
      assert.equal(outcome.body.code, 'bad-request')
    }
    const settings = await call(routes, ROUTES.settings, { attachments: 'yes' })
    assert.equal(settings.status, 400)
  }

  // A running conversation is not part of either count, so the button never
  // promises a deletion it would refuse.
  {
    const busy = await seedSession(projectB, 'session-busy', { cwd: 'E:\\code\\busy', digest: DIGEST_FRESH })
    const { ctx, routes } = fakeCtx({
      workspaces: [{ path: 'E:\\code\\alpha', sessionIds: ['session-alpha'] }],
      running: ['session-busy'],
    })
    apply(ctx)
    const state = await call(routes, ROUTES.state)
    assert.deepEqual(state.body.counts, { orphaned: 0, detached: 0, total: 0 })
    assert.equal(await exists(busy), true)
  }

  // An explicit list deletes what it names in one visit, including the
  // conversations those named ones delegated. A named conversation that is
  // already gone reports a miss instead of a failure.
  {
    const batchRoot = 'session-batch-root'
    const batchChild = 'batch-child'
    await seedSession(projectD, batchRoot, { cwd: 'E:\\code\\batch' })
    await seedSession(projectD, batchChild, { cwd: 'E:\\code\\batch', parentSession: batchRoot, origin: 'subagent', withCache: true })
    const { ctx, routes } = fakeCtx()
    apply(ctx)
    const outcome = await call(routes, ROUTES.bulk, { sessionIds: [batchRoot, batchChild, 'session-batch-missing'] })
    assert.equal(outcome.status, 200, JSON.stringify(outcome.body))
    assert.deepEqual(outcome.body.removed.sort(), [batchChild, batchRoot].sort(), 'both named conversations are deleted')
    assert.deepEqual(outcome.body.failed, [{ sessionId: 'session-batch-missing', code: 'not-found' }])
    assert.equal(outcome.body.counts, undefined, 'an explicit list has no scope to count')
    assert.equal(await exists(join(paths.sessions, projectD, batchRoot)), false)
    assert.equal(await exists(join(paths.sessions, projectD, batchChild)), false)
    assert.equal(await exists(join(paths.cache, `${batchChild}.json`)), false)
  }

  // A delegated conversation never enters a scope of its own: a live
  // conversation's subagent is not garbage, and a child whose chain is broken is
  // the only delegated one worth cleaning.
  const lineageRoot = 'session-lineage-root'
  const lineageChild = 'lineage-child'
  const lineageGrandchild = 'lineage-grandchild'
  const strayChild = 'lineage-stray-child'
  const brokenRoot = 'session-lineage-broken-root'
  const orphanedGrandchild = 'lineage-orphaned-grandchild'
  const liveRoot = 'session-lineage-live-root'
  const liveChild = 'lineage-live-child'
  await seedSession(projectD, lineageRoot, { cwd: 'E:\\code\\lineage', withCache: true })
  await seedSession(projectD, lineageChild, { cwd: 'E:\\code\\lineage', parentSession: lineageRoot, origin: 'subagent', withCache: true })
  await seedSession(projectD, lineageGrandchild, { cwd: 'E:\\code\\lineage', parentSession: lineageChild, origin: 'subagent' })
  await seedSession(projectD, strayChild, { cwd: 'E:\\code\\lineage', parentSession: 'session-lineage-gone', origin: 'subagent' })
  // The middle generation is gone: the grandchild is reachable from neither the
  // root nor anything else, so it is a leftover like any other.
  await seedSession(projectD, brokenRoot, { cwd: 'E:\\code\\lineage' })
  await seedSession(projectD, orphanedGrandchild, { cwd: 'E:\\code\\lineage', parentSession: 'lineage-broken-middle', origin: 'subagent' })
  await seedSession(projectD, liveRoot, { cwd: 'E:\\code\\lineage' })
  await seedSession(projectD, liveChild, { cwd: 'E:\\code\\lineage', parentSession: liveRoot, origin: 'subagent' })
  const lineageWorkspace = { path: 'E:\\code\\lineage', sessionIds: [liveRoot] }
  {
    const { ctx, routes } = fakeCtx({
      workspaces: [{ path: 'E:\\code\\alpha', sessionIds: ['session-alpha'] }, lineageWorkspace],
      running: ['session-busy'],
    })
    apply(ctx)
    const state = await call(routes, ROUTES.state)
    assert.deepEqual(state.body.counts, { orphaned: 0, detached: 4, total: 4 })
    const outcome = await call(routes, ROUTES.bulk, { scope: 'detached' })
    assert.equal(outcome.status, 200, JSON.stringify(outcome.body))
    assert.deepEqual(outcome.body.removed.sort(), [brokenRoot, lineageRoot, orphanedGrandchild, strayChild].sort())
    assert.equal(await exists(join(paths.sessions, projectD, lineageChild)), false, 'a subagent conversation goes with its parent')
    assert.equal(await exists(join(paths.sessions, projectD, lineageGrandchild)), false, 'so does a grandchild')
    assert.equal(await exists(join(paths.cache, `${lineageChild}.json`)), false)
    assert.equal(await exists(join(paths.sessions, projectD, liveChild)), true, 'a stored conversation keeps its subagent conversations')
    assert.deepEqual(outcome.body.counts, { orphaned: 0, detached: 0 })
  }

  // A root whose subagent is working cannot be deleted, so it must not be
  // counted: the button may never promise a deletion the Host would refuse.
  {
    const panelRoot = 'session-panel-root'
    const panelChild = 'panel-busy-child'
    await seedSession(projectD, panelRoot, { cwd: 'E:\\code\\panel' })
    await seedSession(projectD, panelChild, { cwd: 'E:\\code\\panel', parentSession: panelRoot, origin: 'subagent' })
    const { ctx, routes } = fakeCtx({
      workspaces: [{ path: 'E:\\code\\alpha', sessionIds: ['session-alpha'] }, lineageWorkspace],
      running: [panelChild, 'session-busy'],
    })
    apply(ctx)
    const state = await call(routes, ROUTES.state)
    assert.deepEqual(state.body.counts, { orphaned: 0, detached: 0, total: 0 })
    assert.equal(await exists(join(paths.sessions, projectD, panelRoot)), true)
  }

  // A settings file this build cannot read refuses the request instead of
  // silently deciding about attachment bytes — and nothing is deleted first.
  {
    await mkdir(join(home, 'better-session'), { recursive: true })
    await writeFile(paths.settings, '{not json')
    await assert.rejects(() => readSettings(home), /not valid JSON/)
    const { ctx, routes } = fakeCtx({ workspaces: scopes })
    apply(ctx)
    const answer = await call(routes, ROUTES.remove, { sessionId: 'session-alpha' })
    assert.equal(answer.status, 500, JSON.stringify(answer.body))
    assert.match(answer.body.message, /not valid JSON/)
    assert.equal(await exists(alpha), true, 'the conversation survives a settings failure')
    await writeSettings(home, { attachments: true })
  }

  // A transcript that ends inside a frame may name an attachment this read
  // cannot see, so the reference set is incomplete and attachment collection is
  // skipped — the deletion itself still stands.
  {
    const torn = Buffer.concat([transcript([headerLine('session-torn', { cwd: 'E:\\code\\torn' })]), transcript(['{"type":"tail"}']).subarray(0, 6)])
    await seedLog(projectE, 'session-torn', torn)
    await assert.rejects(() => referencedDigests(home), /ends inside a frame/)

    const victimDigest = 'd4'.repeat(32)
    const leakedDigest = 'e5'.repeat(32)
    const victim = await seedSession(projectE, 'session-victim', { cwd: 'E:\\code\\torn', digest: victimDigest })
    await seedAttachment(victimDigest, 3_600_000)
    await seedAttachment(leakedDigest, 3_600_000)
    const host = fakeCtx()
    apply(host.ctx)
    const answer = await call(host.routes, ROUTES.remove, { sessionId: 'session-victim' })
    assert.equal(answer.status, 200, JSON.stringify(answer.body))
    assert.equal(answer.body.attachments, undefined, 'an incomplete reference set collects nothing')
    assert.equal(await exists(victim), false, 'the conversation still goes')
    assert.equal(await exists(join(paths.attachments, 'objects', leakedDigest.slice(0, 2), leakedDigest)), true, 'no byte is deleted on an incomplete reference set')
    assert.ok(host.warnings.some((line) => /attachment cleanup skipped/.test(line)), 'the skipped cleanup is reported')
  }

  console.log('cleanup: route checks passed')
} finally {
  await removeHome()
}
