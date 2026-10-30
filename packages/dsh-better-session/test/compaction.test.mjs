/**
 * The per-session compaction settings: where they live, what a submission may
 * say, and which values a fresh install starts from.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  readGlobalSettings,
  readSessionSettings,
  validateSettings,
  writeGlobalSettings,
  writeSessionSettings,
} from '../src/compaction.js'
import { removeHome, resetHome } from './support.mjs'

await resetHome()
const home = process.env.DSH_HOME

const sessionId = 'session-compaction'
const sessionDirectory = join(home, 'sessions', '--workspace--', sessionId)
await mkdir(sessionDirectory, { recursive: true })

// A session without a file inherits, so the reader says so instead of guessing.
assert.equal(await readSessionSettings(home, sessionId), undefined)

// What the session stores is the file in its own directory.
const stored = await writeSessionSettings(home, sessionId, {
  thresholdRatio: 0.5,
  retainRatio: 0.12,
  maxTokens: 4096,
  compactionRetries: 2,
  maxOverflowRetries: 0,
})
assert.deepEqual(stored, {
  thresholdRatio: 0.5,
  retainRatio: 0.12,
  maxTokens: 4096,
  compactionRetries: 2,
  maxOverflowRetries: 0,
})
assert.deepEqual(JSON.parse(await readFile(join(sessionDirectory, 'better-session.json'), 'utf8')), stored)
assert.deepEqual(await readSessionSettings(home, sessionId), stored)

// The global base lives beside the pack, not in a plugin directory of its own.
assert.equal(await readGlobalSettings(home), undefined)
const global = await writeGlobalSettings(home, { thresholdRatio: 0.7, retainRatio: 0.2 })
assert.equal(global.thresholdRatio, 0.7)
assert.equal((await readGlobalSettings(home)).retainRatio, 0.2)
const globalFile = join(home, 'dsh-web-pack', 'better-session', 'compaction.json')
assert.equal(JSON.parse(await readFile(globalFile, 'utf8')).thresholdRatio, 0.7)

// A submission is checked before anything is written.
const valid = { thresholdRatio: 0.5, retainRatio: 0.1, maxTokens: 4096, compactionRetries: 1, maxOverflowRetries: 1 }
assert.equal(validateSettings(valid), undefined)
assert.equal(validateSettings({ ...valid, thresholdRatio: 0.3, retainRatio: 0.3 }), 'retain-ratio-not-less-than-threshold')
assert.equal(validateSettings({ ...valid, thresholdRatio: 0.2 }), 'invalid-threshold-ratio')
assert.equal(validateSettings({ ...valid, retainRatio: 0.31 }), 'invalid-retain-ratio')
assert.equal(validateSettings({ ...valid, maxTokens: 16 }), 'invalid-max-tokens')
assert.equal(validateSettings({ ...valid, compactionRetries: 99 }), 'invalid-compaction-retries')
assert.equal(validateSettings({ ...valid, maxOverflowRetries: 99 }), 'invalid-max-overflow-retries')
assert.equal(validateSettings(null), 'bad-request')

// Normalizing keeps the retained tail below the threshold and clamps the rest.
assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS)
assert.deepEqual(normalizeSettings({ thresholdRatio: 0.3, retainRatio: 0.3 }), {
  thresholdRatio: 0.3,
  retainRatio: 0.29,
  maxTokens: DEFAULT_SETTINGS.maxTokens,
  compactionRetries: DEFAULT_SETTINGS.compactionRetries,
  maxOverflowRetries: DEFAULT_SETTINGS.maxOverflowRetries,
})
assert.equal(normalizeSettings({ thresholdRatio: 5 }).thresholdRatio, 0.9)

// A session the store does not hold yet is refused, not written somewhere else.
await assert.rejects(
  () => writeSessionSettings(home, 'session-nothing', { thresholdRatio: 0.5 }),
  (error) => error.code === 'SESSION_NOT_STORED',
)

await removeHome()
console.log('manage: per-session compaction checks passed')
