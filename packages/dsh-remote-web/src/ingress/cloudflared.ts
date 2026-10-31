/**
 * The cloudflared binary this package owns.
 *
 * The row installs the Cloudflare tunnel client itself instead of leaning on
 * the `cloudflared` npm package's postinstall: the binary lives under
 * `$DSH_HOME/dsh-web-pack/remote-web/bin/`, is pinned to one release, is
 * validated by actually running `--version` before it is trusted, and never
 * sits inside a node_modules tree that a package manager may rewrite while a
 * tunnel is running. `DSH_REMOTE_CLOUDFLARED_BIN` points the row at a binary
 * that already exists (offline hosts, tests).
 *
 * The spawn wrapper here is the whole reason the npm package is not needed: a
 * quick tunnel reports its minted hostname on stderr, a named tunnel reports a
 * registered edge connection, and both surface through the same tiny handle
 * the tunnel manager consumes.
 *
 * @module dsh-remote-web/cloudflared
 */
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'

/** The pinned release this row downloads. Bump deliberately, in one place. */
export const CLOUDFLARED_VERSION = '2026.10.7'

/** Environment variable pointing the row at an existing binary. */
const BINARY_OVERRIDE_ENV = 'DSH_REMOTE_CLOUDFLARED_BIN'

/** Release assets per platform/arch; `compressed` assets are `.tgz` archives. */
const RELEASE_ASSETS: Record<string, { name: string; compressed: boolean }> = {
  'win32-x64': { name: 'cloudflared-windows-amd64.exe', compressed: false },
  'win32-arm64': { name: 'cloudflared-windows-arm64.exe', compressed: false },
  'linux-x64': { name: 'cloudflared-linux-amd64', compressed: false },
  'linux-arm64': { name: 'cloudflared-linux-arm64', compressed: false },
  'linux-arm': { name: 'cloudflared-linux-arm', compressed: false },
  'darwin-x64': { name: 'cloudflared-darwin-amd64.tgz', compressed: true },
  'darwin-arm64': { name: 'cloudflared-darwin-arm64.tgz', compressed: true },
}

/** Resolve the DSH home the same way dsh itself does. */
function dshHome(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const raw = env.DSH_HOME
  return raw !== undefined && raw.trim() !== '' ? raw.trim() : join(home, '.dsh')
}

/**
 * Where this row keeps its cloudflared binary.
 * @param env - environment to read the override and `DSH_HOME` from.
 * @param home - platform home fallback.
 * @returns the absolute binary path.
 */
export function cloudflaredBinaryPath(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const override = env[BINARY_OVERRIDE_ENV]
  if (override !== undefined && override.trim() !== '') {
    const value = override.trim()
    return isAbsolute(value) ? value : join(process.cwd(), value)
  }
  return join(dshHome(env, home), 'dsh-web-pack', 'remote-web', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')
}

/** The release asset for this machine. */
function releaseAsset(platform: string, arch: string): { name: string; compressed: boolean } {
  const asset = RELEASE_ASSETS[`${platform}-${arch}`]
  if (asset === undefined) {
    throw new Error(`cloudflared: no release asset for ${platform}/${arch}`)
  }
  return asset
}

/** Download URL of one release asset. */
function assetUrl(version: string, name: string): string {
  return `https://github.com/cloudflare/cloudflared/releases/download/${version}/${name}`
}

/**
 * Run `--version` and read the version it prints.
 * @param binary - the executable path.
 * @returns the printed version, or undefined when the binary does not run.
 */
export function cloudflaredVersion(binary: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(binary, ['--version'], { timeout: 10_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error !== null) {
        resolve(undefined)
        return
      }
      const match = /cloudflared version (\S+)/.exec(`${stdout}\n${stderr}`)
      resolve(match?.[1])
    })
  })
}

/**
 * Download the pinned release to `target` and make it executable.
 * @param options - target path, version, platform/arch override, fetch seam.
 * @returns the binary path.
 */
export async function downloadCloudflared(options: {
  path: string
  version?: string
  platform?: string
  arch?: string
  fetch?: typeof fetch
  log?: (message: string) => void
}): Promise<string> {
  const version = options.version ?? CLOUDFLARED_VERSION
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const fetcher = options.fetch ?? fetch
  const asset = releaseAsset(platform, arch)
  const url = assetUrl(version, asset.name)
  const log = options.log ?? (() => {})

  mkdirSync(dirname(options.path), { recursive: true })
  const downloadPath = `${options.path}.download`
  log(`downloading ${url}`)
  const response = await fetcher(url, { redirect: 'follow' })
  if (!response.ok || response.body === null) {
    throw new Error(`cloudflared: download failed (${response.status} ${response.statusText})`)
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(downloadPath))

  let binary = downloadPath
  if (asset.compressed) {
    const extracted = `${downloadPath}.bin`
    await new Promise<void>((resolve, reject) => {
      execFile('tar', ['-xzf', downloadPath, '-C', dirname(options.path), 'cloudflared'], { windowsHide: true }, (error) => {
        if (error !== null) reject(error)
        else resolve()
      })
    })
    renameSync(join(dirname(options.path), 'cloudflared'), extracted)
    rmSync(downloadPath, { force: true })
    binary = extracted
  }

  if (platform !== 'win32') chmodSync(binary, 0o755)
  renameSync(binary, options.path)
  return options.path
}

/**
 * Make sure the pinned binary is present and runs, downloading it otherwise.
 * @param options - path/version overrides and the seams used by tests.
 * @returns the executable path.
 */
export async function ensureCloudflaredBinary(options: {
  path?: string
  version?: string
  platform?: string
  arch?: string
  fetch?: typeof fetch
  log?: (message: string) => void
} = {}): Promise<string> {
  const path = options.path ?? cloudflaredBinaryPath()
  const version = options.version ?? CLOUDFLARED_VERSION
  if (existsSync(path)) {
    const running = await cloudflaredVersion(path)
    if (running === version) return path
  }
  await downloadCloudflared({ ...options, path, version })
  const installed = await cloudflaredVersion(path)
  if (installed !== version) {
    throw new Error(`cloudflared: ${path} reports ${installed ?? 'no version'} after the download, expected ${version}`)
  }
  return path
}

/** The handle shape the tunnel manager consumes. */
export interface CloudflaredHandle {
  on(event: string, listener: (...args: any[]) => void): unknown
  off(event: string, listener: (...args: any[]) => void): unknown
  stop(): boolean
}

/** Hostnames cloudflared mints for accountless quick tunnels. */
const QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/
/** The line a named tunnel prints once an edge connection registers. */
const NAMED_CONNECTED = /Registered tunnel connection/

/**
 * Spawn one cloudflared child and translate its output into lifecycle events.
 * @param binary - the executable.
 * @param args - argv after the executable.
 * @param options - extra environment (the named tunnel's token) and logging.
 * @returns the handle the manager drives.
 */
export function spawnCloudflared(
  binary: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; log?: (message: string) => void } = {},
): CloudflaredHandle & { emit(event: string, ...args: any[]): boolean } {
  const log = options.log ?? (() => {})
  const child = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, ...options.env },
  })
  const handle = new EventEmitter() as unknown as CloudflaredHandle & { emit(event: string, ...args: any[]): boolean }
  let announced = false

  const scan = (chunk: Buffer): void => {
    const text = chunk.toString()
    for (const line of text.split('\n')) {
      if (line.trim() !== '') log(line.trim())
    }
    if (announced) return
    const quick = QUICK_URL.exec(text)
    if (quick !== null) {
      announced = true
      handle.emit('url', quick[0])
      return
    }
    if (NAMED_CONNECTED.test(text)) {
      announced = true
      handle.emit('connected')
    }
  }

  child.stdout?.on('data', scan)
  child.stderr?.on('data', scan)
  child.once('exit', (code, signal) => { handle.emit('exit', code, signal) })
  child.once('error', (error) => { handle.emit('error', error) })
  handle.stop = (): boolean => child.kill()
  return handle
}

/**
 * Spawn a quick tunnel: cloudflared mints an ephemeral trycloudflare hostname
 * and reports it on stderr, which surfaces as the handle's `url` event.
 * @param binary - the executable.
 * @param targetUrl - the local origin the tunnel fronts.
 * @param flags - extra flags (e.g. the Host the origin should see).
 * @param log - line log.
 * @returns the handle.
 */
export function spawnQuickTunnel(
  binary: string,
  targetUrl: string,
  flags: Record<string, string | boolean> = {},
  log?: (message: string) => void,
): CloudflaredHandle & { emit(event: string, ...args: any[]): boolean } {
  const args = ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', targetUrl]
  for (const [flag, value] of Object.entries(flags)) {
    if (value === false) continue
    args.push(flag)
    if (value !== true) args.push(value)
  }
  return spawnCloudflared(binary, args, { log })
}

/**
 * Spawn a named tunnel. The token travels in TUNNEL_TOKEN, never argv.
 * @param binary - the executable.
 * @param token - the named-tunnel token.
 * @param log - line log.
 * @returns the handle emitting `connected` once an edge connection registers.
 */
export function spawnNamedTunnel(
  binary: string,
  token: string,
  log?: (message: string) => void,
): CloudflaredHandle & { emit(event: string, ...args: any[]): boolean } {
  return spawnCloudflared(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', 'run'], {
    env: { TUNNEL_TOKEN: token },
    log,
  })
}
