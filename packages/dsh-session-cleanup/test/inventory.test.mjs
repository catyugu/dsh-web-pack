/**
 * Inventory checks for the session cleanup sub-component: what the stored
 * Sessions say, which of them no workspace accounts for, what attachment bytes
 * the surviving transcripts name, and how the cleanup settings round-trip.
 *
 * This suite reads the disk only; what the routes do with that inventory is
 * checked in `bulk.test.mjs`.
 */
import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { zstdCompressSync } from 'node:zlib'
import { referencedDigests } from '../src/attachments.js'
import { frameRanges } from '../src/logs.js'
import { classifySessions } from '../src/sessions.js'
import { readSettings, scanSessions, writeSettings } from '../src/store.js'
import {
  home,
  paths,
  removeHome,
  resetHome,
  seedAttachment,
  seedBrokenSession,
  seedSession,
  transcript,
} from './support.mjs'

const DIGEST_KEPT = 'a1'.repeat(32)
const DIGEST_DROPPED = 'b2'.repeat(32)
const DIGEST_FRESH = 'c3'.repeat(32)

const projectA = '--E-code-alpha--'
const projectB = '--E-code-gone--'
const projectC = '--E-code-live--'

await resetHome()

try {
  await seedSession(projectB, 'session-gone', { cwd: 'E:\\code\\gone', digest: DIGEST_DROPPED, withCache: true })
  await seedSession(projectC, 'session-live', { cwd: 'E:\\code\\live', digest: DIGEST_DROPPED, withCache: true })
  const removed = await seedSession(projectC, 'session-removed', { cwd: 'E:\\code\\live', digest: DIGEST_KEPT })
  await seedSession(projectA, 'session-alpha', { cwd: 'E:\\code\\alpha', digest: DIGEST_KEPT, withCache: true })
  await seedBrokenSession(projectB, 'session-unreadable')
  await rm(removed, { recursive: true, force: true })
  await seedAttachment(DIGEST_KEPT, 3_600_000)
  await seedAttachment(DIGEST_DROPPED, 3_600_000)
  await seedAttachment(DIGEST_FRESH, 0)

  // The inventory reads the header cwd out of a compressed transcript.
  {
    const scanned = await scanSessions(home)
    assert.equal(scanned.length, 4, 'every stored Session is inventoried')
    const alpha = scanned.find((record) => record.id === 'session-alpha')
    assert.equal(alpha.cwd, 'E:\\code\\alpha')
    assert.equal(alpha.project, projectA)
    const broken = scanned.find((record) => record.id === 'session-unreadable')
    assert.equal(broken.headerUnreadable, true, 'a header that does not decode is marked, not guessed')
  }

  // A torn trailing frame is ignored instead of failing the whole frame scan.
  {
    const intact = transcript(['{"type":"a"}', '{"type":"b"}'])
    const torn = Buffer.concat([intact, zstdCompressSync(Buffer.from('{"type":"c"}\n')).subarray(0, 6)])
    assert.equal(frameRanges(torn).length, 2)
  }

  // Classification: no workspace for the cwd means orphaned; a workspace that
  // does not list the id means detached; a header this build cannot decode is
  // never a candidate.
  {
    const scanned = await scanSessions(home)
    const classified = classifySessions(scanned, [
      { path: 'E:\\code\\alpha', sessionIds: ['session-alpha'] },
      { path: 'e:/code/live/', sessionIds: [] },
    ])
    assert.deepEqual(classified.orphaned.map((record) => record.id), ['session-gone'])
    assert.deepEqual(classified.detached.map((record) => record.id), ['session-live'])
  }

  // A delegated conversation whose parent this process still holds is not
  // garbage, even though the parent's log is not on disk.
  {
    const stored = [{
      id: 'logless-child',
      project: 'x',
      directory: 'x',
      origin: 'subagent',
      parentSession: 'held-parent',
      cwd: 'E:\\code\\alpha',
    }]
    assert.deepEqual(classifySessions(stored, [{ path: 'E:\\code\\alpha', sessionIds: [] }], ['held-parent']).detached, [])
    assert.deepEqual(classifySessions(stored, [{ path: 'E:\\code\\alpha', sessionIds: [] }]).detached.map((record) => record.id), ['logless-child'], 'without the live parent the child is a leftover')
  }

  // The reference set is what the surviving transcripts name.
  {
    const referenced = await referencedDigests(home)
    assert.deepEqual([...referenced].sort(), [DIGEST_KEPT, DIGEST_DROPPED].sort())
  }

  // Settings default on, then round-trip through the artifact. The projection
  // cache and the registry entries have no switch: they always go.
  {
    assert.deepEqual(await readSettings(home), { version: 2, attachments: true })
    const stored = await writeSettings(home, { attachments: false })
    assert.deepEqual(stored, { version: 2, attachments: false })
    assert.deepEqual(await readSettings(home), stored)
    assert.deepEqual(JSON.parse(await readFile(paths.settings, 'utf8')), stored)
  }

  console.log('cleanup: inventory checks passed')
} finally {
  await removeHome()
}
