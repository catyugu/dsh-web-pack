/**
 * The shared attachment store: which bytes a surviving conversation still
 * names, and how the rest is collected.
 *
 * An equal object may be referenced from any transcript, so a deletion can
 * only ever drop bytes the whole corpus no longer names. Reading the reference
 * set is therefore part of the deletion, not an optimisation.
 *
 * @module dsh-better-session/cleanup/attachments
 */
import { readdir, rm, rmdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { logFiles, readLog } from './logs.js'
import { scanSessions } from './store.js'

/** Attachment digests are published with this prefix inside a transcript. */
const DIGEST_REFERENCE = /sha256:([0-9a-f]{64})/g

/** How long a freshly written object is protected from collection. */
const DEFAULT_GRACE_MS = 600_000

/**
 * Collect every attachment digest the surviving transcripts still name.
 *
 * A transcript this read cannot decode rejects the whole set: a partial set
 * would delete bytes a conversation still uses.
 * @param home - the Harness home directory.
 * @returns the referenced digest set.
 * @throws {Error} when any transcript cannot be read in full.
 */
export async function referencedDigests(home) {
  const sessions = await scanSessions(home, { readHeaders: false })
  const digests = new Set()
  for (const session of sessions) {
    for (const path of await logFiles(session.directory)) {
      const text = await readLog(path)
      for (const match of text.matchAll(DIGEST_REFERENCE)) digests.add(match[1])
    }
  }
  return digests
}

/**
 * Drop the attachment bytes no surviving transcript names.
 *
 * Recently written entries are left alone: an upload lands before the
 * transcript that names it flushes, so a fresh object may be referenced by a
 * conversation whose log does not say so yet.
 * @param home - the Harness home directory.
 * @param options - the reference set, the protection window, and the clock.
 * @returns how many objects, hard links, and bytes were removed.
 */
export async function collectAttachments(home, {
  referenced,
  graceMs = DEFAULT_GRACE_MS,
  now = Date.now(),
} = {}) {
  if (!(referenced instanceof Set)) throw new TypeError('collectAttachments needs the referenced digest set')
  const root = join(home, 'attachments', 'v1')
  const collected = { objects: 0, references: 0, bytes: 0 }
  for (const tree of ['objects', 'file-objects']) {
    for (const entry of await objectEntries(join(root, tree))) {
      if (referenced.has(entry.digest) || now - entry.mtimeMs < graceMs) continue
      await rm(entry.path, { force: true })
      collected.objects += 1
      collected.bytes += entry.size
      await pruneEmptyDirectory(dirname(entry.path))
    }
  }
  for (const entry of await referenceEntries(join(root, 'files'))) {
    if (referenced.has(entry.digest) || now - entry.mtimeMs < graceMs) continue
    collected.references += 1
    // The files that were listed go one by one; a link this run never saw wins
    // the directory, because pruning only ever removes an empty one.
    for (const name of await files(entry.path)) await rm(join(entry.path, name), { force: true })
    await pruneEmptyDirectory(entry.path)
    await pruneEmptyDirectory(dirname(entry.path))
  }
  await purgeStaging(join(root, 'tmp'), now - graceMs)
  return collected
}

/**
 * Enumerate one canonical-object tree: `<root>/<prefix>/<digest>`.
 * @param root - absolute tree root, missing when nothing was stored yet.
 * @returns one entry per object file.
 */
async function objectEntries(root) {
  const entries = []
  for (const prefix of await directories(root)) {
    const prefixDirectory = join(root, prefix)
    for (const name of await files(prefixDirectory)) {
      const path = join(prefixDirectory, name)
      const stats = await stat(path)
      entries.push({ digest: name, path, size: stats.size, mtimeMs: stats.mtimeMs })
    }
  }
  return entries
}

/**
 * Enumerate one hard-link tree: `<root>/<prefix>/<digest>/<name>`.
 * @param root - absolute tree root, missing when nothing was stored yet.
 * @returns one entry per digest directory.
 */
async function referenceEntries(root) {
  const entries = []
  for (const prefix of await directories(root)) {
    const prefixDirectory = join(root, prefix)
    for (const digest of await directories(prefixDirectory)) {
      const path = join(prefixDirectory, digest)
      const stats = await stat(path)
      entries.push({ digest, path, mtimeMs: stats.mtimeMs })
    }
  }
  return entries
}

/**
 * Remove staging files a crashed or cancelled write left behind.
 * @param root - the attachment staging directory.
 * @param cutoff - entries older than this epoch are stale.
 */
async function purgeStaging(root, cutoff) {
  for (const name of await files(root)) {
    const path = join(root, name)
    try {
      const stats = await stat(path)
      if (stats.mtimeMs < cutoff) await rm(path, { force: true })
    } catch {
      // A concurrent writer owns it; the next cleanup sees it again.
    }
  }
}

/**
 * Remove a directory that lost its last child, so the tree keeps its shape.
 *
 * The non-recursive call is the point: a writer that adds a link between the
 * deletion of the listed files and this call makes the directory non-empty, and
 * `rmdir` then refuses instead of taking the new link with the directory.
 * @param directory - the directory to prune.
 */
async function pruneEmptyDirectory(directory) {
  try {
    await rmdir(directory)
  } catch {
    // Not empty any more, already gone, or still in use: nothing to prune.
  }
}

/**
 * List the immediate subdirectories of a directory.
 * @param root - absolute directory that may not exist yet.
 * @returns its child directory names.
 */
async function directories(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

/**
 * List the immediate files of a directory.
 * @param root - absolute directory that may not exist yet.
 * @returns its child file names.
 */
async function files(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}
