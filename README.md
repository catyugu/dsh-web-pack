# dsh-web-pack

A pack of switchable DeepSeek Harness Web plugins. `设置 → 插件` shows one
switchable row per plugin, each with its own icon and its own browser half.

| Row | What it does |
| --- | --- |
| `dsh-better-session` | Regenerate or edit any question; set the compaction settings of one session or of the whole install. |
| `dsh-session-cleanup` | Delete sessions, clear archived ones, reclaim attachment bytes. |

## Install

```sh
dsh plugin add @catyugu/dsh-web-pack --profile web
```

That command is the whole install. The bundle carries the patch that creates the
two rows and ships both row packages inside its own tarball as `file:`
dependencies, so pnpm links them into the installed bundle's `node_modules` and
both rows start as soon as the bundle is enabled. No row package is published.

## Update

```sh
dsh plugin add @catyugu/dsh-web-pack --profile web
```

Only `@catyugu/dsh-web-pack` exists on npm; the rows version with it.
