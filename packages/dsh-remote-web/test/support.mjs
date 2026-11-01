/**
 * Route-level fakes: a request the handlers can iterate as a body and a
 * response that keeps its status, headers and bytes. The pairing routes read
 * only `method`, `url`, `headers`, `socket.remoteAddress` and the request
 * stream, and answer through `writeHead`/`write`/`end`, so a Readable plus a
 * small EventEmitter covers them without a listening server.
 */
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'

/**
 * Build a request-shaped object.
 * @param {object} [init] - request fields.
 * @param {string} [init.method] - HTTP method.
 * @param {string} [init.url] - request target.
 * @param {Record<string, string>} [init.headers] - request headers; `host` defaults to loopback.
 * @param {unknown} [init.body] - JSON body (an object is serialized).
 * @param {string} [init.remoteAddress] - socket peer address.
 * @param {boolean} [init.secure] - whether the socket is a TLS one.
 * @returns {import('node:stream').Readable} the request.
 */
export function routeRequest(init = {}) {
  const { method = 'GET', url = '/', headers = {}, body, remoteAddress = '127.0.0.1', secure = false } = init
  const payload = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]
  const request = Readable.from(payload)
  request.method = method
  request.url = url
  request.headers = { host: '127.0.0.1:3080', ...headers }
  request.socket = { remoteAddress, ...(secure ? { encrypted: true } : {}) }
  return request
}

/** A response that records what a handler wrote. */
export class RouteResponse extends EventEmitter {
  statusCode = 0
  headers = {}
  chunks = []
  ended = false

  /**
   * @param {number} status - status code.
   * @param {Record<string, unknown>} [headers] - response headers.
   * @returns {this} this response, for the chained `writeHead().end()` shape.
   */
  writeHead(status, headers = {}) {
    this.statusCode = status
    for (const [name, value] of Object.entries(headers)) this.headers[name.toLowerCase()] = value
    return this
  }

  /** @param {unknown} chunk - one body chunk. @returns {boolean} always true. */
  write(chunk) {
    this.chunks.push(Buffer.from(chunk))
    return true
  }

  /** @param {unknown} [chunk] - the final body chunk. @returns {this} this response. */
  end(chunk) {
    if (chunk !== undefined) this.chunks.push(Buffer.from(chunk))
    this.ended = true
    this.emit('close')
    return this
  }

  /** @returns {string} the body as text. */
  get text() {
    return Buffer.concat(this.chunks).toString('utf8')
  }

  /** @returns {unknown} the body parsed as JSON. */
  get json() {
    return JSON.parse(this.text)
  }

  /** @returns {string[]} every Set-Cookie header line. */
  get cookies() {
    const value = this.headers['set-cookie']
    if (value === undefined) return []
    return Array.isArray(value) ? value : [value]
  }
}

/**
 * Run one route handler to completion.
 * @param {(request: unknown, response: unknown) => unknown} handler - the route handler.
 * @param {object} [init] - request fields, see {@link routeRequest}.
 * @param {object} [response] - an existing response to reuse.
 * @returns {Promise<RouteResponse>} the response the handler wrote.
 */
export async function callRoute(handler, init = {}, response = new RouteResponse()) {
  await handler(routeRequest(init), response)
  return response
}
