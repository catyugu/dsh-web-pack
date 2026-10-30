# dsh-web-pack

A pack of switchable DeepSeek Harness Web plugins. Each sub-component is its own
package, so `设置 → 插件` shows one card per plugin with its own icon and switch.

| Package | What it does |
| --- | --- |
| `dsh-better-session` | Regenerate or edit any question; set the compaction settings of one session or of the whole install. |
| `dsh-session-cleanup` | Delete sessions, clear archived ones, reclaim attachment bytes. |

## Install

Install each package by tag and path; the pack itself carries only the patch that
creates the rows:

```sh
dsh plugin add "github:catyugu/dsh-web-pack#v0.2.0&path:/packages/dsh-better-session" --profile web
dsh plugin add "github:catyugu/dsh-web-pack#v0.2.0&path:/packages/dsh-session-cleanup"  --profile web
dsh plugin add "github:catyugu/dsh-web-pack#v0.2.0"                                     --profile web
```

The last line is the bundle: its patch inserts one row per package.
