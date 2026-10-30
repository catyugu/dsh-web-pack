/**
 * Verify the tarball this package would publish carries its rows.
 *
 * The rows are `file:` dependencies, so they only reach a reader if the tarball
 * contains `packages/<row>` with the row's manifest and browser bundle, and if
 * the patch names exactly the packages those manifests declare. A packaging
 * change that drops either leaves readers with a bundle whose rows never start.
 *
 * The tarball is packed into a temporary directory and read directly, because
 * npm's own file report mixes lifecycle output into stdout.
 *
 * @module dsh-web-pack/check-tarball
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

/**
 * Walk the entries of a tar archive.
 * @param archive - the uncompressed tar bytes.
 * @returns each entry's name.
 */
function tarEntries(archive) {
  const names = []
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '').trim()
    const size = Number.parseInt(text(124, 12) || '0', 8)
    names.push(text(0, 100))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return names
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
  const files = new Set(tarEntries(gunzipSync(await readFile(join(destination, tarball)))))
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')

  for (const directory of (await readdir(join(root, 'packages'))).sort()) {
    const manifest = JSON.parse(await readFile(join(root, 'packages', directory, 'package.json'), 'utf8'))
    if (!patch.includes(`"${manifest.name}"`)) throw new Error(`${manifest.name} has no row in the patch`)
    for (const file of ['package.json', 'client.js', 'src/host.js']) {
      const path = `package/packages/${directory}/${file}`
      if (!files.has(path)) throw new Error(`${manifest.name} ships without ${file}`)
    }
  }
  console.log(`the tarball carries ${(await readdir(join(root, 'packages'))).length} rows`)
} finally {
  await rm(destination, { recursive: true, force: true })
}
