/**
 * The one piece of the settings card that is a decision rather than markup:
 * whether a `named` tunnel is complete enough to save. Kept out of the card
 * because the token is stored redacted — the form cannot read it back, so the
 * "already configured" fact arrives from the host instead (see
 * `readPairFacts`), and that combination is exactly what a test should pin.
 */

/** Locale keys the card renders when a `named` tunnel is incomplete. */
export type NamedTunnelProblemKey =
  | 'settings.tunnelHostMissing'
  | 'settings.tunnelHostInvalid'
  | 'settings.tunnelTokenMissing'

/** What the card knows about the public-access decision right now. */
export interface NamedTunnelInputs {
  /** The selected mode (draft), e.g. `off`, `quick`, `named`. */
  tunnel: string
  /** The hostname draft. */
  host: string
  /** The token draft; empty when the user has not typed one this round. */
  tokenDraft: string
  /** Whether the host already holds a tunnel token (a redacted secret). */
  tokenStored: boolean
}

/**
 * Report what a `named` tunnel still lacks.
 *
 * An empty token draft is not a problem while the host holds a stored token:
 * an empty field means "keep it", which is the only way to edit the hostname
 * without re-pasting a secret the form can never display.
 * @param inputs - the current decision and the host fact.
 * @returns the copy key to show and to block the save with, or undefined when
 *   the decision is complete (or not `named` at all).
 */
export function namedTunnelProblem(inputs: NamedTunnelInputs): NamedTunnelProblemKey | undefined {
  if (inputs.tunnel !== 'named') return undefined
  const host = inputs.host.trim()
  if (host === '') return 'settings.tunnelHostMissing'
  if (!/^https?:\/\/\S+$/i.test(host)) return 'settings.tunnelHostInvalid'
  if (inputs.tokenDraft.trim() === '' && !inputs.tokenStored) return 'settings.tunnelTokenMissing'
  return undefined
}
