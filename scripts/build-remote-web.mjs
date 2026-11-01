/**
 * Build the `dsh-remote-web` row from its own sources.
 *
 * The package is a source-level fork of the retired `dsh-remote-web-ui`: the
 * Host half is plain ESM TypeScript, the browser half is one classic script
 * built from `src/client`, and its CSS modules are compiled here because the
 * Harness shell loads a plugin's client bundle as a single file.
 *
 * Two artifacts come out of `src`:
 *
 * - `lib/host.js` and `lib/invariant.js` — ESM, every package the Harness
 *   runtime already provides left external.
 * - `client.js` — one CJS body wrapped in the shell's module-loader call, with
 *   React and the shell's client packages left external.
 *
 * `*.module.css` is compiled into a JS module: class names are hashed per
 * file, `:global(...)` wrappers are dropped (their content is emitted as-is),
 * and the stylesheet is injected once through a `<style>` tag owned by this
 * package.
 *
 * @module dsh-web-pack/build-remote-web
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const packageDirectory = join(root, 'packages', 'dsh-remote-web')
const source = join(packageDirectory, 'src')
const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'))

/**
 * The Host half is bundled self-contained: a row travels inside the pack's
 * tarball, and pnpm does not install the nested `file:` dependencies of a
 * tarball dependency, so every runtime import has to be inlined here. Node
 * builtins stay external through `platform: 'node'`.
 */
const HOST_EXTERNAL = ['@deepseek-ai/cordis']
/** Modules the shell's client module loader hands to the bundle. */
const CLIENT_EXTERNAL = ['@deepseek-ai/*', 'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']

/**
 * Rewrite one selector: local class names become `<name>_<hash>`, `:global()`
 * wrappers are removed, attribute selectors and everything else stay put.
 * @param selector - one selector text.
 * @param hash - per-file suffix.
 * @param classes - map collecting local names.
 * @returns the rewritten selector.
 */
function rewriteSelector(selector, hash, classes) {
  let out = ''
  let index = 0
  let globalDepth = 0
  while (index < selector.length) {
    const rest = selector.slice(index)
    if (rest.startsWith(':global(')) {
      index += ':global('.length
      globalDepth += 1
      continue
    }
    if (globalDepth > 0 && selector[index] === ')') {
      globalDepth -= 1
      index += 1
      continue
    }
    if (selector[index] === '[') {
      const end = selector.indexOf(']', index)
      const stop = end === -1 ? selector.length : end + 1
      out += selector.slice(index, stop)
      index = stop
      continue
    }
    if (globalDepth === 0 && selector[index] === '.' && /[A-Za-z_]/.test(selector[index + 1] ?? '')) {
      const match = /^\.([A-Za-z_][\w-]*)/.exec(rest)
      classes.set(match[1], `${match[1]}_${hash}`)
      out += `.${match[1]}_${hash}`
      index += match[0].length
      continue
    }
    out += selector[index]
    index += 1
  }
  return out
}

/** esbuild plugin compiling `*.module.css` into a JS module with a class map. */
const cssModulesPlugin = {
  name: 'dsh-css-modules',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
      const text = await readFile(args.path, 'utf8')
      // Hash the repository-relative path, not the absolute one: the same
      // source must produce the same class names on every machine and in CI.
      const relativePath = relative(root, args.path).replaceAll('\\', '/')
      const hash = createHash('sha256').update(relativePath).digest('hex').slice(0, 6)
      const classes = new Map()
      let css = ''
      let index = 0
      // Every prelude up to `{` is either an at-rule (`@media …`, copied
      // verbatim; its inner selectors are preludes of their own) or a
      // selector list, which is rewritten.
      while (index < text.length) {
        const open = text.indexOf('{', index)
        if (open === -1) {
          css += text.slice(index)
          break
        }
        const prelude = text.slice(index, open)
        css += prelude.trimStart().startsWith('@') ? prelude : rewriteSelector(prelude, hash, classes)
        css += '{'
        index = open + 1
      }
      const tagId = `${manifest.name}/${basename(args.path)}`
      const contents = `const css = ${JSON.stringify(css)}
const id = ${JSON.stringify(tagId)}
if (typeof document !== 'undefined' && document.getElementById(id) === null) {
  const tag = document.createElement('style')
  tag.id = id
  tag.dataset.plugin = ${JSON.stringify(manifest.name)}
  tag.textContent = css
  document.head.appendChild(tag)
}
export default ${JSON.stringify(Object.fromEntries(classes))}
`
      return { contents, loader: 'js', resolveDir: dirname(args.path) }
    })
  },
}

await mkdir(join(packageDirectory, 'lib'), { recursive: true })

await build({
  entryPoints: [
    { in: join(source, 'index.ts'), out: 'host' },
    { in: join(source, 'invariant.ts'), out: 'invariant' },
  ],
  outdir: join(packageDirectory, 'lib'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: HOST_EXTERNAL,
  entryNames: '[name]',
  // yaml ships CommonJS; inlining it into an ESM bundle leaves esbuild's
  // `__require` shim without a real `require`, which throws at load time.
  // One createRequire binding gives the inlined CJS the module loader it
  // expects.
  banner: {
    js: "import { createRequire as __dshCreateRequire } from 'node:module';\nconst require = __dshCreateRequire(import.meta.url);",
  },
  logLevel: 'warning',
})

const client = await build({
  entryPoints: [join(source, 'client', 'index.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: CLIENT_EXTERNAL,
  jsx: 'automatic',
  // A plain stylesheet is text the row injects into its own tag; `*.module.css`
  // is compiled by the plugin below instead.
  loader: { '.css': 'text' },
  plugins: [cssModulesPlugin],
  logLevel: 'warning',
})
const body = client.outputFiles[0].text
await writeFile(join(packageDirectory, 'client.js'), `/**
 * Generated from src/client — do not edit. Run \`npm run build:remote-web\`.
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory(require) {
    var module = { exports: {} }
    var exports = module.exports
${body}
    return module.exports
  },
})
`)

console.log(`built ${manifest.name}: lib/host.js, lib/invariant.js, client.js`)
