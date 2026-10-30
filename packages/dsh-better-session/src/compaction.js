/**
 * The compaction settings of one session.
 *
 * The Harness reads a compaction engine's configuration every time it prices
 * pressure, so replacing that configuration changes what one conversation
 * compacts at without touching the profile's own files. The settings belong to
 * the session: they live in the session's own directory, they are read when the
 * agent takes a step, and a subagent inherits its parent's values.
 *
 * @module dsh-better-session/compaction
 */
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { dshHome, packFile, readJson, sessionDirectory, writeJson } from './home.js'

/** The values the official engine ships with. */
export const DEFAULT_SETTINGS = Object.freeze({
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  maxTokens: 8192,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})

/** The range each setting accepts. */
export const LIMITS = Object.freeze({
  thresholdRatio: [0.3, 0.9],
  retainRatio: [0.01, 0.3],
  maxTokens: [256, 65536],
  retries: [0, 10],
})

/** The settings artifact inside one session directory. */
const FILE = 'better-session.json'

/**
 * Clamp one number into its range.
 * @param value - the submitted value.
 * @param fallback - the value to use when the submission is not a number.
 * @param range - the accepted range.
 * @returns the clamped value.
 */
function clamp(value, fallback, range) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(range[1], Math.max(range[0], number))
}

/**
 * The settings a submission asks for.
 * @param value - the submitted settings.
 * @param defaults - the values used for fields the submission leaves out.
 * @returns the effective settings.
 */
export function normalizeSettings(value, defaults = DEFAULT_SETTINGS) {
  const source = value !== null && typeof value === 'object' ? value : {}
  const thresholdRatio = clamp(source.thresholdRatio, defaults.thresholdRatio, LIMITS.thresholdRatio)
  const retainRatio = clamp(source.retainRatio, defaults.retainRatio, LIMITS.retainRatio)
  return {
    thresholdRatio,
    // The retained tail has to stay below the pressure threshold, or the
    // engine would compact into a context that is still under pressure.
    retainRatio: Math.min(retainRatio, thresholdRatio - 0.01),
    maxTokens: Math.trunc(clamp(source.maxTokens, defaults.maxTokens, LIMITS.maxTokens)),
    compactionRetries: Math.trunc(clamp(source.compactionRetries, defaults.compactionRetries, LIMITS.retries)),
    maxOverflowRetries: Math.trunc(clamp(source.maxOverflowRetries, defaults.maxOverflowRetries, LIMITS.retries)),
  }
}

/**
 * Check one submission.
 * @param value - the submitted settings.
 * @returns the reason the submission is refused, or undefined when it is fine.
 */
export function validateSettings(value) {
  if (value === null || typeof value !== 'object') return 'bad-request'
  if (!isNumberInRange(value.thresholdRatio, LIMITS.thresholdRatio)) return 'invalid-threshold-ratio'
  if (!isNumberInRange(value.retainRatio, LIMITS.retainRatio)) return 'invalid-retain-ratio'
  if (value.retainRatio >= value.thresholdRatio) return 'retain-ratio-not-less-than-threshold'
  if (!isIntegerInRange(value.maxTokens, LIMITS.maxTokens)) return 'invalid-max-tokens'
  if (!isIntegerInRange(value.compactionRetries, LIMITS.retries)) return 'invalid-compaction-retries'
  if (!isIntegerInRange(value.maxOverflowRetries, LIMITS.retries)) return 'invalid-max-overflow-retries'
  return undefined
}

/**
 * Whether one number sits inside a range.
 * @param value - the submitted number.
 * @param range - the accepted range.
 * @returns true when the number is acceptable.
 */
function isNumberInRange(value, range) {
  return typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1]
}

/**
 * Whether one integer sits inside a range.
 * @param value - the submitted number.
 * @param range - the accepted range.
 * @returns true when the number is acceptable.
 */
function isIntegerInRange(value, range) {
  return Number.isInteger(value) && value >= range[0] && value <= range[1]
}

/**
 * Read one session's settings.
 * @param home - the Harness home directory.
 * @param sessionId - the session identity.
 * @returns the stored settings, or undefined when the session inherits.
 */
export async function readSessionSettings(home, sessionId) {
  const directory = await sessionDirectory(home, sessionId)
  if (directory === undefined) return undefined
  const parsed = await readJson(join(directory, FILE), 'session compaction settings')
  return parsed === undefined ? undefined : normalizeSettings(parsed)
}

/**
 * Store one session's settings.
 * @param home - the Harness home directory.
 * @param sessionId - the session identity.
 * @param value - the submitted settings.
 * @returns the stored settings.
 * @throws {Error} with code `SESSION_NOT_STORED` when the session has no directory.
 */
export async function writeSessionSettings(home, sessionId, value) {
  const directory = await sessionDirectory(home, sessionId)
  if (directory === undefined) {
    throw Object.assign(new Error(`session "${sessionId}" has no directory yet`), { code: 'SESSION_NOT_STORED' })
  }
  const settings = normalizeSettings(value)
  await writeJson(join(directory, FILE), settings)
  return settings
}

/**
 * Drop one session's settings, so the session inherits the profile's values.
 * @param home - the Harness home directory.
 * @param sessionId - the session identity.
 */
export async function clearSessionSettings(home, sessionId) {
  const directory = await sessionDirectory(home, sessionId)
  if (directory === undefined) return
  await rm(join(directory, FILE), { force: true })
}

/**
 * Read the pack's global settings, the base every session inherits.
 * @param home - the Harness home directory.
 * @returns the stored settings, or undefined when the pack has none.
 */
export async function readGlobalSettings(home) {
  const parsed = await readJson(packFile(home, 'compaction'), 'global compaction settings')
  return parsed === undefined ? undefined : normalizeSettings(parsed)
}

/**
 * Store the pack's global settings.
 * @param home - the Harness home directory.
 * @param value - the submitted settings.
 * @returns the stored settings.
 */
export async function writeGlobalSettings(home, value) {
  const settings = normalizeSettings(value)
  await writeJson(packFile(home, 'compaction'), settings)
  return settings
}

/**
 * Drop the pack's global settings.
 * @param home - the Harness home directory.
 */
export async function clearGlobalSettings(home) {
  await rm(packFile(home, 'compaction'), { force: true })
}

/**
 * The settings one engine configuration stands for.
 * @param config - an engine's configuration.
 * @returns the settings those values describe.
 */
function settingsFrom(config) {
  if (config === null || typeof config !== 'object') return { ...DEFAULT_SETTINGS }
  return {
    thresholdRatio: numberOr(config.thresholdRatio, DEFAULT_SETTINGS.thresholdRatio),
    retainRatio: numberOr(config.retainRatio, DEFAULT_SETTINGS.retainRatio),
    maxTokens: numberOr(config.maxTokens, DEFAULT_SETTINGS.maxTokens),
    compactionRetries: numberOr(config.compactionRetries, DEFAULT_SETTINGS.compactionRetries),
    maxOverflowRetries: numberOr(config.maxOverflowRetries, DEFAULT_SETTINGS.maxOverflowRetries),
  }
}

/**
 * One number, or a fallback.
 * @param value - the candidate.
 * @param fallback - the value used when the candidate is not a number.
 * @returns the number.
 */
function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * The route an agent's request takes, when the session names one.
 * @param agent - live agent.
 * @returns the provider and model, or undefined.
 */
function routeOf(agent) {
  const routed = agent?.session?.requestHeader?.()?.config
  if (typeof routed?.provider === 'string' && routed.provider.length > 0
    && typeof routed?.model === 'string' && routed.model.length > 0) {
    return { provider: routed.provider, model: routed.model }
  }
  const provider = agent?.options?.provider
  const model = agent?.options?.model
  if (typeof provider === 'string' && provider.length > 0 && typeof model === 'string' && model.length > 0) {
    return { provider, model }
  }
  return undefined
}

/**
 * One engine's configuration with the session's settings applied.
 * @param config - the engine's own configuration.
 * @param settings - the settings in force.
 * @param agent - the agent whose route the configuration addresses.
 * @returns the patched configuration.
 */
function withSettings(config, settings, agent) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const { retainTokens: _retainTokens, ...rest } = source
  const patched = {
    ...rest,
    thresholdRatio: settings.thresholdRatio,
    retainRatio: settings.retainRatio,
    maxTokens: settings.maxTokens,
    compactionRetries: settings.compactionRetries,
    maxOverflowRetries: settings.maxOverflowRetries,
  }
  const route = routeOf(agent)
  if (route === undefined || !Array.isArray(source.modelPolicies)) return Object.freeze(patched)
  return Object.freeze({
    ...patched,
    modelPolicies: Object.freeze(source.modelPolicies.map((policy) => (
      policy?.provider === route.provider && policy?.model === route.model
        ? Object.freeze({ ...policy, ...patched })
        : policy
    ))),
  })
}

/**
 * The compaction engine one agent uses.
 * @param ctx - host context.
 * @param agent - live agent.
 * @returns the engine, or undefined when the agent has none.
 */
function engineOf(ctx, agent) {
  const scoped = ctx.get?.('agentPresets')?.serviceFor?.(agent, 'compaction')
  return scoped ?? ctx.get?.('compaction')
}

/**
 * Apply one session's settings to its agent, and give them back on reset.
 *
 * The engine's own configuration is remembered the first time it is patched, so
 * "reset" restores exactly what the profile shipped.
 * @param ctx - host context.
 * @returns the controller.
 */
export function createSessionController(ctx) {
  const originals = new WeakMap()
  /** The engine's own values, read before this plugin patches anything. */
  const official = settingsFrom(ctx.get?.('compaction')?.config)

  /**
   * Apply the settings to one agent's engine.
   * @param agent - live agent.
   * @param settings - the settings in force.
   */
  const apply = (agent, settings) => {
    const engine = engineOf(ctx, agent)
    if (engine === null || typeof engine !== 'object' || engine.config === undefined) return
    if (!originals.has(engine)) originals.set(engine, engine.config)
    engine.config = withSettings(engine.config, settings, agent)
  }

  /**
   * Give one agent's engine its own configuration back.
   * @param agent - live agent.
   */
  const restore = (agent) => {
    const engine = engineOf(ctx, agent)
    if (engine === null || typeof engine !== 'object') return
    const original = originals.get(engine)
    if (original === undefined) return
    engine.config = original
    originals.delete(engine)
  }

  return {
    apply,
    restore,
    defaults: () => ({ ...official }),
    /** The home this plugin reads its per-session files from. */
    home: dshHome(),
  }
}
