/**
 * The invariant companion's identity: it reserves ownership for the package
 * this repository actually ships. A stale upstream name would register a
 * package nobody installs and leave the real one unowned.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { apply, inject, name } from '../src/invariant.ts'

test('the companion registers under the package it ships with', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const registered = []
  const disposer = () => {}
  const ctx = {
    invariants: {
      register: (packageName, install) => {
        registered.push({ packageName, install })
        return disposer
      },
    },
  }

  assert.equal(await apply(ctx), disposer)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].packageName, manifest.name)
  assert.equal(registered[0].packageName, '@catyugu/dsh-remote-web')
  assert.equal(name, 'remote-web-invariant')
  assert.deepEqual(inject, ['invariants'])
})
