/**
 * Compose each package's browser bundle from its own source.
 *
 * The browser half of every package is one classic script: the source is the
 * function expression this bundle hands to the page's module loader, unchanged.
 * A package that ships a prebuilt browser bundle (the vendored `dsh-remote-web`)
 * has no `src/client.js` and is left alone.
 *
 * @module dsh-web-pack/build
 */
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const packages = join(root, 'packages')

for (const name of (await readdir(packages)).sort()) {
  const directory = join(packages, name)
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  const sourceFile = join(directory, 'src', 'client.js')
  if (!existsSync(sourceFile)) {
    console.log(`skipped ${manifest.name} (prebuilt client)`)
    continue
  }
  const source = (await readFile(sourceFile, 'utf8')).trim()
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
