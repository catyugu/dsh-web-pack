/**
 * The shared HTTP shape: one refusal type, one JSON body reader, one answer
 * writer. Both sub-components route over the same authenticated `/api`
 * carrier, so they share the way a refusal becomes a status code.
 *
 * @module dsh-better-session/http
 */

/** A request the route answers itself instead of handing to the host side. */
export class Refusal extends Error {
  /**
   * @param status - HTTP status to answer with.
   * @param code - machine-readable reason for the browser side.
   * @param message - human-readable reason, safe to log.
   */
  constructor(status, code, message) {
    super(message)
    this.name = 'Refusal'
    this.status = status
    this.code = code
  }
}

/**
 * Decode one JSON request body.
 * @param request - the incoming request.
 * @returns the decoded value.
 * @throws {Refusal} when the body is not JSON.
 */
export async function jsonBody(request) {
  try {
    return await request.json()
  } catch {
    throw new Refusal(400, 'bad-request', 'the request body must be JSON')
  }
}

/**
 * Wrap one JSON answer.
 * @param status - HTTP status.
 * @param body - JSON-serialisable body.
 * @returns the response to send.
 */
export function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Run one handler under the shared refusal mapping: a `Refusal` answers its
 * own status, and anything else is a host fault the browser side cannot read.
 * @param report - diagnostic sink of the host side.
 * @param label - what the failure was, without the detail.
 * @param code - machine-readable reason for the unexpected failure.
 * @param task - the handler body.
 * @returns the response to send.
 */
export async function answered(report, label, code, task) {
  try {
    return await task()
  } catch (error) {
    if (error instanceof Refusal) {
      return reply(error.status, { ok: false, code: error.code, message: error.message })
    }
    const message = error instanceof Error ? error.message : String(error)
    report(`${label}: ${message}`)
    return reply(500, { ok: false, code, message })
  }
}
