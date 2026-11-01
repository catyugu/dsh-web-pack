/**
 * Pure planner for the tunnel branch of the settings sync: one resolved
 * `tunnel` mode in, one runtime plan out. Kept free of cordis types so the
 * matrix is unit-testable without a host context.
 */

/** Whether a configured public host is a parseable http(s) URL with a host. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

/** Why a `named` tunnel cannot run, as reported to the panel. */
export type TunnelProblem = 'host-missing' | 'host-invalid' | 'token-missing'

/** How the settings sync should drive cloudflared for one resolved value. */
export type TunnelPlan =
  | { mode: 'off'; problem?: TunnelProblem }
  | { mode: 'quick'; targetUrl: string }
  | { mode: 'named'; token: string; publicUrl: string }

/**
 * Decide the tunnel the settings ask for.
 *
 * `off` runs nothing (the GUI stays on its LAN addresses). `quick` runs a
 * Cloudflare quick tunnel whose hostname is minted on every start. `named`
 * runs the tunnel from `tunnelToken` toward the fixed `tunnelHost` the
 * operator mapped in the Cloudflare dashboard: the token carries the tunnel,
 * not its hostname, so both inputs are required.
 *
 * An incomplete `named` setting still resolves to `off`, but carries the
 * `problem` so the panel can name what is missing instead of leaving the row
 * silently public-less. An unknown mode value is treated as `off`.
 * @param value - the resolved settings slice that drives the tunnel.
 * @param port - the local webServer port the tunnel forwards to.
 */
export function tunnelPlanOf(
  value: { tunnel?: string; tunnelHost?: string; tunnelToken?: string },
  port: number,
): TunnelPlan {
  if (value.tunnel === 'quick') return { mode: 'quick', targetUrl: `http://127.0.0.1:${String(port)}` }
  if (value.tunnel !== 'named') return { mode: 'off' }
  const host = value.tunnelHost?.trim() ?? ''
  const token = value.tunnelToken?.trim() ?? ''
  if (host === '') return { mode: 'off', problem: 'host-missing' }
  if (!isHttpUrl(host)) return { mode: 'off', problem: 'host-invalid' }
  if (token === '') return { mode: 'off', problem: 'token-missing' }
  return { mode: 'named', token, publicUrl: host }
}
