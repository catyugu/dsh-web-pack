# AGENTS

Repository instructions for agents working in `dsh-web-pack`.

## Working loop

| Stage | Command |
| --- | --- |
| setup | `pnpm install` |
| build | `pnpm build` |
| test | `pnpm test` |
| check | `pnpm check` (build + test; run before claiming a change works) |

Never install dependencies globally, and never edit `client.js` or
`packages/dsh-remote-web/{lib,client.js}` by hand — they are build outputs of
`scripts/build-client.mjs` and `scripts/build-remote-web.mjs`. Change the
source and rebuild.

## Where things live

- `packages/<row>/` — one row per package: Host half under `src/`, browser half
  under `src/client` (built to `client.js`) or `src/client.js` (plain JS).
- `packages/dsh-remote-web/src/` — the forked remote-access row; its directory
  layout and boundaries are documented in `docs/design.md`.
- `cordis.patch.yml` — the patch that mounts every row by package name.
- `scripts/` — the build entry points. `build-remote-web.mjs` also compiles the
  row's CSS modules.

## Rules

- The popup is `dsh-remote-web`'s only settings surface. Do not add a
  plugin-manager card back.
- Durable state belongs under `$DSH_HOME/dsh-web-pack/remote-web/`; new state
  follows the same directory. Moving a host off the upstream package moves those
  files by hand before the new row starts — no compatibility shim in code.
- The row downloads and owns the cloudflared binary itself
  (`src/ingress/cloudflared.ts`); never reintroduce a dependency on the
  `cloudflared` npm package or on a machine-local tool directory.
- Every public behavior change needs a line in `CHANGELOG.md` and, when it
  changes a row's shape, in `docs/design.md`.
