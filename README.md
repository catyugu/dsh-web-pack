# dsh-web-pack

A pack of switchable DeepSeek Harness Web plugins. `设置 → 插件` shows one
switchable row per plugin, each with its own icon and its own browser half.

| Row | What it does |
| --- | --- |
| `dsh-better-session` | Regenerate or edit any question; set the compaction settings of one session or of the whole install. |
| `dsh-session-cleanup` | Delete sessions, clear archived ones, reclaim attachment bytes. |
| `dsh-remote-web` | Scan-to-pair remote access: the QR beside settings pairs phones and computers into the same GUI, over the LAN or a Cloudflare tunnel. |

## Requirements

DeepSeek Harness 0.2.1-rc.4 or newer within the 0.2 line. The package declares
that range as `engines.dsh`, so the plugin manager refuses an incompatible
Harness instead of mounting a row against APIs it does not have.

## Install

```sh
dsh plugin add @catyugu/dsh-web-pack --profile web
```

That command is the whole install. The bundle carries the patch that creates the
three rows and ships every row package inside its own tarball as `file:`
dependencies, so pnpm links them into the installed bundle's `node_modules` and
the rows start as soon as the bundle is enabled. No row package is published.

## Update

```sh
dsh plugin add @catyugu/dsh-web-pack --profile web
```

Only `@catyugu/dsh-web-pack` exists on npm; the rows version with it.

## dsh-remote-web

`dsh-remote-web` keeps the browser remote-access surface that
`@linxin666/dsh-remote-web-ui` retired at 0.4.13, as this repository's own
source tree rather than a vendored build. It places state under
`$DSH_HOME/dsh-web-pack/remote-web/`, migrates the upstream state files on first
mount (already-paired devices and the relay identity keep working), puts every
setting in the pairing popup instead of the plugin manager, and installs and
owns its own `cloudflared` binary. See `packages/dsh-remote-web/README.md` and
`docs/design.md`.

## Development

The repository is a pnpm project. Nothing is installed globally and nothing is
edited in a build output.

```sh
pnpm install            # setup
pnpm build              # client bundles + dsh-remote-web artifacts
pnpm test               # node --test over packages/*/test
pnpm check              # build then test — the gate for every change
```

To run a row against a real Harness profile:

```sh
dsh plugin --profile web add link:$PWD/packages/dsh-remote-web
```

`docs/design.md` records the architecture and the decisions behind it;
`AGENTS.md` holds the same working loop for agents.
