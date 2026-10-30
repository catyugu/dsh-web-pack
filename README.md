# dsh-web-pack

A pack of switchable DeepSeek Harness Web plugins. Each sub-component is its own
package, so `设置 → 插件` shows one card per plugin with its own icon and switch.

| Package | What it does |
| --- | --- |
| `dsh-better-session` | Regenerate or edit any question; tune context compaction. |
| `dsh-session-cleanup` | Delete sessions, clear archived ones, reclaim attachment bytes. |

## Install

```sh
dsh plugin add github:catyugu/dsh-web-pack --profile web
```

The pack depends on the two packages in `packages/`, and its patch inserts one row
per package.
