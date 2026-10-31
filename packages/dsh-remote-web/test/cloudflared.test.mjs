/**
 * Checks for the tunnel binary this package owns: where it lives, and how a
 * spawned child's output turns into the lifecycle events the tunnel manager
 * consumes. No real download and no real cloudflared is involved.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  cloudflaredBinaryPath,
  downloadCloudflared,
  spawnCloudflared,
} from '../src/ingress/cloudflared.ts'

/** Run one spawned handle until it reports, or fail after a timeout. */
function once(handle, event, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`timed out waiting for ${event}`)) }, timeoutMs)
    handle.once(event, (...args) => { clearTimeout(timer); resolve(args) })
    handle.once('error', (error) => { clearTimeout(timer); reject(error) })
  })
}

test('the binary lives under the state directory, and the override wins', () => {
  const home = join(tmpdir(), 'dsh-home')
  const path = cloudflaredBinaryPath({ DSH_HOME: home })
  assert.ok(path.startsWith(join(home, 'dsh-web-pack', 'remote-web', 'bin')), path)
  assert.ok(path.endsWith(process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'), path)

  const override = join(tmpdir(), 'elsewhere', 'cloudflared')
  assert.equal(cloudflaredBinaryPath({ DSH_HOME: home, DSH_REMOTE_CLOUDFLARED_BIN: override }), override)
})

test('a download writes the platform asset to the requested path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-cloudflared-'))
  try {
    const target = join(directory, 'bin', 'cloudflared')
    const fetch = async () => new Response('binary-bytes', { status: 200 })
    await downloadCloudflared({ path: target, platform: 'linux', arch: 'x64', fetch })
    assert.equal(await readFile(target, 'utf8'), 'binary-bytes')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a quick tunnel surfaces the minted hostname from stderr', async () => {
  const script = 'console.error("INF |  https://purple-river-1234.trycloudflare.com  |")'
  const handle = spawnCloudflared(process.execPath, ['-e', script])
  const [url] = await once(handle, 'url')
  assert.equal(url, 'https://purple-river-1234.trycloudflare.com')
})

test('a named tunnel surfaces the first registered edge connection', async () => {
  const script = 'console.error("INF Registered tunnel connection connIndex=0")'
  const handle = spawnCloudflared(process.execPath, ['-e', script])
  await once(handle, 'connected')
  assert.ok(handle.stop())
})
