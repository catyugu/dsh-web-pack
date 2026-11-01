/**
 * Publish the bundle on npm.
 *
 * The rows travel inside this package: they are `file:` dependencies, so the
 * tarball carries them and pnpm links them into the installed package's own
 * `node_modules`. Only this package is published.
 *
 * The script publishes directly when the credential may bypass
 * proof-of-presence, and falls back to staged publishing (2FA deferred to a
 * person approving on the registry) only when the registry refused for an
 * authentication reason. Any other failure — a bad tarball, a name the account
 * may not write, a network error — is rethrown, because staging it would turn
 * one clear error into a second, unrelated one. A version the registry already
 * serves is a no-op, so a retried tag run finishes the release instead of
 * failing on the version it published the first time.
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
 * The registry answers that mean "this credential may publish, but a person
 * must approve it": proof-of-presence (EOTP), a 2FA challenge, or the 403 npm
 * produces for a session that needs one.
 */
const NEEDS_APPROVAL = /EOTP|one-time pass|two-factor|2FA|E403|403 Forbidden|needs auth|must be logged in to publish/i

/**
 * Run one npm command in the repository root and capture its output.
 * @param args - the npm arguments.
 * @param opts - capture stdout/stderr, and whether a lookup may fail quietly.
 * @returns the command's stdout.
 * @throws the command's error, with its captured output attached as `output`.
 */
function npm(args, opts = {}) {
  const { capture = false, quiet = false } = opts
  const options = {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', capture || !quiet ? 'pipe' : 'ignore'],
  }
  try {
    const stdout = shell
      ? execFileSync(['npm', ...args].join(' '), { ...options, shell: true })
      : execFileSync('npm', args, options)
    if (capture) process.stdout.write(stdout ?? '')
    return stdout ?? ''
  } catch (error) {
    error.output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    throw error
  }
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
    const parsed = JSON.parse(npm(['view', name, 'versions', '--json'], { quiet: true }))
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
    const staged = JSON.parse(npm(['stage', 'list', '--json'], { quiet: true }))
    return new Set(staged.map((entry) => `${entry.packageName}@${entry.version}`))
  } catch {
    return new Set()
  }
}

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const key = `${manifest.name}@${manifest.version}`

if (publishedVersions(manifest.name).includes(manifest.version)) {
  console.log(`${key} is already published`)
} else {
  console.log(`publishing ${key}`)
  let refusal
  try {
    npm(['publish', quoted(root), '--access', 'public'], { capture: true })
    console.log(`${key} is published`)
  } catch (error) {
    if (!NEEDS_APPROVAL.test(error.output ?? error.message ?? '')) throw error
    refusal = error
  }
  if (refusal !== undefined) {
    // The credential is valid but the registry wants a person to approve this
    // exact artifact: stage it, and the approval finishes the release.
    if (stagedVersions().has(key)) {
      console.log(`${key} is already staged`)
    } else {
      console.log(`staging ${key}`)
      npm(['stage', 'publish', quoted(root), '--access', 'public'], { capture: true })
      console.log(`${key} is staged; approve it on npm to finish the release`)
    }
  }
}
