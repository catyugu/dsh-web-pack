# dsh-remote-web

Scan-to-pair remote access for the dsh Web GUI, maintained in this repository
as an independent fork of the retired `@linxin666/dsh-remote-web-ui`.

A phone or another computer scans the QR code beside the settings button and
opens the same Web GUI: one-time pairing tokens, a revocable device roster, a
LAN bind toggle, and an optional Cloudflare tunnel (named, or quick and fronted
by a stable-origin relay). Phones get a portrait touch adaptation layer; a
remote desktop gets the full workbench. Everything behind `/remote` answers
only a request that carries a live paired-device cookie.

## One place for settings

Everything a user can switch — whether remote access is on at all, the pairing
window, the cookie name, the LAN fence policy, the public base URL, the tunnel
token, the LAN bind — lives in the popup the user already opens to pair a
device. There is no second settings card in the plugin manager: the pairing
sheet and the staged form are one modal (`src/client/entry/RemoteEntry.tsx`).

Turning remote access off revokes every paired device, drops the token and
stops the public tunnel, but the sidebar entry stays mounted: the switch is
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
`Config` in `src/index.ts`; the popup edits the same fields through the
`remote-web-ui` settings namespace, so a value saved in the form and a value in
the patch compose in the ordinary Harness order.

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | the popup's master switch: off revokes every device and stops the tunnel |
| `tokenTtlMs` | 10 min | lifetime of one QR pairing link |
| `offlineAfterMs` | 25 s | a device is offline once it is quieter than this |
| `idleExpireMs` | 30 days | a silent device session is dropped after this |
| `cookieName` | `dsh_pair` | cookie carrying the paired device id |
| `requirePairingForLan` | `true` | non-loopback desktops ride the gated `/remote` channel |
| `publicBaseUrl` | — | tunnel hostname the QR link is built from |
| `trustedHosts` | — | extra host authorities trusted by the pairing fence |
| `devicesFile` | fork path | override for the device store |
| `autoTunnel` | `false` | run a Cloudflare quick tunnel (ephemeral hostname) |
| `tunnelToken` | — | Cloudflare named-tunnel token (fixed hostname) |
| `lanBind` | off | forward the LAN address to the loopback server |
| `profile` | `$DSH_PROFILE` or `desktop` | profile whose patch the LAN bind manages |

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
