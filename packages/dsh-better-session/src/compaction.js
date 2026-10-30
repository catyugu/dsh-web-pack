/**
 * The compaction settings: what the Harness compresses at, and the runtime
 * override that applies them to the engines the running sessions use.
 *
 * The Harness reads a compaction engine's configuration every time it prices
 * pressure, so replacing that configuration changes the behaviour of the
 * running sessions without touching the profile's own files: the official
 * configuration stays exactly as it was, and the plugin's settings live in the
 * Harness home.
 *
 * @module dsh-better-session/manage/compaction
 */
import { dshHome, readJson, settingsFile, writeJson } from './home.js'

/** The values the official engine ships with. */
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
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

/**
 * The settings artifact path.
 * @returns its absolute path.
 */
function settingsPath() {
  return settingsFile(dshHome(), 'compaction')
}

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
    enabled: source.enabled === true,
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
  if (typeof value.enabled !== 'boolean') return 'invalid-enabled'
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
 * Read the stored settings.
 *
 * A missing file is a fresh install and takes the defaults. A file this build
 * cannot read is an error: the settings decide how much context a session
 * keeps, and guessing them would silently change the conversation.
 * @returns the effective settings.
 */
export async function readSettings() {
  const parsed = await readJson(settingsPath(), 'compaction settings')
  if (parsed === undefined) return { ...DEFAULT_SETTINGS }
  return normalizeSettings(parsed)
}

/**
 * Persist the settings.
 * @param settings - the settings to store.
 * @returns the stored settings.
 */
export async function writeSettings(settings) {
  const value = normalizeSettings(settings)
  await writeJson(settingsPath(), value)
  return value
}

/**
 * The settings one engine configuration stands for.
 * @param config - an engine's configuration.
 * @returns the settings those values describe.
 */
function settingsFrom(config) {
  if (config === null || typeof config !== 'object') return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
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
 * One engine's configuration with the plugin's settings applied.
 * @param config - the engine's own configuration.
 * @param settings - the plugin's settings.
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
 * Apply the settings to the engines the running sessions use.
 *
 * The original configurations are remembered so the plugin can give them back
 * when it is disabled or removed.
 * @param ctx - host context.
 * @param settingsProvider - reads the settings that are in force.
 * @returns the controller.
 */
export function createRuntimeController(ctx, settingsProvider) {
  const originals = new WeakMap()
  const touched = new Set()
  /** The engine's own values, read before this plugin patches anything. */
  const official = settingsFrom(ctx.get?.('compaction')?.config)

  /**
   * Apply the settings to one engine.
   * @param engine - the engine to patch.
   * @param settings - the settings in force.
   * @param agent - the agent whose route the configuration addresses.
   */
  const patch = (engine, settings, agent) => {
    if (engine === null || typeof engine !== 'object' || engine.config === undefined) return
    if (!originals.has(engine)) {
      originals.set(engine, engine.config)
      touched.add(engine)
    }
    engine.config = withSettings(engine.config, settings, agent)
  }

  /**
   * Apply the settings to one agent's engine.
   * @param agent - live agent.
   */
  const applyToAgent = (agent) => {
    const settings = settingsProvider()
    if (!settings.enabled) return
    patch(engineOf(ctx, agent), settings, agent)
  }

  /**
   * Apply the settings to every live agent.
   */
  const applyToLiveAgents = () => {
    const settings = settingsProvider()
    if (!settings.enabled) {
      restore()
      return
    }
    const agents = typeof ctx.agents?.list === 'function' ? ctx.agents.list() : []
    for (const agent of agents) applyToAgent(agent)
    const root = ctx.get?.('compaction')
    if (root !== undefined) patch(root, settings, undefined)
  }

  /**
   * Give every patched engine its own configuration back.
   */
  const restore = () => {
    for (const engine of touched) {
      const original = originals.get(engine)
      if (original !== undefined) engine.config = original
      originals.delete(engine)
    }
    touched.clear()
  }

  return {
    applyToAgent,
    applyToLiveAgents,
    restore,
    defaults: () => ({ ...official }),
  }
}
