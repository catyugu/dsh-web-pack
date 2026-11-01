# Design

`dsh-web-pack` ships browser-side rows for the DeepSeek Harness Web GUI. This
document records the decisions a maintainer needs before touching them: the
working loop, where the code lives, what each module owns, and the boundaries
the rows must not cross.

## Working loop

| Stage | Command | What it guarantees |
| --- | --- | --- |
| setup | `pnpm install` | the toolchain and every dependency come from `package.json` + `pnpm-lock.yaml`; nothing is installed globally |
| build | `pnpm build` | `client.js` for each row, plus `lib/host.js` / `lib/invariant.js` / `client.js` for `dsh-remote-web` |
| test | `pnpm test` | `node --test` over `packages/*/test/*.test.mjs` |
| check | `pnpm check` | build, then test; the command a change must pass |
| run | `dsh plugin --profile <p> add link:<this repo>/packages/<row>` | boots the row inside a real profile |

`engines.node` is `>=22.15.0` for the pack; `dsh-remote-web` needs
`^22.19.0 || >=24.0.0` because its client bundle and state migration are built
against the modern runtime. `engines.dsh` pins the Harness line
(`>=0.2.1-rc.4 <0.3.0-0`), so the plugin manager refuses an incompatible
Harness instead of mounting a row against APIs it does not have.

## Rows and their shape

A row is one package under `packages/`. Its Host half is an ESM module the
Harness mounts from the package's `exports["."]`; its browser half is one
classic script built by `scripts/build-client.mjs` (plain-JS rows) or
`scripts/build-remote-web.mjs` (the TypeScript row) into
`window.__ModuleLoader__.load({ id, factory(require) })`. The row's
`package.json` declares `dsh.client.inject` — the shell modules the bundle
requires — and nothing else about the client.

`dsh-remote-web` is the one row carried as TypeScript sources: it forked the
retired `dsh-remote-web-ui`, and its Host half uses cordis services and
schemastery types that are only meaningful in TS. Everything else in this
repository stays plain JavaScript on purpose: no transpiler, no bundler config,
no type-check step for two small rows.

## dsh-remote-web layout

| Directory | Owns |
| --- | --- |
| `src/index.ts` | the plugin surface: `name`, `inject`, `Config`, `apply`, the settings resolution, and the mount wiring |
| `src/pairing/` | one-time tokens, device sessions, the `/api/pair` family, the `/remote` gate, presence |
| `src/http/` | route tables, the gated remote proxy, inner auth, the boot script for non-loopback pages, the loopback helpers |
| `src/ingress/` | the owned cloudflared binary, the tunnel lifecycle, the relay registry, the public-base keeper, LAN bind, firewall, posture |
| `src/state/` | `$DSH_HOME` resolution for the row's durable state |
| `src/lifecycle/` | mount-once semantics and detached work |
| `src/client/` | entry (trigger + popup), panel, settings form, locale, phoned-side boot flow and portrait adaptation |

Rules that keep it readable:

- The popup is the row's only settings surface. The settings form and the
  pairing panel render inside one sheet (`RemoteEntry.tsx` → `SettingsSection`);
  no second card is contributed to the plugin manager. `settings-face.ts` is the
  single bridge between the apply-owned form and that sheet.
- The popup renders decisions, not the schema. Three questions — remote access,
  public access (`off` / `quick` / `named`), LAN access — carry the whole user
  surface, with two leftovers under a collapsed group. Which keys reach a form
  at all is decided by `volatile()` in `Config`: the heartbeat tunables and the
  deployment fields stay in the profile patch, so the card cannot mis-tune them
  and needs no per-field "inherit" choice.
- The Host half never serves a file from `node_modules`: the tunnel binary is
  downloaded into `$DSH_HOME/dsh-web-pack/remote-web/bin/` and validated by
  running `--version` before it is trusted. `DSH_REMOTE_CLOUDFLARED_BIN` is the
  documented escape hatch for offline hosts and tests.
- Durable state has one directory: `$DSH_HOME/dsh-web-pack/remote-web/`, holding
  `devices.json` and `registry/<profile>.json`. Moving a host off the upstream
  package is an operational step (move those two files before the new row
  starts); the code carries no compatibility shim for the old paths.
- Public surface: `exports["."]` (plugin), `exports["./client"]` (browser half),
  and `exports["./invariant"]` (the invariant companion). Everything else is
  internal. A name that is exported owes a docstring; none of the internal
  modules are reachable from outside the package.
- Every source module is maintained here. There is no generated copy of a
  module and no cross-repository sync step: a module two rows need is either
  bundled into both from a repository-internal source tree or does not exist.
  The one published cross-repository contract is `mountOnce`'s
  `Symbol.for('dsh-web.mounted-plugins')` registry, whose shape sibling
  packages in other repositories read — changing it breaks them.

## Types and data

- `Config` (schemastery) is the settings contract; `ResolvedConfigFields` is
  what the loader hands `apply`, with every field possibly a volatile reference.
  `resolve()` reads those references at call time, which is what makes a
  settings save land on the live instance without a remount.
- `PairingConfig` is the projection of that config the pairing service sees
  (`pairingConfigOf`) — one mapping, so a field cannot be silently dropped.
- The device store is a plain JSON object keyed by device id:
  `{ [deviceId]: { createdAt, lastSeenAt, userAgent } }`. The cookie carries the
  id, so the store is the only authority on whether a device is alive.
- The relay identity file is `{ id, secret }`; the id names the public origin.

## Assertions, errors, logging

- Internal invariants (route/registration symmetry, a store that must parse)
  fail loudly; external input (a pairing token, an HTTP body, a tunnel URL) is
  validated and answered with a typed error frame (`forbidden`,
  `unknown-address`, `unpaired`, …), never an assertion.
- A caught error is either handled with a stated fallback or rethrown with its
  stack; the tunnel manager is the one place that retries, with capped
  exponential backoff, and it logs the failing phase.
- Host code emits diagnostics through `ctx.logger`; library modules take an
  injected `log` seam instead of printing. The browser half logs only when a
  user-visible action fails.

## Tests

`node --test`, end-to-end over module boundaries rather than per-function unit
tests: route tables against a fake Host context and a seeded `$DSH_HOME`, the
migration against a disposable home, the tunnel binary pathing and the parsing
of a spawned child's output using a Node one-liner as the child. No coverage
target exists; a test earns its place by catching a regression a user could see.
