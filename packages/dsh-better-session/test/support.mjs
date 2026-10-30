/**
 * Shared fixtures for every sub-component's tests: a throwaway `DSH_HOME` under
 * `.test-home`, the seeding helpers the suites write with, and the minimal Host
 * context the plugin's routes and deletion path read.
 *
 * Every suite calls `resetHome()` first and `removeHome()` last, so no check
 * ever touches a real Harness home. A suite may import this module and its own
 * sub-component; nothing else.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

export const home = join(import.meta.dirname, '.test-home')

export const paths = {
  sessions: join(home, 'sessions'),
  cache: join(home, 'storages', 'session_projcache', 'sessions'),
  attachments: join(home, 'attachments', 'v1'),
  settings: join(home, 'better-session', 'cleanup.json'),
}

/** Point the plugin at this suite's home; safe to call more than once. */
export function useTestHome() {
  process.env.DSH_HOME = home
}

export async function resetHome() {
  useTestHome()
  await rm(home, { recursive: true, force: true })
}

export async function removeHome() {
  await rm(home, { recursive: true, force: true })
}

/**
 * One concatenated-frame transcript: each line is its own checksummed frame.
 * @param lines - the plaintext records.
 * @returns the log artifact bytes.
 */
export function transcript(lines) {
  return Buffer.concat(lines.map((line) => zstdCompressSync(Buffer.from(`${line}\n`))))
}

/**
 * Seed one Session directory with a header and one attachment reference.
 * @param project - the project directory name.
 * @param sessionId - the Session identity.
 * @param options - the header fields, the referenced digest, and a cache copy.
 * @returns the Session directory.
 */
export async function seedSession(project, sessionId, { cwd, parentSession, origin, digest, withCache = false } = {}) {
  const directory = join(paths.sessions, project, sessionId)
  await mkdir(directory, { recursive: true })
  const header = headerLine(sessionId, { cwd, parentSession, origin })
  await writeFile(join(directory, 'session.v4.jsonl.zstd'), transcript(digest === undefined ? [header] : [header, reference(digest)]))
  if (withCache) {
    await mkdir(paths.cache, { recursive: true })
    await writeFile(join(paths.cache, `${sessionId}.json`), '{"state":1}')
  }
  return directory
}

/**
 * Seed one Session whose log exists but whose header does not decode — the
 * shape a crash during the first write leaves behind.
 * @param project - the project directory name.
 * @param sessionId - the Session identity.
 * @returns the Session directory.
 */
export async function seedBrokenSession(project, sessionId) {
  const directory = join(paths.sessions, project, sessionId)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'session.v4.jsonl.zstd'), transcript(['not a header']))
  return directory
}

/**
 * Seed one Session directory whose log artifact is exactly these bytes, for the
 * shapes `seedSession` cannot express.
 * @param project - the project directory name.
 * @param sessionId - the Session identity.
 * @param bytes - the log artifact content.
 * @returns the Session directory.
 */
export async function seedLog(project, sessionId, bytes) {
  const directory = join(paths.sessions, project, sessionId)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'session.v4.jsonl.zstd'), bytes)
  return directory
}

/** One header line, as a Session log begins with it. */
export function headerLine(sessionId, { cwd, parentSession, origin } = {}) {
  return JSON.stringify({
    type: 'session',
    version: 4,
    id: sessionId,
    cwd,
    createdAt: 1,
    isSeeded: false,
    delegationDepth: parentSession === undefined ? 0 : 1,
    ...(parentSession === undefined ? {} : { parentSession }),
    ...(origin === undefined ? {} : { origin }),
  })
}

/**
 * Seed one attachment object plus its hard-link reference path.
 * @param digest - the content digest.
 * @param ageMs - how long ago it was written.
 */
export async function seedAttachment(digest, ageMs) {
  const prefix = digest.slice(0, 2)
  const object = join(paths.attachments, 'objects', prefix, digest)
  await mkdir(join(paths.attachments, 'objects', prefix), { recursive: true })
  await writeFile(object, `bytes of ${digest}`)
  const reference = join(paths.attachments, 'files', prefix, digest, 'note.bin')
  await mkdir(join(paths.attachments, 'files', prefix, digest), { recursive: true })
  await writeFile(reference, `bytes of ${digest}`)
  const stamp = new Date(Date.now() - ageMs)
  await utimes(object, stamp, stamp)
  await utimes(join(paths.attachments, 'files', prefix, digest), stamp, stamp)
}

/** One user message naming an attachment, as a transcript line. */
function reference(digest) {
  return JSON.stringify({
    type: 'user/message',
    seq: 1,
    data: { content: [{ type: 'file', attachment: { attachmentId: `sha256:${digest}` } }] },
  })
}

/**
 * Minimal Host context: the captured routes, the registry, and the Agent status.
 *
 * The registry holds mutable accounting, so a test can assert what a deletion
 * left behind, and the context keeps its event listeners, so a test can raise
 * the lifecycle events the plugin reacts to.
 * @param options - the live workspaces, running and attached identities, the
 *   additionally held Agents, the registry posture, its archive and pin sets,
 *   and which registry operations refuse.
 * @returns the context plus the spies each suite asserts on.
 */
export function fakeCtx({
  workspaces = [],
  running = [],
  live = [],
  held = [],
  registry = 'ok',
  archived = [],
  pinned = [],
  detachFails = [],
  archiveFails = false,
  pinFails = false,
} = {}) {
  const routes = new Map()
  const events = []
  const warnings = []
  const listeners = new Map()
  const detached = []
  const unarchived = []
  const unpinned = []
  const accounting = workspaces.map((workspace) => ({ path: workspace.path, sessionIds: [...workspace.sessionIds] }))
  const state = { archived: [...archived], pinned: [...pinned] }
  const heldAgents = held.map((agent) => ({
    status: agent.status ?? 'idle',
    session: {
      header: {
        id: agent.id,
        ...(agent.parentSession === undefined ? {} : { parentSession: agent.parentSession }),
        ...(agent.origin === undefined ? {} : { origin: agent.origin }),
      },
    },
  }))
  const heldIds = new Set(heldAgents.map((agent) => agent.session.header.id))
  const agentsService = {
    get: (id) => heldAgents.find((agent) => agent.session.header.id === id)
      ?? (running.includes(id) ? { status: 'running' } : undefined),
    list: () => heldAgents,
  }
  const registryService = {
    list: () => accounting.map((workspace) => ({
      path: workspace.path,
      sessionIds: [...workspace.sessionIds],
      detachSession: async (sessionId) => {
        if (detachFails.includes(workspace.path)) throw new Error(`cannot detach from ${workspace.path}`)
        detached.push({ sessionId, workspace: workspace.path })
        workspace.sessionIds = workspace.sessionIds.filter((id) => id !== sessionId)
      },
    })),
    get archivedSessionIds() {
      return [...state.archived]
    },
    get pinnedSessionIds() {
      return [...state.pinned]
    },
    unarchiveSession: async (sessionId) => {
      if (archiveFails) throw new Error('cannot unarchive')
      unarchived.push(sessionId)
      state.archived = state.archived.filter((id) => id !== sessionId)
    },
    unpinSession: async (sessionId) => {
      if (pinFails) throw new Error('cannot unpin')
      unpinned.push(sessionId)
      state.pinned = state.pinned.filter((id) => id !== sessionId)
    },
  }
  const ctx = {
    effect: (register) => {
      const dispose = register()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    on: (event, listener) => {
      const entries = listeners.get(event) ?? []
      entries.push(listener)
      listeners.set(event, entries)
      return () => listeners.set(event, entries.filter((entry) => entry !== listener))
    },
    emit: (event, sessionId) => events.push([event, sessionId]),
    logger: { warn: (line) => warnings.push(line) },
    inject: () => {},
    get: (name) => {
      if (name === 'workspaceRegistry') {
        if (registry === 'absent') return undefined
        if (registry === 'throw') {
          return {
            list: () => {
              throw new Error('registry unavailable')
            },
            get archivedSessionIds() {
              return []
            },
            get pinnedSessionIds() {
              return []
            },
          }
        }
        return registryService
      }
      if (name === 'agents') return agentsService
      if (name === 'sessions') return { get: (id) => (live.includes(id) || heldIds.has(id) ? { id } : undefined) }
      return undefined
    },
    connection: {
      fetch: {
        register: (route) => {
          routes.set(route.path, route)
          return async () => {}
        },
      },
    },
  }
  /**
   * Raise one lifecycle event the way the Harness would.
   * @param event - the event name.
   * @param payload - what the emitters pass.
   * @returns nothing; listeners run in order.
   */
  async function raise(event, payload) {
    for (const listener of listeners.get(event) ?? []) await listener(payload)
  }
  return { ctx, routes, events, warnings, listeners, detached, unarchived, unpinned, accounting, raise }
}

/**
 * Call one captured route.
 * @param routes - the route table `fakeCtx` captured.
 * @param path - the route path.
 * @param body - optional JSON body.
 * @returns the status and decoded body.
 */
export async function call(routes, path, body) {
  const route = routes.get(path)
  assert.notEqual(route, undefined, `route ${path} is registered`)
  const init = body === undefined
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  const response = await route.fetch(new Request(`http://localhost${path}`, init))
  return { status: response.status, body: await response.json() }
}

/**
 * Call one route with a method, an optional query string, and an optional body.
 * @param routes - the registered routes.
 * @param path - the route path.
 * @param options - method, body, and query string.
 * @returns the status and the decoded body.
 */
export async function request(routes, path, { method = 'GET', body, query } = {}) {
  const route = routes.get(path)
  assert.notEqual(route, undefined, `route ${path} is registered`)
  const init = body === undefined
    ? { method }
    : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  const response = await route.fetch(new Request(`http://localhost${path}${query ?? ''}`, init))
  return { status: response.status, body: await response.json() }
}

/**
 * Whether a path exists, whatever its type.
 * @param path - absolute path.
 * @returns whether the filesystem holds it.
 */
export async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
