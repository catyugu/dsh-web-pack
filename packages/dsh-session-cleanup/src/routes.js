/**
 * The HTTP surface: four exact Fetch routes on the authenticated `/api`
 * carrier. This module owns request shape only — decoding, validation, and the
 * status a refusal gets — and defers every decision to the operations the host
 * side composes from Harness services.
 *
 * @module dsh-better-session/cleanup/routes
 */
import { Refusal, answered, jsonBody, reply } from './http.js'

/** The exact Fetch routes the browser side talks to. */
export const ROUTES = {
  remove: '/api/sessionCleanup/remove',
  state: '/api/sessionCleanup/state',
  settings: '/api/sessionCleanup/settings',
  bulk: '/api/sessionCleanup/bulk',
}

/** The two cleanup scopes: no workspace at all, or one that does not list it. */
const SCOPES = new Set(['orphaned', 'detached'])

/**
 * Build the four routes over one operations object.
 * @param operations - what each route does, plus the diagnostic reporter.
 * @returns one Fetch route per entry, ready for `connection.fetch.register`.
 */
export function createRoutes(operations) {
  return [
    removeRoute(operations),
    stateRoute(operations),
    settingsRoute(operations),
    bulkRoute(operations),
  ]
}

/**
 * One deletion request: the Session identity only.
 * @param operations - the composed operations.
 */
function removeRoute({ remove, report }) {
  return {
    path: ROUTES.remove,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'deleting the requested session failed', 'remove-failed', async () => {
      const payload = await jsonBody(request)
      const sessionId = payload?.sessionId
      if (typeof sessionId !== 'string') {
        throw new Refusal(400, 'bad-request', 'the request body must carry one plain session id')
      }
      const outcome = await remove(sessionId)
      return reply(outcome.status, outcome.body)
    }),
  }
}

/**
 * One inventory read: both cleanup scopes and the stored settings.
 * @param operations - the composed operations.
 */
function stateRoute({ state, report }) {
  return {
    path: ROUTES.state,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => answered(report, 'reading the cleanup inventory failed', 'inventory-failed', async () => {
      const snapshot = await state()
      return reply(200, { ok: true, ...snapshot })
    }),
  }
}

/**
 * One settings write: the attachment switch, and nothing else.
 * @param operations - the composed operations.
 */
function settingsRoute({ saveSettings, report }) {
  return {
    path: ROUTES.settings,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'saving the cleanup settings failed', 'settings-failed', async () => {
      const payload = await jsonBody(request)
      if (payload === null || typeof payload !== 'object') {
        throw new Refusal(400, 'bad-request', 'the request body must carry the attachment switch')
      }
      if (payload.attachments !== undefined && typeof payload.attachments !== 'boolean') {
        throw new Refusal(400, 'bad-request', '"attachments" must be a boolean')
      }
      const settings = await saveSettings({ attachments: payload.attachments })
      return reply(200, { ok: true, settings })
    }),
  }
}

/**
 * One bulk deletion: either a scope name the Host resolves, or the explicit
 * conversations the page already knows it wants gone.
 * @param operations - the composed operations.
 */
function bulkRoute({ bulk, report }) {
  return {
    path: ROUTES.bulk,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => answered(report, 'cleaning conversations failed', 'bulk-failed', async () => {
      const payload = await jsonBody(request)
      const target = bulkRequest(payload)
      const outcome = await bulk(target)
      return reply(200, { ok: true, ...target, ...outcome })
    }),
  }
}

/**
 * Decode one bulk request: a named cleanup scope, or the ids of a list the page
 * built itself. One call per batch, so a workspace's archived conversations
 * cost one inventory read instead of one per conversation.
 * @param payload - the decoded body.
 * @returns the target the host side deletes.
 * @throws {Refusal} when the body names neither shape.
 */
function bulkRequest(payload) {
  if (payload === null || typeof payload !== 'object') {
    throw new Refusal(400, 'bad-request', 'the request body must name one cleanup scope or a list of session ids')
  }
  if (payload.sessionIds !== undefined) {
    const listed = payload.sessionIds
    if (!Array.isArray(listed) || listed.length === 0 || listed.some((sessionId) => typeof sessionId !== 'string')) {
      throw new Refusal(400, 'bad-request', '"sessionIds" must be a non-empty list of session ids')
    }
    return { sessionIds: listed }
  }
  if (typeof payload.scope === 'string' && SCOPES.has(payload.scope)) return { scope: payload.scope }
  throw new Refusal(400, 'bad-request', 'the request body must name one cleanup scope or a list of session ids')
}
