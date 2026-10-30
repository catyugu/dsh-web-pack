/**
 * What a Session's records are on disk: the header facts its placement depends
 * on, the cleanup settings, and the two artifacts one deletion removes. The
 * paths themselves come from `home.js`; what a conversation means for a
 * workspace lives in `sessions.js`.
 *
 * @module dsh-session-cleanup/store
 */
import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  directories,
  projectionCacheFile,
  readJson,
  sessionDirectories,
  sessionsRoot,
  settingsFile,
  writeJson,
} from './home.js'
import { logFiles, readHeader } from './logs.js'

/** Settings schema version, so a future field can migrate instead of guessing. */
const SETTINGS_VERSION = 2

/**
 * Enumerate every conversation stored on disk.
 * @param home - the Harness home directory.
 * @param options - whether to read each header for its project directory and lineage.
 * @returns one record per Session directory: identity, project directory, path,
 *   and the header facts classification and deletion read.
 */
export async function scanSessions(home, { readHeaders = true } = {}) {
  const root = sessionsRoot(home)
  const sessions = []
  for (const project of await directories(root)) {
    const projectDirectory = join(root, project)
    for (const id of await directories(projectDirectory)) {
      const directory = join(projectDirectory, id)
      sessions.push({ id, project, directory, ...(readHeaders ? await headerFacts(directory) : {}) })
    }
  }
  return sessions
}

/**
 * Read the header facts a Session's placement depends on: the project directory
 * it declares and the delegation lineage it records.
 * @param directory - absolute Session directory.
 * @returns the declared `cwd`, `parentSession`, and `origin`, each only when the
 *   header names it. A Session whose header this build cannot decode is marked
 *   `headerUnreadable`, because its placement is unknown and guessing it would
 *   put a conversation a list still shows into a cleanup scope.
 */
async function headerFacts(directory) {
  const [first] = await logFiles(directory)
  if (first === undefined) return {}
  let header
  try {
    const line = await readHeader(first)
    header = line === undefined ? undefined : JSON.parse(line)
  } catch {
    return { headerUnreadable: true }
  }
  if (header === null || typeof header !== 'object') return { headerUnreadable: true }
  return {
    ...(typeof header.cwd === 'string' ? { cwd: header.cwd } : {}),
    ...(typeof header.parentSession === 'string' ? { parentSession: header.parentSession } : {}),
    ...(header.origin === 'subagent' ? { origin: 'subagent' } : {}),
  }
}

/**
 * Read the cleanup settings.
 *
 * The projection cache and the workspace entries are never optional: a
 * conversation whose records stay behind is a row that cannot be opened, so
 * the only switch here is whether the attachments go too.
 *
 * A missing file is a fresh install and takes the defaults. Anything else —
 * unparsable JSON, a permission problem — is an error, because a settings file
 * this build cannot read must not decide whether attachment bytes are deleted.
 * @param home - the Harness home directory.
 * @returns the effective settings.
 */
export async function readSettings(home) {
  const parsed = await readJson(settingsFile(home, 'cleanup'), 'cleanup settings')
  if (parsed === undefined) return { version: SETTINGS_VERSION, attachments: true }
  return { version: SETTINGS_VERSION, attachments: parsed?.attachments !== false }
}

/**
 * Persist the cleanup settings.
 * @param home - the Harness home directory.
 * @param next - the requested attachment switch; anything but `false` means on.
 * @returns the stored settings.
 */
export async function writeSettings(home, next) {
  const value = { version: SETTINGS_VERSION, attachments: next?.attachments !== false }
  await writeJson(settingsFile(home, 'cleanup'), value)
  return value
}

/**
 * Delete one Session's log directories.
 * @param home - the Harness home directory.
 * @param sessionId - validated Session identity.
 * @returns how many directories were removed.
 */
export async function removeSessionLogs(home, sessionId) {
  const removed = await sessionDirectories(home, sessionId)
  for (const directory of removed) {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
  return removed.length
}

/**
 * Drop the Session's projection-cache checkpoint, a derived copy of its log.
 * @param home - the Harness home directory.
 * @param sessionId - validated Session identity.
 * @returns whether a checkpoint file was removed.
 */
export async function removeProjectionCache(home, sessionId) {
  const path = projectionCacheFile(home, sessionId)
  try {
    if (!(await stat(path)).isFile()) return false
    await rm(path, { force: true })
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}
