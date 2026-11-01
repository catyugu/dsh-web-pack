/**
 * Verify the tarball this package would publish is installable, not merely
 * populated.
 *
 * The rows are `file:` dependencies, so they only reach a reader if the tarball
 * carries each row with its manifest, its Host module and its browser bundle,
 * and if the patch names exactly the packages those manifests declare. File
 * presence alone would let a broken import ship: the tarball is therefore
 * unpacked into a temporary directory and every Host entry point is imported
 * from there, which is what a reader's `dsh plugin add` does with it.
 *
 * The tarball is packed into a temporary directory and read directly, because
 * npm's own file report mixes lifecycle output into stdout.
 *
 * @module dsh-web-pack/check-tarball
 */
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

/** Longest header field the tar format stores inline. */
const NAME_BYTES = 100

/**
 * Walk the entries of a tar archive.
 * @param archive - the uncompressed tar bytes.
 * @returns every regular file with its bytes.
 */
function tarEntries(archive) {
  const entries = []
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '').trim()
    const name = text(0, NAME_BYTES)
    const size = Number.parseInt(text(124, 12) || '0', 8)
    const type = text(156, 1)
    const start = offset + 512
    // Only regular files (typeflag '0' or the end-of-archive default) carry bytes.
    if (type === '0' || type === '') entries.push({ name, data: archive.subarray(start, start + size) })
    offset = start + Math.ceil(size / 512) * 512
  }
  return entries
}

const root = join(import.meta.dirname, '..')
/** Windows runs `npm.cmd`, which Node only spawns through a shell. */
const shell = process.platform === 'win32'
const destination = await mkdtemp(join(tmpdir(), 'dsh-web-pack-'))

try {
  const args = ['pack', '--pack-destination', destination]
  const command = shell ? ['npm', ...args].map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ') : 'npm'
  execFileSync(command, shell ? [] : args, { cwd: root, shell, stdio: ['ignore', 'ignore', 'inherit'] })

  const [tarball] = (await readdir(destination)).filter((file) => file.endsWith('.tgz'))
  const entries = tarEntries(gunzipSync(await readFile(join(destination, tarball))))
  const files = new Set(entries.map((entry) => entry.name))

  // Unpack exactly what the archive carries, so an import resolves against the
  // installed layout instead of this checkout's node_modules.
  const installed = join(destination, 'installed')
  for (const entry of entries) {
    const target = join(installed, entry.name)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, entry.data)
  }

  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
  const rows = (await readdir(join(root, 'packages'))).sort()
  for (const directory of rows) {
    const manifest = JSON.parse(await readFile(join(root, 'packages', directory, 'package.json'), 'utf8'))
    if (!patch.includes(`"${manifest.name}"`)) throw new Error(`${manifest.name} has no row in the patch`)
    const entryPoints = Object.entries(manifest.exports ?? {})
      .filter(([key]) => key === '.' || key === './invariant' || key === './client')
      .flatMap(([key, target]) => (typeof target === 'string' ? [{ key, target }] : []))
    if (entryPoints.length === 0) throw new Error(`${manifest.name} declares no entry points`)
    for (const { key, target } of entryPoints) {
      const path = `package/packages/${directory}/${target.replace(/^\.\//, '')}`
      if (!files.has(path)) throw new Error(`${manifest.name} ships without ${target}`)
      // The browser half is a classic script for the page's module loader, not
      // an ES module, so only the Host half is imported.
      if (key === './client') continue
      const module = await import(pathToFileURL(join(installed, path)).href)
      if (typeof module.apply !== 'function') throw new Error(`${manifest.name}: ${key} exports no apply`)
    }
  }
  console.log(`the tarball carries ${rows.length} importable rows`)
} finally {
  await rm(destination, { recursive: true, force: true })
}
