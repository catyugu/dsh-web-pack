/**
 * The row's durable-state root: `$DSH_HOME/dsh-web-pack/remote-web/`. One
 * directory, resolved from the live environment, so every state file the row
 * owns lands beside the others and no caller spells a path of its own.
 */

import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/**
 * Resolve the DSH home directory.
 *
 * `DSH_HOME` wins when set; a relative value resolves against the working
 * directory. A leading `~` expands to the platform home. Without an override
 * the home directory is `<platform home>/.dsh`.
 * @param env - environment to read `DSH_HOME` from.
 * @param home - platform home directory (test seam).
 * @returns the absolute DSH home path.
 */
export function dshHome(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const raw = env.DSH_HOME?.trim()
  if (raw === undefined || raw === '') return join(home, '.dsh')
  const expanded = raw === '~'
    ? home
    : raw.startsWith('~/') || raw.startsWith('~\\')
      ? join(home, raw.slice(2))
      : raw
  return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded)
}
