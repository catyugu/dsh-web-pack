/**
 * The row's route table: the pairing API (device operations and the status
 * stream) plus the phone-facing landing pages, wired over one fence set and one
 * per-source accept budget.
 *
 * Registration stays a flat list of exact paths: the families own their
 * handlers, this module only decides what a running row mounts.
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { PairingService } from '../pairing/pairing.ts'
import { createPairGrantStore, type PairGrantStore } from '../pairing/pair-grant.ts'
import { createAcceptRateLimiter, createPairingFences } from './fence.ts'
import { makePairRoutes } from './pair-routes.ts'
import { makeLandingRoutes } from './landing-routes.ts'

export { PAIR_PATHS } from './paths.ts'

/** Dependencies of the route table (test seam). */
export interface PairRoutesDeps {
  /** The pairing service. */
  service: PairingService
  /** Current desktop gate policy, re-read for every status response. */
  requirePairingForLan?: boolean | (() => boolean)
  /** The row's master switch, re-read per request. */
  enabled?: boolean | (() => boolean)
  /** Whether the host currently holds a tunnel token. */
  tunnelTokenStored?: () => boolean
  /** LAN-bind facts for the settings card; undefined drops the route (tests). */
  lanBindStatus?: () => Record<string, unknown>
  /** The official index document to serve on the app landing; undefined drops it. */
  indexDocument?: (deviceId: string) => Promise<string | undefined>
  /** Extra trusted non-loopback hosts (from config or environment). */
  trustedHosts?: readonly string[] | (() => readonly string[])
  /** The one-time grant table; defaults to a fresh store. */
  grants?: PairGrantStore
}

/**
 * Build the route table.
 * @param deps - service plus the live settings facts.
 * @returns the exact routes to register on webServer.
 */
export function makeRoutes(deps: PairRoutesDeps): WebRoute[] {
  const grants = deps.grants ?? createPairGrantStore()
  const fences = createPairingFences({
    service: deps.service,
    trustedHosts: deps.trustedHosts,
    grants,
  })
  const limiter = createAcceptRateLimiter()
  return [
    ...makePairRoutes({
      service: deps.service,
      fences,
      limiter,
      requirePairingForLan: deps.requirePairingForLan,
      enabled: deps.enabled,
      tunnelTokenStored: deps.tunnelTokenStored,
      lanBindStatus: deps.lanBindStatus,
    }),
    ...makeLandingRoutes({
      service: deps.service,
      fences,
      limiter,
      grants,
      indexDocument: deps.indexDocument,
    }),
  ]
}
