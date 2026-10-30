/**
 * Stage the bundle on npm.
 *
 * The rows travel inside this package: they are `file:` dependencies, so the
 * tarball carries them and pnpm links them into the installed package's own
 * `node_modules`. Only this package is published.
 *
 * Staging defers the 2FA proof of presence to the approval step, so a token
 * without 2FA bypass can prepare a release that a person then approves on the
 * registry. A version the registry already serves, or already holds staged, is
 * skipped, so a retried tag run finishes the release instead of failing on the
 * version it prepared the first time.
 *
 * `NODE_AUTH_TOKEN` supplies the credential; this script never reads a token
 * itself and never writes one to disk.
 *
 * @module dsh-web-pack/stage
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
/** Windows runs `npm.cmd`, which Node only spawns through a shell. */
const shell = process.platform === 'win32'

/**
 * Run one npm command in the repository root.
 * @param args - the npm arguments.
 * @param quiet - whether to swallow the command's stderr, for a lookup that may
 * find nothing.
 * @returns its stdout.
 */
function npm(args, quiet = false) {
  const options = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'inherit'] }
  return shell
    ? execFileSync(['npm', ...args].join(' '), { ...options, shell: true })
    : execFileSync('npm', args, options)
}

/**
 * Quote one argument for the shell a Windows run goes through.
 * @param value - the argument.
 * @returns the argument, quoted when it contains a space.
 */
function quoted(value) {
  return shell && value.includes(' ') ? `"${value}"` : value
}

/**
 * The versions of this package the registry already serves.
 * @param name - the package name.
 * @returns its published versions, empty when it serves none.
 */
function publishedVersions(name) {
  try {
    const parsed = JSON.parse(npm(['view', name, 'versions', '--json'], true))
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

/**
 * Every `name@version` the registry holds staged for this account.
 * @returns the staged keys.
 */
function stagedVersions() {
  try {
    const staged = JSON.parse(npm(['stage', 'list', '--json'], true))
    return new Set(staged.map((entry) => `${entry.packageName}@${entry.version}`))
  } catch {
    return new Set()
  }
}

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const key = `${manifest.name}@${manifest.version}`

if (publishedVersions(manifest.name).includes(manifest.version)) {
  console.log(`${key} is already published`)
} else if (stagedVersions().has(key)) {
  console.log(`${key} is already staged`)
} else {
  console.log(`staging ${key}`)
  npm(['stage', 'publish', quoted(root), '--access', 'public'])
}
