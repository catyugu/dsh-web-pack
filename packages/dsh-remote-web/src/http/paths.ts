/**
 * The exact paths this row answers. Both route families and the phone-facing
 * landing pages name them here, so a path cannot drift between the handler that
 * serves it and the redirect that points at it.
 */

/** Route paths (exact matches; `/api/*` paths are answered ahead of the API prefix). */
export const PAIR_PATHS = {
  issue: '/api/pair/issue',
  accept: '/api/pair/accept',
  stop: '/api/pair/stop',
  revoke: '/api/pair/revoke',
  heartbeat: '/api/pair/heartbeat',
  status: '/api/pair/status',
  events: '/api/pair/events',
  lanBind: '/api/pair/lan-bind',
  /** Top-level accept-and-redirect entry the QR link points at. */
  acceptPage: '/pair-accept',
  /** The cookieless app landing: serves the official shell for a paired device. */
  appPage: '/pair-app',
  /**
   * The reopen service worker (registered by the capture script). Root-level
   * path so its default script-directory scope already covers `/`.
   */
  appServiceWorker: '/pair-app.sw.js',
} as const
