/**
 * The per-session compaction settings: where they live, what a submission may
 * say, which values a fresh install starts from, and what reaches the engine.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_SETTINGS,
  createSessionController,
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

// What the session stores is the file in its own directory, in the share form
// unless the submission names a token count.
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
  headroomTokens: DEFAULT_SETTINGS.headroomTokens,
  maxTokens: 4096,
  compactionRetries: 2,
  maxOverflowRetries: 0,
})
assert.deepEqual(JSON.parse(await readFile(join(sessionDirectory, 'better-session.json'), 'utf8')), stored)
assert.deepEqual(await readSessionSettings(home, sessionId), stored)

// The token form replaces the share, never joins it.
const tokenStored = await writeSessionSettings(home, sessionId, {
  thresholdRatio: 0.6,
  retainTokens: 8192,
  headroomTokens: 2048,
  maxTokens: 4096,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})
assert.equal(tokenStored.retainTokens, 8192)
assert.equal(tokenStored.retainRatio, undefined)
assert.equal(tokenStored.headroomTokens, 2048)
assert.equal((await readSessionSettings(home, sessionId)).retainTokens, 8192)

// A record written before the headroom setting existed reads with that setting's
// shipped value instead of failing.
await writeFile(join(sessionDirectory, 'better-session.json'), JSON.stringify({
  thresholdRatio: 0.5,
  retainRatio: 0.1,
  maxTokens: 4096,
  compactionRetries: 1,
  maxOverflowRetries: 1,
}))
assert.equal((await readSessionSettings(home, sessionId)).headroomTokens, DEFAULT_SETTINGS.headroomTokens)

// The global base lives beside the pack, not in a plugin directory of its own.
assert.equal(await readGlobalSettings(home), undefined)
const global = await writeGlobalSettings(home, { thresholdRatio: 0.7, retainRatio: 0.2 })
assert.equal(global.thresholdRatio, 0.7)
assert.equal((await readGlobalSettings(home)).retainRatio, 0.2)
const globalFile = join(home, 'dsh-web-pack', 'better-session', 'compaction.json')
assert.equal(JSON.parse(await readFile(globalFile, 'utf8')).thresholdRatio, 0.7)

// A submission is checked before anything is written.
const valid = {
  thresholdRatio: 0.5,
  retainRatio: 0.1,
  headroomTokens: 65536,
  maxTokens: 4096,
  compactionRetries: 1,
  maxOverflowRetries: 1,
}
assert.equal(validateSettings(valid), undefined)
assert.equal(validateSettings({ ...valid, thresholdRatio: 0.3, retainRatio: 0.3 }), 'retain-ratio-not-less-than-threshold')
assert.equal(validateSettings({ ...valid, thresholdRatio: 0.2 }), 'invalid-threshold-ratio')
assert.equal(validateSettings({ ...valid, retainRatio: 0.31 }), 'invalid-retain-ratio')
assert.equal(validateSettings({ ...valid, retainRatio: undefined }), 'invalid-retain-ratio')
assert.equal(validateSettings({ ...valid, retainTokens: 4096, retainRatio: undefined }), undefined)
assert.equal(validateSettings({ ...valid, retainTokens: 4096 }), 'retain-form-conflict')
assert.equal(validateSettings({ ...valid, retainTokens: 16, retainRatio: undefined }), 'invalid-retain-tokens')
assert.equal(validateSettings({ ...valid, headroomTokens: -1 }), 'invalid-headroom-tokens')
assert.equal(validateSettings({ ...valid, headroomTokens: 1.5 }), 'invalid-headroom-tokens')
assert.equal(validateSettings({ ...valid, maxTokens: 16 }), 'invalid-max-tokens')
assert.equal(validateSettings({ ...valid, compactionRetries: 99 }), 'invalid-compaction-retries')
assert.equal(validateSettings({ ...valid, maxOverflowRetries: 99 }), 'invalid-max-overflow-retries')
assert.equal(validateSettings(null), 'bad-request')

// Normalizing keeps the retained share below the threshold and clamps the rest.
assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS)
assert.deepEqual(normalizeSettings({ thresholdRatio: 0.3, retainRatio: 0.3 }), {
  thresholdRatio: 0.3,
  retainRatio: 0.29,
  headroomTokens: DEFAULT_SETTINGS.headroomTokens,
  maxTokens: DEFAULT_SETTINGS.maxTokens,
  compactionRetries: DEFAULT_SETTINGS.compactionRetries,
  maxOverflowRetries: DEFAULT_SETTINGS.maxOverflowRetries,
})
assert.equal(normalizeSettings({ thresholdRatio: 5 }).thresholdRatio, 0.9)
assert.equal(normalizeSettings({ retainTokens: 9999999 }).retainTokens, 1_048_576)
assert.equal(normalizeSettings({ retainTokens: 4096, retainRatio: 0.2 }).retainTokens, 4096)
assert.equal(normalizeSettings({ retainTokens: 4096, retainRatio: 0.2 }).retainRatio, undefined)
assert.equal(normalizeSettings({ headroomTokens: -5 }).headroomTokens, 0)

// A session the store does not hold yet is refused, not written somewhere else.
await assert.rejects(
  () => writeSessionSettings(home, 'session-nothing', { thresholdRatio: 0.5 }),
  (error) => error.code === 'SESSION_NOT_STORED',
)

// The engine patch: the session's values replace the engine's, one retained form
// survives, the matching routed policy takes the same values, and the rest of
// the engine's configuration is left alone.
const engineConfig = Object.freeze({
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  headroomTokens: 65536,
  maxTokens: 65536,
  compactionRetries: 1,
  maxOverflowRetries: 1,
  modelPolicies: Object.freeze([
    { provider: 'p', model: 'm', thresholdRatio: 0.7 },
    { provider: 'other', model: 'x', thresholdRatio: 0.6 },
  ]),
  summarizationProvider: 's',
  summarizationModel: 'sm',
  auto: true,
})
const engine = { config: engineConfig }
const agent = { session: { requestHeader: () => ({ config: { provider: 'p', model: 'm' } }) } }
const rootContext = { get: (name) => (name === 'compaction' ? engine : undefined) }
const controller = createSessionController(rootContext)

controller.apply(agent, {
  thresholdRatio: 0.5,
  retainTokens: 8192,
  headroomTokens: 4096,
  maxTokens: 2048,
  compactionRetries: 2,
  maxOverflowRetries: 0,
})
assert.equal(engine.config.thresholdRatio, 0.5)
assert.equal(engine.config.retainTokens, 8192)
assert.equal(engine.config.retainRatio, undefined)
assert.equal(engine.config.headroomTokens, 4096)
assert.equal(engine.config.maxTokens, 2048)
assert.equal(engine.config.modelPolicies[0].thresholdRatio, 0.5)
assert.equal(engine.config.modelPolicies[0].retainTokens, 8192)
assert.equal(engine.config.modelPolicies[0].retainRatio, undefined)
assert.equal(engine.config.modelPolicies[0].modelPolicies, undefined)
assert.equal(engine.config.modelPolicies[1].thresholdRatio, 0.6)
assert.equal(engine.config.summarizationProvider, 's')
assert.equal(engine.config.auto, true)
assert.deepEqual(controller.defaultsFor(agent), {
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  headroomTokens: 65536,
  maxTokens: 65536,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})
controller.restore(agent)
assert.equal(engine.config, engineConfig)

// A preset-scoped engine is the one a session actually uses; the profile-level
// service is only the fallback for a conversation with no live agent.
const scopedConfig = Object.freeze({
  thresholdRatio: 0.4,
  retainRatio: 0.1,
  headroomTokens: 1024,
  maxTokens: 1024,
  compactionRetries: 0,
  maxOverflowRetries: 0,
})
const scoped = { config: scopedConfig }
const scopedContext = {
  get: (name) => {
    if (name === 'agentPresets') return { serviceFor: () => scoped }
    if (name === 'compaction') return engine
    return undefined
  },
}
const scopedController = createSessionController(scopedContext)
assert.equal(scopedController.defaultsFor(agent).thresholdRatio, 0.4)
assert.equal(scopedController.defaultsFor(undefined).thresholdRatio, 0.8)

// Every ctx.get hands out a fresh traceable proxy for the same service, so the
// original configuration is remembered against the service, not the proxy.
const rawConfig = Object.freeze({
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  headroomTokens: 65536,
  maxTokens: 65536,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})
const rawEngine = { config: rawConfig }
const traceable = () => new Proxy(rawEngine, {
  get: (target, prop) => (prop === Symbol.for('cordis.original') ? target : Reflect.get(target, prop)),
  set: (target, prop, value) => Reflect.set(target, prop, value),
})
const proxyController = createSessionController({ get: (name) => (name === 'compaction' ? traceable() : undefined) })
proxyController.apply(agent, {
  thresholdRatio: 0.5,
  retainTokens: 4096,
  headroomTokens: 1024,
  maxTokens: 2048,
  compactionRetries: 0,
  maxOverflowRetries: 0,
})
assert.equal(rawEngine.config.retainTokens, 4096)
assert.equal(proxyController.defaultsFor(agent).retainRatio, 0.16)
proxyController.restore(agent)
assert.equal(rawEngine.config, rawConfig)

// An engine that cannot keep the patched configuration is reported instead of
// leaving the panel to claim a policy that never reached it.
const locked = {}
Object.defineProperty(locked, 'config', { value: Object.freeze({ thresholdRatio: 0.8 }), writable: false })
const lockedController = createSessionController({ get: (name) => (name === 'compaction' ? locked : undefined) })
assert.throws(
  () => lockedController.apply(agent, DEFAULT_SETTINGS),
  /refused its configuration|did not keep the configuration/,
)

await removeHome()
console.log('manage: per-session compaction checks passed')
