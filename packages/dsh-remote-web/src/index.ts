/**
 * Mobile remote control for the dsh web GUI — host half.
 *
 * This module is the plugin surface only: the stable name, the required
 * services, the settings schema, and the mount that hands a
 * {@link RemoteRuntime} to the fiber. The runtime owns the pairing service
 * (one-time tokens, device sessions, revocation), the `/api/pair` and landing
 * routes, the gated `/remote` channel, the public ingress and the presence
 * sweep. The browser half (the `./client` entry) renders the sidebar entry, the
 * pairing panel, and the phone-side pair/accept + deep-link flow.
 */

import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
// Type-only: pulls the host-side Context merge (ctx.connection, whose
// authenticatedUrl the /pair-accept redirect consumes).
import type {} from '@deepseek-ai/dsh-client-connection'
import { resolveConfig, type ResolvedConfigFields } from './config.ts'
import { RemoteRuntime } from './runtime/remote-runtime.ts'
import { mountOnce } from './lifecycle/mount-once.ts'

export {
  Config,
  REMOTE_WEB_UI_SETTINGS_NAMESPACE,
  defaultDevicesFile,
  pairingConfigOf,
} from './config.ts'
export type { ResolvedConfigFields } from './config.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile config values were committed into the running fiber without a
     * remount; dispatched to the owning fiber only. Spelled here because the
     * Loader package is not a dependency of this plugin, with the Loader's own
     * shape so the two declarations merge when a Host program carries both.
     * @param paths - changed config paths as key arrays; every value is committed before dispatch.
     * @mode emit
     */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
    /**
     * Waterfall seam on the /api transport fence: the connection plugin fires
     * this per /api request before bridging to the API proxy on deployments
     * that carry the pairing/revocation seam; call `next()` to delegate,
     * return false (without calling it) to veto with 403.
     *
     * Cohort note (0.1.2-alpha.2): the official runtime ships NO emitter for
     * this event, so the listener below never fires there and direct /api
     * stays under the harness fence + browser auth. It is wired anyway so
     * cohort lines that do carry the seam get pairing enforcement on direct
     * /api without a plugin change.
     */
    'api/gate'(
      this: Context,
      request: IncomingMessage,
      method: string | undefined,
      next: () => boolean | Promise<boolean>,
    ): boolean | Promise<boolean>
  }
}

/** Stable cordis plugin name. */
export const name = 'remote-web-ui'

/** Services required before the pairing surfaces can mount. */
export const inject = ['webServer', 'typertGateway', 'connection']

/**
 * Mount the row once per process.
 *
 * A profile can name this package twice (this pack's row and a standalone
 * install, or a repository link beside an npm copy); the second mount would
 * re-register the same routes and fail the boot, so the guard queues it until
 * the holder releases the name.
 */
export const apply = mountOnce('@catyugu/dsh-remote-web', applyImpl)

/**
 * Start the running row and follow live settings edits.
 *
 * A save commits the new values into the row's volatile references and
 * announces `loader/volatile-update` instead of remounting, so `sync` is what
 * re-applies them: it re-reads every field through those references and is
 * idempotent, which keeps the pairing service, its device sessions and the
 * route registrations alive across a save.
 * @param ctx - host plugin context carrying webServer and connection.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
function applyImpl(ctx: Context, config?: ResolvedConfigFields): void {
  const runtime = new RemoteRuntime(ctx, () => resolveConfig(ctx, config))
  ctx.effect(() => () => { runtime.dispose() }, 'dsh-remote-web: runtime')
  ctx.on('loader/volatile-update', () => { runtime.sync() })
  runtime.start()
}
