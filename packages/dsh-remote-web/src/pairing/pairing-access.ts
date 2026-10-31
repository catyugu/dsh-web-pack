/**
 * The pairing access this row publishes to other host plugins, so they can
 * `ctx.get('remoteWebUiPairing')` without taking a package dependency: a live
 * paired-device cookie is an allow path on routes that sit outside /api (and
 * therefore outside the api gate).
 *
 * It is registered with `ctx.provide` rather than a cordis `Service` subclass:
 * this row travels inside the pack's tarball, where no package resolves from
 * the row's own directory, so its Host half must not import cordis at runtime.
 *
 * @module dsh-remote-web/pairing-access
 */
import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

/** Named lookup key sibling plugins pass to ctx.get. */
export const REMOTE_WEB_UI_PAIRING = 'remoteWebUiPairing'

/**
 * Pairing identity for one HTTP request. Structural: consumers must not import
 * this module, only the method shape.
 */
export interface PairingAccess {
  /**
   * Whether the request carries a live paired-device cookie.
   * @param request - the incoming HTTP request.
   * @returns true when the session is live and was refreshed.
   */
  isPairedDevice(request: IncomingMessage): boolean
}

/**
 * Publish the pairing access under the name sibling plugins look up.
 * @param ctx - host plugin context.
 * @param check - live cookie + session predicate (re-read per request).
 * @returns the disposer that withdraws the service.
 */
export function providePairingAccess(
  ctx: Context,
  check: (request: IncomingMessage) => boolean,
): () => void {
  const access: PairingAccess = { isPairedDevice: (request) => check(request) }
  return ctx.provide(REMOTE_WEB_UI_PAIRING, access)
}
