/**
 * The compaction settings of one session.
 *
 * The Harness reads a compaction engine's configuration every time it prices
 * pressure, so replacing that configuration changes what one conversation
 * compacts at without touching the profile's own files. The settings belong to
 * the session: they live in the session's own directory, they are read when the
 * agent takes a step, and a subagent inherits its parent's values.
 *
 * A policy keeps its recent context either as a share of the message budget or
 * as an exact token count; the two forms are mutually exclusive, and a
 * submission names exactly one of them.
 *
 * @module dsh-better-session/compaction
 */
import { join } from 'node:path'
import { dshHome, packFile, readJson, sessionDirectory, writeJson } from './home.js'

/** The values the official engine ships with. */
export const DEFAULT_SETTINGS = Object.freeze({
  thresholdRatio: 0.8,
  retainRatio: 0.16,
  headroomTokens: 65536,
  maxTokens: 65536,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})

/** The range each setting accepts. */
export const LIMITS = Object.freeze({
  thresholdRatio: [0.3, 0.9],
  retainRatio: [0.01, 0.3],
  retainTokens: [256, 1_048_576],
  headroomTokens: [0, 1_048_576],
  maxTokens: [256, 1_048_576],
  retries: [0, 10],
})

/** The settings artifact inside one session directory. */
const FILE = 'better-session.json'

/** Cordis's shared identity symbol: a traceable proxy answers with the service it wraps. */
const SERVICE_ORIGINAL = Symbol.for('cordis.original')

/**
 * The service behind one context proxy.
 *
 * Every `ctx.get()` hands out a fresh traceable proxy for the same service, so a
 * WeakMap keyed by the proxy forgets its entry on the next read; the wrapped
 * service is the stable identity.
 * @param value - a service as a context returns it.
 * @returns the service itself.
 */
function serviceTarget(value) {
  if (value === null || typeof value !== 'object') return value
  const original = value[SERVICE_ORIGINAL]
  return original !== null && typeof original === 'object' ? original : value
}

/**
 * Whether a value is a plain object.
 * @param value - the candidate.
 * @returns true for a non-null, non-array object.
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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
 * One number, or a fallback.
 * @param value - the candidate.
 * @param fallback - the value used when the candidate is not a number.
 * @returns the number.
 */
function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * The retained-context fields one submission asks for.
 *
 * A submission names one form explicitly. Without either form the base decides;
 * an unreadable value falls back to that form's own default, so a damaged record
 * still yields a policy the engine accepts.
 * @param source - the submitted settings.
 * @param base - the values the submission leaves out.
 * @param thresholdRatio - the pressure threshold the ratio form must stay under.
 * @returns either `retainRatio` or `retainTokens`.
 */
function retentionSettings(source, base, thresholdRatio) {
  if (source.retainTokens !== undefined) {
    return {
      retainTokens: Math.trunc(clamp(source.retainTokens, numberOr(base.retainTokens, LIMITS.retainTokens[0]), LIMITS.retainTokens)),
    }
  }
  if (source.retainRatio !== undefined) {
    return {
      retainRatio: Math.min(
        clamp(source.retainRatio, numberOr(base.retainRatio, DEFAULT_SETTINGS.retainRatio), LIMITS.retainRatio),
        thresholdRatio - 0.01,
      ),
    }
  }
  if (base.retainTokens !== undefined) {
    return {
      retainTokens: Math.trunc(clamp(base.retainTokens, LIMITS.retainTokens[0], LIMITS.retainTokens)),
    }
  }
  return {
    retainRatio: Math.min(
      clamp(base.retainRatio, DEFAULT_SETTINGS.retainRatio, LIMITS.retainRatio),
      thresholdRatio - 0.01,
    ),
  }
}

/**
 * The settings a submission asks for.
 * @param value - the submitted settings.
 * @param defaults - the values used for fields the submission leaves out.
 * @returns the effective settings.
 */
export function normalizeSettings(value, defaults = DEFAULT_SETTINGS) {
  const source = isRecord(value) ? value : {}
  const base = isRecord(defaults) ? defaults : DEFAULT_SETTINGS
  const thresholdRatio = clamp(
    source.thresholdRatio,
    numberOr(base.thresholdRatio, DEFAULT_SETTINGS.thresholdRatio),
    LIMITS.thresholdRatio,
  )
  return {
    thresholdRatio,
    ...retentionSettings(source, base, thresholdRatio),
    headroomTokens: Math.trunc(clamp(
      source.headroomTokens,
      numberOr(base.headroomTokens, DEFAULT_SETTINGS.headroomTokens),
      LIMITS.headroomTokens,
    )),
    maxTokens: Math.trunc(clamp(
      source.maxTokens,
      numberOr(base.maxTokens, DEFAULT_SETTINGS.maxTokens),
      LIMITS.maxTokens,
    )),
    compactionRetries: Math.trunc(clamp(
      source.compactionRetries,
      numberOr(base.compactionRetries, DEFAULT_SETTINGS.compactionRetries),
      LIMITS.retries,
    )),
    maxOverflowRetries: Math.trunc(clamp(
      source.maxOverflowRetries,
      numberOr(base.maxOverflowRetries, DEFAULT_SETTINGS.maxOverflowRetries),
      LIMITS.retries,
    )),
  }
}

/**
 * Check one submission.
 * @param value - the submitted settings.
 * @returns the reason the submission is refused, or undefined when it is fine.
 */
export function validateSettings(value) {
  if (!isRecord(value)) return 'bad-request'
  if (!isNumberInRange(value.thresholdRatio, LIMITS.thresholdRatio)) return 'invalid-threshold-ratio'
  if (value.retainRatio !== undefined && value.retainTokens !== undefined) return 'retain-form-conflict'
  if (value.retainTokens !== undefined) {
    if (!isIntegerInRange(value.retainTokens, LIMITS.retainTokens)) return 'invalid-retain-tokens'
  } else {
    if (!isNumberInRange(value.retainRatio, LIMITS.retainRatio)) return 'invalid-retain-ratio'
    if (value.retainRatio >= value.thresholdRatio) return 'retain-ratio-not-less-than-threshold'
  }
  if (!isIntegerInRange(value.headroomTokens, LIMITS.headroomTokens)) return 'invalid-headroom-tokens'
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
 * The settings one engine configuration stands for.
 * @param config - an engine's configuration.
 * @returns the settings those values describe.
 */
function settingsFrom(config) {
  if (!isRecord(config)) return { ...DEFAULT_SETTINGS }
  const retention = typeof config.retainTokens === 'number' && Number.isFinite(config.retainTokens)
    ? { retainTokens: Math.trunc(config.retainTokens) }
    : { retainRatio: numberOr(config.retainRatio, DEFAULT_SETTINGS.retainRatio) }
  return {
    thresholdRatio: numberOr(config.thresholdRatio, DEFAULT_SETTINGS.thresholdRatio),
    ...retention,
    headroomTokens: Math.trunc(numberOr(config.headroomTokens, DEFAULT_SETTINGS.headroomTokens)),
    maxTokens: Math.trunc(numberOr(config.maxTokens, DEFAULT_SETTINGS.maxTokens)),
    compactionRetries: Math.trunc(numberOr(config.compactionRetries, DEFAULT_SETTINGS.compactionRetries)),
    maxOverflowRetries: Math.trunc(numberOr(config.maxOverflowRetries, DEFAULT_SETTINGS.maxOverflowRetries)),
  }
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
 *
 * Both retained-context keys leave the base first: only the form the session
 * chose survives, because the engine refuses a policy that names both.
 * @param config - the engine's own configuration.
 * @param settings - the settings in force.
 * @param agent - the agent whose route the configuration addresses.
 * @returns the patched configuration.
 */
function withSettings(config, settings, agent) {
  const source = isRecord(config) ? config : {}
  const { retainRatio: _retainRatio, retainTokens: _retainTokens, ...rest } = source
  const own = {
    thresholdRatio: settings.thresholdRatio,
    ...(settings.retainTokens === undefined
      ? { retainRatio: settings.retainRatio }
      : { retainTokens: settings.retainTokens }),
    headroomTokens: settings.headroomTokens,
    maxTokens: settings.maxTokens,
    compactionRetries: settings.compactionRetries,
    maxOverflowRetries: settings.maxOverflowRetries,
  }
  const patched = { ...rest, ...own }
  const route = routeOf(agent)
  if (route === undefined || !Array.isArray(source.modelPolicies)) return Object.freeze(patched)
  return Object.freeze({
    ...patched,
    modelPolicies: Object.freeze(source.modelPolicies.map((policy) => (
      policy?.provider === route.provider && policy?.model === route.model
        ? Object.freeze({ ...policy, ...own })
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
 * "reset" restores exactly what the session's engine shipped with, and a
 * refusal is reported instead of leaving the panel to claim a policy that never
 * reached the engine.
 * @param ctx - host context.
 * @returns the controller.
 */
export function createSessionController(ctx) {
  const originals = new WeakMap()

  /**
   * The settings a session's engine itself carries, before this plugin patched
   * it. The engine a session actually uses belongs to its agent preset, which is
   * not necessarily the profile-level `compaction` service.
   * @param agent - live agent, or undefined when no agent is loaded.
   * @returns those settings.
   */
  const defaultsFor = (agent) => {
    const engine = agent === undefined ? undefined : engineOf(ctx, agent)
    const config = engine !== undefined && engine !== null && typeof engine === 'object'
      ? originals.get(serviceTarget(engine)) ?? engine.config
      : ctx.get?.('compaction')?.config
    return settingsFrom(config)
  }

  /**
   * Apply the settings to one agent's engine.
   * @param agent - live agent.
   * @param settings - the settings in force.
   * @throws {Error} when the engine does not keep the configuration it was given.
   */
  const apply = (agent, settings) => {
    const engine = engineOf(ctx, agent)
    if (engine === null || typeof engine !== 'object' || engine.config === undefined) return
    const target = serviceTarget(engine)
    if (!originals.has(target)) originals.set(target, engine.config)
    const next = withSettings(engine.config, settings, agent)
    try {
      engine.config = next
    } catch (error) {
      throw new Error(`the compaction engine refused its configuration: ${String(error)}`, { cause: error })
    }
    if (engine.config !== next) throw new Error('the compaction engine did not keep the configuration it was given')
  }

  /**
   * Give one agent's engine its own configuration back.
   * @param agent - live agent.
   */
  const restore = (agent) => {
    const engine = engineOf(ctx, agent)
    if (engine === null || typeof engine !== 'object') return
    const target = serviceTarget(engine)
    const original = originals.get(target)
    if (original === undefined) return
    engine.config = original
    originals.delete(target)
  }

  return {
    apply,
    restore,
    defaultsFor,
    /** The home this plugin reads its per-session files from. */
    home: dshHome(),
  }
}
