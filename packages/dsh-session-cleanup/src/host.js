/**
 * Session cleanup sub-component, host side: the plugin's lifetime, and the
 * Harness services behind the routes in `routes.js`.
 *
 * The hard part is not the files: `session.list` merges persisted Sessions with
 * every Session this process still holds in memory, so a Session that was
 * opened once keeps producing a row long after its log is gone, and no public
 * API can detach it. Deletion therefore hides the identity from the corpus
 * listing for the rest of the process; once the process restarts there is
 * nothing left to hide.
 *
 * What a conversation means for a workspace lives in `sessions.js`, what
 * deleting one takes with it lives in `deletion.js`, and what a header or a
 * cache file is lives in `store.js`. This module joins those to Harness
 * services: routes, the corpus filter, the inventory, and the lifecycle events.
 */
import { collectAttachments, referencedDigests } from './attachments.js'
import { announceRemoval, busyInSubtree, heldSessions, readLineage, removeSession, scrubHidden } from './deletion.js'
import { Refusal } from './http.js'
import { ROUTES, createRoutes } from './routes.js'
import { classifySessions } from './sessions.js'
import { dshHome } from './home.js'
import { readSettings, scanSessions, writeSettings } from './store.js'

/** Connection owns the authenticated `/api` carrier these routes ride on. */
export const inject = ['connection']

/** The routes the browser side talks to, re-exported for the host checks. */
export { ROUTES }

/**
 * Register the routes and the list guards for as long as the plugin is mounted.
 * @param ctx - Host context carrying Connection and the optional session services.
 */
export function apply(ctx) {
  const hidden = new Set()
  for (const route of createRoutes(operations(ctx, hidden))) serve(ctx, route)
  hideFromSessionCorpus(ctx, hidden)
  installSessionGuards(ctx, hidden)
}

/**
 * Keep this process's memory of a deletion honest for as long as the plugin is
 * mounted: an identity hidden here must not come back through an announcement,
 * an append, or a freshly created Session of the same id.
 * @param ctx - Host context carrying the event bus.
 * @param hidden - identities deleted in this process.
 */
export function installSessionGuards(ctx, hidden) {
  // A hidden identity can still announce itself (an Agent status change re-adds
  // its summary), so every announcement is answered with a removal.
  ctx.on('api-session/added', (summary) => {
    const sessionId = String(summary?.sessionId ?? '')
    if (hidden.has(sessionId)) announceRemoval(ctx, sessionId)
  })
  // A newly created Session owns its identity again, whatever was deleted before.
  ctx.on('session/created', (session) => {
    hidden.delete(String(session.id))
  })
  // A hidden Session that is still attached may append once more and push its
  // log back onto disk; the checkpoint is where that copy is dropped again.
  ctx.on('session/flush', (session) => scrubHidden(ctx, hidden, String(session.id)))
}

/**
 * What each route does, in terms of Harness services and the store.
 * @param ctx - Host context carrying the registry and the Agents.
 * @param hidden - identities deleted in this process.
 * @returns the operations `createRoutes` needs, plus its diagnostic sink.
 */
function operations(ctx, hidden) {
  return {
    report: (line) => ctx.logger?.warn?.(line),
    remove: async (sessionId) => {
      // The switches decide whether attachment bytes may go, so a settings file
      // this build cannot read must refuse before anything is deleted.
      const settings = await readSettings(dshHome())
      const result = await removeSession(ctx, hidden, sessionId, await readLineage(ctx))
      return await removalAnswer(ctx, result, settings)
    },
    state: async () => {
      const inventory = await takeInventory(ctx)
      return {
        settings: await readSettings(dshHome()),
        counts: {
          orphaned: inventory.orphaned.length,
          detached: inventory.detached.length,
          total: inventory.orphaned.length + inventory.detached.length,
        },
      }
    },
    saveSettings: async (patch) => {
      const home = dshHome()
      const current = await readSettings(home)
      return writeSettings(home, { attachments: patch.attachments ?? current.attachments })
    },
    bulk: async ({ scope, sessionIds }) => {
      const settings = await readSettings(dshHome())
      // One lineage read, one attachment sweep: a batch is one visit to every
      // Session on disk, not one per deletion.
      const inventory = scope === undefined ? undefined : await takeInventory(ctx)
      const targets = inventory === undefined
        ? sessionIds
        : (scope === 'orphaned' ? inventory.orphaned : inventory.detached).map((session) => session.id)
      const lineage = inventory?.lineage ?? await readLineage(ctx)
      const removed = []
      const failed = []
      const failedSteps = []
      for (const sessionId of targets) {
        const result = await removeSession(ctx, hidden, sessionId, lineage)
        if (result.outcome === 'removed') removed.push(sessionId)
        else failed.push({ sessionId, code: result.outcome === 'busy' ? 'session-running' : 'not-found' })
        failedSteps.push(...result.failedSteps)
      }
      const attachments = settings.attachments && removed.length > 0
        ? await collectUnreferencedAttachments(ctx)
        : undefined
      return {
        removed,
        failed,
        ...(failedSteps.length === 0 ? {} : { failedSteps }),
        ...(attachments === undefined ? {} : { attachments }),
        ...(scope === undefined ? {} : { counts: await remainingCounts(ctx) }),
      }
    },
  }
}

/**
 * One deletion's answer: the status and the JSON body the route sends.
 * @param ctx - Host context, for a skipped attachment cleanup and for the home path.
 * @param result - what the deletion did.
 * @param settings - the cleanup switches read before the deletion ran.
 * @returns the HTTP status and body.
 */
async function removalAnswer(ctx, result, settings) {
  if (result.outcome === 'invalid') {
    return {
      status: 400,
      body: { ok: false, code: 'bad-request', message: 'the request body must carry one plain session id' },
    }
  }
  if (result.outcome === 'busy') {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'session-running',
        message: `session ${result.busy.map((id) => `"${id}"`).join(', ')} is running; stop its work before deleting`,
        busy: result.busy,
      },
    }
  }
  if (result.outcome === 'missing') {
    return {
      status: 404,
      body: {
        ok: false,
        code: 'not-found',
        message: `no stored session directory for "${result.sessionId}" under "${dshHome()}"`,
        forgotten: result.forgotten,
      },
    }
  }
  const attachments = settings.attachments && result.removedDirectories > 0
    ? await collectUnreferencedAttachments(ctx)
    : undefined
  return {
    status: 200,
    body: {
      ok: true,
      sessionId: result.sessionId,
      removedDirectories: result.removedDirectories,
      removedSessions: result.removedSessions,
      failedSteps: result.failedSteps,
      forgotten: result.forgotten,
      // Only a still attached Session needs the listing filter; a cold one is
      // gone from the next listing on its own.
      hidden: result.hidden,
      ...(attachments === undefined ? {} : { attachments }),
    },
  }
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
 * Keep every deleted identity out of the Session corpus, which is the single
 * source of `session.list`, content search, and lineage traces. A live Session
 * has no other way out: the store's detach disposer belongs to whatever
 * resumed it.
 * @param ctx - Host context that may mount the Session query engine.
 * @param hidden - identities deleted in this process.
 */
export function hideFromSessionCorpus(ctx, hidden) {
  ctx.inject(['sessionQuery'], (scope) => {
    const engine = scope.sessionQuery
    const listSessions = engine.listSessions
    if (typeof listSessions !== 'function') {
      ctx.logger?.warn?.('better-session: sessionQuery.listSessions is unavailable; deleted sessions stay listed until the next restart')
      return
    }
    const own = Object.hasOwn(engine, 'listSessions')
    const visible = async (signal) => {
      const records = await listSessions.call(engine, signal)
      if (hidden.size === 0) return records
      const present = new Set(records.map((record) => String(record.header.id)))
      // An identity that no longer exists anywhere needs no hiding any more.
      for (const sessionId of hidden) if (!present.has(sessionId)) hidden.delete(sessionId)
      return records.filter((record) => !hidden.has(String(record.header.id)))
    }
    engine.listSessions = visible
    scope.effect(() => () => {
      if (engine.listSessions !== visible) return
      // Give the engine back exactly the shape it had, own method or inherited.
      if (own) engine.listSessions = listSessions
      else delete engine.listSessions
    }, 'better-session: hidden corpus filter')
  })
}

/**
 * Read the disk inventory and file every conversation no workspace accounts
 * for into its cleanup scope, skipping the ones whose subtree is working: a
 * conversation the Host would refuse must never be counted.
 * @param ctx - Host context carrying the workspace registry and the Agents.
 * @returns the scope lists and the lineage they were classified by.
 */
async function takeInventory(ctx) {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined) {
    throw new Refusal(503, 'registry-unavailable', 'the workspace registry is not mounted, so no conversation can be classified')
  }
  const sessions = await scanSessions(dshHome())
  const workspaces = [...registry.list()].map((workspace) => ({
    path: workspace.path,
    sessionIds: [...workspace.sessionIds],
  }))
  const lineage = await readLineage(ctx, sessions)
  const classified = classifySessions(sessions, workspaces, heldSessions(ctx))
  const idle = (session) => busyInSubtree(ctx, lineage, session.id).length === 0
  return {
    lineage,
    orphaned: classified.orphaned.filter(idle),
    detached: classified.detached.filter(idle),
  }
}

/**
 * Report the remaining cleanup counts after one bulk run.
 * @param ctx - Host context carrying the workspace registry.
 * @returns the two counts, or nothing when the inventory could not be read.
 */
async function remainingCounts(ctx) {
  try {
    const inventory = await takeInventory(ctx)
    return { orphaned: inventory.orphaned.length, detached: inventory.detached.length }
  } catch {
    return undefined
  }
}

/**
 * Delete the attachment bytes no surviving transcript names.
 * @param ctx - Host context, for the diagnostic line of a skipped cleanup.
 * @returns what was collected, or nothing when the cleanup could not run.
 */
async function collectUnreferencedAttachments(ctx) {
  const home = dshHome()
  try {
    return await collectAttachments(home, { referenced: await referencedDigests(home) })
  } catch (error) {
    // A transcript the reader cannot decode means the reference set is
    // incomplete, and an incomplete set deletes bytes a conversation still uses.
    ctx.logger?.warn?.(`better-session: attachment cleanup skipped: ${String(error)}`)
    return undefined
  }
}
