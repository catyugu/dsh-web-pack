/**
 * JSON body and response helpers for the row's own route families: one lenient
 * bounded body reader, one JSON writer, and the request-init helper that keeps
 * a host fetch body decodable.
 *
 * The reader is lenient by contract: an empty body, invalid JSON, a non-object
 * payload (under `objectOnly`), and an oversized body all answer `null`, so a
 * route decides its own error frame instead of handling a throw.
 */

import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http'

/** Default body cap for readJsonBody: 64 KiB. */
const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024

/** JSON response headers every route family starts from; callers may override. */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
} satisfies OutgoingHttpHeaders

/**
 * Parse a request body as JSON, or null on an empty body, invalid JSON, or a
 * body past `maxBytes` (default 64 KiB). Overflow destroys the request instead
 * of draining the remainder; callers must not keep reading the request.
 * @param req - the incoming request.
 * @param opts - body cap and whether only a JSON object is accepted.
 * @returns the parsed body, or null when there is none to return.
 */
export async function readJsonBody(
  req: IncomingMessage,
  opts: { maxBytes?: number; objectOnly?: boolean } = {},
): Promise<unknown | null> {
  const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > maxBytes) {
      req.destroy()
      return null
    }
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return null
  try {
    const parsed: unknown = JSON.parse(text)
    if (opts.objectOnly && !isJsonObject(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Whether a value is a JSON object: typeof object, not null, not an array.
 * @param value - the candidate value.
 * @returns true for a plain JSON object.
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Request init that asks a remote origin for an uncompressed body.
 *
 * The DSH host boots `@deepseek-ai/dsh-http-proxy`, whose top-level import of
 * the npm `undici` copy replaces the legacy `undici.globalDispatcher.1` slot
 * Node's built-in `fetch()` reads. That cross-major wrapper drops the
 * `content-encoding` header and automatic decompression, so a plain fetch
 * resolves to raw gzip/brotli/zstd bytes — compressed noise no JSON or text
 * consumer can read. Every host fetch that parses a remote body must request
 * identity encoding. Caller headers survive; `accept-encoding` is forced to
 * `identity` because a caller value has no decoder behind it in this host.
 * @param init - the caller's request init (signal, headers, method, ...).
 * @returns a copy with `accept-encoding: identity` merged in.
 */
export function withIdentityEncoding(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('accept-encoding', 'identity')
  return { ...init, headers }
}

/**
 * Write one JSON response. Default headers are the family defaults
 * (content-type and referrer-policy); caller headers are appended or
 * override them.
 * @param res - the response to write.
 * @param status - HTTP status code.
 * @param body - the JSON payload.
 * @param headers - extra or overriding headers.
 */
export function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: OutgoingHttpHeaders = {},
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { ...JSON_HEADERS, ...headers })
  res.end(payload)
}

/** Longest device-cookie lifetime: one year; revoked sessions die at the gate regardless. */
const COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60

/**
 * Whether the request reached this process over TLS. The harness itself serves
 * plain HTTP; a tunnel edge terminates TLS and stamps `x-forwarded-proto`
 * (the same signal the landing redirect trusts when it rebuilds an origin).
 * @param req - the request to classify.
 * @returns true when the request arrived over TLS.
 */
export function isHttpsRequest(req: IncomingMessage): boolean {
  const forwarded = req.headers['x-forwarded-proto']
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim().toLowerCase()
    if (first === 'https') return true
  }
  return (req.socket as { encrypted?: boolean }).encrypted === true
}

/**
 * The device cookie for one request. `Secure` is added only when the request
 * arrived over TLS: LAN pairing runs on plain HTTP, where a Secure cookie is
 * simply dropped by the browser and the phone would silently lose its session.
 * @param req - the request the cookie answers.
 * @param cookieName - the configured cookie name.
 * @param deviceId - the device session id.
 * @returns the Set-Cookie value.
 */
export function deviceCookieOf(req: IncomingMessage, cookieName: string, deviceId: string): string {
  const secure = isHttpsRequest(req) ? '; Secure' : ''
  return `${cookieName}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(COOKIE_MAX_AGE_SEC)}${secure}`
}
