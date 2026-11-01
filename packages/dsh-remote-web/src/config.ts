/**
 * The row's settings contract: the schemastery schema the Host serves, the
 * resolution of those fields (including the volatile references a live edit
 * commits into), and the mapping onto the pairing service's tunables.
 *
 * The deployment-level fields (`trustedHosts`, `devicesFile`, `profile`) are
 * deliberately NOT volatile: they belong in the profile patch, so the card
 * leaves them to the operator instead of offering a control a document write
 * could not honor. The same holds for the heartbeat tunables
 * (`offlineAfterMs`, `idleExpireMs`, `cookieName`): their correct values are
 * host facts, and editing them from the pairing popup can only mis-tune device
 * liveness.
 */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_IDLE_EXPIRE_MS, type PairingConfig } from './pairing/pairing.ts'
import { dshHome } from './state/dsh-home.ts'
import { resolveManagedProfile } from './ingress/lan-bind-plan.ts'

/**
 * Settings namespace of the remote-control capability. Under the 0.1.7
 * settings model the namespace IS the Host profile entry id, so this is also
 * the id the browser half asks `ctx.configForms` for.
 */
export const REMOTE_WEB_UI_SETTINGS_NAMESPACE = 'remote-web-ui' as SettingsNamespace

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Token lifetime in ms; the QR link dies after this. */
  tokenTtlMs?: number
  /** A device is "online" while its lastSeenAt is newer than this (ms). */
  offlineAfterMs?: number
  /**
   * Idle sessions older than this (ms) are deleted from memory and disk.
   * Default is 30 days; a leftover cookie no longer authorizes after expiry.
   */
  idleExpireMs?: number
  /** Cookie name carrying the paired device id. */
  cookieName?: string
  /**
   * When true (default), a desktop Web GUI opened at a non-loopback origin
   * rides the gated `/remote/api` channel, whose requests must carry a live
   * paired-device cookie — the QR is the only way into remote desktop, and
   * stop()/revoke() cut the channel and the pairing cookie off immediately.
   * This policy selects the transport; it never loosens the channel, whose
   * gate is unconditional. Turning the policy off does NOT open the channel:
   * the /remote proxy attaches the process's own browser-auth credential only
   * when the request itself presents a live paired-device credential, so an
   * unpaired LAN/tunnel caller is forwarded without it and the inner route
   * answers 401.
   */
  requirePairingForLan?: boolean
  /**
   * How the public side is reached — the one decision behind what used to be
   * three overlapping keys.
   *
   * - `off` (default): no public ingress; the GUI answers on its LAN addresses.
   * - `quick`: the plugin runs a Cloudflare quick tunnel with the binary it
   *   ships, so a phone anywhere can pair without setup. The minted hostname
   *   changes on every start, so a paired phone has to pair again after a
   *   restart.
   * - `named`: the plugin runs the tunnel named by `tunnelToken` toward the
   *   fixed `tunnelHost` mapped in the Cloudflare dashboard. That hostname
   *   never changes, so a phone pairs once and keeps its bookmark and cookie
   *   across restarts.
   *
   * Unknown values are treated as `off`.
   */
  tunnel?: string
  /**
   * The fixed public hostname a `named` tunnel serves (e.g.
   * `https://dsh.example.com`). Required by `named`: the tunnel token carries
   * the tunnel, not its hostname, so without this the QR base and the fence
   * trust would have no source. Ignored by the other modes. Can also be set
   * via the DSH_REMOTE_TUNNEL_HOST env var.
   */
  tunnelHost?: string
  /**
   * Cloudflare tunnel token (`cloudflared tunnel run --token <t>`), required
   * by `named`. Treated as a secret: the settings surface stores it redacted,
   * and an empty value means "keep the stored token".
   */
  tunnelToken?: string
  /**
   * Extra trusted host authorities (exact host:port or port-less host) allowed
   * to access pairing endpoints and remote web services. Useful in Docker,
   * reverse proxy, or NAT environments where incoming request Host headers
   * differ from the container's internal network addresses. Can also be set
   * via the DSH_REMOTE_TRUSTED_HOSTS env var.
   */
  trustedHosts?: string[]
  /**
   * Absolute path to a JSON file where paired device sessions are persisted.
   * Defaults to `$DSH_HOME/dsh-web-pack/remote-web/devices.json` so a paired
   * device keeps its session across `dsh web` restarts.
   */
  devicesFile?: string
  /**
   * LAN bind toggle. When the user flips it (true or false) the plugin writes
   * the managed webserver block into the profile patch — true pins the bind
   * default to 0.0.0.0 (an explicit --host flag still wins), false pins it
   * back to 127.0.0.1 — and maintains the matching host firewall rule. The
   * block takes effect when the process next applies the profile, and the
   * settings card reports the divergence (pendingRestart) instead of guessing.
   * While the toggle has never been set (undefined), the plugin does not
   * touch the patch file at all.
   */
  lanBind?: boolean
  /**
   * The profile whose cordis.patch.yml the LAN bind toggle manages. Defaults
   * to the profile the Host booted (its `profileContext`), then to the
   * DSH_PROFILE environment variable, then "web" — the Desktop client boots
   * "desktop" without exporting DSH_PROFILE, so the environment alone names
   * the wrong profile there. Must be a single safe path segment.
   */
  profile?: string
  /** Master switch for the plugin (browser half + host pairing surfaces). */
  enabled?: boolean
}

/**
 * Plugin config schema. This schema IS the entry's settings page: the Host
 * derives one form per profile entry from it and serves that form only when at
 * least one field is `volatile()`. The marker is also what admits a write and
 * what keeps the edit on the live path — the Loader commits the new value into
 * the field's reference and announces `loader/volatile-update` on this fiber
 * instead of remounting the row, so the pairing service, its device sessions,
 * the tunnel and the route registrations survive a settings save.
 *
 * The schema is left to inference rather than annotated with `z<Config>`: a
 * volatile field's parsed output is a live reference while its accepted input
 * stays the plain value, so the two sides no longer share one shape and the
 * annotation would reject the schema the Host must be given.
 */
export const Config = z.object({
  tokenTtlMs: z.number().step(1).min(60_000).default(10 * 60_000).volatile(),
  offlineAfterMs: z.number().step(1).min(5_000).default(25_000),
  idleExpireMs: z.number().step(1).min(60_000).default(DEFAULT_IDLE_EXPIRE_MS),
  cookieName: z.string().min(1).default('dsh_pair'),
  requirePairingForLan: z.boolean().default(true).volatile(),
  tunnel: z.string().default('off').volatile(),
  tunnelHost: z.string().volatile(),
  trustedHosts: z.array(z.string()),
  devicesFile: z.string(),
  tunnelToken: z.string().role('secret').volatile(),
  lanBind: z.boolean().volatile(),
  profile: z.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  enabled: z.boolean().default(true).volatile(),
})

/**
 * Fully resolved config: every field non-optional except the ones that
 * legitimately resolve to `undefined` when unset (the schema keeps those
 * optional, so `Required` alone would over-narrow them).
 */
export type ResolvedConfig = Required<Omit<Config, 'tunnelHost' | 'trustedHosts' | 'devicesFile' | 'lanBind' | 'profile' | 'tunnelToken'>> & {
  tunnelHost: string | undefined
  trustedHosts: string[] | undefined
  devicesFile: string
  /** undefined until the user flips the toggle once; undefined never writes the patch. */
  lanBind: boolean | undefined
  tunnelToken: string | undefined
  profile: string
}

/**
 * The stable reference a `volatile()` config field resolves to; its owner
 * updates it in place when the user saves.
 */
interface ConfigRef<T> {
  /** @returns the value currently committed for the running instance. */
  get(): T
}

/** One resolved config field: a live reference, or a plain value from a hand-built context. */
type ConfigField<T> = ConfigRef<T> | T

/** The config the Host hands `apply` — the runtime face of {@link Config}. */
export interface ResolvedConfigFields {
  tokenTtlMs?: ConfigField<number>
  offlineAfterMs?: ConfigField<number>
  idleExpireMs?: ConfigField<number>
  cookieName?: ConfigField<string>
  requirePairingForLan?: ConfigField<boolean>
  tunnel?: ConfigField<string>
  tunnelHost?: ConfigField<string>
  trustedHosts?: ConfigField<string[]>
  devicesFile?: ConfigField<string>
  tunnelToken?: ConfigField<string>
  lanBind?: ConfigField<boolean>
  profile?: ConfigField<string>
  enabled?: ConfigField<boolean>
}

/** Whether a resolved field is the live reference a volatile schema field produces. */
function isConfigRef<T>(field: ConfigField<T>): field is ConfigRef<T> {
  return typeof field === 'object' && field !== null && typeof (field as ConfigRef<T>).get === 'function'
}

/**
 * Read one resolved config field, following the live reference the schema
 * produces and falling back when the field is unset.
 * @param field - the resolved field.
 * @param fallback - the value to use when the field is absent or unset.
 * @returns the current value.
 */
function readConfigField<T>(field: ConfigField<T> | undefined, fallback: T): T {
  if (field === undefined) return fallback
  if (isConfigRef(field)) {
    const value = field.get()
    return value === undefined ? fallback : value
  }
  return field as T
}

/**
 * Read one optional resolved config field. A volatile reference is read at call
 * time, so an unset field stays `undefined` rather than falling back to a
 * schema default (the distinction the LAN toggle and the tunnel plan depend on).
 * @param field - the resolved field.
 * @returns the current value, or undefined when unset.
 */
function readOptionalConfigField<T>(field: ConfigField<T> | undefined): T | undefined {
  if (field === undefined) return undefined
  if (isConfigRef(field)) return field.get()
  return field as T
}

/**
 * The single mapping from resolved plugin config to the pairing service
 * config, so no field can be silently dropped.
 * @param resolved - the resolved plugin config.
 * @returns the pairing service tunables.
 */
export function pairingConfigOf(resolved: Pick<
  ResolvedConfig,
  'tokenTtlMs' | 'offlineAfterMs' | 'idleExpireMs' | 'cookieName' | 'devicesFile'
>): PairingConfig {
  return {
    tokenTtlMs: resolved.tokenTtlMs,
    offlineAfterMs: resolved.offlineAfterMs,
    idleExpireMs: resolved.idleExpireMs,
    cookieName: resolved.cookieName,
    devicesFile: resolved.devicesFile,
  }
}

/**
 * Default paired-session store: `$DSH_HOME/dsh-web-pack/remote-web/devices.json`.
 * @param home - the resolved DSH home (test seam).
 * @returns the device store path.
 */
export function defaultDevicesFile(home: string = dshHome()): string {
  return join(home, 'dsh-web-pack', 'remote-web', 'devices.json')
}

/** Schema defaults, re-read for hand-built test contexts (the loader applies them normally). */
const DEFAULTS: ResolvedConfig = {
  tokenTtlMs: 10 * 60_000,
  offlineAfterMs: 25_000,
  idleExpireMs: DEFAULT_IDLE_EXPIRE_MS,
  cookieName: 'dsh_pair',
  requirePairingForLan: true,
  tunnel: 'off',
  tunnelHost: undefined,
  trustedHosts: undefined,
  devicesFile: defaultDevicesFile(),
  tunnelToken: undefined,
  lanBind: undefined,
  profile: resolveManagedProfile(undefined, undefined, process.env.DSH_PROFILE),
  enabled: true,
}

/**
 * The launched profile the Host publishes on its `profileContext` service
 * (`{ name, dir, patchPath, … }`). The Desktop client boots the "desktop"
 * profile without exporting DSH_PROFILE, so the environment alone resolves
 * the wrong profile there and the LAN bind toggle would edit a profile that
 * is not running.
 * @param ctx - host plugin context.
 * @returns the profile name when the Host publishes one; undefined otherwise.
 */
function launchedProfileName(ctx: Context): string | undefined {
  const fact = ctx.get('profileContext') as { name?: unknown } | undefined
  return typeof fact?.name === 'string' && fact.name.length > 0 ? fact.name : undefined
}

/**
 * Resolve the effective config at call time.
 *
 * The settings are read through the volatile references on every call rather
 * than captured once: a settings save commits into those references and
 * announces `loader/volatile-update`, so re-resolving here is what makes a live
 * edit reach the running instance without a remount — and keeps the device
 * sessions, the tunnel and the routes alive.
 * @param ctx - host plugin context.
 * @param config - the fields the Host passed to `apply`.
 * @returns every field with schema defaults applied.
 */
export function resolveConfig(ctx: Context, config: ResolvedConfigFields | undefined): ResolvedConfig {
  const envTunnelHost = process.env.DSH_REMOTE_TUNNEL_HOST?.trim() || undefined
  return {
    tokenTtlMs: readConfigField(config?.tokenTtlMs, DEFAULTS.tokenTtlMs),
    offlineAfterMs: readConfigField(config?.offlineAfterMs, DEFAULTS.offlineAfterMs),
    idleExpireMs: readConfigField(config?.idleExpireMs, DEFAULTS.idleExpireMs),
    cookieName: readConfigField(config?.cookieName, DEFAULTS.cookieName),
    requirePairingForLan: readConfigField(config?.requirePairingForLan, DEFAULTS.requirePairingForLan),
    tunnel: readConfigField(config?.tunnel, DEFAULTS.tunnel),
    tunnelHost: readOptionalConfigField(config?.tunnelHost) ?? envTunnelHost,
    trustedHosts: readOptionalConfigField(config?.trustedHosts),
    devicesFile: readConfigField(config?.devicesFile, DEFAULTS.devicesFile),
    tunnelToken: readOptionalConfigField(config?.tunnelToken),
    lanBind: readOptionalConfigField(config?.lanBind),
    profile: resolveManagedProfile(readOptionalConfigField(config?.profile), launchedProfileName(ctx), process.env.DSH_PROFILE),
    enabled: readConfigField(config?.enabled, DEFAULTS.enabled),
  }
}
