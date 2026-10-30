/**
 * Deletion: what one conversation takes with it, whether that is allowed right
 * now, and which records it leaves behind.
 *
 * The unit of deletion is a conversation plus every conversation delegated from
 * it, at any depth: a subagent Session has no row of its own, so deleting its
 * parent is the only way it can ever go, and deleting it alone would leave the
 * parent pointing at nothing.
 *
 * Nothing here knows about HTTP or about the plugin's lifetime; the host side
 * turns these results into answers.
 *
 * @module dsh-better-session/cleanup/deletion
 */
import { descendantsOf, subagentParents } from './sessions.js'
import { dshHome } from './home.js'
import { removeProjectionCache, removeSessionLogs, scanSessions } from './store.js'

/** A durable Session identity is one safe path segment; anything else is refused. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** What every deletion reports before anything was attempted. */
function emptyOutcome(sessionId) {
  return {
    sessionId,
    outcome: 'removed',
    busy: [],
    removedSessions: [],
    removedDirectories: 0,
    hidden: false,
    forgotten: { detached: 0, unarchived: false, unpinned: false },
    failedSteps: [],
  }
}

/**
 * The delegation lineage of every conversation this process can see: the stored
 * inventory merged with the Agents it still holds, because a child that has not
 * written a log yet is invisible to the inventory alone.
 * @param ctx - Host context carrying the optional Agents.
 * @param stored - an inventory the caller already read, when it has one.
 * @returns child id → parent id.
 */
export async function readLineage(ctx, stored) {
  const sessions = stored ?? await scanSessions(dshHome())
  return new Map([...subagentParents(sessions), ...liveSubagentParents(ctx)])
}

/**
 * The identities this process still holds in memory, stored record or not.
 * @param ctx - Host context carrying the optional Agents.
 * @returns the live Session ids.
 */
export function heldSessions(ctx) {
  const agents = ctx.get('agents')
  if (typeof agents?.list !== 'function') return []
  return [...agents.list()].map((agent) => String(agent?.session?.header?.id ?? '')).filter((id) => id.length > 0)
}

/**
 * The lineage of the Agents this process still holds in memory.
 * @param ctx - Host context carrying the optional Agents.
 * @returns child id → parent id, for every live subagent-origin Session.
 */
function liveSubagentParents(ctx) {
  const agents = ctx.get('agents')
  if (typeof agents?.list !== 'function') return new Map()
  const parents = new Map()
  for (const agent of agents.list()) {
    const header = agent?.session?.header
    if (header?.origin !== 'subagent' || typeof header.parentSession !== 'string') continue
    parents.set(String(header.id), String(header.parentSession))
  }
  return parents
}

/**
 * The conversations inside one deletion that are still working.
 *
 * A running child refuses the whole deletion: its log may be appended again
 * after the file is gone, and it would lose the parent it reports to.
 * @param ctx - Host context carrying the optional Agents.
 * @param lineage - child id → parent id.
 * @param sessionId - the conversation a deletion names.
 * @returns the running ids, the named one included.
 */
export function busyInSubtree(ctx, lineage, sessionId) {
  return [sessionId, ...descendantsOf(lineage, sessionId)].filter((id) => isRunning(ctx, id))
}

/**
 * Delete every stored record of one conversation, together with every
 * conversation delegated from it, and hide those identities from the listings
 * this process serves.
 *
 * A conversation this process already deleted is gone, not missing: repeating
 * the request reports success, because a bulk run that names both a parent and
 * one of its subagents must not report the second one as a failure.
 * @param ctx - Host context carrying the optional Agent, Session, and registry services.
 * @param hidden - identities deleted in this process.
 * @param sessionId - durable Session identity.
 * @param lineage - the delegation lineage, as {@link readLineage} reads it.
 * @returns the outcome and what it removed.
 */
export async function removeSession(ctx, hidden, sessionId, lineage) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return { ...emptyOutcome(String(sessionId)), outcome: 'invalid' }
  }
  const targets = [sessionId, ...descendantsOf(lineage, sessionId)]
  const busy = targets.filter((id) => isRunning(ctx, id))
  if (busy.length > 0) return { ...emptyOutcome(sessionId), outcome: 'busy', busy }
  const outcome = emptyOutcome(sessionId)
  const alreadyGone = hidden.has(sessionId)
  for (const target of targets) {
    const live = isAttached(ctx, target)
    outcome.hidden ||= live
    const directories = await removeStoredRecords(ctx, target, outcome.failedSteps)
    outcome.removedDirectories += directories
    const dropped = await forgetInRegistry(ctx, target)
    outcome.forgotten.detached += dropped.detached
    outcome.forgotten.unarchived ||= dropped.unarchived
    outcome.forgotten.unpinned ||= dropped.unpinned
    outcome.failedSteps.push(...dropped.failedSteps)
    // Only a target that had records, or is still attached, has a row to drop.
    if (directories === 0 && !live) continue
    hidden.add(target)
    announceRemoval(ctx, target)
    outcome.removedSessions.push(target)
  }
  if (outcome.removedDirectories === 0 && !outcome.hidden && !alreadyGone) outcome.outcome = 'missing'
  return outcome
}

/**
 * Drop the stored records of a conversation this process already deleted.
 *
 * A hidden Session that is still attached may append once more and put its log
 * back on disk; this is what takes that copy away again. It runs no preflight
 * and touches no registry, because the deletion that hid the identity already
 * settled both — and because refusing here would leave the log in place.
 * @param ctx - Host context, for the diagnostic line of a failed removal.
 * @param hidden - identities deleted in this process.
 * @param sessionId - durable Session identity.
 * @returns how many directories were removed.
 */
export async function scrubHidden(ctx, hidden, sessionId) {
  if (!hidden.has(sessionId)) return 0
  return await removeStoredRecords(ctx, sessionId, [])
}

/**
 * Remove one conversation's log directories and its projection-cache
 * checkpoint.
 * A checkpoint left behind is a derived row the UI can still see, so it always
 * goes with the logs.
 * @param ctx - Host context, for the diagnostic line of a failed removal.
 * @param sessionId - validated Session identity.
 * @param failedSteps - receives every cleanup step that did not complete.
 * @returns how many session directories were removed.
 */
async function removeStoredRecords(ctx, sessionId, failedSteps) {
  const home = dshHome()
  const removed = await removeSessionLogs(home, sessionId)
  try {
    await removeProjectionCache(home, sessionId)
  } catch (error) {
    ctx.logger?.warn?.(`better-session: removing the projection cache of "${sessionId}" failed: ${String(error)}`)
    failedSteps.push(`${sessionId}: projection cache`)
  }
  return removed
}

/**
 * Drop the identity from the durable workspace registry: workspace accounting
 * plus the archive and pin sets, so no id outlives the Session it named.
 *
 * One workspace refusing its detach must not keep the others from dropping the
 * id, so each is attempted on its own and every failure is reported instead of
 * swallowed.
 * @param ctx - Host context carrying the workspace registry.
 * @param sessionId - validated Session identity.
 * @returns what the registry gave up, and what it refused.
 */
async function forgetInRegistry(ctx, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  const forgotten = { detached: 0, unarchived: false, unpinned: false, failedSteps: [] }
  if (registry === undefined) return forgotten
  let workspaces
  try {
    workspaces = [...registry.list()]
  } catch (error) {
    ctx.logger?.warn?.(`better-session: reading the workspaces that account for "${sessionId}" failed: ${String(error)}`)
    forgotten.failedSteps.push(`${sessionId}: workspace accounting`)
    return forgotten
  }
  for (const workspace of workspaces) {
    if (!workspace.sessionIds.includes(sessionId)) continue
    try {
      await workspace.detachSession(sessionId)
      forgotten.detached += 1
    } catch (error) {
      ctx.logger?.warn?.(`better-session: detaching "${sessionId}" from "${workspace.path}" failed: ${String(error)}`)
      forgotten.failedSteps.push(`${sessionId}: workspace "${workspace.path}"`)
    }
  }
  if (registry.archivedSessionIds.includes(sessionId)) {
    try {
      await registry.unarchiveSession(sessionId)
      forgotten.unarchived = true
    } catch (error) {
      ctx.logger?.warn?.(`better-session: unarchiving "${sessionId}" failed: ${String(error)}`)
      forgotten.failedSteps.push(`${sessionId}: archive set`)
    }
  }
  if (registry.pinnedSessionIds.includes(sessionId)) {
    try {
      await registry.unpinSession(sessionId)
      forgotten.unpinned = true
    } catch (error) {
      ctx.logger?.warn?.(`better-session: unpinning "${sessionId}" failed: ${String(error)}`)
      forgotten.failedSteps.push(`${sessionId}: pin set`)
    }
  }
  return forgotten
}

/** Whether this identity's Agent is still working. */
function isRunning(ctx, sessionId) {
  return ctx.get('agents')?.get(sessionId)?.status === 'running'
}

/** Whether this identity is still held in memory, by the store or an Agent. */
function isAttached(ctx, sessionId) {
  return ctx.get('sessions')?.get(sessionId) !== undefined || ctx.get('agents')?.get(sessionId) !== undefined
}

/**
 * Tell every connected page that a row is gone, so its list drops it now.
 * @param ctx - Host context carrying the event bus.
 * @param sessionId - the identity that was deleted.
 */
export function announceRemoval(ctx, sessionId) {
  try {
    ctx.emit('api-session/removed', sessionId)
  } catch (error) {
    ctx.logger?.warn?.(`better-session: announcing the removal of "${sessionId}" failed: ${String(error)}`)
  }
}
