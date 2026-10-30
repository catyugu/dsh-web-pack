/**
 * Session relationships: which conversations a workspace accounts for, which
 * ones no list can reach, and which conversation was delegated from which.
 *
 * Everything here is a computation over the header facts `store.scanSessions`
 * reads. Nothing touches the filesystem, so a classification can be checked
 * against a fixture without a Harness home.
 *
 * @module dsh-better-session/cleanup/sessions
 */

/**
 * Compare two host paths the way the filesystem does: separators and case are
 * not part of the identity of a directory.
 * @param path - one absolute host path.
 * @returns its comparable form.
 */
export function comparablePath(path) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * The stored delegation lineage: which conversation each one was delegated from.
 * A fork records the same parent field without the origin and stays an
 * independent conversation, so only a recorded subagent origin is an edge.
 * @param sessions - the stored inventory, each with its header facts.
 * @returns child id → parent id.
 */
export function subagentParents(sessions) {
  const parents = new Map()
  for (const session of sessions) {
    if (session.origin !== 'subagent' || typeof session.parentSession !== 'string') continue
    if (session.parentSession === session.id) continue
    parents.set(session.id, session.parentSession)
  }
  return parents
}

/**
 * Every conversation below one root, at any depth, breadth first. A damaged
 * chain that loops is visited once.
 * @param parents - child id → parent id.
 * @param rootId - the conversation whose descendants are wanted.
 * @returns the descendant ids, nearest first; empty when the root has none.
 */
export function descendantsOf(parents, rootId) {
  const children = new Map()
  for (const [childId, parentId] of parents) {
    const siblings = children.get(parentId)
    if (siblings === undefined) children.set(parentId, [childId])
    else siblings.push(childId)
  }
  const descendants = []
  const visited = new Set([rootId])
  const pending = [rootId]
  for (let parentId = pending.shift(); parentId !== undefined; parentId = pending.shift()) {
    for (const childId of children.get(parentId) ?? []) {
      if (visited.has(childId)) continue
      visited.add(childId)
      descendants.push(childId)
      pending.push(childId)
    }
  }
  return descendants
}

/**
 * Split the conversations no workspace accounts for into the ones whose
 * workspace is gone and the ones whose workspace simply does not list them.
 *
 * A delegated conversation is not a candidate of its own: it has no row in any
 * list, and its records go with the conversation that delegated it. Only a
 * child whose chain back to its root is broken is classified, because no future
 * deletion could reach it either. A conversation whose header this build cannot
 * read is never a candidate: its placement is unknown, and guessing it is how a
 * conversation a list still shows gets deleted.
 * @param sessions - the disk inventory, each with its header facts.
 * @param workspaces - the live workspaces: `path` plus their owned session ids.
 * @param live - identities this process holds without a stored record, so a
 *   child of a Session whose log is not on disk yet still has its parent.
 * @returns the two invisible groups, in inventory order.
 */
export function classifySessions(sessions, workspaces, live = []) {
  const owners = new Set()
  const paths = new Set()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) owners.add(sessionId)
    if (typeof workspace.path === 'string') paths.add(comparablePath(workspace.path))
  }
  const parents = subagentParents(sessions)
  const present = new Set(sessions.map((session) => session.id))
  for (const sessionId of live) present.add(sessionId)
  const orphaned = []
  const detached = []
  for (const session of sessions) {
    if (owners.has(session.id)) continue
    if (session.headerUnreadable === true) continue
    if (hasStoredAncestor(session.id, parents, present)) continue
    if (typeof session.cwd === 'string' && paths.has(comparablePath(session.cwd))) detached.push(session)
    else orphaned.push(session)
  }
  return { orphaned, detached }
}

/**
 * Whether an unbroken chain of present conversations still stands above this
 * one. The chain has to be unbroken: a child whose grandparent is stored but
 * whose parent is gone is reachable from nothing, so it is a candidate like any
 * other leftover.
 * @param sessionId - one stored Session identity.
 * @param parents - child id → parent id, which only present children contribute.
 * @param present - every identity that exists on disk or in this process.
 * @returns whether the nearest present ancestor is the immediate parent.
 */
function hasStoredAncestor(sessionId, parents, present) {
  const visited = new Set([sessionId])
  for (let parentId = parents.get(sessionId); parentId !== undefined; parentId = parents.get(parentId)) {
    if (present.has(parentId)) return true
    if (visited.has(parentId)) return false
    visited.add(parentId)
  }
  return false
}
