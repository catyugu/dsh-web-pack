/**
 * The HTTP surface of the session management sub-component: four exact Fetch
 * routes on the authenticated `/api` carrier. This module owns request shape
 * only — decoding, validation, and the status a refusal gets — and defers every
 * decision to the operations the host side composes from Harness services.
 *
 * A question is addressed by its message identity, never by a turn number: one
 * turn may hold several questions, and only the one the user clicked may be
 * replayed.
 *
 * @module dsh-better-session/manage/routes
 */
import { Refusal, answered, jsonBody, reply } from './http.js'

/** The exact Fetch routes the browser side talks to. */
export const ROUTES = {
  prompt: '/api/sessionManage/prompt',
  regenerate: '/api/sessionManage/turns/regenerate',
  compaction: '/api/sessionManage/compaction',
  defaults: '/api/sessionManage/defaults',
  hidden: '/api/sessionManage/hidden',
}

/** The operation identity a regeneration carries. */
const OPERATION_ID = /^[a-zA-Z0-9_-]{8,40}$/

/**
 * Build the routes over one operations object.
 * @param operations - what each route does, plus the diagnostic reporter.
 * @returns one Fetch route per entry, ready for `connection.fetch.register`.
 */
export function createRoutes(operations) {
  return [
    promptRoute(operations),
    regenerateRoute(operations),
    compactionRoute(operations),
    defaultsRoute(operations),
    hiddenRoute(operations),
  ]
}

/**
 * Read the question one message identity names.
 * @param operations - the composed operations.
 */
function promptRoute({ prompt, report }) {
  return {
    path: ROUTES.prompt,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'reading the question failed', 'prompt-failed', async () => {
      const query = new URL(request.url).searchParams
      const sessionId = query.get('sessionId')
      const messageId = query.get('messageId')
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Refusal(400, 'bad-request', 'the request must name one session')
      }
      if (typeof messageId !== 'string' || messageId.length === 0) {
        throw new Refusal(400, 'bad-request', 'the request must name one question')
      }
      return reply(200, { ok: true, prompt: await prompt({ sessionId, messageId }) })
    }),
  }
}

/**
 * Remove one question's turn and re-send that question.
 * @param operations - the composed operations.
 */
function regenerateRoute({ regenerate, report }) {
  return {
    path: ROUTES.regenerate,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'regenerating the turn failed', 'regenerate-failed', async () => {
      const payload = await jsonBody(request)
      const target = questionRequest(payload)
      if (typeof payload.operationId !== 'string' || !OPERATION_ID.test(payload.operationId)) {
        throw new Refusal(400, 'bad-request', 'the request must carry one operation id')
      }
      if (payload.text !== undefined && typeof payload.text !== 'string') {
        throw new Refusal(400, 'bad-request', '"text" must be a string')
      }
      if (typeof payload.text === 'string' && payload.text.trim().length === 0) {
        throw new Refusal(400, 'bad-request', '"text" must not be empty')
      }
      return reply(200, {
        ok: true,
        ...(await regenerate({
          ...target,
          operationId: payload.operationId,
          ...(payload.text === undefined ? {} : { text: payload.text }),
        })),
      })
    }),
  }
}

/**
 * Read or write the compaction settings.
 * @param operations - the composed operations.
 */
function compactionRoute({ readCompaction, saveCompaction, report }) {
  return {
    path: ROUTES.compaction,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'the compaction settings failed', 'compaction-failed', async () => {
      const sessionId = new URL(request.url).searchParams.get('sessionId')
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Refusal(400, 'bad-request', 'the request must name one session')
      }
      if (request.method === 'GET') return reply(200, { ok: true, ...(await readCompaction({ sessionId })) })
      const payload = await jsonBody(request)
      return reply(200, { ok: true, ...(await saveCompaction({ sessionId, payload })) })
    }),
  }
}

/**
 * Read or write the pack's global settings.
 * @param operations - the composed operations.
 */
function defaultsRoute({ readGlobal, saveGlobal, report }) {
  return {
    path: ROUTES.defaults,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'the global compaction settings failed', 'defaults-failed', async () => {
      if (request.method === 'GET') return reply(200, { ok: true, ...(await readGlobal()) })
      const payload = await jsonBody(request)
      return reply(200, { ok: true, ...(await saveGlobal({ payload })) })
    }),
  }
}

/**
 * Read the turns a session no longer has.
 * @param operations - the composed operations.
 */
function hiddenRoute({ hidden, report }) {
  return {
    path: ROUTES.hidden,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'reading the removed turns failed', 'hidden-failed', async () => {
      const sessionId = new URL(request.url).searchParams.get('sessionId')
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new Refusal(400, 'bad-request', 'the request must name one session')
      }
      return reply(200, { ok: true, ranges: await hidden({ sessionId }) })
    }),
  }
}

/**
 * Decode one question request: the session and the question it names.
 * @param payload - the decoded body.
 * @returns the target the host side acts on.
 * @throws {Refusal} when the body names neither shape.
 */
function questionRequest(payload) {
  if (payload === null || typeof payload !== 'object') {
    throw new Refusal(400, 'bad-request', 'the request body must name one session and one question')
  }
  if (typeof payload.sessionId !== 'string' || payload.sessionId.length === 0) {
    throw new Refusal(400, 'bad-request', 'the request body must name one session')
  }
  if (typeof payload.messageId !== 'string' || payload.messageId.length === 0) {
    throw new Refusal(400, 'bad-request', 'the request body must name one question')
  }
  return { sessionId: payload.sessionId, messageId: payload.messageId }
}
