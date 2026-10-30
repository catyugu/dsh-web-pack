# Changelog

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
