# dsh-remote-web

Scan-to-pair remote access for the dsh Web GUI, maintained in this repository
as an independent fork of the retired `@linxin666/dsh-remote-web-ui`.

A phone or another computer scans the QR code beside the settings button and
opens the same Web GUI: one-time pairing tokens, a revocable device roster, a
LAN bind toggle, and an optional Cloudflare tunnel (named, or quick and fronted
by a stable-origin relay). Phones get a portrait touch adaptation layer; a
remote desktop gets the full workbench. Everything behind `/remote` answers
only a request that carries a live paired-device cookie.

## One place for settings, three decisions

The popup the user already opens to pair a device is also the only settings
surface, and it asks three questions rather than listing config keys:
**remote access** (one switch), **public access** (off / temporary tunnel /
fixed-domain tunnel, with the two `named` inputs appearing only when they
apply), and **LAN access** (follow the launch flags / open to the LAN / this
machine only). Two leftovers — the LAN fence policy and the pairing-link
lifetime — sit under a collapsed "Other". There is no second settings card in
the plugin manager: the pairing sheet and the staged form are one modal
(`src/client/entry/RemoteEntry.tsx`).

Turning remote access off pauses it: the token goes, open streams close and the
public tunnel stops, while the paired devices are kept — the gate refuses while
the switch is off, so a kept pairing is not access, and turning it back on needs
no new scan. The explicit "停止" action is the destructive one: it pauses and
forgets every device. Either way the sidebar entry stays mounted: the switch is
edited inside the popup that entry opens, so the popup reports the stopped
state and offers the way back instead of disappearing.

## The tunnel binary is ours

The row installs and owns `cloudflared` itself:

- a pinned release (`CLOUDFLARED_VERSION`) is downloaded on demand into
  `$DSH_HOME/dsh-web-pack/remote-web/bin/` and validated by running
  `--version` before it is trusted;
- the child is spawned by this package, never by a package postinstall, so no
  binary sits in a `node_modules` tree a package manager may rewrite while a
  tunnel runs;
- `DSH_REMOTE_CLOUDFLARED_BIN` points the row at an existing binary when the
  host is offline or a test provides its own.

## State

| Path under `$DSH_HOME/dsh-web-pack/remote-web/` | What it holds |
| --- | --- |
| `devices.json` | the paired-device roster the `dsh_pair` cookies point at |
| `registry/<profile>.json` | the relay identity (`id`, `secret`) behind `<id>.dsh-market.com` |
| `bin/cloudflared` | the tunnel binary this row downloaded |

Moving a host off `@linxin666/dsh-remote-web-ui` is an operational step: move
`~/.dsh/remote-web-ui-devices.json` and `~/.dsh/remote-web-ui-registry/*` here
before the new row starts. A device paired through the upstream package keeps
working, because the roster keeps the device ids its cookie already carries and
the relay identity keeps the public origin stable.

## Configuration

The row mounts from `cordis.patch.yml` as `web-pack-remote-web`. Its schema is
`Config` in `src/index.ts`. The split below is enforced by the schema, not by
the UI: the Host serves a form only for `volatile()` fields, so everything in
the popup column is a user decision and everything in the patch column is a
deployment fact (the popup cannot even show it).

| Key | Default | Where | Meaning |
| --- | --- | --- | --- |
| `enabled` | `true` | popup | master switch: off pauses remote access (pairings kept), stops the tunnel and refuses the `/remote` channel |
| `tunnel` | `off` | popup | `off`, `quick` (ephemeral hostname) or `named` (fixed hostname) |
| `tunnelHost` | — | popup | the fixed public hostname `named` serves |
| `tunnelToken` | — | popup | Cloudflare tunnel token for `named`; stored redacted |
| `lanBind` | unset | popup | unset follows the launch flags; `true` writes `0.0.0.0`; `false` pins `127.0.0.1` |
| `requirePairingForLan` | `true` | popup | non-loopback desktops ride the gated `/remote` channel |
| `tokenTtlMs` | 10 min | popup | lifetime of one QR pairing link |
| `offlineAfterMs` | 25 s | patch | a device is offline once it is quieter than this |
| `idleExpireMs` | 30 days | patch | a silent device session is dropped after this |
| `cookieName` | `dsh_pair` | patch | cookie carrying the paired device id |
| `trustedHosts` | — | patch | extra host authorities trusted by the pairing fence |
| `devicesFile` | fork path | patch | override for the device store |
| `profile` | launched profile | patch | profile whose patch the LAN bind manages |

`DSH_REMOTE_TUNNEL_HOST` overrides `tunnelHost` from the environment, for
deployments that inject the public hostname at boot.

## Building

```sh
pnpm install
pnpm build:remote-web   # lib/host.js, lib/invariant.js, client.js
```

The sources are this repository's own; they no longer track an upstream tree.
`docs/design.md` at the repository root records the layout and the boundaries.

## Not included

The protocol-v1 native-app surface (`/ios/v1`) of `dsh-remote-bridge`. This row
serves the browser path; a phone uses the GUI over `/remote`.
