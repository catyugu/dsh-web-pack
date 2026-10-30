/**
 * Compose each package's browser bundle from its own source.
 *
 * The browser half of every package is one classic script: the source is the
 * function expression this bundle hands to the page's module loader, unchanged.
 *
 * @module dsh-web-pack/build
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const packages = join(root, 'packages')

for (const name of (await readdir(packages)).sort()) {
  const directory = join(packages, name)
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  const source = (await readFile(join(directory, 'src', 'client.js'), 'utf8')).trim()
  const bundle = `/**
 * Generated from src/client.js — do not edit. Run \`npm run build\`.
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory(require) {
    return (${source})(require)
  },
})
`
  await writeFile(join(directory, 'client.js'), bundle)
  console.log(`built ${manifest.name}`)
}
