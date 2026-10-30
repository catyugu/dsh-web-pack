/**
 * The Harness home layout: where a profile keeps Session records, projection
 * caches, and this plugin's own settings. Both sub-components read the layout
 * from here instead of rebuilding the same paths.
 *
 * @module dsh-better-session/home
 */
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Resolve the Harness home directory, honouring an explicit `DSH_HOME`.
 * @returns the absolute home directory.
 */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured.length > 0 ? configured : join(homedir(), '.dsh')
}

/**
 * Where the profile keeps its Session directories.
 * @param home - the Harness home directory.
 * @returns the absolute sessions root.
 */
export function sessionsRoot(home) {
  return join(home, 'sessions')
}

/**
 * The projection-cache checkpoint of one Session.
 * @param home - the Harness home directory.
 * @param sessionId - the Session identity.
 * @returns its absolute path.
 */
export function projectionCacheFile(home, sessionId) {
  return join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
}

/**
 * One of this plugin's settings artifacts.
 * @param home - the Harness home directory.
 * @param name - the artifact name, without its suffix.
 * @returns its absolute path.
 */
export function settingsFile(home, name) {
  return join(home, 'better-session', `${name}.json`)
}

/**
 * List the immediate subdirectories of a directory.
 * @param root - absolute directory that may not exist yet.
 * @returns its child directory names.
 */
export async function directories(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

/**
 * Whether one path is a directory.
 * @param path - absolute path.
 * @returns whether the filesystem holds a directory there.
 */
export async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Find the directories one Session owns: at most one per project directory,
 * matched by the trailing path segment so no layout knowledge is duplicated.
 * @param home - the Harness home directory.
 * @param sessionId - validated Session identity.
 * @returns every existing session directory.
 */
export async function sessionDirectories(home, sessionId) {
  const root = sessionsRoot(home)
  const found = []
  for (const project of await directories(root)) {
    const candidate = join(root, project, sessionId)
    if (await isDirectory(candidate)) found.push(candidate)
  }
  return found
}

/**
 * Read one JSON artifact.
 *
 * A missing file is not an error: the caller decides what an absent artifact
 * means. A file this build cannot parse is an error, because guessing its
 * contents would silently change what the plugin does.
 * @param path - absolute artifact path.
 * @param subject - what the artifact is, for the failure message.
 * @returns the decoded value, or undefined when the artifact does not exist.
 * @throws {Error} when the artifact is not valid JSON.
 */
export async function readJson(path, subject) {
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`the ${subject} at "${path}" are not valid JSON`)
  }
}

/**
 * Replace one JSON artifact atomically.
 * @param path - absolute artifact path.
 * @param value - the value to store.
 */
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}
