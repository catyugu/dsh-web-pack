/**
 * Route checks for the session management sub-component: the three exact
 * routes the browser side talks to, and the status each refusal becomes.
 *
 * The routes are mounted on the shared fake Host context, so this file checks
 * the HTTP surface without the turn engine behind it.
 */
import assert from 'node:assert/strict'
import { ROUTES, apply } from '../src/host.js'
import { call, fakeCtx, removeHome, resetHome } from './support.mjs'

await resetHome()

try {
  // Every route is registered, and only those routes.
  const host = fakeCtx()
  apply(host.ctx)
  assert.deepEqual([...host.routes.keys()].sort(), Object.values(ROUTES).sort(), 'every route is registered')

  // A question of a session this process does not hold is refused with 404.
  const prompt = await host.routes.get(ROUTES.prompt).fetch(
    new Request(`http://localhost${ROUTES.prompt}?sessionId=session-turn&messageId=question-one`),
  )
  assert.equal(prompt.status, 404, JSON.stringify(await prompt.json()))

  /**
   * Answer one regeneration request through the captured route.
   * @param body - the JSON body to send.
   * @returns the answer.
   */
  const regenerate = (body) => host.routes.get(ROUTES.regenerate).fetch(
    new Request(`http://localhost${ROUTES.regenerate}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

  // A request that names no question is refused before any Host service is read.
  const bad = await regenerate({ sessionId: 'session-turn' })
  assert.equal(bad.status, 400)
  const body = await bad.json()
  assert.equal(body.ok, false)
  assert.equal(body.code, 'bad-request')

  // An operation id is required, and must be one the Host accepts.
  const noOperation = await regenerate({ sessionId: 'session-turn', messageId: 'question-one' })
  assert.equal(noOperation.status, 400)

  // An empty edited question is refused instead of being replayed.
  const emptyText = await regenerate({ sessionId: 'session-turn', messageId: 'question-one', operationId: 'operation-route', text: '  ' })
  assert.equal(emptyText.status, 400)

  // The compaction settings read as the official defaults on a fresh home.
  const settings = await call(host.routes, ROUTES.compaction)
  assert.equal(settings.status, 200, JSON.stringify(settings.body))
  assert.equal(settings.body.settings.enabled, false)
  assert.equal(settings.body.settings.thresholdRatio, 0.8)
  assert.deepEqual(settings.body.defaults, settings.body.settings, 'an unpatched engine has no other defaults')

  // A submission outside a range is refused with the reason the dictionary knows.
  const refused = await call(host.routes, ROUTES.compaction, {
    enabled: true,
    thresholdRatio: 0.95,
    retainRatio: 0.2,
    maxTokens: 4096,
    compactionRetries: 1,
    maxOverflowRetries: 1,
  })
  assert.equal(refused.status, 400, JSON.stringify(refused.body))
  assert.equal(refused.body.code, 'invalid-threshold-ratio')

  console.log('manage: route checks passed')
} finally {
  await removeHome()
}
