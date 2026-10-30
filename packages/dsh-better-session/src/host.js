/**
 * Session management sub-component, host side: the plugin's lifetime, and the
 * Harness services behind the routes in `routes.js`.
 *
 * What a turn is lives in `turns.js`, what the compaction engine does with a
 * context lives in `compaction.js`. This module joins those to the Harness:
 * routes, the agent of a session, and the runtime override the compaction
 * settings apply.
 *
 * @module dsh-better-session/manage/host
 */
import { Refusal } from './http.js'
import {
  createRuntimeController,
  normalizeSettings,
  readSettings,
  validateSettings,
  writeSettings,
} from './compaction.js'
import { ROUTES, createRoutes } from './routes.js'
import { TurnError, readQuestionText, regenerateFromTurn } from './turns.js'

/** The services these routes and the compaction override read. */
export const inject = ['connection', 'agents']

/** The routes the browser side talks to, re-exported for the host checks. */
export { ROUTES }

/**
 * Register the routes and the compaction override for as long as the plugin
 * is mounted.
 * @param ctx - Host context carrying Connection and the session services.
 */
export function apply(ctx) {
  const settings = { current: normalizeSettings({}) }
  const controller = createRuntimeController(ctx, () => settings.current)
  for (const route of createRoutes(operations(ctx, settings, controller))) serve(ctx, route)
  ctx.on('agent/pre-step', ({ agent }, next) => {
    try {
      controller.applyToAgent(agent)
    } catch (error) {
      ctx.logger?.warn?.(`better-session: the compaction settings could not be applied: ${String(error)}`)
    }
    return next()
  }, { prepend: true })
  ctx.effect(() => {
    let closed = false
    readSettings()
      .then((stored) => {
        if (closed) return
        settings.current = normalizeSettings(stored)
        controller.applyToLiveAgents()
      })
      .catch((error) => {
        ctx.logger?.warn?.(`better-session: the compaction settings could not be read: ${String(error)}`)
      })
    return () => {
      closed = true
      controller.restore()
    }
  }, 'better-session: compaction settings')
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
 * @param settings - the compaction settings in force.
 * @param controller - the runtime override that applies them.
 * @returns the operations `createRoutes` needs, plus its diagnostic sink.
 */
function operations(ctx, settings, controller) {
  return {
    report: (line) => ctx.logger?.warn?.(line),
    prompt: ({ sessionId, messageId }) => guard(() => readQuestionText(liveSession(ctx, sessionId), messageId)),
    regenerate: ({ sessionId, messageId, operationId, text }) => guard(async () => {
      const result = await regenerateFromTurn(ctx, liveAgent(ctx, sessionId), messageId, operationId, text)
      return {
        turn: result.deletion.turn,
        endTurn: result.deletion.endTurn,
        deletedTurns: result.deletion.deletedTurns,
        replayMessageId: result.replayMessageId,
        interrupted: result.interrupted === true,
      }
    }),
    readCompaction: async () => {
      const defaults = controller.defaults()
      settings.current = normalizeSettings(await readSettings(), defaults)
      return { settings: settings.current, defaults }
    },
    saveCompaction: async (payload) => {
      const defaults = controller.defaults()
      const submitted = {
        enabled: payload?.enabled,
        thresholdRatio: payload?.thresholdRatio,
        retainRatio: payload?.retainRatio,
        maxTokens: payload?.maxTokens,
        compactionRetries: payload?.compactionRetries,
        maxOverflowRetries: payload?.maxOverflowRetries,
      }
      const refusal = validateSettings(submitted)
      if (refusal !== undefined) throw new Refusal(400, refusal, `the compaction settings are refused: ${refusal}`)
      settings.current = normalizeSettings(submitted, defaults)
      await writeSettings(settings.current)
      controller.applyToLiveAgents()
      return { settings: settings.current, defaults }
    },
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
 * Turn a turn-level refusal into the status the browser side reads.
 * @param error - the failure the turn engine raised.
 * @returns the refusal to answer with, or undefined when the failure is not one.
 */
export function refusalOf(error) {
  if (!(error instanceof TurnError)) return undefined
  const status = {
    AGENT_BUSY: 423,
    QUEUE_NOT_EMPTY: 409,
    TARGET_NOT_FOUND: 404,
    TURN_NOT_CLOSED: 409,
    TURN_COMPACTED: 409,
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
