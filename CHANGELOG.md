# Changelog

## 0.4.1

The pack takes over the remote-access row the upstream author retired — as this
repository's own source tree, with its own tunnel binary.

### Added

- `dsh-remote-web`: scan-to-pair remote access for the Web GUI — QR pairing,
  the gated `/remote` channel, the device roster, the LAN bind toggle, and the
  optional Cloudflare tunnel with its stable-origin relay. It continues
  `@linxin666/dsh-remote-web-ui@0.4.6` (the last release that still serves the
  browser surface) under this repository's own package id.
- Every setting the row has is edited in the pairing popup, in the same sheet a
  user opens to pair a device. No settings card is contributed to the plugin
  manager any more.
- The row installs and owns `cloudflared`: a pinned release is downloaded into
  `$DSH_HOME/dsh-web-pack/remote-web/bin/` and validated by running
  `--version`. `DSH_REMOTE_CLOUDFLARED_BIN` points it at an existing binary.

### Changed

- Row state lives under `$DSH_HOME/dsh-web-pack/remote-web/`
  (`devices.json`, `registry/<profile>.json`). Moving a host off the upstream
  package is an operational step: move the two upstream files there before the
  new row starts.
- The row mounts as `web-pack-remote-web` from this pack's patch.
- Sources are built from `src` by `scripts/build-remote-web.mjs` (esbuild plus a
  CSS-modules loader); the prebuilt upstream bundle is no longer vendored.

### Removed

- The `cloudflared` npm dependency and the anonymous install heartbeat.

## 0.3.5

The compaction panel tunes the policy the engine actually reads, and the pack
states the Harness it runs on.

### Added

- Both rows declare `engines.dsh` (`>=0.2.1-rc.4 <0.3.0-0`). The Harness checks
  that range before mounting a profile bundle, so a release it does not target
  is refused instead of loading a row against APIs it does not have.

### Changed

- `dsh-better-session` 0.3.5: the panel edits the retained context as a share
  of the message budget or as a token count, chosen with a unit switch, and
  edits the compaction headroom beside the pressure threshold, the summary cap,
  and the retry counts. Saving keeps the engine fields the panel does not own.
- "Reset" shows the configuration of the engine the session actually steps
  with, which belongs to its agent preset rather than to the profile-level
  service, and a configuration the engine refuses is reported instead of
  silently dropped.
- The summary cap falls back to the engine's 65536 rather than 8192.
- `dsh.client.external` no longer lists `react`, `react-dom` and the
  primitives: they are platform-baseline modules the shell seeds.
- `dsh-session-cleanup` 0.3.5: unchanged code, released with the family.

## 0.3.4

The dialog says what it does: it sends the message again, it does not ask the
question again.

### Changed

- `dsh-better-session` 0.3.4: both confirmation dialogs name the message and the
  send. "This removes this message and everything after it, then sends the
  message again." The editor variant says it sends the text below instead, and
  the title, the reading hint and its failure line follow the same wording.
- `dsh-session-cleanup` 0.3.4: unchanged code, released with the family.

## 0.3.3

Re-sending a question removes that question, not the whole turn it lives in.

### Fixed

- `dsh-better-session` 0.3.3: input a user sends while the agent works is
  delivered inside the running turn, so one turn can hold several questions.
  Re-sending one of them removed the turn from its first question on, so the
  questions sent before it and every operation between them left the model
  context and the transcript even though the user never asked for that. The
  removal now starts at the clicked question's own log position: the questions
  before it, and the work they caused, stay.
- The replacement records which question its range starts at, and the page hides
  rows from that question's row instead of hiding every row of the turn. The
  ranges this page remembered before the release still hide their turns: a record
  without a question covers whole turns, and is rewritten with one the next time
  a range is remembered.

### Changed

- Re-sending a question is `POST /api/sessionManage/questions/resend`. The
  `/api/sessionManage/hidden` route, which no caller used and which answered
  every request with an error, is gone.
- `dsh-session-cleanup` 0.3.3: unchanged code, released with the family.

## 0.3.2

Not published: 0.3.3 carries everything this version was staged with.

## 0.3.1

Version only: npm refuses to reuse a version it has already published.

## 0.3.0

One package on npm, and it carries its rows.

### Changed

- `@catyugu/dsh-web-pack` is the only published package. The two rows ship inside
  its tarball as `file:` dependencies under `packages/`: pnpm links them into the
  installed bundle's own `node_modules`, the profile resolves each row through the
  bundle's dependency closure, and the row's own manifest still names its browser
  bundle.
- `dsh plugin add @catyugu/dsh-web-pack --profile web` is the whole install. It
  replaces the three `github:` commands of 0.2.1.
- CI checks that every row is a `file:` dependency, that the tarball carries the
  row's manifest, host entry and browser bundle, and that the patch mounts it.
- The Release workflow stages `@catyugu/dsh-web-pack` on npm for one approval; a
  row package is never published.

## 0.2.1

The compaction panel keeps only its controls.

### Changed

- `dsh-better-session` 0.2.1: the panel no longer explains where its values come
  from. The lines under the scope switch are gone, both the "this session has no
  settings of its own" and the "there is no global default" one, and so is the line
  that announced a reset. The fields show the values in force.
- `dsh-session-cleanup` 0.2.1: unchanged code, released with the family.

## 0.2.0

The compaction settings stopped being one switch over the whole install and became
the session's own, with a global base behind them.

### Changed

- `dsh-better-session` 0.2.0: the panel opens from the composer, next to the
  permission control, and edits either this session's settings or the global base.
  - A session's values live in `better-session.json` inside the session's own
    directory; the global base lives in
    `DSH_HOME/dsh-web-pack/better-session/compaction.json`. A session without
    values of its own inherits the global base, and a subagent inherits its
    parent's values.
  - The values take effect from that session's next turn: the plugin patches the
    engine of the agent that is about to step, and gives the engine back its own
    configuration when the session has no values.
  - The runtime-override switch is gone. Saving is the override, and "Reset"
    fills the form with the engine's own values without committing anything.
  - Fixed: the ratio fields showed `0.800000011920929` instead of `0.8`.
- `dsh-session-cleanup` 0.2.0: unchanged code, released with the family.
- Both compaction routes answer GET and POST only; reset is a form action, not a
  request.

## 0.1.0

The first release of the pack: `dsh-better-session` and `dsh-session-cleanup` as
two packages, each with its own icon and its own switch.

### Added

- `dsh-better-session` 0.1.0: regenerate or edit any question, tune what the
  Harness compacts, and stop the running answer first when asked to.
- `dsh-session-cleanup` 0.1.0: delete one session, clear archived ones, and
  reclaim attachment bytes.
- `cordis.patch.yml` inserts one row per package, so the plugin manager shows both
  sub-components with their own titles, descriptions, and icons.
