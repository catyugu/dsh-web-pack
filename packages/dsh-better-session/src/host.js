/**
 * Session management sub-component, host side: the plugin's lifetime, and the
 * Harness services behind the routes in `routes.js`.
 *
 * What a question is, and what re-sending one removes, lives in `turns.js`; what
 * the compaction engine does with a context lives in `compaction.js`. This
 * module joins those to the Harness: routes, the agent of a session, and the
 * per-session compaction settings the agent takes its next step with.
 *
 * @module dsh-better-session/host
 */
import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Refusal } from './http.js'
import {
  createSessionController,
  normalizeSettings,
  readGlobalSettings,
  readSessionSettings,
  validateSettings,
  writeGlobalSettings,
  writeSessionSettings,
} from './compaction.js'
import { settingsFile } from './home.js'
import { ROUTES, createRoutes } from './routes.js'
import { EditError, readQuestion, resendQuestion } from './turns.js'

/** The services these routes and the compaction override read. */
export const inject = ['connection', 'agents']

/** The routes the browser side talks to, re-exported for the host checks. */
export { ROUTES }

/**
 * Register the routes and the per-session compaction settings for as long as
 * the plugin is mounted.
 * @param ctx - Host context carrying Connection and the session services.
 */
export function apply(ctx) {
  const controller = createSessionController(ctx)
  const cache = new Map()

  /**
   * The settings one session's next step uses: its own, its parent's, or none.
   * @param sessionId - the session identity.
   * @param parentSession - the session this one was forked from, when it was.
   * @returns the settings, or undefined when the session inherits.
   */
  const settingsFor = async (sessionId, parentSession) => {
    const cached = cache.get(sessionId)
    if (cached !== undefined) return cached.settings
    let settings = await readSessionSettings(controller.home, sessionId)
    if (settings === undefined && typeof parentSession === 'string') {
      settings = await readSessionSettings(controller.home, parentSession)
    }
    if (settings === undefined) settings = await readGlobalSettings(controller.home)
    cache.set(sessionId, { settings })
    return settings
  }

  /**
   * Give one session's agent the settings it should take its next step with.
   * @param agent - live agent.
   */
  const applyTo = async (agent) => {
    const session = agent?.session
    const sessionId = session?.id
    if (typeof sessionId !== 'string') return
    const settings = await settingsFor(sessionId, session?.header?.parentSession)
    if (settings === undefined) controller.restore(agent)
    else controller.apply(agent, settings)
  }

  for (const route of createRoutes(operations(ctx, { controller, cache, settingsFor, applyTo }))) serve(ctx, route)

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    try {
      await applyTo(agent)
    } catch (error) {
      ctx.logger?.warn?.(`better-session: the compaction settings could not be applied: ${String(error)}`)
    }
    return next()
  }, { prepend: true })

  ctx.effect(() => {
    // One release moved these settings into the sessions; a global file left
    // behind by an older install would keep claiming to be in force.
    const global = settingsFile(controller.home, 'compaction')
    rm(global, { force: true })
      .then(() => rm(dirname(global), { recursive: false }))
      .catch(() => {})
  }, 'better-session: one-time settings migration')
}

/**
 * Mount one exact Fetch route for the plugin's lifetime.
 * @param ctx - Host context carrying Connection.
 * @param route - path, methods, and handler.
 */
function serve(ctx, route) {
  ctx.effect(
    () => ctx.connection.fetch.register(route),
    `better-session: ${route.path}`,
  )
}

/**
 * What each route does, in terms of Harness services.
 * @param ctx - Host context carrying the agents and the sessions.
 * @param state - the session settings cache and the agent that applies them.
 * @returns the operations `createRoutes` needs, plus its diagnostic sink.
 */
function operations(ctx, state) {
  const { controller, cache, settingsFor, applyTo } = state
  return {
    report: (line) => ctx.logger?.warn?.(line),
    prompt: ({ sessionId, messageId }) => guard(() => readQuestion(liveSession(ctx, sessionId), messageId)),
    resend: ({ sessionId, messageId, operationId, text }) => guard(async () => {
      const result = await resendQuestion(ctx, liveAgent(ctx, sessionId), messageId, operationId, text)
      return {
        turn: result.removal.turn,
        endTurn: result.removal.endTurn,
        replayMessageId: result.replayMessageId,
        interrupted: result.interrupted === true,
      }
    }),
    readCompaction: async ({ sessionId }) => {
      const defaults = controller.defaultsFor(agentOf(ctx, sessionId))
      const own = await readSessionSettings(controller.home, sessionId)
      const global = await readGlobalSettings(controller.home)
      cache.set(sessionId, { settings: own ?? global })
      return {
        settings: own ?? global ?? defaults,
        defaults,
        overridden: own !== undefined,
      }
    },
    saveCompaction: async ({ sessionId, payload }) => {
      const submitted = compactionPayload(payload)
      const refusal = validateSettings(submitted)
      if (refusal !== undefined) throw new Refusal(400, refusal, `the compaction settings are refused: ${refusal}`)
      const agent = agentOf(ctx, sessionId)
      const defaults = controller.defaultsFor(agent)
      const settings = normalizeSettings(submitted, defaults)
      try {
        await writeSessionSettings(controller.home, sessionId, settings)
      } catch (error) {
        if (error?.code === 'SESSION_NOT_STORED') {
          throw new Refusal(409, 'session-not-stored', `session "${sessionId}" has no directory yet`)
        }
        throw error
      }
      cache.set(sessionId, { settings })
      if (agent !== undefined) await applyTo(agent)
      return { settings, defaults, overridden: true }
    },
    readGlobal: async () => {
      const defaults = controller.defaultsFor(undefined)
      const global = await readGlobalSettings(controller.home)
      return { settings: global ?? defaults, defaults, overridden: global !== undefined }
    },
    saveGlobal: async ({ payload }) => {
      const submitted = compactionPayload(payload)
      const refusal = validateSettings(submitted)
      if (refusal !== undefined) throw new Refusal(400, refusal, `the compaction settings are refused: ${refusal}`)
      const defaults = controller.defaultsFor(undefined)
      const settings = await writeGlobalSettings(controller.home, normalizeSettings(submitted, defaults))
      cache.clear()
      await reapplyAll(ctx, cache, settingsFor, applyTo)
      return { settings, defaults, overridden: true }
    },
  }
}

/**
 * The agent that owns one session, when this process still holds it.
 * @param ctx - Host context carrying the agents.
 * @param sessionId - the session identity.
 * @returns the agent, or undefined when the session is not live.
 */
function agentOf(ctx, sessionId) {
  return ctx.get('agents')?.get(sessionId)
}

/**
 * The fields one compaction submission carries.
 * @param payload - the decoded body.
 * @returns the settings the submission names.
 */
function compactionPayload(payload) {
  return {
    thresholdRatio: payload?.thresholdRatio,
    retainRatio: payload?.retainRatio,
    retainTokens: payload?.retainTokens,
    headroomTokens: payload?.headroomTokens,
    maxTokens: payload?.maxTokens,
    compactionRetries: payload?.compactionRetries,
    maxOverflowRetries: payload?.maxOverflowRetries,
  }
}

/**
 * Give every live agent the settings that are now in force.
 * @param ctx - host context.
 * @param cache - the per-session settings cache.
 * @param settingsFor - reads one session's settings.
 * @param applyTo - applies them to one agent.
 */
async function reapplyAll(ctx, cache, settingsFor, applyTo) {
  cache.clear()
  const agents = typeof ctx.get('agents')?.list === 'function' ? ctx.get('agents').list() : []
  for (const agent of agents) {
    try {
      await applyTo(agent)
    } catch {
      // One agent that cannot be repriced must not stop the others.
    }
  }
}

/**
 * Run one turn operation and turn its refusal into an answer the browser side
 * can read.
 * @param task - the operation.
 * @returns the operation's result.
 */
async function guard(task) {
  try {
    return await task()
  } catch (error) {
    throw refusalOf(error) ?? error
  }
}

/**
 * Turn a conversation-editing refusal into the status the browser side reads.
 * @param error - the failure the edit engine raised.
 * @returns the refusal to answer with, or undefined when the failure is not one.
 */
export function refusalOf(error) {
  if (!(error instanceof EditError)) return undefined
  const status = {
    AGENT_BUSY: 423,
    QUEUE_NOT_EMPTY: 409,
    TARGET_NOT_FOUND: 404,
    RANGE_COMPACTED: 409,
    PROMPT_NOT_FOUND: 404,
    PROMPT_UNSUPPORTED: 409,
  }[error.code]
  if (status === undefined) return new Refusal(500, 'operation-failed', error.message)
  return new Refusal(status, error.code.toLowerCase().replace(/_/g, '-'), error.message)
}

/**
 * The agent that owns one session.
 * @param ctx - Host context carrying the agents.
 * @param sessionId - the session identity.
 * @returns the agent.
 * @throws {Refusal} when the session has no agent in this process.
 */
function liveAgent(ctx, sessionId) {
  const agent = ctx.get('agents')?.get(sessionId)
  if (agent === undefined) throw new Refusal(404, 'session-not-active', `session "${sessionId}" is not active`)
  return agent
}

/**
 * The session one identity names.
 * @param ctx - Host context carrying the sessions.
 * @param sessionId - the session identity.
 * @returns the session.
 * @throws {Refusal} when the session is not loaded.
 */
function liveSession(ctx, sessionId) {
  const session = ctx.get('sessions')?.get(sessionId)
  if (session === undefined) throw new Refusal(404, 'session-not-loaded', `session "${sessionId}" is not loaded`)
  return session
}
