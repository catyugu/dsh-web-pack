/**
 * The running row: one object that owns everything a mounted `dsh-remote-web`
 * holds — the pairing service, the public ingress (tunnel, relay, public base),
 * the HTTP gateway (routes and the api/gate listener), the posture probe, the
 * LAN-bind assertion and the presence sweep.
 *
 * The plugin surface (`index.ts`) only resolves config and hands the runtime to
 * the fiber; every resource here is either registered as a fiber effect (routes,
 * timers, listeners — torn down by cordis) or released by {@link dispose}
 * (tunnel, relay, public base), so the row can be remounted without leaking.
 */

import { setInterval as nodeSetInterval, setTimeout as nodeSetTimeout } from 'node:timers'
import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
// Type-only: pulls the host-side Context merge (ctx.connection, whose
// authenticatedUrl the /pair-accept redirect consumes).
import type {} from '@deepseek-ai/dsh-client-connection'
import { PairingService } from '../pairing/pairing.ts'
import type { ResolvedConfig } from '../config.ts'
import { pairingConfigOf } from '../config.ts'
import { isPairedDeviceRequest, makeGateListener } from '../pairing/gate.ts'
import { providePairingAccess } from '../pairing/pairing-access.ts'
import { isTrustedApiRequest } from '../http/fence.ts'
import { makeRoutes } from '../http/routes.ts'
import { makeRemoteApiRoutes, makeRemoteApiUpgradeRoutes } from '../http/remote-api.ts'
import { startRemotePresencePet, type PresencePetSeam } from '../pairing/remote-presence-pet.ts'
import { claimPostureKey, postureTargets, probePosture, releasePostureKey } from '../ingress/posture.ts'
import { lanIPv4Addresses } from '../ingress/lan.ts'
import { ensureFirewallRule, firewallSummary, removeFirewallRule } from '../ingress/firewall.ts'
import { lanBindState, writeLanBind } from '../ingress/lan-bind.ts'
import { tunnelPlanOf, type TunnelPlan, type TunnelProblem } from '../ingress/tunnel-plan.ts'
import { loadRelayIdentity, RelayRegistrar, type RelayState } from '../ingress/relay-registry.ts'
import { desiredBindHost, desiredBindPort, firewallActionNeeded, pendingRestartOf, type AppliedFirewallState, type StartupFacts } from '../ingress/lan-bind-plan.ts'
import { createInnerAuth } from '../http/inner-auth.ts'
import { withIdentityEncoding } from '../http/http.ts'
import { TunnelManager, type TunnelInfo } from '../ingress/tunnel.ts'
import { PublicBaseKeeper } from '../ingress/public-base.ts'
import { runDetached } from '../lifecycle/detached-work.ts'
import { REMOTE_CHANNEL_BOOT_SCRIPT } from '../http/remote-channel-boot.ts'
import { UUID_POLYFILL_SCRIPT } from '../http/uuid-polyfill.ts'

/** Presence sweep cadence (a stale device flips to disconnected within two sweeps). */
const SWEEP_INTERVAL_MS = 10_000

/** Why a `named` tunnel cannot run, in the words the panel and the log show. */
const TUNNEL_PROBLEMS: Record<TunnelProblem, string> = {
  'host-missing': 'the fixed-domain tunnel needs its public hostname',
  'host-invalid': 'the fixed-domain tunnel hostname is not an http(s) URL',
  'token-missing': 'the fixed-domain tunnel needs its Cloudflare tunnel token',
}

/** How long the official shell is reused before the landing refetches it. */
const APP_SHELL_TTL_MS = 30_000

/** The running row. */
export class RemoteRuntime {
  private readonly ctx: Context
  private readonly resolve: () => ResolvedConfig
  private readonly service: PairingService
  private readonly tunnel = new TunnelManager()
  private readonly publicBase: PublicBaseKeeper
  private readonly innerAuth: ReturnType<typeof createInnerAuth>
  private relayRegistrar: RelayRegistrar | undefined
  /** The tunnel target the registrar last announced (dedupes sync re-runs). */
  private relayAnnouncedFor: string | undefined
  private tunnelMode: TunnelPlan['mode'] = 'off'
  private appShellCache: { at: number; html: string } | undefined
  private postureKey: string | undefined
  private postureWasExposed = false
  /** LAN-bind facts for the settings card, re-read per request. */
  private lastKnownPort: number | undefined
  private lastFirewallApplied: AppliedFirewallState | undefined
  private lanBindWorkPending = false
  private readonly disposeRoutes: { current?: () => void } = {}
  private readonly disposeSweep: { current?: () => void } = {}

  /**
   * @param ctx - the host plugin context (webServer, connection, logger).
   * @param resolve - reads the effective config at call time.
   */
  constructor(ctx: Context, resolve: () => ResolvedConfig) {
    this.ctx = ctx
    this.resolve = resolve
    this.service = new PairingService(pairingConfigOf(resolve()))
    // The public base the pairing fence trusts. A tunnel reconnect must not
    // strip the host the QR still shows: named and relay hosts never change,
    // and a quick tunnel's host survives a bounded grace window.
    this.publicBase = new PublicBaseKeeper((base) => { this.service.setPublicBaseUrl(base) })
    this.innerAuth = createInnerAuth(() => {
      if (!Number.isFinite(ctx.webServer.port)) return undefined
      try {
        return (ctx.connection as { authenticatedUrl?: (base: string) => string }).authenticatedUrl?.(`http://127.0.0.1:${String(ctx.webServer.port)}/`)
      } catch {
        return undefined
      }
    })
    this.tunnel.onPhase((info: TunnelInfo) => { this.onTunnelPhase(info) })
  }

  /** Mount everything that lives for the fiber's lifetime, then apply config once. */
  start(): void {
    // The bind facts are known by now (webServer is an inject edge): the LAN
    // bases are frozen per process, matching the CLI's once-per-invocation
    // sampling stance. A recompose pass can hand the plugin a webServer whose
    // facts have not settled yet (host unset, port undefined); deriving LAN
    // bases from that would advertise :undefined links or clear a working set,
    // so the bases only update when both facts are readable.
    const bindKnown = (this.ctx.webServer.host === '0.0.0.0' || this.ctx.webServer.host === '127.0.0.1')
      && Number.isFinite(this.ctx.webServer.port)
    if (bindKnown) {
      const lanBases = this.ctx.webServer.host === '0.0.0.0'
        ? lanIPv4Addresses().map(address => ({ address, base: `http://${address}:${String(this.ctx.webServer.port)}` }))
        : []
      this.service.setLanBases(lanBases)
    }

    const gate = makeGateListener(this.service, () => this.resolve().requirePairingForLan, () => this.resolve().enabled)
    this.ctx.effect(() => this.ctx.on('api/gate', gate), 'dsh-remote-web: api gate')

    // The first posture round waits for the connection plugin's /api route: a
    // probe before it mounts would read the SPA fallback and false-positive.
    const initialPostureTimer = nodeSetTimeout(() => { this.runPostureProbe() }, 5_000)
    initialPostureTimer.unref()
    this.ctx.effect(() => () => { clearTimeout(initialPostureTimer) }, 'dsh-remote-web: posture probe boot')

    // Sibling plugins (dsh-better-sidebar, …) look this up by name. Absent when
    // this plugin is not installed; stop() / enabled=false still refuse cookies.
    providePairingAccess(this.ctx, (request: IncomingMessage) => {
      if (!this.resolve().enabled) return false
      return isPairedDeviceRequest(this.service, request)
    })

    // Remote-presence to pet-visibility link: while a paired device is online
    // (an active phone mirror), hide the host-global pet through the pet's OWN
    // hide switch; when the last device has been offline for a grace window,
    // show it again. The pet plugin is optional, so the seam is resolved per
    // transition and every failure degrades to a no-op.
    const presencePet = startRemotePresencePet({
      onState: listener => this.service.onState(listener),
      pet: (): PresencePetSeam | undefined => {
        try {
          return this.ctx.get('pet') as unknown as PresencePetSeam | undefined
        } catch {
          return undefined
        }
      },
    })
    this.ctx.effect(() => presencePet, 'dsh-remote-web: remote-presence pet visibility')

    if (this.service.lanAddresses.length > 0) {
      const urls = this.service.lanAddresses.map(ip => `http://${ip}:${String(this.ctx.webServer.port)}`).join(' , ')
      console.log(`dsh-remote-web: the paired Web GUI is reachable on LAN at ${urls}`)
    }
    // Cohort honesty (see the README security model): the pairing gate covers
    // the plugin's own /remote channel; direct /api from LAN origins is
    // governed by the harness fence + browser-auth cookie, and this cohort's
    // api/gate seam has no emitter — so pausing or revoking here cannot
    // invalidate a browser credential a device has already redeemed.
    if (this.ctx.webServer.host === '0.0.0.0') {
      console.warn('dsh-remote-web: LAN-exposed bind — pairing gates the /remote channel; direct /api stays under the harness fence + browser auth (a pause or revoke does not invalidate an already-redeemed browser credential)')
    }

    this.ctx.effect(() => () => { this.lanBindWorkPending = false }, 'dsh-remote-web: lan-bind work')

    // Inject the crypto.randomUUID polyfill before any other script runs, so
    // the main bundle does not crash on non-secure contexts (LAN HTTP).
    this.ctx.effect(() => this.ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'script', placement: 'head', text: UUID_POLYFILL_SCRIPT })
    }), 'dsh-remote-web: uuid polyfill')

    // The browser-half channel patch installs at this plugin's boot entry, but
    // dsh-client-connection boots earlier and opens its event streams
    // unrewritten — on a non-loopback origin the SDK fence rejects them and the
    // workspace list never loads. Contribute the rewrite as a parse-time head
    // script so it is active before ANY boot entry runs; the client apply
    // adopts the installed seat instead of patching twice. The row follows the
    // live steady-state decision (enabled + pairing gate); the script itself
    // skips loopback origins.
    this.ctx.effect(() => this.ctx.on('webserver/index-inject', (table) => {
      const value = this.resolve()
      if (!value.enabled || !value.requirePairingForLan) return
      table.push({ kind: 'script', placement: 'head', text: REMOTE_CHANNEL_BOOT_SCRIPT })
    }), 'dsh-remote-web: remote channel boot patch')

    this.sync()
  }

  /** Release everything the row holds outside the fiber's effect registry. */
  dispose(): void {
    this.disposeRelayRegistrar()
    this.publicBase.dispose()
    this.tunnel.dispose()
  }

  /**
   * Apply the effective configuration to the running surfaces: the service
   * tunables, the LAN-bind block and firewall, the tunnel plan, the pairing
   * routes, the presence sweep and the posture probe. Idempotent, so a save
   * that changes nothing observable is a no-op.
   */
  sync(): void {
    const value = this.resolve()
    this.service.config = pairingConfigOf(value)
    this.scheduleLanBindWork()
    // A plugin-managed tunnel owns the public base while it runs: the URL lands
    // in the service through the tunnel's phase listener. `off` has no public
    // base at all, so the QR falls back to the LAN addresses. The master switch
    // wins over the tunnel setting: a disabled row runs nothing, which is why
    // the "off" arm below is the only ingress teardown there is.
    const plan: TunnelPlan = value.enabled ? tunnelPlanOf(value, this.ctx.webServer.port) : { mode: 'off' }
    this.tunnelMode = plan.mode
    this.publicBase.setMode(plan.mode)
    if (plan.mode === 'quick') {
      const liveTunnelUrl = this.publicBase.quickUrl()
      if (liveTunnelUrl !== undefined) {
        // The registrar is new (or the relay just came back) while the tunnel
        // already runs: announce now — no phase event fires for an unchanged
        // target.
        const registrar = this.ensureRelayRegistrar()
        if (registrar !== undefined) this.announceRelay(registrar, liveTunnelUrl)
      }
      // With the relay in front, the connector stamps the stable origin as the
      // origin-side Host (`--http-host-header`): the plugin fence and the
      // harness browser-auth are Host-bound to the relay origin, and the
      // Workers relay cannot control the origin-side Host. The target identity
      // change is also what restarts a running tunnel when the relay appears.
      const registrar = this.ensureRelayRegistrar()
      const originHostHeader = registrar === undefined ? undefined : new URL(registrar.baseUrl).host
      this.tunnel.start(originHostHeader === undefined
        ? plan.targetUrl
        : { kind: 'quick', targetUrl: plan.targetUrl, originHostHeader })
    } else if (plan.mode === 'named') {
      // The relay only fronts the quick tunnel.
      this.disposeRelayRegistrar()
      // The hostname is fixed and known before the process runs, so publish it
      // now: a named tunnel that fails to start must not leave the previous
      // mode's ephemeral host as the QR and fence base.
      this.publicBase.markRunning(plan.publicUrl)
      this.tunnel.start({ kind: 'named', token: plan.token, publicUrl: plan.publicUrl })
    } else {
      this.disposeRelayRegistrar()
      this.tunnel.stop()
      this.publicBase.reset()
      // An incomplete `named` setting is a configuration mistake the user can
      // fix in the popup: name the missing input instead of leaving a silent
      // public-less row (a running earlier tunnel is stopped either way).
      if (plan.problem !== undefined) {
        const message = TUNNEL_PROBLEMS[plan.problem]
        console.warn(`dsh-remote-web: ${message}`)
        this.service.setTunnelStatus({ state: 'failed', error: message })
      }
    }
    if (!value.enabled) {
      // Off means off at the edge: the routes refuse while the switch is off,
      // and the service drops the QR and closes the streams a phone holds. The
      // pairings stay, so turning it back on needs no new scan.
      this.service.pause()
    }
    // The route family and the sweep are mounted once for the plugin lifetime,
    // not per switch state: a disabled row still answers the panel so the
    // settings that turn it back on stay one click away in the same popup.
    if (this.disposeRoutes.current === undefined) {
      const routes = [
        ...makeRoutes({
          service: this.service,
          requirePairingForLan: () => this.resolve().requirePairingForLan,
          enabled: () => this.resolve().enabled,
          tunnelTokenStored: () => (this.resolve().tunnelToken ?? '') !== '',
          lanBindStatus: () => this.lanBindStatus(),
          indexDocument: () => this.fetchAppShell(),
          trustedHosts: () => this.trustedHosts(),
        }),
        // The remote desktop channel: a paired-credential-gated `/remote`
        // prefix that re-issues fenced paths to loopback. The gate is
        // unconditional — requirePairingForLan governs the plain /api surface
        // and the desktop's client-side rewrite only; it is never an
        // authorization input here, because this channel attaches the
        // process's own browser credential to everything it forwards.
        ...makeRemoteApiRoutes({
          service: this.service,
          port: this.ctx.webServer.port,
          enabled: () => this.resolve().enabled,
          auth: this.innerAuth,
        }),
      ]
      const upgrades = makeRemoteApiUpgradeRoutes({
        service: this.service,
        port: this.ctx.webServer.port,
        enabled: () => this.resolve().enabled,
        auth: this.innerAuth,
      })
      this.disposeRoutes.current = this.ctx.effect(
        () => {
          const disposers = [
            ...routes.map(route => this.ctx.webServer.register(route)),
            ...upgrades.map(route => this.ctx.webServer.registerUpgrade(route)),
          ]
          return () => { for (const dispose of disposers) dispose() }
        },
        'dsh-remote-web: pairing routes',
      )
    }
    if (this.disposeSweep.current === undefined) {
      this.disposeSweep.current = this.ctx.effect(
        () => {
          const timer = nodeSetInterval(() => { this.service.sweep() }, SWEEP_INTERVAL_MS)
          timer.unref()
          return () => { clearInterval(timer) }
        },
        'dsh-remote-web: presence sweep',
      )
    }
    // Settings changed the reachable posture (manual publicBaseUrl, bind):
    // re-probe unless the target set is unchanged.
    this.runPostureProbe()
  }

  /**
   * The LAN-bind facts the settings card polls: the managed block's host, the
   * live bind, the firewall summary and the reachable LAN URLs, re-read per
   * request so a hot rebind and a fresh toggle round are both reflected.
   * @returns the status frame.
   */
  private lanBindStatus(): Record<string, unknown> {
    const resolvedNow = this.resolve()
    let state: { blockPresent: boolean; host?: string; port?: number }
    try {
      state = lanBindState(resolvedNow.profile)
    } catch {
      // An unsafe profile value must not take the whole status endpoint down.
      state = { blockPresent: false }
    }
    const lanOn = state.host === '0.0.0.0'
    const port = Number.isFinite(this.ctx.webServer.port) ? this.ctx.webServer.port : this.lastKnownPort
    if (Number.isFinite(this.ctx.webServer.port)) this.lastKnownPort = this.ctx.webServer.port
    const startup = this.ctx.get('webStartup') as StartupFacts | undefined
    const desiredHost = resolvedNow.lanBind === undefined
      ? undefined
      : desiredBindHost(resolvedNow.lanBind === true, startup?.host)
    return {
      profile: resolvedNow.profile,
      setting: resolvedNow.lanBind ?? null,
      blockHost: state.host ?? null,
      bindHost: this.ctx.webServer.host,
      port,
      lanUrls: this.ctx.webServer.host === '0.0.0.0' && port !== undefined
        ? lanIPv4Addresses().map(address => `http://${address}:${String(port)}`)
        : [],
      firewall: port !== undefined ? firewallSummary(port, lanOn) : { ok: true, managed: false },
      platform: process.platform,
      // The running bind does not follow the block on every deployment (the
      // live patch watcher is profile-shape dependent): flag the divergence so
      // the card can ask for a restart instead of looking broken. The
      // comparison uses the effective desired host (a CLI --host wins over the
      // toggle), not the raw toggle.
      pendingRestart: pendingRestartOf(resolvedNow.lanBind, desiredHost, this.ctx.webServer.host),
    }
  }

  /** The extra host authorities the pairing fence trusts (config + environment). */
  private trustedHosts(): string[] {
    const list: string[] = []
    const envHosts = process.env.DSH_REMOTE_TRUSTED_HOSTS
    if (typeof envHosts === 'string' && envHosts.trim() !== '') {
      for (const item of envHosts.split(',')) {
        const trimmed = item.trim()
        if (trimmed !== '') list.push(trimmed)
      }
    }
    const cfgHosts = this.resolve().trustedHosts
    if (Array.isArray(cfgHosts)) {
      for (const item of cfgHosts) {
        if (typeof item === 'string') {
          const trimmed = item.trim()
          if (trimmed !== '') list.push(trimmed)
        }
      }
    }
    return list
  }

  /**
   * The official index document for the /pair-app landing, fetched from the
   * inner loopback with the process credential and cached briefly (the shell is
   * static; skins/injections settle right after boot).
   * @returns the shell, or undefined when it cannot be read.
   */
  private async fetchAppShell(): Promise<string | undefined> {
    if (!Number.isFinite(this.ctx.webServer.port)) return undefined
    if (this.appShellCache !== undefined && Date.now() - this.appShellCache.at < APP_SHELL_TTL_MS) return this.appShellCache.html
    const cookie = await this.innerAuth.ready()
    try {
      const response = await fetch(`http://127.0.0.1:${String(this.ctx.webServer.port)}/`, withIdentityEncoding({
        headers: cookie !== undefined ? { cookie } : undefined,
      }))
      if (!response.ok) {
        // A stale credential (secret rotation, 30-day TTL) must not wedge every
        // later landing: drop it so the next attempt re-redeems.
        if (response.status === 401 || response.status === 403) this.innerAuth.invalidate()
        return undefined
      }
      const html = await response.text()
      this.appShellCache = { at: Date.now(), html }
      return html
    } catch {
      return undefined
    }
  }

  /**
   * Probe every advertised /api origin for the forged-Host exposure this row
   * cannot gate: the connection plugin's fence is the one seam no plugin can
   * mount a gate into. A re-opened /api (a re-added --trusted-host, or the
   * SDK's LAN auto-trust under 0.0.0.0) then shows on the panel and the log
   * instead of silently serving unpaired clients.
   */
  private runPostureProbe(): void {
    if (!this.resolve().enabled) return
    const targets = postureTargets(this.service.publicBaseUrl, this.service.lanAddresses, this.ctx.webServer.port)
    if (targets.length === 0) {
      this.postureKey = undefined
      this.service.setPosture(undefined)
      return
    }
    const key = targets.join('|')
    const claim = claimPostureKey(this.postureKey, key)
    if (!claim.run) return
    this.postureKey = claim.next
    void probePosture({ port: this.ctx.webServer.port, targets }).then((snapshot) => {
      this.service.setPosture(snapshot)
      const exposedHosts = snapshot.hosts.filter(host => host.exposed).map(host => host.host)
      const exposed = exposedHosts.length > 0
      if (exposed && !this.postureWasExposed) {
        console.error(`dsh-remote-web: CRITICAL — the /api fence is OPEN for [${exposedHosts.join(', ')}]: unpaired clients reach the full host API. Remove --trusted-host for these hosts (pairing covers them) or bind loopback.`)
      } else if (!exposed && this.postureWasExposed) {
        console.log('dsh-remote-web: the /api posture probe is clean again (every advertised origin refused with 403).')
      }
      this.postureWasExposed = exposed
    }).catch(() => {
      // Keep the previous snapshot; drop the in-flight key so the same targets
      // retry instead of sticking on a failed round.
      this.postureKey = releasePostureKey(this.postureKey, key)
    })
  }

  /** One tunnel phase transition: publish the base, and probe the new posture. */
  private onTunnelPhase(info: TunnelInfo): void {
    if (this.tunnelMode === 'off') return
    if (info.phase === 'running' && info.url !== undefined) {
      this.publicBase.markRunning(info.url)
      this.service.setTunnelStatus({ state: 'running', url: info.url })
      const registrar = this.tunnelMode === 'quick' ? this.ensureRelayRegistrar() : undefined
      if (registrar !== undefined) this.announceRelay(registrar, info.url)
      this.runPostureProbe()
    } else if (info.phase === 'starting') {
      // A quick-tunnel restart mints a new hostname, but the old one is not
      // dropped at once: the edge may still deliver a connection the phone
      // already opened, and the reconnect usually lands inside the grace
      // window. A named tunnel keeps its fixed hostname, and a registered relay
      // its stable subdomain, so neither is ever dropped here.
      this.publicBase.markReconnecting()
      this.service.setTunnelStatus({ state: 'starting' })
    } else if (info.phase === 'failed') {
      this.publicBase.markReconnecting()
      this.service.setTunnelStatus(info.error === undefined ? { state: 'failed' } : { state: 'failed', error: info.error })
    }
  }

  /** Relay registry: one stable subdomain per profile in front of the quick tunnel. */
  private ensureRelayRegistrar(): RelayRegistrar | undefined {
    if (this.relayRegistrar === undefined) {
      try {
        const identity = loadRelayIdentity(this.resolve().profile)
        this.relayRegistrar = new RelayRegistrar(identity, (state: RelayState) => {
          this.service.setRelayStatus(state.state === 'off' ? undefined : state)
          if (state.state === 'running') {
            this.publicBase.setRelay(state.url)
          } else if (state.state === 'off') {
            this.publicBase.setRelay(undefined)
          } else if (state.state === 'failed') {
            // Keep the last relay URL on failures: the phone origin only breaks
            // when the mapping itself goes stale, not when one refresh call
            // fails. The registrar retries with backoff.
            console.warn(`dsh-remote-web: relay registration failed (${state.error}) — the stable origin may serve its offline page until the retry lands`)
          }
        })
      } catch (error) {
        console.warn(`dsh-remote-web: relay registry unavailable (${error instanceof Error ? error.message : String(error)}) — the quick URL is the QR base`)
      }
    }
    return this.relayRegistrar
  }

  /** Announce the running tunnel target to the relay, once per target. */
  private announceRelay(registrar: RelayRegistrar, target: string): void {
    if (this.relayAnnouncedFor === target) return
    this.relayAnnouncedFor = target
    void registrar.announce(target)
  }

  /**
   * Drop the relay registrar. Toggle-off removes the registry row so the stable
   * origin stops proxying; teardown/mode changes keep the row (the phone then
   * sees the relay's offline page instead of a dangling claim, and re-enabling
   * reuses the same identity).
   * @param unregister - whether to remove the registry row.
   */
  private disposeRelayRegistrar(unregister = false): void {
    const registrar = this.relayRegistrar
    this.relayRegistrar = undefined
    this.publicBase.setRelay(undefined)
    this.relayAnnouncedFor = undefined
    if (registrar === undefined) return
    if (unregister) void registrar.unregister().catch(() => undefined)
    registrar.dispose()
  }

  /**
   * Schedule the LAN-bind assertion. It never blocks the caller: one pending
   * work item is enough, and it always re-reads the config at run time so a
   * toggle flipped twice before the tick lands on the last value.
   *
   * The scheduling runs through runDetached: the settings save that drives
   * sync() holds the Host's exclusive HMR transaction in its async context, and
   * a write to cordis.patch.yml inside that transaction makes the watcher's
   * refresh re-enter it ("HMR transactions cannot be nested"). Scheduling from
   * the module-scope resource starts the timer — and therefore the write — with
   * no store at all.
   */
  private scheduleLanBindWork(): void {
    if (this.lanBindWorkPending) return
    this.lanBindWorkPending = true
    runDetached(() => setImmediate(() => {
      this.lanBindWorkPending = false
      try {
        this.applyLanBindWork(this.resolve())
      } catch (error) {
        // A deferred assertion must never surface as an unhandled rejection:
        // the settings save that triggered it already answered, and the card
        // reads the live block state back on its own poll.
        console.error(`dsh-remote-web: the deferred lan-bind assertion failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }))
  }

  /**
   * Write the managed profile block and align the host firewall with the toggle
   * (managed platforms only). Desired host/port come from the CLI flags when
   * given (flags win), else from the toggle and the currently bound port. The
   * block takes effect on the next start, so the re-assert at every boot keeps
   * it in sync with both the toggle and the flags.
   */
  private applyLanBindWork(value: ResolvedConfig): void {
    if (value.lanBind === undefined) return
    const startup = this.ctx.get('webStartup') as StartupFacts | undefined
    const desiredHost = desiredBindHost(value.lanBind === true, startup?.host)
    const desiredPort = desiredBindPort(startup?.port, Number.isFinite(this.ctx.webServer.port) ? this.ctx.webServer.port : undefined)
    if (desiredPort === undefined) {
      console.error('dsh-remote-web: cannot assert the lan-bind block — the web server port is not known yet')
    } else {
      try {
        const current = lanBindState(value.profile)
        if (current.host !== desiredHost || current.port !== desiredPort) {
          writeLanBind(desiredHost, desiredPort, value.profile)
          console.log(`dsh-remote-web: lan-bind block written for profile ${value.profile} (${desiredHost}:${String(desiredPort)}); it takes effect when the profile next applies (the card reports pendingRestart until the running bind follows)`)
        }
      } catch (error) {
        console.error(`dsh-remote-web: failed to write the lan-bind block: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // Keep the firewall rule aligned with the toggle. The probes and rule
    // rewrites are blocking subprocesses, so they run only when the desired
    // state actually moved — not on every unrelated settings save.
    const livePort = Number.isFinite(this.ctx.webServer.port) ? this.ctx.webServer.port : undefined
    if (livePort === undefined) {
      console.error('dsh-remote-web: cannot align the host firewall rule — the web server port is not known yet')
      return
    }
    const nextFirewall: AppliedFirewallState = { enabled: value.lanBind === true, port: livePort }
    if (!firewallActionNeeded(this.lastFirewallApplied, nextFirewall)) return
    const ruleOk = nextFirewall.enabled ? ensureFirewallRule(nextFirewall.port) : removeFirewallRule(nextFirewall.port)
    if (ruleOk) {
      this.lastFirewallApplied = nextFirewall
    } else {
      console.error('dsh-remote-web: the host firewall rule could not be updated (admin rights required on managed platforms)')
    }
  }
}
