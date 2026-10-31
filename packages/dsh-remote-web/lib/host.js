// packages/dsh-remote-web/src/index.ts
import { join as join5 } from "node:path";
import { setInterval as nodeSetInterval, setTimeout as nodeSetTimeout } from "node:timers";
import z2 from "@deepseek-ai/schemastery";

// packages/dsh-remote-web/src/pairing/pairing.ts
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
var DEFAULT_IDLE_EXPIRE_MS = 30 * 24 * 60 * 60 * 1e3;
var MAX_USER_AGENT_CHARS = 180;
var UnknownLanAddressError = class extends Error {
  /**
   * @param address - the offending literal.
   */
  constructor(address) {
    super(`remote-web-ui: unknown LAN address ${JSON.stringify(address)}`);
    this.name = "UnknownLanAddressError";
  }
};
var defaultClock = {
  now: () => Date.now(),
  randomToken: () => randomBytes(16).toString("hex")
};
var PairingService = class {
  /**
   * @param config - tunables. The settings surface replaces the object (a
   * fresh literal) when a committed section changes; every operation reads
   * the current one.
   * @param clock - clock/entropy source (injectable for tests).
   */
  constructor(config, clock = defaultClock, fs = {}) {
    this.config = config;
    this.clock = clock;
    this.fs = fs;
    this.loadPersisted();
  }
  config;
  clock;
  fs;
  tokens = /* @__PURE__ */ new Map();
  devices = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  lastEmitted;
  stopped = false;
  tokenSerial = 0;
  /** LAN base URLs keyed by the advertised IP literal (interface order). */
  lanBases = /* @__PURE__ */ new Map();
  /** Public (tunneled) base URL, e.g. a Cloudflare Tunnel quick URL. */
  publicBase;
  /** Auto-tunnel status, while the auto-tunnel feature is active. */
  tunnelStatus;
  relayStatus;
  posture;
  /** True when lastSeenAt changed since the last persist (flushed on sweep). */
  dirty = false;
  /**
   * Restore device sessions persisted by a previous process run. A corrupt
   * or missing file is tolerated (an empty device table, never a throw) —
   * persistence is an availability convenience, not a security boundary.
   *
   * Every still-valid session is restored, deliberately without applying
   * `maxDevices`: the constructor runs with whatever cap the configuration
   * layer has delivered so far (the schema default until the saved settings
   * row is applied), and trimming here would permanently drop authorizations
   * the user never revoked — the trimmed table reaches disk on the next
   * heartbeat/sweep write. The cap is enforced where a device is admitted
   * (see `accept`), against the configuration in force at that moment.
   */
  loadPersisted() {
    const file = this.config.devicesFile;
    if (file === void 0) return;
    try {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      if (typeof saved !== "object" || saved === null) return;
      for (const [deviceId, session] of Object.entries(saved)) {
        if (typeof deviceId !== "string") continue;
        if (typeof session !== "object" || session === null) continue;
        const { createdAt, lastSeenAt, userAgent } = session;
        if (typeof createdAt !== "number" || typeof lastSeenAt !== "number") continue;
        const label = typeof userAgent === "string" ? sanitizeUserAgent(userAgent) : void 0;
        this.devices.set(deviceId, {
          createdAt,
          lastSeenAt,
          ...label !== void 0 ? { userAgent: label } : {}
        });
      }
      if (this.evictIdle()) this.persistRevocation();
    } catch {
    }
  }
  /** Drop sessions whose lastSeenAt is older than idleExpireMs. */
  evictIdle() {
    const now = this.clock.now();
    const limit = this.config.idleExpireMs ?? DEFAULT_IDLE_EXPIRE_MS;
    let removed = false;
    for (const [id, session] of [...this.devices]) {
      if (now - session.lastSeenAt > limit) {
        this.devices.delete(id);
        removed = true;
      }
    }
    return removed;
  }
  /**
   * Write the current device table to the configured file. Called on the
   * mutation boundaries that change the set of live sessions (accept, stop,
   * revoke, idle eviction) and, throttled, from sweep() so lastSeenAt
   * survives a restart without a write per request.
   *
   * Device ids are session credentials (the gate authorizes requests by the
   * cookie's device id), so the file is written 0600 via a temp file and
   * atomic rename; a crash mid-write can never leave a half-written store.
   */
  persist() {
    const file = this.config.devicesFile;
    if (file === void 0) return true;
    try {
      mkdirSync(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      const payload = {};
      for (const [id, session] of this.devices) payload[id] = session;
      writeFileSync(temp, JSON.stringify(payload), { mode: 384 });
      renameSync(temp, file);
      this.dirty = false;
      return true;
    } catch (error) {
      console.error("remote-web-ui: failed to persist paired devices", error);
      return false;
    }
  }
  /**
   * Persist a table change that REVOKES access (stop, per-device revoke, idle
   * eviction). A failed write would leave the revoked session on disk, and
   * {@link loadPersisted} restores that file verbatim on the next start — the
   * device's still-valid cookie would authorize again after an explicit
   * revocation. When the write cannot be made durable, the stale store is
   * removed instead (a missing file already loads as an empty table), so the
   * failure costs a re-pair rather than silently undoing the revocation.
   */
  persistRevocation() {
    if (this.persist()) return;
    const file = this.config.devicesFile;
    if (file === void 0) return;
    try {
      if (this.fs.removeFile !== void 0) this.fs.removeFile(file);
      else rmSync(file, { force: true });
      console.error("remote-web-ui: the device revocation could not be persisted; removed the stale device store so a restart cannot restore it");
    } catch (error) {
      console.error("remote-web-ui: the device revocation could not be persisted and the stale device store could not be removed", error);
    }
  }
  /** The default LAN base URL (the first interface; undefined when not LAN-reachable). */
  get lanBaseUrl() {
    return this.lanBases.values().next().value;
  }
  /** The LAN base URL for one specific literal (undefined when not constructible). */
  lanBaseUrlFor(address) {
    return this.lanBases.get(address);
  }
  /** The LAN IP literals QR links can be built from (interface order). */
  get lanAddresses() {
    return [...this.lanBases.keys()];
  }
  /** Set the LAN base URLs once the server bind is known (interface order). */
  setLanBases(entries) {
    this.lanBases = new Map(entries.map((entry) => [entry.address, entry.base]));
    this.notify();
  }
  /** The configured public (tunneled) base URL, when present. */
  get publicBaseUrl() {
    return this.publicBase;
  }
  /**
   * Set or clear the public base URL (a tunnel in front of this server). The
   * value is canonicalized to its origin: a trailing slash (what a browser
   * address-bar copy produces) or a path would mint a dead `//pair-accept`
   * link, which WHATWG resolves as an authority rather than a path.
   */
  setPublicBaseUrl(url) {
    this.publicBase = url === void 0 ? void 0 : canonicalBaseUrl(url);
    this.notify();
  }
  /** Set or clear the auto-tunnel status frame (undefined when the feature is off). */
  setTunnelStatus(status) {
    this.tunnelStatus = status;
    this.notify();
  }
  /** Set or clear the relay-registry status frame (undefined when not in play). */
  setRelayStatus(status) {
    this.relayStatus = status;
    this.notify();
  }
  /** Set the latest /api posture probe result (see posture.ts). */
  setPosture(snapshot) {
    this.posture = snapshot;
    this.notify();
  }
  /**
   * Issue a fresh token, replacing (invalidating) any previous one. A
   * stopped service re-arms through this call (the panel's refresh button).
   * @param workspaceId - optional workspace the QR link should land in.
   * @param address - optional LAN IP literal the QR must be built from; the
   * default is the public base (when configured) or the first interface.
   * Unknown addresses are refused.
   * @returns the token secret and its expiry.
   * @throws {Error} when no reachable base exists (no all-interfaces bind and
   * no public base) — callers surface this as the lan-required state instead
   * of minting an unusable QR.
   */
  issue(workspaceId, address) {
    if (this.lanBases.size === 0 && this.publicBase === void 0) {
      throw new Error("remote-web-ui: pairing requires a reachable bind (--host 0.0.0.0 or publicBaseUrl)");
    }
    if (address !== void 0 && !this.lanBases.has(address)) {
      throw new UnknownLanAddressError(address);
    }
    const now = this.clock.now();
    const token = this.clock.randomToken();
    this.tokens.clear();
    this.stopped = false;
    this.tokenSerial += 1;
    this.tokens.set(token, {
      id: `t${this.tokenSerial}`,
      issuedAt: now,
      expiresAt: now + this.config.tokenTtlMs,
      ...workspaceId !== void 0 ? { workspaceId } : {},
      ...address !== void 0 ? { address } : {}
    });
    this.notify();
    return { token, expiresAt: now + this.config.tokenTtlMs };
  }
  /**
   * Redeem a token and bind a device session. The token is a bearer
   * credential for its whole window, not a single-use nonce: it is refused
   * only when unknown, past its expiry, or after stop(), and every successful
   * call — including a repeat within the same window — mints a fresh device
   * session (see the module doc for the mobile cookie-context rationale).
   * @param token - the token secret from the QR link.
   * @param userAgent - optional User-Agent header captured at accept.
   * @returns the new device id, or a refusal code.
   */
  accept(token, userAgent) {
    const record = this.tokens.get(token);
    if (record === void 0 || this.stopped || this.clock.now() > record.expiresAt) {
      return { ok: false, code: "invalid" };
    }
    const deviceId = this.clock.randomToken();
    const now = this.clock.now();
    while (this.devices.size >= this.config.maxDevices) {
      let oldest;
      for (const [id, session] of this.devices) {
        if (oldest === void 0 || session.createdAt < oldest.createdAt) oldest = { id, createdAt: session.createdAt };
      }
      if (oldest === void 0) break;
      this.devices.delete(oldest.id);
    }
    const label = sanitizeUserAgent(userAgent);
    this.devices.set(deviceId, {
      createdAt: now,
      lastSeenAt: now,
      ...label !== void 0 ? { userAgent: label } : {}
    });
    this.persist();
    this.notify();
    return { ok: true, deviceId };
  }
  /**
   * Stop remote control: revoke every device session and clear the token.
   * The phone's next gated /api request 403s; the panel falls back to
   * stopped until a fresh QR is issued.
   */
  stop() {
    this.tokens.clear();
    this.devices.clear();
    this.persistRevocation();
    this.stopped = true;
    this.notify();
  }
  /**
   * Revoke one paired device. The next gated request from that cookie is
   * refused; other sessions stay live. Unknown ids are a no-op.
   * @param deviceId - the cookie value of the device to drop.
   * @returns true when a live session was removed.
   */
  revoke(deviceId) {
    if (this.stopped) return false;
    if (!this.devices.delete(deviceId)) return false;
    this.persistRevocation();
    this.notify();
    return true;
  }
  /**
   * The api/gate path: record activity for a device id and report whether
   * the request may proceed. Unknown or revoked ids (including any device
   * after stop() or idle expiry) are refused.
   *
   * Presence refreshes are throttled on purpose: every gated request (and
   * the mobile SSE keepalive) lands here, so a broadcast per call would fan
   * a full snapshot out to every status stream on the hot path. The refresh
   * only updates lastSeenAt and marks the store dirty; the snapshot reaches
   * listeners at the next sweep() (structural changes notify immediately).
   * @param deviceId - the cookie value of the requesting device.
   * @returns true when the device session is live and was refreshed.
   */
  touchDevice(deviceId) {
    const session = this.liveSession(deviceId);
    if (session === void 0) return false;
    session.lastSeenAt = this.clock.now();
    this.dirty = true;
    return true;
  }
  /** Explicit presence heartbeat (the phone's client sends these). */
  heartbeat(deviceId) {
    return this.touchDevice(deviceId);
  }
  /**
   * Periodic sweep: drop idle sessions, flush a dirty lastSeenAt, and
   * re-evaluate the derived snapshot (a device aging past the offline
   * window flips the phase to disconnected). Emits only when the snapshot
   * actually changed.
   */
  sweep() {
    const evicted = this.evictIdle();
    if (evicted) this.persistRevocation();
    else if (this.dirty) this.persist();
    this.notify();
  }
  /** The current snapshot (fresh object per call — stable between emits). */
  snapshot() {
    const now = this.clock.now();
    const devices = [...this.devices.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt).map(([id, session]) => this.toDeviceSnapshot(id, session, now));
    const onlineCount = devices.filter((device) => device.online).length;
    const token = this.activeToken();
    return {
      phase: this.derivePhase(onlineCount, token !== void 0),
      lanAvailable: this.lanBases.size > 0,
      lanAddresses: [...this.lanBases.keys()],
      ...this.publicBase !== void 0 ? { publicUrl: this.publicBase } : {},
      ...this.tunnelStatus !== void 0 ? { tunnel: this.tunnelStatus } : {},
      ...this.relayStatus !== void 0 ? { relay: this.relayStatus } : {},
      ...this.posture !== void 0 ? { posture: this.posture } : {},
      ...token !== void 0 ? { tokenId: token.record.id, tokenExpiresAt: token.record.expiresAt } : {},
      deviceCount: this.devices.size,
      onlineCount,
      devices
    };
  }
  /** Whether a cookie value names a currently live (non-idle) device session. */
  hasDevice(deviceId) {
    return this.liveSession(deviceId) !== void 0;
  }
  /**
   * Number of device sessions in the table, including idle ones whose idle
   * window has not been swept yet. Restore keeps every persisted session
   * (see `loadPersisted`), so this can exceed the configured cap until the
   * next `accept` trims the excess.
   */
  deviceCount() {
    return this.devices.size;
  }
  /** Subscribe to snapshot changes (each emit passes a fresh snapshot). */
  onState(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  activeToken() {
    for (const [token, record] of this.tokens) {
      if (this.stopped) return void 0;
      if (this.clock.now() > record.expiresAt) continue;
      return { token, record };
    }
    return void 0;
  }
  /**
   * Return a live session, deleting it first when idle-expired. Side-effecting
   * so a stale cookie cannot pass the gate between sweeps.
   */
  liveSession(deviceId) {
    if (this.stopped) return void 0;
    const session = this.devices.get(deviceId);
    if (session === void 0) return void 0;
    const limit = this.config.idleExpireMs ?? DEFAULT_IDLE_EXPIRE_MS;
    if (this.clock.now() - session.lastSeenAt > limit) {
      this.devices.delete(deviceId);
      this.persistRevocation();
      this.notify();
      return void 0;
    }
    return session;
  }
  toDeviceSnapshot(id, session, now) {
    return {
      id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      online: this.isOnlineAt(session, now),
      ...session.userAgent !== void 0 ? { userAgent: session.userAgent } : {}
    };
  }
  derivePhase(onlineCount, hasToken) {
    if (this.lanBases.size === 0 && this.publicBase === void 0) return "lan-required";
    if (this.stopped) return "stopped";
    if (onlineCount > 0) return "connected";
    if (this.devices.size > 0) return "disconnected";
    if (hasToken) return "waiting";
    return "stopped";
  }
  isOnlineAt(session, now) {
    return now - session.lastSeenAt <= this.config.offlineAfterMs;
  }
  notify() {
    const snapshot = this.snapshot();
    if (this.lastEmitted !== void 0 && snapshotsEqual(this.lastEmitted, snapshot)) return;
    this.lastEmitted = snapshot;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("remote-web-ui: pairing state listener failed", error);
      }
    }
  }
};
function snapshotsEqual(a, b) {
  return a.phase === b.phase && a.lanAvailable === b.lanAvailable && sameStrings(a.lanAddresses, b.lanAddresses) && a.publicUrl === b.publicUrl && tunnelEqual(a.tunnel, b.tunnel) && relayEqual(a.relay, b.relay) && postureEqual(a.posture, b.posture) && a.tokenId === b.tokenId && a.tokenExpiresAt === b.tokenExpiresAt && a.deviceCount === b.deviceCount && a.onlineCount === b.onlineCount && devicesEqual(a.devices, b.devices);
}
function devicesEqual(a, b) {
  return a.length === b.length && a.every((device, index) => {
    const other = b[index];
    return other !== void 0 && device.id === other.id && device.createdAt === other.createdAt && device.lastSeenAt === other.lastSeenAt && device.online === other.online && device.userAgent === other.userAgent;
  });
}
function tunnelEqual(a, b) {
  return a === b || a !== void 0 && b !== void 0 && a.state === b.state && a.url === b.url && a.error === b.error;
}
function relayEqual(a, b) {
  return a === b || a !== void 0 && b !== void 0 && a.state === b.state && a.url === b.url && a.error === b.error;
}
function postureEqual(a, b) {
  if (a === b) return true;
  if (!isPostureFrame(a) || !isPostureFrame(b)) return false;
  return a.checkedAt === b.checkedAt && hostsEqual(a.hosts, b.hosts);
}
function isPostureFrame(value) {
  return typeof value === "object" && value !== null;
}
function hostsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a.length === b.length && a.every((host, index) => {
    const other = b[index];
    return isPostureHost(host) && isPostureHost(other) && host.host === other.host && host.exposed === other.exposed;
  });
}
function isPostureHost(value) {
  return typeof value === "object" && value !== null;
}
function sameStrings(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function canonicalBaseUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
function sanitizeUserAgent(raw) {
  if (raw === void 0) return void 0;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned === "") return void 0;
  return cleaned.length <= MAX_USER_AGENT_CHARS ? cleaned : cleaned.slice(0, MAX_USER_AGENT_CHARS);
}

// packages/dsh-remote-web/src/state/dsh-home.ts
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { isAbsolute as posixIsAbsolute, join as posixJoin } from "node:path/posix";
function expandHome(path, home = homedir()) {
  const isPosix = home.startsWith("/");
  const j = isPosix ? posixJoin : join;
  if (path === "~") return home;
  if (path.startsWith("~/") || path.startsWith("~\\")) return j(home, path.slice(2));
  return path;
}
function resolveDshHome(env = process.env, home = homedir()) {
  const isPosix = home.startsWith("/");
  const j = isPosix ? posixJoin : join;
  const isAbs = isPosix ? posixIsAbsolute : isAbsolute;
  const raw = env.DSH_HOME;
  if (raw !== void 0 && raw.trim() !== "") {
    const expanded = expandHome(raw.trim(), home);
    return isAbs(expanded) ? expanded : j(process.cwd(), expanded);
  }
  return j(home, ".dsh");
}
function dshHome() {
  return resolveDshHome();
}

// packages/dsh-remote-web/src/http/loopback.ts
function isIPv4Loopback(v4) {
  const parts = v4.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isLoopbackAddress(address) {
  if (address === void 0) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice("::ffff:".length));
  return isIPv4Loopback(normalized);
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  return isIPv4Loopback(hostname);
}

// packages/dsh-remote-web/src/pairing/gate.ts
function readCookie(header, name2) {
  if (header === void 0) return void 0;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key === name2) return part.slice(eq + 1).trim();
  }
  return void 0;
}
function hostnameOf(request) {
  const host = request.headers.host;
  if (typeof host !== "string") return void 0;
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return void 0;
  }
}
function isLoopbackClient(request) {
  const hostname = hostnameOf(request);
  if (hostname === void 0 || !isLoopbackHostname(hostname)) return false;
  const socket = request.socket;
  return isLoopbackAddress(socket?.remoteAddress);
}
function makeGateListener(service, requirePairingForLan = true, enabled = true) {
  return (request, _method, next) => {
    if (isLoopbackClient(request)) return next();
    const active = typeof enabled === "function" ? enabled() : enabled;
    if (!active) return false;
    const require2 = typeof requirePairingForLan === "function" ? requirePairingForLan() : requirePairingForLan;
    if (!require2) return next();
    return isPairedDeviceRequest(service, request) ? next() : false;
  };
}
function isPairedDeviceRequest(service, request) {
  const deviceId = readCookie(request.headers.cookie, service.config.cookieName);
  if (deviceId === void 0) return false;
  return service.touchDevice(deviceId);
}

// packages/dsh-remote-web/src/pairing/pairing-access.ts
import { Service } from "@deepseek-ai/cordis";
var REMOTE_WEB_UI_PAIRING = "remoteWebUiPairing";
var RemoteWebUiPairing = class extends Service {
  /**
   * @param ctx - host plugin context.
   * @param check - live cookie + session predicate (re-read per request).
   */
  constructor(ctx, check) {
    super(ctx, REMOTE_WEB_UI_PAIRING);
    this.check = check;
  }
  check;
  /**
   * Whether the request carries a live paired-device cookie.
   * @param request - the incoming HTTP request.
   * @returns true when the session is live and was refreshed.
   */
  isPairedDevice(request) {
    return this.check(request);
  }
};

// packages/dsh-remote-web/src/http/routes.ts
import { z } from "zod";

// packages/dsh-remote-web/src/http/http.ts
var DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;
var JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer"
};
async function readJsonBody(req, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > maxBytes) {
      req.destroy();
      return null;
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text === "") return null;
  try {
    const parsed = JSON.parse(text);
    if (opts.objectOnly && !isJsonObject(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function withIdentityEncoding(init = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  return { ...init, headers };
}
function writeJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...JSON_HEADERS, ...headers });
  res.end(payload);
}

// packages/dsh-remote-web/src/pairing/pair-grant.ts
import { randomBytes as randomBytes2 } from "node:crypto";
var DEFAULT_PAIR_GRANT_TTL_MS = 6e4;
var MAX_LIVE_GRANTS = 256;
function createPairGrantStore(options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_PAIR_GRANT_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const createGrant = options.createGrant ?? (() => randomBytes2(32).toString("base64url"));
  const entries = /* @__PURE__ */ new Map();
  const purgeExpired = (at) => {
    for (const [grant, entry] of entries) {
      if (entry.expiresAt <= at) entries.delete(grant);
    }
  };
  return {
    issue(deviceId) {
      const issuedAt = now();
      purgeExpired(issuedAt);
      while (entries.size >= MAX_LIVE_GRANTS) {
        const oldest = entries.keys().next().value;
        if (oldest === void 0) break;
        entries.delete(oldest);
      }
      const grant = createGrant();
      const expiresAt = issuedAt + ttlMs;
      entries.set(grant, { deviceId, expiresAt });
      return { grant, expiresAt };
    },
    consume(grant) {
      if (grant === void 0 || grant === "") return void 0;
      const consumedAt = now();
      const entry = entries.get(grant);
      entries.delete(grant);
      purgeExpired(consumedAt);
      if (entry === void 0 || entry.expiresAt <= consumedAt) return void 0;
      return entry.deviceId;
    },
    peek(grant) {
      if (grant === void 0 || grant === "") return void 0;
      const at = now();
      const entry = entries.get(grant);
      if (entry === void 0) return void 0;
      if (entry.expiresAt <= at) {
        entries.delete(grant);
        return void 0;
      }
      return entry.deviceId;
    },
    get size() {
      return entries.size;
    }
  };
}

// packages/dsh-remote-web/src/http/remote-methods.ts
var REMOTE_PREFIX = "/remote";
var REMOTE_API_PREFIX = `${REMOTE_PREFIX}/api`;
var REMOTE_API_PATHS = {
  mux: `${REMOTE_API_PREFIX}/remote.mux`
};
var REMOTE_UPGRADE_PATHS = [
  REMOTE_API_PATHS.mux,
  `${REMOTE_PREFIX}/sidebar/ws/terminal`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-terminals`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-opens`,
  `${REMOTE_API_PREFIX}/dsh-ssh/terminal`
];
var PLUGIN_MANAGER_PATH = "/api/plugin-manager";
var REMOTE_DEVICE_HEADER = "x-dsh-remote-device";
var REMOTE_DEVICE_QUERY = "device";
var LOCAL_ONLY_PREFIXES = [
  "/api/pair",
  "/api/update",
  PLUGIN_MANAGER_PATH
];
function localOnlyDenial(innerPath) {
  for (const prefix of LOCAL_ONLY_PREFIXES) {
    if (innerPath === prefix || innerPath.startsWith(`${prefix}/`)) {
      return `${prefix.slice(1)} stays physically local and stays unreachable from a paired remote desktop`;
    }
  }
  return void 0;
}

// packages/dsh-remote-web/src/http/remote-channel-rules.ts
var REMOTE_PREFIX2 = "/remote";
var WEB_PAGE_PROTOCOLS = [
  "http:",
  "https:",
  "blob:",
  "data:",
  "about:",
  "filesystem:"
];
var REMOTE_API_PREFIX2 = `${REMOTE_PREFIX2}/api`;
var REMOTE_HOST_GRANT_GLOBAL = "__DSH_REMOTE_HOST_GRANT__";
var REMOTE_CHANNEL_RULES = {
  remotePrefix: REMOTE_PREFIX2,
  apiPrefix: "/api/",
  pairPrefix: "/api/pair/",
  updatePrefix: "/api/update/",
  settingsBridgePrefix: "/api/dsh-web-ui-settings",
  sidebarPrefix: "/sidebar/",
  gitPrefix: "/git/",
  petPrefix: "/pet/",
  // The official 0.1.2-alpha.2 line opens exactly one stream socket (the
  // Typert gateway mux, /api/remote.mux); the legacy /api/events.* paths
  // were removed by the SDK and stay absent here.
  wsPaths: [
    "/api/remote.mux",
    "/sidebar/ws/terminal",
    "/sidebar/ws/agent-terminals",
    "/sidebar/ws/agent-opens",
    "/api/dsh-ssh/terminal"
  ],
  deviceHeader: REMOTE_DEVICE_HEADER,
  deviceKey: "dsh-remote-device",
  deviceQuery: REMOTE_DEVICE_QUERY,
  uploadPath: "/api/session/uploadFileBinary",
  uploadHookGlobal: "__DSH_FILE_UPLOAD__",
  webProtocols: WEB_PAGE_PROTOCOLS,
  hostGrantGlobal: REMOTE_HOST_GRANT_GLOBAL
};
var REMOTE_CHANNEL_BOOT_GLOBAL = "__DSH_REMOTE_CHANNEL_BOOT__";

// packages/dsh-remote-web/src/http/routes.ts
function isTrustedApiRequest(request, trustedHosts) {
  if (!isTrustedHost(request, trustedHosts)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === new URL(`http://${request.headers.host ?? ""}`).host;
  } catch {
    return false;
  }
}
function isTrustedHost(request, trustedHosts) {
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  const hostname = hostUrl.hostname;
  return isLoopbackClient(request) || trustedHosts.some((entry) => {
    let entryUrl;
    try {
      entryUrl = new URL(`http://${entry}`);
    } catch {
      return false;
    }
    return entryUrl.port === "" ? entryUrl.hostname === hostname : entryUrl.host === hostUrl.host;
  });
}
function isTopLevelDocumentNavigation(request) {
  return request.headers["sec-fetch-mode"] === "navigate" && request.headers["sec-fetch-dest"] === "document";
}
function isPrivateOrLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().trim();
  if (normalized === "localhost" || normalized.endsWith(".local") || normalized.endsWith(".lan") || normalized.endsWith(".internal") || normalized.endsWith(".home.arpa")) {
    return true;
  }
  let ip = normalized;
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}
function isNonCrossSite(request) {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    const originUrl = new URL(origin);
    const hostUrl = new URL(`http://${host}`);
    return originUrl.host === hostUrl.host;
  } catch {
    return false;
  }
}
function privateLanHostOf(request, navigation = false) {
  const host = request.headers.host;
  if (typeof host !== "string") return void 0;
  let hostName = "";
  try {
    hostName = new URL(`http://${host}`).hostname;
  } catch {
    return void 0;
  }
  if (hostName === "" || !isPrivateOrLocalHostname(hostName)) return void 0;
  if (!(navigation && isTopLevelDocumentNavigation(request)) && !isNonCrossSite(request)) return void 0;
  return host;
}
var MAX_BODY_BYTES = 4096;
function acceptLimitKey(socketIp, forwarded, bucket) {
  if (isLoopbackAddress(socketIp) && forwarded !== void 0 && forwarded !== "") {
    return `${bucket}|${socketIp}|${forwarded.slice(0, MAX_FORWARDED_KEY_CHARS)}`;
  }
  return `${bucket}|${socketIp}`;
}
var MAX_FORWARDED_KEY_CHARS = 64;
var MAX_ACCEPT_BUCKETS = 1024;
var MAX_DYNAMIC_TRUSTED_HOSTS = 64;
var loggedEntryRefusals = /* @__PURE__ */ new Set();
function logEntryRefusal(request, path, reason) {
  const key = `${reason}|${request.headers.host ?? ""}|${path}`;
  if (loggedEntryRefusals.has(key) || loggedEntryRefusals.size >= 64) return;
  loggedEntryRefusals.add(key);
  const markers = [
    `sec-fetch-site=${request.headers["sec-fetch-site"] ?? "-"}`,
    `sec-fetch-mode=${request.headers["sec-fetch-mode"] ?? "-"}`,
    `sec-fetch-dest=${request.headers["sec-fetch-dest"] ?? "-"}`,
    `origin=${request.headers.origin ?? "-"}`
  ].join(" ");
  console.log(`remote-web-ui: refused ${path} from host ${request.headers.host ?? "-"} (${reason}; ${markers})`);
}
function addBounded(set, value, max) {
  if (set.has(value)) return;
  if (set.size >= max) {
    const oldest = set.values().next().value;
    if (oldest !== void 0) set.delete(oldest);
  }
  set.add(value);
}
function publicHostOf(url) {
  if (url === void 0) return void 0;
  try {
    return new URL(url).host;
  } catch {
    return void 0;
  }
}
var COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;
var APP_DEVICE_STORAGE_KEY = "dsh-remote-device";
function appShellCaptureScript(deviceId) {
  const safeId = JSON.stringify(deviceId);
  const grantGlobal = JSON.stringify(REMOTE_HOST_GRANT_GLOBAL);
  const register = `try{if('serviceWorker' in navigator){navigator.serviceWorker.register(${JSON.stringify(PAIR_PATHS.appServiceWorker)},{scope:'/'}).catch(function(e){})}}catch(e){}`;
  return `<script>(function(){try{sessionStorage.setItem(${JSON.stringify(APP_DEVICE_STORAGE_KEY)},${safeId});}catch(e){}try{history.replaceState(null,'','/')}catch(e){}try{window[${grantGlobal}]=true}catch(e){}${register}})()</script>`;
}
function patchAppShell(html, deviceId) {
  const script = appShellCaptureScript(deviceId);
  const head = /<head[^>]*>/i.exec(html);
  if (head === null) return script + html;
  const end = head.index + head[0].length;
  return html.slice(0, end) + script + html.slice(end);
}
function appServiceWorkerScript() {
  return `'use strict';
var SHELL_CACHE = 'dsh-remote-shell-v1';
var SHELL_KEY = '/dsh-remote-shell';
var APP_URL = '/pair-app';
self.addEventListener('install', function (event) {
  event.waitUntil(refreshShell().then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.caches.keys().then(function (names) {
    return Promise.all(names.map(function (name) {
      return name === SHELL_CACHE ? Promise.resolve() : self.caches.delete(name);
    }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  var path;
  try { path = new URL(request.url).pathname; } catch (error) { return; }
  if (path !== '/') return;
  event.respondWith(reopen(event));
});
/* Network-first: a live pairing gets the current shell (the /pair-app check
   refreshes lastSeenAt, so every reopen also keeps the session alive); a
   refused shell passes the original navigation through for the harness's
   own response; an unreachable server falls back to the cached shell. */
function reopen(event) {
  var request = event.request;
  return fetch(APP_URL, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (!response.ok) return fetch(request);
    var copy = response.clone();
    event.waitUntil(self.caches.open(SHELL_CACHE).then(function (cache) {
      return cache.put(SHELL_KEY, copy);
    }));
    return response;
  }, function () {
    return self.caches.match(SHELL_KEY).then(function (cached) {
      return cached !== undefined ? cached : fetch(request);
    });
  });
}
/* Best-effort shell warm-up and refresh; never rejects. */
function refreshShell() {
  return fetch(APP_URL, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (!response.ok) return undefined;
    var copy = response.clone();
    return self.caches.open(SHELL_CACHE).then(function (cache) {
      return cache.put(SHELL_KEY, copy);
    });
  }, function () { return undefined; });
}`;
}
function pairingFailurePage() {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    "<title>Pairing link invalid</title></head>",
    '<body style="font-family:system-ui,sans-serif;padding:24px;max-width:32em;margin:0 auto;line-height:1.6">',
    "<p><strong>\u914D\u5BF9\u5DF2\u5931\u6548\uFF0C\u6216\u914D\u5BF9\u94FE\u63A5\u5DF2\u8FC7\u671F\u3002</strong></p>",
    "<p>\u8BF7\u5728\u684C\u9762\u7AEF\u6253\u5F00\u8FDC\u7A0B\u63A7\u5236\u9762\u677F\uFF0C\u5237\u65B0\u4E8C\u7EF4\u7801\u540E\u91CD\u65B0\u626B\u7801\uFF1B\u91CD\u65B0\u914D\u5BF9\u540E\u672C\u673A\u5373\u53EF\u6062\u590D\u8BBF\u95EE\u3002</p>",
    '<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">',
    "<p><strong>This pairing has expired or the link is no longer valid.</strong></p>",
    "<p>Open the remote panel on the desktop, refresh the QR code, and scan again \u2014 re-pairing restores access on this device.</p>",
    "</body></html>"
  ].join("");
}
var PAIR_PATHS = {
  issue: "/api/pair/issue",
  accept: "/api/pair/accept",
  stop: "/api/pair/stop",
  revoke: "/api/pair/revoke",
  heartbeat: "/api/pair/heartbeat",
  status: "/api/pair/status",
  events: "/api/pair/events",
  lanBind: "/api/pair/lan-bind",
  /** Top-level accept-and-redirect entry the QR link points at. */
  acceptPage: "/pair-accept",
  /** The cookieless app landing: serves the official shell for a paired device. */
  appPage: "/pair-app",
  /**
   * The reopen service worker (registered by the capture script). Root-level
   * path so its default script-directory scope already covers `/`.
   */
  appServiceWorker: "/pair-app.sw.js"
};
var issuePayloadSchema = z.object({
  address: z.string().min(1).optional()
});
var acceptPayloadSchema = z.object({
  token: z.string().default("")
});
var revokePayloadSchema = z.object({
  deviceId: z.string().min(1)
});
var pairActionPayloadSchema = z.object({}).passthrough();
function parsePairPayload(schema, body) {
  const result = schema.safeParse(body ?? {});
  return result.success ? result.data : void 0;
}
var PairingEventsStream = class {
  streams = /* @__PURE__ */ new Set();
  /**
   * @param service - the pairing service whose snapshots are fanned out.
   */
  constructor(service) {
    service.onState((snapshot) => {
      this.push(snapshot);
    });
  }
  /** Open one stream; the response is owned to completion. */
  open(req, res) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    const stream = { res, closed: false };
    this.streams.add(stream);
    const close = () => {
      if (stream.closed) return;
      stream.closed = true;
      this.streams.delete(stream);
    };
    res.on("close", close);
    req.on("close", close);
  }
  /** Push one frame to every open stream (contained per stream). */
  push(snapshot) {
    const frame = `data: ${JSON.stringify({ type: "state", ...snapshot })}

`;
    for (const stream of this.streams) {
      try {
        stream.res.write(frame);
      } catch {
        stream.closed = true;
        this.streams.delete(stream);
      }
    }
  }
  /** Stream count (tests/diagnostics). */
  get size() {
    return this.streams.size;
  }
};
function makeRoutes(deps) {
  const { service, requirePairingForLan = true } = deps;
  const pairingRequired = () => typeof requirePairingForLan === "function" ? requirePairingForLan() : requirePairingForLan;
  const grants = deps.grants ?? createPairGrantStore();
  const events = new PairingEventsStream(service);
  const dynamicTrustedHosts = /* @__PURE__ */ new Set();
  const loopbackFence = (req) => isTrustedApiRequest(req, []);
  const lanFence = (req, navigation = false) => {
    const publicHost = publicHostOf(service.publicBaseUrl);
    const bases = service.lanAddresses;
    const extraHosts = typeof deps.trustedHosts === "function" ? deps.trustedHosts() : deps.trustedHosts ?? [];
    const combined = [
      ...bases,
      ...publicHost !== void 0 ? [publicHost] : [],
      ...extraHosts,
      ...dynamicTrustedHosts
    ];
    if (navigation && isTopLevelDocumentNavigation(req) ? isTrustedHost(req, combined) : isTrustedApiRequest(req, combined)) return true;
    const privateLanHost = privateLanHostOf(req, navigation);
    if (privateLanHost !== void 0) {
      const cookieDeviceId = readCookie(req.headers.cookie, service.config.cookieName);
      let queryDeviceId = null;
      let queryGrant;
      try {
        const params = new URL(req.url ?? "/", "http://pair.invalid").searchParams;
        queryDeviceId = params.get("device");
        queryGrant = params.get("grant") ?? void 0;
      } catch {
      }
      const granted = grants.peek(queryGrant);
      const deviceId = cookieDeviceId ?? queryDeviceId ?? granted ?? void 0;
      if (deviceId !== void 0 && service.hasDevice(deviceId)) {
        addBounded(dynamicTrustedHosts, privateLanHost, MAX_DYNAMIC_TRUSTED_HOSTS);
        return true;
      }
    }
    return false;
  };
  const requireMethod = (req, res, method) => {
    if (req.method === method) return true;
    res.writeHead(405);
    res.end();
    return false;
  };
  const acceptAttempts = /* @__PURE__ */ new Map();
  const ACCEPT_MAX_ATTEMPTS = 10;
  const ACCEPT_WINDOW_MS = 3e4;
  const pruneAcceptAttempts = (nowMs) => {
    while (acceptAttempts.size > 0) {
      const oldest = acceptAttempts.keys().next().value;
      if (oldest === void 0) break;
      const attempt = acceptAttempts.get(oldest);
      if (attempt !== void 0 && nowMs - attempt.windowStart <= ACCEPT_WINDOW_MS) break;
      acceptAttempts.delete(oldest);
    }
    while (acceptAttempts.size > MAX_ACCEPT_BUCKETS) {
      const oldest = acceptAttempts.keys().next().value;
      if (oldest === void 0) break;
      acceptAttempts.delete(oldest);
    }
  };
  const rateLimitAccept = (req, bucket) => {
    const socketIp = req.socket?.remoteAddress ?? "unknown";
    const hops = typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",") : [];
    const forwarded = (hops[hops.length - 1] ?? "").trim();
    const ip = acceptLimitKey(socketIp, forwarded, bucket);
    const nowMs = Date.now();
    pruneAcceptAttempts(nowMs);
    const entry = acceptAttempts.get(ip);
    if (entry === void 0 || nowMs - entry.windowStart > ACCEPT_WINDOW_MS) {
      acceptAttempts.delete(ip);
      acceptAttempts.set(ip, { count: 1, windowStart: nowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > ACCEPT_MAX_ATTEMPTS;
  };
  const handleIssue = async (req, res) => {
    if (!requireMethod(req, res, "POST")) return;
    if (!loopbackFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true });
    const payload = parsePairPayload(issuePayloadSchema, body);
    if (payload === void 0) {
      writeJson(res, 400, { ok: false, code: "bad-payload" });
      return;
    }
    const { address } = payload;
    try {
      const { token, expiresAt } = service.issue(void 0, address);
      const base = address === void 0 ? service.publicBaseUrl ?? service.lanBaseUrl : service.lanBaseUrlFor(address);
      if (base === void 0) throw new Error("remote-web-ui: base unavailable");
      writeJson(res, 200, {
        ok: true,
        url: `${base}/pair-accept?pair=${token}`,
        token,
        expiresAt,
        // Every constructible base, so a multi-homed panel can switch the
        // advertised network without a second round trip.
        lanAddresses: service.lanAddresses,
        // The configured public base, when present — the panel uses it to
        // label the QR as a public (tunneled) link.
        ...service.publicBaseUrl !== void 0 ? { publicBaseUrl: service.publicBaseUrl } : {}
      });
    } catch (error) {
      const unknownAddress = error instanceof UnknownLanAddressError;
      writeJson(res, unknownAddress ? 400 : 409, {
        ok: false,
        code: unknownAddress ? "unknown-address" : "lan-required"
      });
    }
  };
  const handleAccept = async (req, res) => {
    if (!requireMethod(req, res, "POST")) return;
    const privateLanHost = privateLanHostOf(req);
    if (!lanFence(req) && privateLanHost === void 0) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    if (rateLimitAccept(req, "api")) {
      writeJson(res, 429, { ok: false, code: "rate-limited" });
      return;
    }
    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true });
    const payload = parsePairPayload(acceptPayloadSchema, body);
    if (payload === void 0) {
      writeJson(res, 400, { ok: false, code: "bad-payload" });
      return;
    }
    const ua = req.headers["user-agent"];
    const result = service.accept(payload.token, typeof ua === "string" ? ua : void 0);
    if (!result.ok) {
      if (!lanFence(req)) {
        writeJson(res, 403, { ok: false, code: "forbidden" });
        return;
      }
      writeJson(res, 404, { ok: false, code: result.code });
      return;
    }
    if (privateLanHost !== void 0) {
      addBounded(dynamicTrustedHosts, privateLanHost, MAX_DYNAMIC_TRUSTED_HOSTS);
    }
    writeJson(res, 200, { ok: true, deviceId: result.deviceId }, {
      "set-cookie": [deviceCookie(req, service.config.cookieName, result.deviceId)]
    });
  };
  const handleStop = async (req, res) => {
    if (!requireMethod(req, res, "POST")) return;
    if (!loopbackFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true });
    if (parsePairPayload(pairActionPayloadSchema, body) === void 0) {
      writeJson(res, 400, { ok: false, code: "bad-payload" });
      return;
    }
    service.stop();
    writeJson(res, 200, { ok: true });
  };
  const handleRevoke = async (req, res) => {
    if (!requireMethod(req, res, "POST")) return;
    if (!loopbackFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true });
    const payload = parsePairPayload(revokePayloadSchema, body);
    if (payload === void 0) {
      writeJson(res, 400, { ok: false, code: "bad-payload" });
      return;
    }
    const revoked = service.revoke(payload.deviceId);
    if (!revoked) {
      writeJson(res, 404, { ok: false, code: "unknown-device" });
      return;
    }
    writeJson(res, 200, { ok: true });
  };
  const handleHeartbeat = async (req, res) => {
    if (!requireMethod(req, res, "POST")) return;
    if (!lanFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES, objectOnly: true });
    if (parsePairPayload(pairActionPayloadSchema, body) === void 0) {
      writeJson(res, 400, { ok: false, code: "bad-payload" });
      return;
    }
    const deviceId = readCookie(req.headers.cookie, service.config.cookieName);
    if (deviceId === void 0 || !service.heartbeat(deviceId)) {
      writeJson(res, 401, { ok: false, code: "unpaired" });
      return;
    }
    writeJson(res, 200, { ok: true });
  };
  const handleStatus = async (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    if (!lanFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    const deviceId = readCookie(req.headers.cookie, service.config.cookieName);
    const paired = deviceId !== void 0 && service.hasDevice(deviceId);
    const local = isLoopbackClient(req);
    const snapshot = service.snapshot();
    const { devices: _devices, ...rest } = snapshot;
    const visible = paired || local ? rest : { phase: snapshot.phase, lanAvailable: snapshot.lanAvailable };
    writeJson(res, 200, { ok: true, paired, requirePairingForLan: pairingRequired(), ...visible });
  };
  const handleEvents = (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    if (!loopbackFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    events.open(req, res);
    events.push(service.snapshot());
  };
  const handleLanBind = (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    if (!loopbackFence(req)) {
      writeJson(res, 403, { ok: false, code: "forbidden" });
      return;
    }
    writeJson(res, 200, { ok: true, ...deps.lanBindStatus?.() ?? {} });
  };
  const handleAcceptPage = async (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    const privateLanHost = privateLanHostOf(req, true);
    if (!lanFence(req, true) && privateLanHost === void 0) {
      logEntryRefusal(req, PAIR_PATHS.acceptPage, "untrusted-host");
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    if (rateLimitAccept(req, "page")) {
      res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
      res.end("rate limited");
      return;
    }
    const url = new URL(req.url ?? "/", "http://pair.invalid");
    const token = url.searchParams.get("pair") ?? "";
    const ua = req.headers["user-agent"];
    const result = token === "" ? { ok: false, code: "invalid" } : service.accept(token, typeof ua === "string" ? ua : void 0);
    if (!result.ok) {
      if (!lanFence(req, true)) {
        logEntryRefusal(req, PAIR_PATHS.acceptPage, "untrusted-host-after-invalid-token");
        res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        res.end("forbidden");
        return;
      }
      const deviceId = readCookie(req.headers.cookie, service.config.cookieName);
      if (deviceId !== void 0 && service.hasDevice(deviceId)) {
        const { grant: grant2 } = grants.issue(deviceId);
        res.writeHead(303, { location: `${appOrigin(req)}/pair-app?grant=${encodeURIComponent(grant2)}`, "cache-control": "no-store", "referrer-policy": "no-referrer" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" });
      res.end(pairingFailurePage());
      return;
    }
    if (privateLanHost !== void 0) {
      addBounded(dynamicTrustedHosts, privateLanHost, MAX_DYNAMIC_TRUSTED_HOSTS);
    }
    const { grant } = grants.issue(result.deviceId);
    res.writeHead(303, {
      location: `${appOrigin(req)}/pair-app?grant=${encodeURIComponent(grant)}`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "set-cookie": [deviceCookie(req, service.config.cookieName, result.deviceId)]
    });
    res.end();
  };
  const handleAppPage = async (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    if (!lanFence(req, true)) {
      logEntryRefusal(req, PAIR_PATHS.appPage, "untrusted-host");
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    if (rateLimitAccept(req, "page")) {
      res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
      res.end("rate limited");
      return;
    }
    const url = new URL(req.url ?? "/", "http://pair.invalid");
    const grantedDevice = grants.consume(url.searchParams.get("grant") ?? void 0);
    const cookieDevice = readCookie(req.headers.cookie, service.config.cookieName);
    const id = grantedDevice !== void 0 && service.touchDevice(grantedDevice) ? grantedDevice : cookieDevice !== void 0 && service.touchDevice(cookieDevice) ? cookieDevice : void 0;
    if (id === void 0) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" });
      res.end(pairingFailurePage());
      return;
    }
    const html = await deps.indexDocument?.(id).catch(() => void 0);
    if (html === void 0) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("remote device app unavailable");
      return;
    }
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "set-cookie": [deviceCookie(req, service.config.cookieName, id)]
    });
    res.end(patchAppShell(html, id));
  };
  const handleAppServiceWorker = (req, res) => {
    if (!requireMethod(req, res, "GET")) return;
    if (!lanFence(req, true)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }
    res.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      // Defensive: the root-level script path already allows a `/` scope,
      // the header keeps that explicit for engines that want it stated.
      "service-worker-allowed": "/"
    });
    res.end(appServiceWorkerScript());
  };
  const routes = [
    { kind: "exact", path: PAIR_PATHS.issue, handler: handleIssue },
    { kind: "exact", path: PAIR_PATHS.accept, handler: handleAccept },
    { kind: "exact", path: PAIR_PATHS.stop, handler: handleStop },
    { kind: "exact", path: PAIR_PATHS.revoke, handler: handleRevoke },
    { kind: "exact", path: PAIR_PATHS.heartbeat, handler: handleHeartbeat },
    { kind: "exact", path: PAIR_PATHS.status, handler: handleStatus },
    { kind: "exact", path: PAIR_PATHS.events, handler: handleEvents }
  ];
  if (deps.lanBindStatus !== void 0) {
    routes.push({ kind: "exact", path: PAIR_PATHS.lanBind, handler: handleLanBind });
  }
  routes.push({ kind: "exact", path: PAIR_PATHS.acceptPage, handler: handleAcceptPage });
  if (deps.indexDocument !== void 0) {
    routes.push({ kind: "exact", path: PAIR_PATHS.appPage, handler: handleAppPage });
    routes.push({ kind: "exact", path: PAIR_PATHS.appServiceWorker, handler: handleAppServiceWorker });
  }
  return routes;
}
function isHttpsRequest(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim().toLowerCase();
    if (first === "https") return true;
  }
  return req.socket.encrypted === true;
}
function deviceCookie(req, cookieName, deviceId) {
  const secure = isHttpsRequest(req) ? "; Secure" : "";
  return `${cookieName}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(COOKIE_MAX_AGE_SEC)}${secure}`;
}
function appOrigin(req) {
  const origin = `http://${req.headers.host ?? "127.0.0.1"}`;
  return isHttpsRequest(req) ? origin.replace("http://", "https://") : origin;
}

// packages/dsh-remote-web/src/http/loopback-proxy.ts
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
var WS_FORWARD_HEADERS = [
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions",
  "sec-websocket-protocol"
];
var HTTP_FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified"
];
function proxyLoopbackHttp(req, res, port, upstreamPath, auth) {
  void Promise.resolve(auth?.ready()).catch(() => void 0).then((cookie) => {
    pipeLoopbackHttp(req, res, port, upstreamPath, auth, typeof cookie === "string" ? cookie : void 0);
  });
}
function pipeLoopbackHttp(req, res, port, upstreamPath, auth, cookie) {
  const headers = {
    host: `127.0.0.1:${String(port)}`,
    "sec-fetch-site": "same-origin"
  };
  const contentType = req.headers["content-type"];
  if (typeof contentType === "string") headers["content-type"] = contentType;
  const contentLength = req.headers["content-length"];
  if (typeof contentLength === "string") headers["content-length"] = contentLength;
  const accept = req.headers.accept;
  if (typeof accept === "string") headers.accept = accept;
  if (cookie !== void 0) headers.cookie = cookie;
  const upstream = httpRequest({
    host: "127.0.0.1",
    port,
    path: upstreamPath,
    method: req.method,
    headers
  }, (upstreamRes) => {
    if (upstreamRes.statusCode === 401 && cookie !== void 0) auth?.invalidate();
    const out = {};
    for (const name2 of HTTP_FORWARD_RESPONSE_HEADERS) {
      const value = upstreamRes.headers[name2];
      if (value !== void 0) out[name2] = value;
    }
    res.writeHead(upstreamRes.statusCode ?? 502, out);
    upstreamRes.pipe(res);
    upstreamRes.on("error", () => {
      res.destroy();
    });
    res.on("close", () => {
      if (!upstreamRes.readableEnded) upstream.destroy();
    });
  });
  upstream.on("error", () => {
    if (!res.headersSent) {
      writeJson(res, 502, { ok: false, error: { code: "upstream-failure", message: "upstream request failed" } });
      return;
    }
    res.destroy();
  });
  req.on("error", () => {
    upstream.destroy();
  });
  req.pipe(upstream);
}
function proxyLoopbackUpgrade(req, socket, head, port, upstreamPath, cookie) {
  const lines = [
    `GET ${upstreamPath} HTTP/1.1`,
    `Host: 127.0.0.1:${String(port)}`,
    "Upgrade: websocket",
    "Connection: Upgrade"
  ];
  if (cookie !== void 0) lines.push(`Cookie: ${cookie}`);
  for (const name2 of WS_FORWARD_HEADERS) {
    const value = req.headers[name2];
    if (value === void 0) continue;
    lines.push(`${name2}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }
  const handshake = `${lines.join("\r\n")}\r
\r
`;
  const upstream = connect(port, "127.0.0.1");
  socket.setKeepAlive(true, 2e4);
  upstream.setKeepAlive(true, 2e4);
  const tearDown = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on("error", tearDown);
  socket.on("error", tearDown);
  upstream.on("close", () => {
    socket.destroy();
  });
  socket.on("close", () => {
    upstream.destroy();
  });
  upstream.on("connect", () => {
    upstream.write(handshake);
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
}

// packages/dsh-remote-web/src/http/remote-api.ts
var ALLOWED_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
function isSafeSegment(segment) {
  if (segment === "") return false;
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\") && !decoded.includes("\0");
}
function envelopeError(res, status, rpcId, code, message) {
  writeJson(res, status, {
    type: "server-response",
    rpcId,
    result: { ok: false, error: { code, message, details: { issues: [] } } }
  });
}
function innerPathOf(pathname) {
  if (pathname === REMOTE_PREFIX || pathname === `${REMOTE_PREFIX}/`) return void 0;
  if (!pathname.startsWith(`${REMOTE_PREFIX}/`)) return void 0;
  const rest = pathname.slice(REMOTE_PREFIX.length);
  if (!rest.startsWith("/")) return void 0;
  const segments = rest.slice(1).split("/");
  if (segments.length === 0 || segments.some((segment) => !isSafeSegment(segment))) {
    return void 0;
  }
  return rest;
}
function loopbackOnlyDenial(innerPath) {
  return localOnlyDenial(innerPath);
}
function pairedDeviceIdOf(req, service) {
  const cookieDevice = readCookie(req.headers.cookie, service.config.cookieName);
  const headerDevice = typeof req.headers[REMOTE_DEVICE_HEADER] === "string" ? req.headers[REMOTE_DEVICE_HEADER] : void 0;
  const id = cookieDevice ?? headerDevice;
  if (id === void 0) return void 0;
  return service.touchDevice(id) ? id : void 0;
}
function makeRemoteApiRoutes(deps) {
  const { service, port } = deps;
  const handler = (req, res) => {
    const paired = pairedDeviceIdOf(req, service);
    if (paired === void 0) {
      req.resume();
      envelopeError(res, 403, "invalid-request", "unpaired", "this device is not paired with the desktop");
      return;
    }
    const method = req.method ?? "GET";
    if (!ALLOWED_METHODS.has(method)) {
      req.resume();
      res.writeHead(405).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const inner = innerPathOf(url.pathname);
    if (inner === void 0) {
      req.resume();
      res.writeHead(404).end();
      return;
    }
    const denied = loopbackOnlyDenial(inner);
    if (denied !== void 0) {
      req.resume();
      envelopeError(res, 403, "invalid-request", "forbidden", denied);
      return;
    }
    proxyLoopbackHttp(req, res, port, `${inner}${url.search}`, deps.auth);
  };
  return [{ kind: "prefix", path: REMOTE_PREFIX, handler }];
}
function upgradeInnerPath(reqUrl, fallbackPath) {
  if (reqUrl === void 0 || reqUrl === "") return fallbackPath;
  let url;
  try {
    url = new URL(reqUrl, "http://127.0.0.1");
  } catch {
    return fallbackPath;
  }
  const inner = innerPathOf(url.pathname);
  if (inner === void 0) return fallbackPath;
  url.searchParams.delete(REMOTE_DEVICE_QUERY);
  return `${inner}${url.search}`;
}
function makeRemoteApiUpgradeRoutes(deps) {
  const { service, port } = deps;
  const handlerFor = (fallbackPath) => (req, socket, head) => {
    let queryDevice;
    try {
      queryDevice = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get(REMOTE_DEVICE_QUERY) ?? void 0;
    } catch {
    }
    const deviceId = pairedDeviceIdOf(req, service);
    const paired = deviceId ?? (queryDevice !== void 0 && service.touchDevice(queryDevice) ? queryDevice : void 0);
    if (paired === void 0) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const inner = upgradeInnerPath(req.url, fallbackPath);
    const denied = loopbackOnlyDenial(inner.split("?")[0] ?? inner);
    if (denied !== void 0) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    void Promise.resolve(deps.auth?.ready()).catch(() => void 0).then((cookie) => {
      if (socket.destroyed) return;
      proxyLoopbackUpgrade(req, socket, head, port, inner, typeof cookie === "string" ? cookie : void 0);
    });
  };
  return REMOTE_UPGRADE_PATHS.map((path) => ({
    path,
    handler: handlerFor(path.slice(REMOTE_PREFIX.length))
  }));
}

// packages/dsh-remote-web/src/pairing/remote-presence-pet.ts
var DEFAULT_RESTORE_AFTER_MS = 12e4;
var nodeTimers = { setTimeout, clearTimeout };
function startRemotePresencePet(deps) {
  const restoreAfterMs = deps.restoreAfterMs ?? DEFAULT_RESTORE_AFTER_MS;
  const timers = deps.timers ?? nodeTimers;
  let previousOnline = false;
  let hiddenByRemote = false;
  let restoreTimer;
  let disposed = false;
  const clearRestore = () => {
    if (restoreTimer !== void 0) {
      timers.clearTimeout(restoreTimer);
      restoreTimer = void 0;
    }
  };
  const scheduleRestore = () => {
    clearRestore();
    restoreTimer = timers.setTimeout(() => {
      restoreTimer = void 0;
      restoreAfterTick();
    }, restoreAfterMs);
  };
  const restoreAfterTick = () => {
    if (disposed || !hiddenByRemote) return;
    const pet = deps.pet();
    if (pet === void 0) return;
    hiddenByRemote = false;
    void pet.setVisible(true).catch(() => {
    });
  };
  const hideForRemote = () => {
    if (hiddenByRemote) return;
    const pet = deps.pet();
    if (pet === void 0) return;
    void pet.state().then(
      (value) => {
        if (disposed || hiddenByRemote) return;
        const visible = value.display?.visible;
        if (visible !== true) return;
        hiddenByRemote = true;
        return pet.setVisible(false).catch(() => {
          hiddenByRemote = false;
        });
      },
      () => {
      }
    );
  };
  const handle = (snapshot) => {
    const online = snapshot.phase === "connected" && snapshot.onlineCount > 0;
    if (online && !previousOnline) {
      cancelRestoreAndClear();
      hideForRemote();
    } else if (!online && previousOnline) {
      scheduleRestore();
    }
    previousOnline = online;
  };
  const cancelRestoreAndClear = () => {
    clearRestore();
  };
  const unsubscribe = deps.onState(handle);
  return () => {
    disposed = true;
    unsubscribe();
    clearRestore();
  };
}

// packages/dsh-remote-web/src/ingress/posture.ts
import http from "node:http";
function postureTargets(publicBaseUrl, lanAddresses, port) {
  const targets = [];
  if (publicBaseUrl !== void 0) {
    try {
      const url = new URL(publicBaseUrl);
      const authority = url.port === "" ? url.hostname : `${url.hostname}:${url.port}`;
      if (authority !== "") targets.push(authority);
    } catch {
    }
  }
  for (const address of lanAddresses) {
    targets.push(`${address}:${String(port)}`);
  }
  return [...new Set(targets)];
}
var defaultRequest = (options, onStatus) => {
  const request = http.request(options, (response) => {
    onStatus(response.statusCode ?? 0);
  });
  request.on("error", () => {
    onStatus(0);
  });
  return request;
};
async function probeHost(port, hostHeader, request, timeoutMs) {
  return await new Promise((resolve2) => {
    let settled = false;
    const finish = (exposed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handle.destroy();
      resolve2(exposed);
    };
    const handle = request({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: "/api/session.list",
      headers: { host: hostHeader, "content-type": "application/json" },
      timeout: timeoutMs
    }, (status) => {
      finish(status !== 403 && status !== 401);
    });
    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs + 1e3);
    handle.on("error", () => {
      finish(false);
    });
    handle.end("{}");
  });
}
async function probePosture(options) {
  const { port, targets } = options;
  const request = options.request ?? defaultRequest;
  const timeoutMs = options.timeoutMs ?? 3e3;
  const now = options.now ?? (() => Date.now());
  const hosts = [];
  for (const target of targets) {
    hosts.push({ host: target, exposed: await probeHost(port, target, request, timeoutMs) });
  }
  return { checkedAt: now(), hosts };
}
function claimPostureKey(current, key) {
  if (current === key) return { run: false, next: current };
  return { run: true, next: key };
}
function releasePostureKey(current, attempted) {
  return current === attempted ? void 0 : current;
}

// packages/dsh-remote-web/src/ingress/lan.ts
import { networkInterfaces } from "node:os";
function lanIPv4Addresses() {
  return Object.values(networkInterfaces()).flat().filter((iface) => {
    return iface !== void 0 && iface.family === "IPv4" && !iface.internal;
  }).map((iface) => iface.address);
}

// packages/dsh-remote-web/src/ingress/firewall.ts
import { spawnSync } from "node:child_process";
var FIREWALL_RULE_NAME = "remote-web-ui (auto)";
var spawnRunner = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    shell: false,
    encoding: "utf8",
    windowsHide: process.platform === "win32",
    timeout: 2e4
  });
  return {
    ok: result.status === 0,
    out: result.stdout ?? "",
    err: result.stderr ?? "",
    missing: result.error !== void 0
  };
};
function netshBackend(run) {
  const show = () => {
    const result = run("netsh", ["advfirewall", "firewall", "show", "rule", `name=${FIREWALL_RULE_NAME}`, "verbose"]);
    return result.ok && result.out.includes(FIREWALL_RULE_NAME);
  };
  return {
    label: "netsh",
    ruleExists: show,
    addRule: (port) => run("netsh", [
      "advfirewall",
      "firewall",
      "add",
      "rule",
      `name=${FIREWALL_RULE_NAME}`,
      "dir=in",
      "action=allow",
      "protocol=TCP",
      `localport=${String(port)}`,
      "profile=private,domain"
    ]).ok,
    removeRule: () => {
      if (!show()) return true;
      return run("netsh", ["advfirewall", "firewall", "delete", "rule", `name=${FIREWALL_RULE_NAME}`]).ok;
    }
  };
}
function firewalldBackend(run) {
  return {
    label: "firewalld",
    ruleExists: (port) => run("firewall-cmd", ["--permanent", "--query-port", `${String(port)}/tcp`]).ok,
    addRule: (port) => {
      const add = run("firewall-cmd", ["--permanent", "--add-port", `${String(port)}/tcp`]);
      const reload = run("firewall-cmd", ["--reload"]);
      return add.ok && reload.ok;
    },
    removeRule: (port) => {
      const del = run("firewall-cmd", ["--permanent", "--remove-port", `${String(port)}/tcp`]);
      const reload = run("firewall-cmd", ["--reload"]);
      return del.ok && reload.ok;
    }
  };
}
function ufwBackend(run) {
  return {
    label: "ufw",
    ruleExists: (port) => {
      const result = run("ufw", ["status"]);
      return result.ok && new RegExp(`(^|\\s)${String(port)}/tcp\\s+ALLOW`, "i").test(result.out);
    },
    addRule: (port) => run("ufw", ["allow", `${String(port)}/tcp`]).ok,
    removeRule: (port) => run("ufw", ["delete", "allow", `${String(port)}/tcp`]).ok
  };
}
function iptablesBackend(run) {
  const rule = (port) => ["INPUT", "-p", "tcp", "--dport", String(port), "-j", "ACCEPT"];
  return {
    label: "iptables",
    ruleExists: (port) => run("iptables", ["-C", ...rule(port)]).ok,
    addRule: (port) => run("iptables", ["-A", ...rule(port)]).ok,
    removeRule: (port) => run("iptables", ["-D", ...rule(port)]).ok
  };
}
function toolAvailable(run, cmd) {
  try {
    return run(cmd, ["--version"]).missing !== true;
  } catch {
    return false;
  }
}
function detectFirewallBackend(platform, run = spawnRunner) {
  if (platform === "win32") return netshBackend(run);
  if (platform !== "linux") return void 0;
  if (toolAvailable(run, "firewall-cmd")) {
    if (run("firewall-cmd", ["--state"]).ok) return firewalldBackend(run);
  }
  if (toolAvailable(run, "ufw")) return ufwBackend(run);
  if (toolAvailable(run, "iptables")) return iptablesBackend(run);
  return void 0;
}
var cachedBackend;
function firewallBackend() {
  const platform = process.platform;
  if (cachedBackend === void 0 || cachedBackend.platform !== platform) {
    cachedBackend = { platform, backend: detectFirewallBackend(platform) };
  }
  return cachedBackend.backend;
}
function ensureFirewallRule(port) {
  invalidateFirewallSummary();
  const backend = firewallBackend();
  if (backend === void 0) return true;
  backend.removeRule(port);
  return backend.addRule(port);
}
function removeFirewallRule(port) {
  invalidateFirewallSummary();
  const backend = firewallBackend();
  if (backend === void 0) return true;
  return backend.removeRule(port);
}
function computeFirewallSummary(port, lanEnabled, backend) {
  if (backend === void 0) return { ok: true, managed: false };
  return { ok: lanEnabled ? backend.ruleExists(port) : !backend.ruleExists(port), managed: true, note: backend.label };
}
var FIREWALL_SUMMARY_TTL_MS = 3e4;
var summaryCache;
function invalidateFirewallSummary() {
  summaryCache = void 0;
}
function firewallSummary(port, lanEnabled) {
  const key = `${String(port)}|${lanEnabled ? "1" : "0"}`;
  const now = Date.now();
  if (summaryCache !== void 0 && summaryCache.key === key && now - summaryCache.at < FIREWALL_SUMMARY_TTL_MS) {
    return summaryCache.value;
  }
  const value = computeFirewallSummary(port, lanEnabled, firewallBackend());
  summaryCache = { key, at: now, value };
  return value;
}

// packages/dsh-remote-web/src/ingress/lan-bind.ts
import { existsSync, mkdirSync as mkdirSync2, readFileSync as readFileSync2, renameSync as renameSync2, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join2, resolve, sep } from "node:path";
import { parseDocument } from "yaml";
var PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
var LAN_BIND_BLOCK_BEGIN = "# --- remote-web-ui lan-bind block (managed - do not edit) ---";
var LAN_BIND_BLOCK_END = "# --- end remote-web-ui lan-bind block ---";
function profilePatchFile(profile, home = dshHome()) {
  if (!PROFILE_PATTERN.test(profile)) {
    throw new Error(`remote-web-ui: unsafe lan-bind profile ${JSON.stringify(profile)}`);
  }
  const file = resolve(join2(home, "profiles", profile, "cordis.patch.yml"));
  const root = resolve(join2(home, "profiles")) + sep;
  if (!file.startsWith(root)) {
    throw new Error(`remote-web-ui: lan-bind profile ${JSON.stringify(profile)} escapes the profiles directory`);
  }
  return file;
}
function readPatchContent(file) {
  if (!existsSync(file)) return "";
  return readFileSync2(file, "utf8");
}
function blockItems(region) {
  const items = [];
  let start = -1;
  let offset = 0;
  for (const line of region.split("\n")) {
    if (line.startsWith("- ") || line === "-") {
      if (start !== -1) items.push({ start, end: offset, text: region.slice(start, offset) });
      start = offset;
    }
    offset += line.length + 1;
  }
  if (start !== -1) items.push({ start, end: region.length, text: region.slice(start) });
  return items;
}
function isManagedWebserverItem(item) {
  return /^- id:\s*['"]?webserver['"]?[ \t]*(?:\r?\n|$)/.test(item);
}
function managedRegion(content, begin, end) {
  const newlineAfterBegin = content.indexOf("\n", begin);
  const innerStart = newlineAfterBegin === -1 ? content.length : newlineAfterBegin + 1;
  const endLineStart = end === -1 ? content.length : content.lastIndexOf("\n", end - 1) + 1;
  return content.slice(innerStart, Math.max(innerStart, endLineStart));
}
function stripManagedBlock(content) {
  let text = content;
  for (; ; ) {
    const begin = text.indexOf(LAN_BIND_BLOCK_BEGIN);
    if (begin === -1) return text;
    const end = text.indexOf(LAN_BIND_BLOCK_END, begin);
    const blockStart = text.lastIndexOf("\n", begin - 1) + 1;
    const newlineAfterEnd = end === -1 ? -1 : text.indexOf("\n", end);
    const resumeAt = end === -1 ? text.length : newlineAfterEnd === -1 ? text.length : newlineAfterEnd + 1;
    const region = managedRegion(text, begin, end);
    let kept = "";
    let cursor = 0;
    for (const item of blockItems(region)) {
      if (!isManagedWebserverItem(item.text)) continue;
      kept += region.slice(cursor, item.start);
      cursor = item.end;
    }
    kept += region.slice(cursor);
    text = text.slice(0, blockStart) + kept + text.slice(resumeAt);
  }
}
function isFlowRoot(base) {
  return base.trimStart().startsWith("[");
}
function toBlockStyle(node) {
  if (typeof node !== "object" || node === null) return;
  const collection = node;
  if (!Array.isArray(collection.items) && typeof collection.flow !== "boolean") return;
  collection.flow = false;
  for (const item of collection.items ?? []) toBlockStyle(item);
}
function mergePatchContent(base, block, file) {
  if (base.length === 0) return block;
  if (!isFlowRoot(base)) return `${base}

${block}`;
  const doc = parseDocument(base, { uniqueKeys: false });
  if (doc.errors.length > 0 || doc.contents === null) {
    throw new Error(`remote-web-ui: cannot update the lan-bind block in ${file}: ${doc.errors[0]?.message ?? "the patch file is not a YAML document"}`);
  }
  if (!("items" in doc.contents)) {
    throw new Error(`remote-web-ui: cannot update the lan-bind block in ${file}: the patch file is not a top-level patch list`);
  }
  toBlockStyle(doc.contents);
  const rendered = doc.toString({ lineWidth: 0 }).trimEnd();
  return `${rendered}

${block}`;
}
function managedBlock(host, port) {
  return [
    LAN_BIND_BLOCK_BEGIN,
    "- id: webserver",
    "  name: '@deepseek-ai/dsh-host-webserver'",
    "  config:",
    `    host: '${host}'`,
    `    port: ${String(port)}`,
    "    compression: gzip",
    "    compressionLevel: 1",
    "    compressionThresholdBytes: 1024",
    LAN_BIND_BLOCK_END,
    ""
  ].join("\n");
}
function managedBindOf(content) {
  const begin = content.indexOf(LAN_BIND_BLOCK_BEGIN);
  if (begin === -1) return void 0;
  const end = content.indexOf(LAN_BIND_BLOCK_END, begin);
  const region = managedRegion(content, begin, end);
  const items = blockItems(region).filter((item) => isManagedWebserverItem(item.text));
  const scope = items.length > 0 ? items.map((item) => item.text).join("") : region;
  const hostMatch = /host:\s*'([^']+)'/.exec(scope);
  const portMatch = /port:\s*(\d+)/.exec(scope);
  return {
    host: hostMatch?.[1] ?? "",
    port: portMatch !== null ? Number(portMatch[1]) : void 0
  };
}
function lanBindState(profile, home = dshHome()) {
  const state = managedBindOf(readPatchContent(profilePatchFile(profile, home)));
  if (state === void 0) return { blockPresent: false };
  return { blockPresent: true, host: state.host, port: state.port };
}
function writeLanBind(host, port, profile, home = dshHome()) {
  const file = profilePatchFile(profile, home);
  const rawBase = stripManagedBlock(readPatchContent(file)).trimEnd();
  const base = rawBase.replace(/\[\s*\]\s*$/, "").trimEnd();
  const block = managedBlock(host, port);
  const content = mergePatchContent(base, block, file);
  const mode = existsSync(file) ? statSync(file).mode & 511 : 384;
  mkdirSync2(dirname2(file), { recursive: true });
  const temp = `${file}.remote-web-ui-tmp-${process.pid.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  writeFileSync2(temp, content, { mode });
  renameSync2(temp, file);
}

// packages/dsh-remote-web/src/ingress/tunnel-plan.ts
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}
function tunnelPlanOf(value, port) {
  if (value.autoTunnel === true) {
    const ignored = [];
    if (value.tunnelToken !== void 0 && value.tunnelToken !== "") ignored.push("tunnelToken");
    if (value.publicBaseUrl !== void 0 && value.publicBaseUrl !== "") ignored.push("publicBaseUrl");
    return { mode: "quick", targetUrl: `http://127.0.0.1:${String(port)}`, ignored };
  }
  if (value.tunnelToken !== void 0 && value.tunnelToken !== "") {
    if (value.publicBaseUrl !== void 0 && isHttpUrl(value.publicBaseUrl)) {
      return { mode: "named", token: value.tunnelToken, publicUrl: value.publicBaseUrl };
    }
    return { mode: "off" };
  }
  return { mode: "off" };
}

// packages/dsh-remote-web/src/ingress/relay-registry.ts
import { randomBytes as randomBytes3 } from "node:crypto";
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join3 } from "node:path";
var RELAY_REGISTER_URL = "https://dsh-market.com/api/relay/register";
var RELAY_UNREGISTER_URL = "https://dsh-market.com/api/relay/unregister";
var RELAY_BASE_SUFFIX = ".dsh-market.com";
var RELAY_ID_RE = /^[a-z0-9]{16}$/;
var RELAY_SECRET_RE = /^[A-Za-z0-9_-]{43}$/;
function relayIdentityFile(profile, home = dshHome()) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile)) {
    throw new Error(`relay registry: profile ${JSON.stringify(profile)} is not a safe path segment`);
  }
  return join3(home, "dsh-web-pack", "remote-web", "registry", `${profile}.json`);
}
function generateRelayIdentity(random = randomBytes3) {
  return {
    id: random(8).toString("hex"),
    secret: random(32).toString("base64url"),
    fresh: true
  };
}
function loadRelayIdentity(profile, home = dshHome(), random = randomBytes3) {
  const file = relayIdentityFile(profile, home);
  try {
    if (existsSync2(file)) {
      const parsed = JSON.parse(readFileSync3(file, "utf8"));
      if (typeof parsed.id === "string" && RELAY_ID_RE.test(parsed.id) && typeof parsed.secret === "string" && RELAY_SECRET_RE.test(parsed.secret)) {
        return { id: parsed.id, secret: parsed.secret };
      }
      console.warn(`relay registry: ${file} is malformed \u2014 reminting the identity (paired devices must scan the QR once more)`);
    }
  } catch (error) {
    console.warn(`relay registry: could not read ${file} (${error instanceof Error ? error.message : String(error)}) \u2014 reminting`);
  }
  const identity = generateRelayIdentity(random);
  mkdirSync3(dirname3(file), { recursive: true });
  writeFileSync3(file, JSON.stringify({ id: identity.id, secret: identity.secret }, null, 2) + "\n", { mode: 384 });
  return identity;
}
function registrationBody(identity, target) {
  return JSON.stringify({
    id: identity.id,
    secret: identity.secret,
    new_secret: identity.fresh === true ? identity.secret : void 0,
    target
  });
}
async function unregisterRelay(identity, endpoint = RELAY_UNREGISTER_URL, fetchFn = fetch) {
  await fetchFn(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: identity.id, secret: identity.secret })
  });
}
function relayBaseOf(identity) {
  return `https://${identity.id}${RELAY_BASE_SUFFIX}`;
}
var RelayRegistrar = class {
  constructor(identity, setState, options = {}) {
    this.identity = identity;
    this.setState = setState;
    this.options = options;
  }
  identity;
  setState;
  options;
  timer;
  attempts = 0;
  lastError;
  disposed = false;
  /** The stable relay base for the QR while registered. */
  get baseUrl() {
    return relayBaseOf(this.identity);
  }
  /** The last registration failure detail (undefined while healthy). */
  get error() {
    return this.lastError;
  }
  /** Push one tunnel target; resolves the stable base once accepted. */
  async announce(target) {
    if (this.disposed) return void 0;
    if (this.timer !== void 0) {
      clearTimeout(this.timer);
      this.timer = void 0;
    }
    this.setState({ state: "registering" });
    try {
      const fetchFn = this.options.fetchFn ?? fetch;
      const response = await fetchFn(this.options.registerUrl ?? RELAY_REGISTER_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: registrationBody(this.identity, target)
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => void 0);
        const error = detail && typeof detail.error === "string" ? detail.error : `HTTP ${String(response.status)}`;
        throw new Error(error);
      }
      this.identity.fresh = false;
      this.attempts = 0;
      this.lastError = void 0;
      this.setState({ state: "running", url: this.baseUrl });
      return this.baseUrl;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (this.lastError === "invalid-params" && this.identity.fresh !== true) {
        this.identity.fresh = true;
      }
      this.setState({ state: "failed", error: this.lastError });
      this.scheduleRetry(target);
      return void 0;
    }
  }
  /** Best-effort removal of the registry row (the relay toggle turned off). */
  async unregister() {
    await unregisterRelay(this.identity, this.options.unregisterUrl, this.options.fetchFn);
  }
  scheduleRetry(target) {
    if (this.disposed) return;
    const base = this.options.baseDelayMs ?? 5e3;
    const max = this.options.maxDelayMs ?? 6e4;
    const delay = Math.min(base * 2 ** this.attempts, max);
    this.attempts += 1;
    const timerFn = this.options.timerFn ?? ((fn, ms) => {
      const timer = setTimeout(fn, ms);
      timer.unref?.();
      return timer;
    });
    this.timer = timerFn(() => {
      this.timer = void 0;
      void this.announce(target);
    }, delay);
  }
  /** Stop retrying and clear the card state (tunnel stopped or disabled). */
  dispose() {
    this.disposed = true;
    if (this.timer !== void 0) {
      clearTimeout(this.timer);
      this.timer = void 0;
    }
    this.setState({ state: "off" });
  }
};

// packages/dsh-remote-web/src/ingress/lan-bind-plan.ts
function desiredBindHost(lanBind, startupHost) {
  if (startupHost === "0.0.0.0" || startupHost === "127.0.0.1") return startupHost;
  return lanBind ? "0.0.0.0" : "127.0.0.1";
}
function desiredBindPort(startupPort, livePort) {
  if (typeof startupPort === "number" && Number.isFinite(startupPort)) return startupPort;
  return typeof livePort === "number" && Number.isFinite(livePort) ? livePort : void 0;
}
function pendingRestartOf(lanBind, desiredHost, liveHost) {
  if (lanBind === void 0 || desiredHost === void 0) return false;
  return liveHost !== desiredHost;
}
var DEFAULT_MANAGED_PROFILE = "web";
function resolveManagedProfile(configured, launched, env) {
  return configured ?? launched ?? env ?? DEFAULT_MANAGED_PROFILE;
}
function firewallActionNeeded(previous, next) {
  if (next === void 0) return false;
  if (previous === void 0) return true;
  return previous.enabled !== next.enabled || previous.port !== next.port;
}

// packages/dsh-remote-web/src/http/inner-auth.ts
var BROWSER_AUTH_COOKIE_PREFIX = "dsh-auth-";
function createInnerAuth(launchUrl, fetchImpl = fetch) {
  let cached;
  let inflight;
  const redeem = async () => {
    const url = launchUrl();
    if (url === void 0) return void 0;
    try {
      const response = await fetchImpl(url, { redirect: "manual" });
      const raw = response.headers.get("set-cookie");
      if (raw === null) return void 0;
      const entry = raw.split(",").map((part) => part.trim()).find((part) => part.startsWith(BROWSER_AUTH_COOKIE_PREFIX));
      if (entry === void 0) return void 0;
      const pair = entry.split(";")[0]?.trim();
      return pair !== void 0 && pair.includes("=") ? pair : void 0;
    } catch {
      return void 0;
    }
  };
  return {
    ready() {
      if (cached !== void 0) return Promise.resolve(cached);
      inflight ??= redeem().then((value) => {
        if (value !== void 0) cached = value;
        inflight = void 0;
        return value;
      }, () => {
        inflight = void 0;
        return void 0;
      });
      return inflight;
    },
    invalidate() {
      cached = void 0;
    }
  };
}

// packages/dsh-remote-web/src/ingress/tunnel.ts
import { existsSync as existsSync4 } from "node:fs";
import { spawn as spawn2 } from "node:child_process";
import { EventEmitter as EventEmitter2 } from "node:events";

// packages/dsh-remote-web/src/ingress/cloudflared.ts
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, existsSync as existsSync3, mkdirSync as mkdirSync4, renameSync as renameSync3, rmSync as rmSync2 } from "node:fs";
import { createWriteStream } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname4, isAbsolute as isAbsolute2, join as join4 } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
var CLOUDFLARED_VERSION = "2026.10.7";
var BINARY_OVERRIDE_ENV = "DSH_REMOTE_CLOUDFLARED_BIN";
var RELEASE_ASSETS = {
  "win32-x64": { name: "cloudflared-windows-amd64.exe", compressed: false },
  "win32-arm64": { name: "cloudflared-windows-arm64.exe", compressed: false },
  "linux-x64": { name: "cloudflared-linux-amd64", compressed: false },
  "linux-arm64": { name: "cloudflared-linux-arm64", compressed: false },
  "linux-arm": { name: "cloudflared-linux-arm", compressed: false },
  "darwin-x64": { name: "cloudflared-darwin-amd64.tgz", compressed: true },
  "darwin-arm64": { name: "cloudflared-darwin-arm64.tgz", compressed: true }
};
function dshHome2(env = process.env, home = homedir2()) {
  const raw = env.DSH_HOME;
  return raw !== void 0 && raw.trim() !== "" ? raw.trim() : join4(home, ".dsh");
}
function cloudflaredBinaryPath(env = process.env, home = homedir2()) {
  const override = env[BINARY_OVERRIDE_ENV];
  if (override !== void 0 && override.trim() !== "") {
    const value = override.trim();
    return isAbsolute2(value) ? value : join4(process.cwd(), value);
  }
  return join4(dshHome2(env, home), "dsh-web-pack", "remote-web", "bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
}
function releaseAsset(platform, arch) {
  const asset = RELEASE_ASSETS[`${platform}-${arch}`];
  if (asset === void 0) {
    throw new Error(`cloudflared: no release asset for ${platform}/${arch}`);
  }
  return asset;
}
function assetUrl(version, name2) {
  return `https://github.com/cloudflare/cloudflared/releases/download/${version}/${name2}`;
}
function cloudflaredVersion(binary) {
  return new Promise((resolve2) => {
    execFile(binary, ["--version"], { timeout: 1e4, windowsHide: true }, (error, stdout, stderr) => {
      if (error !== null) {
        resolve2(void 0);
        return;
      }
      const match = /cloudflared version (\S+)/.exec(`${stdout}
${stderr}`);
      resolve2(match?.[1]);
    });
  });
}
async function downloadCloudflared(options) {
  const version = options.version ?? CLOUDFLARED_VERSION;
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const fetcher = options.fetch ?? fetch;
  const asset = releaseAsset(platform, arch);
  const url = assetUrl(version, asset.name);
  const log = options.log ?? (() => {
  });
  mkdirSync4(dirname4(options.path), { recursive: true });
  const downloadPath = `${options.path}.download`;
  log(`downloading ${url}`);
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok || response.body === null) {
    throw new Error(`cloudflared: download failed (${response.status} ${response.statusText})`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(downloadPath));
  let binary = downloadPath;
  if (asset.compressed) {
    const extracted = `${downloadPath}.bin`;
    await new Promise((resolve2, reject) => {
      execFile("tar", ["-xzf", downloadPath, "-C", dirname4(options.path), "cloudflared"], { windowsHide: true }, (error) => {
        if (error !== null) reject(error);
        else resolve2();
      });
    });
    renameSync3(join4(dirname4(options.path), "cloudflared"), extracted);
    rmSync2(downloadPath, { force: true });
    binary = extracted;
  }
  if (platform !== "win32") chmodSync(binary, 493);
  renameSync3(binary, options.path);
  return options.path;
}
async function ensureCloudflaredBinary(options = {}) {
  const path = options.path ?? cloudflaredBinaryPath();
  const version = options.version ?? CLOUDFLARED_VERSION;
  if (existsSync3(path)) {
    const running = await cloudflaredVersion(path);
    if (running === version) return path;
  }
  await downloadCloudflared({ ...options, path, version });
  const installed = await cloudflaredVersion(path);
  if (installed !== version) {
    throw new Error(`cloudflared: ${path} reports ${installed ?? "no version"} after the download, expected ${version}`);
  }
  return path;
}
var QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
var NAMED_CONNECTED = /Registered tunnel connection/;
function spawnCloudflared(binary, args, options = {}) {
  const log = options.log ?? (() => {
  });
  const child = spawn(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, ...options.env }
  });
  const handle = new EventEmitter();
  let announced = false;
  const scan = (chunk) => {
    const text = chunk.toString();
    for (const line of text.split("\n")) {
      if (line.trim() !== "") log(line.trim());
    }
    if (announced) return;
    const quick = QUICK_URL.exec(text);
    if (quick !== null) {
      announced = true;
      handle.emit("url", quick[0]);
      return;
    }
    if (NAMED_CONNECTED.test(text)) {
      announced = true;
      handle.emit("connected");
    }
  };
  child.stdout?.on("data", scan);
  child.stderr?.on("data", scan);
  child.once("exit", (code, signal) => {
    handle.emit("exit", code, signal);
  });
  child.once("error", (error) => {
    handle.emit("error", error);
  });
  handle.stop = () => child.kill();
  return handle;
}
function spawnQuickTunnel(binary, targetUrl, flags = {}, log) {
  const args = ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", targetUrl];
  for (const [flag, value] of Object.entries(flags)) {
    if (value === false) continue;
    args.push(flag);
    if (value !== true) args.push(value);
  }
  return spawnCloudflared(binary, args, { log });
}
function spawnNamedTunnel(binary, token, log) {
  return spawnCloudflared(binary, ["tunnel", "--no-autoupdate", "--protocol", "http2", "run"], {
    env: { TUNNEL_TOKEN: token },
    log
  });
}

// packages/dsh-remote-web/src/ingress/tunnel.ts
function sameTarget(left, right) {
  if (left === void 0) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}
function namedTunnelHandle(inner, publicUrl) {
  const handle = new EventEmitter2();
  let registered = false;
  const onConnected = () => {
    if (registered) return;
    registered = true;
    handle.emit("url", publicUrl);
  };
  const onExit = (code, signal) => {
    handle.emit("exit", code, signal);
  };
  const onError = (value) => {
    handle.emit("error", value);
  };
  inner.on("connected", onConnected);
  inner.on("exit", onExit);
  inner.on("error", onError);
  handle.stop = () => {
    inner.off("connected", onConnected);
    inner.off("exit", onExit);
    inner.off("error", onError);
    return inner.stop();
  };
  return handle;
}
async function probeTunnelUrl(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal
    });
    await response.body?.cancel().catch(() => void 0);
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function defaultProbe(url, timeoutMs) {
  return await probeTunnelUrl(url, timeoutMs);
}
var BINARY_PROBE_TIMEOUT_MS = 1e4;
function binaryRuns(executable) {
  return new Promise((resolvePromise) => {
    const child = spawn2(executable, ["--version"], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolvePromise(false);
    }, BINARY_PROBE_TIMEOUT_MS);
    child.once("error", () => {
      clearTimeout(timer);
      resolvePromise(false);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolvePromise(code === 0);
    });
  });
}
function createBinaryReadiness(executable, seams = {}) {
  const exists = seams.exists ?? existsSync4;
  const runs = seams.runs ?? binaryRuns;
  const installBinary = seams.install ?? ((path) => ensureCloudflaredBinary({ path }));
  const validated = /* @__PURE__ */ new Set();
  let installs = 0;
  let lastFailure;
  return async () => {
    if (validated.has(executable)) return;
    if (installs >= MAX_BINARY_INSTALL_ATTEMPTS && lastFailure !== void 0) throw lastFailure;
    if (exists(executable) && await runs(executable)) {
      validated.add(executable);
      return;
    }
    installs += 1;
    try {
      await installBinary(executable);
      if (!await runs(executable)) {
        throw new Error(`the cloudflared binary at ${executable} still does not run after the reinstall`);
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error : new Error(String(error));
      throw lastFailure;
    }
    validated.add(executable);
  };
}
var MAX_BINARY_INSTALL_ATTEMPTS = 3;
var DEFAULT_HEALTH_CHECK_INTERVAL_MS = 6e4;
var DEFAULT_HEALTH_CHECK_FAILURES = 2;
var DEFAULT_PROBE_TIMEOUT_MS = 1e4;
var defaultBinaryReadiness = createBinaryReadiness(cloudflaredBinaryPath());
async function defaultEnsureBinary() {
  await defaultBinaryReadiness();
}
var SHARED_TUNNEL_FLAGS = { "--no-autoupdate": true, "--protocol": "http2" };
function quickTunnelFlags(originHostHeader) {
  return originHostHeader === void 0 ? { ...SHARED_TUNNEL_FLAGS } : { ...SHARED_TUNNEL_FLAGS, "--http-host-header": originHostHeader };
}
function defaultFactory(target) {
  const binary = cloudflaredBinaryPath();
  if (target.kind === "quick") {
    return spawnQuickTunnel(binary, target.targetUrl, quickTunnelFlags(target.originHostHeader));
  }
  return namedTunnelHandle(spawnNamedTunnel(binary, target.token), target.publicUrl);
}
var nodeTimer = { setTimeout, clearTimeout };
var TunnelManager = class {
  factory;
  ensureBinary;
  urlTimeoutMs;
  restartBaseMs;
  restartMaxMs;
  timer;
  probe;
  healthCheckIntervalMs;
  healthCheckFailures;
  probeTimeoutMs;
  phase = "stopped";
  url;
  error;
  target;
  handle;
  urlTimer;
  restartTimer;
  healthTimer;
  healthFailures = 0;
  attempts = 0;
  // Generation counter: a stale ensureBinary resolution from an earlier
  // start() must not spawn a second handle after a stop/start cycle.
  generation = 0;
  stopping = false;
  urlListeners = /* @__PURE__ */ new Set();
  phaseListeners = /* @__PURE__ */ new Set();
  /**
   * @param options - seams; defaults spawn the real quick tunnel.
   */
  constructor(options = {}) {
    this.factory = options.factory ?? defaultFactory;
    this.ensureBinary = options.ensureBinary ?? defaultEnsureBinary;
    this.urlTimeoutMs = options.urlTimeoutMs ?? 3e4;
    this.restartBaseMs = options.restartBaseMs ?? 5e3;
    this.restartMaxMs = options.restartMaxMs ?? 6e4;
    this.timer = options.timer ?? nodeTimer;
    this.probe = options.probe ?? defaultProbe;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this.healthCheckFailures = options.healthCheckFailures ?? DEFAULT_HEALTH_CHECK_FAILURES;
    this.probeTimeoutMs = options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  }
  /** The current status frame. */
  get info() {
    return {
      phase: this.phase,
      ...this.url !== void 0 ? { url: this.url } : {},
      ...this.error !== void 0 ? { error: this.error } : {}
    };
  }
  /**
   * Start (or keep) a tunnel toward `target`. Restarting with a different
   * target tears the old tunnel down first; restarting with the same target
   * while running is a no-op. A string is the quick mode's local target URL.
   *
   * In quick mode the URL surfaces when cloudflared mints the ephemeral
   * trycloudflare hostname; in named mode the fixed `publicUrl` surfaces
   * once the first edge connection registers (see {@link namedTunnelHandle}).
   * @param target - what to run (a string means quick toward that local URL).
   */
  start(target) {
    const resolved = typeof target === "string" ? { kind: "quick", targetUrl: target } : target;
    if (sameTarget(this.target, resolved) && (this.phase === "starting" || this.phase === "running")) return;
    this.teardown();
    this.stopping = false;
    this.target = resolved;
    this.attempts = 0;
    this.generation += 1;
    this.attempt();
  }
  /** Stop the tunnel for good: no restarts, no state. */
  stop() {
    this.teardown();
    this.stopping = false;
    this.target = void 0;
    this.setPhase("stopped");
  }
  /** Alias of {@link stop} for plugin-effect disposal. */
  dispose() {
    this.stop();
  }
  /** Subscribe to minted tunnel URLs (fire-and-forget duplicates dropped). */
  onUrl(listener) {
    this.urlListeners.add(listener);
    return () => {
      this.urlListeners.delete(listener);
    };
  }
  /** Subscribe to every phase change. */
  onPhase(listener) {
    this.phaseListeners.add(listener);
    return () => {
      this.phaseListeners.delete(listener);
    };
  }
  attempt() {
    if (this.stopping || this.target === void 0) return;
    const gen = this.generation;
    this.setPhase("starting");
    this.handle = void 0;
    this.url = void 0;
    this.error = void 0;
    void this.ensureBinary().then(() => {
      if (this.stopping || this.target === void 0 || gen !== this.generation) return;
      const handle = this.factory(this.target);
      this.handle = handle;
      this.urlTimer = this.timer.setTimeout(() => {
        this.fail("timed out waiting for the tunnel URL");
      }, this.urlTimeoutMs);
      handle.on("url", (value) => {
        if (this.handle !== handle) return;
        this.handleUrl(value);
      });
      handle.on("exit", () => {
        if (this.handle !== handle) return;
        this.handleExit();
      });
      handle.on("error", (value) => {
        if (this.handle !== handle || this.phase !== "starting") return;
        this.error = value instanceof Error ? value.message : String(value);
      });
    }).catch((value) => {
      if (this.stopping || this.target === void 0 || gen !== this.generation) return;
      const message = value instanceof Error ? value.message : String(value);
      this.fail(`could not obtain the cloudflared binary: ${message}`);
    });
  }
  handleUrl(value) {
    if (this.urlTimer !== void 0) {
      this.timer.clearTimeout(this.urlTimer);
      this.urlTimer = void 0;
    }
    this.url = value;
    this.error = void 0;
    this.attempts = 0;
    this.setPhase("running");
    this.startHealthWatch(value);
    for (const listener of this.urlListeners) {
      try {
        listener(value);
      } catch {
      }
    }
  }
  /**
   * Watch the readiness of a running tunnel. cloudflared can keep its process
   * (and its metrics port) alive while every edge connection is gone, leaving
   * a minted hostname that no longer resolves: the manager used to report
   * 'running' forever and the relay kept forwarding to that dead address, so
   * the phone hit Cloudflare 1016 instead of the relay's offline page
   * (issue #1723). A bounded number of consecutive probe failures ends the
   * attempt through the ordinary fail/backoff path, which mints a new URL and
   * re-announces the relay.
   */
  startHealthWatch(url) {
    this.stopHealthWatch();
    if (this.stopping || this.phase !== "running") return;
    if (this.healthCheckIntervalMs <= 0 || this.healthCheckFailures <= 0) return;
    this.healthFailures = 0;
    const schedule = () => {
      this.healthTimer = this.timer.setTimeout(() => {
        this.healthTimer = void 0;
        void this.healthCheck(url);
      }, this.healthCheckIntervalMs);
    };
    schedule();
  }
  /** One probe round of the running tunnel's public URL. */
  async healthCheck(url) {
    if (this.stopping || this.phase !== "running" || this.url !== url) return;
    let alive = false;
    try {
      alive = await this.probe(url, this.probeTimeoutMs);
    } catch {
      alive = false;
    }
    if (this.stopping || this.phase !== "running" || this.url !== url) return;
    if (alive) {
      this.healthFailures = 0;
    } else {
      this.healthFailures += 1;
      if (this.healthFailures >= this.healthCheckFailures) {
        this.fail("the tunnel stopped answering on its public URL");
        return;
      }
    }
    this.healthTimer = this.timer.setTimeout(() => {
      this.healthTimer = void 0;
      void this.healthCheck(url);
    }, this.healthCheckIntervalMs);
  }
  /** Cancel the readiness watchdog (teardown, restart, stop). */
  stopHealthWatch() {
    if (this.healthTimer !== void 0) {
      this.timer.clearTimeout(this.healthTimer);
      this.healthTimer = void 0;
    }
    this.healthFailures = 0;
  }
  handleExit() {
    if (this.stopping) return;
    this.fail("the tunnel process exited unexpectedly");
  }
  fail(message) {
    if (this.stopping) return;
    this.url = void 0;
    this.error = message;
    if (this.handle !== void 0) {
      this.handle.stop();
      this.handle = void 0;
    }
    if (this.urlTimer !== void 0) {
      this.timer.clearTimeout(this.urlTimer);
      this.urlTimer = void 0;
    }
    this.stopHealthWatch();
    this.setPhase("failed");
    this.attempts += 1;
    const delay = Math.min(this.restartBaseMs * 2 ** (this.attempts - 1), this.restartMaxMs);
    this.restartTimer = this.timer.setTimeout(() => {
      this.restartTimer = void 0;
      this.attempt();
    }, delay);
  }
  /** Stop the current process and cancel every pending timer (no phase change). */
  teardown() {
    this.stopping = true;
    this.stopHealthWatch();
    if (this.urlTimer !== void 0) {
      this.timer.clearTimeout(this.urlTimer);
      this.urlTimer = void 0;
    }
    if (this.restartTimer !== void 0) {
      this.timer.clearTimeout(this.restartTimer);
      this.restartTimer = void 0;
    }
    if (this.handle !== void 0) {
      this.handle.stop();
      this.handle = void 0;
    }
  }
  setPhase(phase) {
    this.phase = phase;
    const info = this.info;
    for (const listener of this.phaseListeners) {
      try {
        listener(info);
      } catch {
      }
    }
  }
};

// packages/dsh-remote-web/src/ingress/public-base.ts
var PUBLIC_BASE_GRACE_MS = 6e4;
var PublicBaseKeeper = class {
  /**
   * @param onChange - receives the base the fence should trust from now on.
   * @param graceMs - how long a quick-tunnel host outlives its tunnel.
   */
  constructor(onChange, graceMs = PUBLIC_BASE_GRACE_MS) {
    this.onChange = onChange;
    this.graceMs = graceMs;
  }
  onChange;
  graceMs;
  mode = "off";
  tunnelUrl;
  relayUrl;
  graceTimer;
  /** The base a fresh fence read should trust: the stable relay origin wins. */
  current() {
    return this.relayUrl ?? this.tunnelUrl;
  }
  /** The mode that currently owns the public base. */
  setMode(mode) {
    this.mode = mode;
  }
  /** The last quick-tunnel URL, for callers that must announce it downstream. */
  quickUrl() {
    return this.tunnelUrl;
  }
  /** A relay registration result; undefined withdraws the stable origin. */
  setRelay(url) {
    this.relayUrl = url;
    this.emit();
  }
  /** The tunnel reported a live URL: it supersedes any pending grace. */
  markRunning(url) {
    this.cancelGrace();
    this.tunnelUrl = url;
    this.emit();
  }
  /**
   * The tunnel left `running` (starting again, or failed). A named tunnel's
   * fixed hostname stays trusted; a quick tunnel's previous host stays
   * trusted for the grace window, then is dropped if nothing replaced it.
   */
  markReconnecting() {
    if (this.mode === "named") return;
    this.startGrace();
  }
  /** Re-publish the current base after a branch change that did not move it. */
  refresh() {
    this.emit();
  }
  /** Forget everything (teardown, or a mode change that stops the tunnel). */
  reset() {
    this.cancelGrace();
    this.tunnelUrl = void 0;
    this.relayUrl = void 0;
    this.emit();
  }
  /** Cancel the pending grace timer; the keeper keeps its last base. */
  dispose() {
    this.cancelGrace();
  }
  startGrace() {
    if (this.tunnelUrl === void 0) return;
    if (this.graceTimer !== void 0) return;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = void 0;
      this.tunnelUrl = void 0;
      this.emit();
    }, this.graceMs);
  }
  cancelGrace() {
    if (this.graceTimer === void 0) return;
    clearTimeout(this.graceTimer);
    this.graceTimer = void 0;
  }
  emit() {
    this.onChange(this.current());
  }
};

// packages/dsh-remote-web/src/lifecycle/mount-once.ts
var MOUNTED = /* @__PURE__ */ Symbol.for("dsh-web.mounted-plugins");
var WAITERS = /* @__PURE__ */ Symbol.for("dsh-web.mounted-plugins.waiters");
function mountedSet() {
  const registry = globalThis;
  const existing = registry[MOUNTED];
  if (existing instanceof Set) return existing;
  const created = /* @__PURE__ */ new Set();
  registry[MOUNTED] = created;
  return created;
}
function mountWaiters() {
  const registry = globalThis;
  return registry[WAITERS] ??= /* @__PURE__ */ new Map();
}
function mountOnce(packageName, fn) {
  const mount = (...args) => {
    const mounted = mountedSet();
    const ctx = args[0];
    if (mounted.has(packageName)) {
      const waiters = mountWaiters();
      const queue = waiters.get(packageName) ?? [];
      let alive = true;
      const pending = {
        run: () => {
          if (alive) mount(...args);
        }
      };
      ctx?.effect?.(() => () => {
        alive = false;
        const index = queue.indexOf(pending);
        if (index >= 0) queue.splice(index, 1);
      });
      queue.push(pending);
      waiters.set(packageName, queue);
      return;
    }
    mounted.add(packageName);
    ctx?.effect?.(() => () => {
      mounted.delete(packageName);
      const waiters = mountWaiters();
      const queue = waiters.get(packageName);
      if (queue === void 0) return;
      waiters.delete(packageName);
      for (const waiter of queue.splice(0)) queueMicrotask(() => {
        waiter.run();
      });
    });
    return fn(...args);
  };
  return mount;
}

// packages/dsh-remote-web/src/lifecycle/detached-work.ts
import { AsyncResource } from "node:async_hooks";
var DETACHED = new AsyncResource("dsh-web:detached-work", { triggerAsyncId: 0 });
function runDetached(work) {
  return DETACHED.runInAsyncScope(work);
}

// packages/dsh-remote-web/src/http/remote-channel-boot.ts
function buildRemoteChannelBootScript(rules = REMOTE_CHANNEL_RULES) {
  const json = JSON.stringify(rules);
  const seat = JSON.stringify(REMOTE_CHANNEL_BOOT_GLOBAL);
  return "(function(){try{var w=window,loc=w.location,h=loc.hostname;var R=" + json + `;if(h==='localhost'||h==='::1'||h==='[::1]'||/^127(\\.\\d{1,3}){3}$/.test(h))return;var pr=loc.protocol;if(typeof pr==="string"&&pr!==""&&R.webProtocols.indexOf(pr)===-1)return;try{if(w.__DSH_TRANSPORT__&&w.__DSH_TRANSPORT__.ownsHost===true&&h.indexOf(".")===-1&&h.indexOf(":")===-1)return}catch(e){}try{if(w[R.hostGrantGlobal]===true){if(w.__DSH_TRANSPORT__===undefined)w.__DSH_TRANSPORT__={};w.__DSH_TRANSPORT__.ownsHost=true}}catch(e){}function rdv(){try{return w.sessionStorage.getItem(R.deviceKey)}catch(e){return null}}function att(init){var dv=rdv();if(dv===null)return init;var h=init&&init.headers;if(typeof Headers!=="undefined"&&h instanceof Headers){try{h.set(R.deviceHeader,dv)}catch(e){}return init}if(typeof h==="object"&&h!==null){var o={};for(var k in h)o[k]=h[k];o[R.deviceHeader]=dv;return Object.assign({},init,{headers:o})}return init}function sf(p){if(p.indexOf(R.pairPrefix)===0)return false;if(p.indexOf(R.updatePrefix)===0)return false;if(p===R.settingsBridgePrefix||p.indexOf(R.settingsBridgePrefix+"/")===0)return false;if(p.indexOf(R.apiPrefix)===0)return true;if(p.indexOf(R.sidebarPrefix)===0||p==="/sidebar")return true;if(p.indexOf(R.gitPrefix)===0||p==="/git")return true;if(p.indexOf(R.petPrefix)===0||p==="/pet")return true;return false}function sw(p){return R.wsPaths.indexOf(p)!==-1}function rp(p){return R.remotePrefix+p}function so(u){return u.origin===loc.origin}function rr(raw){var u;try{u=new URL(raw,loc.href)}catch(e){return raw}if(u.origin!==loc.origin)return raw;if(!sf(u.pathname))return raw;u.pathname=rp(u.pathname);if(raw.charAt(0)==="/"&&raw.charAt(1)!=="/")return u.pathname+u.search+u.hash;return u.href}function uc(v){if(typeof v!=="object"||v===null)return undefined;var n=v.result;if(typeof n==="object"&&n!==null){var e=n.error;if(typeof e==="object"&&e!==null&&typeof e.code==="string")return e.code}var t=v.error;if(typeof t==="object"&&t!==null&&typeof t.code==="string")return t.code;return undefined}var seat={onUnpaired:null,onPaired:null,pendingUnpaired:false,restore:function(){}};function denied(res){if(res.status!==403)return false;return res.clone().json().then(function(b){return uc(b)==="unpaired"}).catch(function(){return false})}function signal(unpaired){if(unpaired){if(seat.onUnpaired)seat.onUnpaired();else seat.pendingUnpaired=true}else{seat.pendingUnpaired=false;if(seat.onPaired)seat.onPaired()}}var of=w.fetch;w.fetch=function(input,init){var raw=typeof input==="string"||input instanceof URL?input.toString():input.url;var url=new URL(raw,loc.href);if(so(url)&&sf(url.pathname)){var next=new URL(url);next.pathname=rp(url.pathname);var target=typeof input==="string"||input instanceof URL?next.toString():new Request(next,input);return Promise.resolve(of.call(w,target,att(init))).then(function(res){void Promise.resolve(denied(res)).then(signal);return res})}return of.call(w,input,init)};var OW=w.WebSocket;w.WebSocket=function(url,protocols){var p=new URL(url.toString(),loc.href);var o=p.protocol==="wss:"?"https://"+p.host:p.protocol==="ws:"?"http://"+p.host:"";if(o!==""&&o===loc.origin&&sw(p.pathname)){var nx=new URL(p);nx.pathname=rp(p.pathname);var dvv=rdv();if(dvv!==null)nx.searchParams.set(R.deviceQuery,dvv);return protocols!==undefined?new OW(nx,protocols):new OW(nx)}return protocols!==undefined?new OW(url,protocols):new OW(url)};w.WebSocket.prototype=OW.prototype;w.WebSocket.CONNECTING=OW.CONNECTING;w.WebSocket.OPEN=OW.OPEN;w.WebSocket.CLOSING=OW.CLOSING;w.WebSocket.CLOSED=OW.CLOSED;var OE=w.EventSource;if(OE!==undefined){w.EventSource=function(url,cfg){var p=new URL(url.toString(),loc.href);if(so(p)&&sf(p.pathname)){var nx=new URL(p);nx.pathname=rp(p.pathname);var dvv=rdv();if(dvv!==null)nx.searchParams.set(R.deviceQuery,dvv);return new OE(nx,cfg)}return new OE(url,cfg)};w.EventSource.prototype=OE.prototype}var restores=[];function patchSrc(C){if(C===undefined)return;var d=Object.getOwnPropertyDescriptor(C.prototype,"src");if(d===undefined||d.configurable===false||d.set===undefined)return;var os=d.set;Object.defineProperty(C.prototype,"src",{configurable:true,enumerable:d.enumerable!==false,get:d.get,set:function(v){os.call(this,rr(String(v)))}});restores.push(function(){Object.defineProperty(C.prototype,"src",d)})}patchSrc(w.HTMLImageElement);patchSrc(w.HTMLScriptElement);patchSrc(w.HTMLIFrameElement);function uf(u,init){var raw=typeof u==="string"?u:u.href;if(typeof raw!=="string")return of.call(w,u,init||{});var q=new URL(raw,loc.href);if(so(q)&&q.pathname===R.uploadPath)return w.fetch(raw,init||{});return of.call(w,u,init||{})}try{if(w[R.uploadHookGlobal]===undefined)w[R.uploadHookGlobal]={fetch:uf}}catch(e){}seat.restore=function(){w.fetch=of;w.WebSocket=OW;if(OE!==undefined)w.EventSource=OE;for(var i=0;i<restores.length;i++)restores[i]();try{delete w[` + seat + "]}catch(e){w[" + seat + "]=undefined}};w[" + seat + "]=seat" + // The boot watchdog rides the same IIFE and skip conditions: it needs
  // the non-loopback gate above (the desktop boots over loopback without
  // a tunnel in the path) and the try/catch fail-closed envelope.
  buildBootWatchdogScript() + "}catch(e){}})();";
}
var BOOT_WATCHDOG_KEY = "dsh-remote-boot-reload";
var BOOT_WATCHDOG_WAIT_MS = 15e3;
var BOOT_WATCHDOG_POLL_MS = 1e3;
function buildBootWatchdogScript(waitMs = BOOT_WATCHDOG_WAIT_MS, pollMs = BOOT_WATCHDOG_POLL_MS) {
  const key = JSON.stringify(BOOT_WATCHDOG_KEY);
  return (
    // Leading semicolon: the preceding seat assignment ends without one,
    // and the fragment must parse when spliced into the IIFE.
    ';function wBoot(){try{return !!(w.document&&w.document.querySelector&&(w.document.querySelector("[data-conversation-scroll]")||w.document.querySelector("[data-slot=\\"conversation\\"]")))}catch(e){return false}}function wTick(n){try{if(wBoot()){try{w.sessionStorage.removeItem(' + key + ')}catch(e){}return}if(!w.document||w.document.readyState!=="complete"){w.setTimeout(function(){wTick(0)},' + pollMs + ");return}if(n<" + waitMs + "){w.setTimeout(function(){wTick(n+" + pollMs + ")}," + pollMs + ");return}var done=false;try{done=w.sessionStorage.getItem(" + key + ')==="1"}catch(e){}if(done)return;try{w.sessionStorage.setItem(' + key + ',"1")}catch(e){}w.location.reload()}catch(e){}}if(typeof w.setTimeout==="function")w.setTimeout(function(){wTick(0)},' + pollMs + ");"
  );
}
var REMOTE_CHANNEL_BOOT_SCRIPT = buildRemoteChannelBootScript();

// packages/dsh-remote-web/src/http/uuid-polyfill.ts
var UUID_POLYFILL_SCRIPT = [
  "(function(){",
  'var g=typeof globalThis!=="undefined"?globalThis:typeof window!=="undefined"?window:self;',
  'if(typeof g.crypto==="undefined"){g.crypto={};}',
  'if(typeof g.crypto.randomUUID!=="function"){',
  "g.crypto.randomUUID=function(){",
  "var a=new Uint8Array(16);",
  "if(g.crypto.getRandomValues){g.crypto.getRandomValues(a);}",
  "else{for(var j=0;j<16;j++){a[j]=Math.random()*256|0;}}",
  "a[6]=(a[6]&0x0f)|0x40;",
  "a[8]=(a[8]&0x3f)|0x80;",
  'var h="",x="0123456789abcdef";',
  "for(var i=0;i<16;i++){h+=x[a[i]>>4]+x[a[i]&0x0f];",
  'if(i===3||i===5||i===7||i===9)h+="-";}',
  "return h;",
  "};",
  "}",
  "})();"
].join("");

// packages/dsh-remote-web/src/index.ts
var name = "remote-web-ui";
var inject = ["webServer", "typertGateway", "connection"];
var REMOTE_WEB_UI_SETTINGS_NAMESPACE = "remote-web-ui";
var Config = z2.object({
  tokenTtlMs: z2.number().step(1).min(6e4).default(10 * 6e4).volatile(),
  offlineAfterMs: z2.number().step(1).min(5e3).default(25e3).volatile(),
  maxDevices: z2.number().step(1).min(1).max(64).default(4).volatile(),
  idleExpireMs: z2.number().step(1).min(6e4).default(DEFAULT_IDLE_EXPIRE_MS).volatile(),
  cookieName: z2.string().min(1).default("dsh_pair").volatile(),
  requirePairingForLan: z2.boolean().default(true).volatile(),
  publicBaseUrl: z2.string().volatile(),
  trustedHosts: z2.array(z2.string()),
  devicesFile: z2.string(),
  autoTunnel: z2.boolean().default(false).volatile(),
  tunnelToken: z2.string().role("secret").volatile(),
  relay: z2.boolean().default(true).volatile(),
  lanBind: z2.boolean().volatile(),
  profile: z2.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  enabled: z2.boolean().default(true).volatile()
});
var SWEEP_INTERVAL_MS = 1e4;
function readConfigField(field, fallback) {
  if (field === void 0) return fallback;
  if (typeof field === "object" && field !== null && typeof field.get === "function") {
    const value = field.get();
    return value === void 0 ? fallback : value;
  }
  return field;
}
function readOptionalConfigField(field) {
  if (field === void 0) return void 0;
  if (typeof field === "object" && field !== null && typeof field.get === "function") {
    return field.get();
  }
  return field;
}
function pairingConfigOf(resolved) {
  return {
    tokenTtlMs: resolved.tokenTtlMs,
    offlineAfterMs: resolved.offlineAfterMs,
    maxDevices: resolved.maxDevices,
    idleExpireMs: resolved.idleExpireMs,
    cookieName: resolved.cookieName,
    devicesFile: resolved.devicesFile
  };
}
function defaultDevicesFile(home = dshHome()) {
  return join5(home, "dsh-web-pack", "remote-web", "devices.json");
}
var DEFAULTS = {
  tokenTtlMs: 10 * 6e4,
  offlineAfterMs: 25e3,
  maxDevices: 4,
  idleExpireMs: DEFAULT_IDLE_EXPIRE_MS,
  cookieName: "dsh_pair",
  requirePairingForLan: true,
  publicBaseUrl: void 0,
  trustedHosts: void 0,
  devicesFile: defaultDevicesFile(),
  autoTunnel: false,
  tunnelToken: void 0,
  relay: true,
  lanBind: void 0,
  profile: resolveManagedProfile(void 0, void 0, process.env.DSH_PROFILE),
  enabled: true
};
function launchedProfileName(ctx) {
  const fact = ctx.get("profileContext");
  return typeof fact?.name === "string" && fact.name.length > 0 ? fact.name : void 0;
}
var apply = mountOnce("@catyugu/dsh-remote-web", applyImpl);
function applyImpl(ctx, config) {
  const envPublicBase = process.env.DSH_REMOTE_PUBLIC_BASE_URL?.trim() || void 0;
  const resolve2 = () => ({
    tokenTtlMs: readConfigField(config?.tokenTtlMs, DEFAULTS.tokenTtlMs),
    offlineAfterMs: readConfigField(config?.offlineAfterMs, DEFAULTS.offlineAfterMs),
    maxDevices: readConfigField(config?.maxDevices, DEFAULTS.maxDevices),
    idleExpireMs: readConfigField(config?.idleExpireMs, DEFAULTS.idleExpireMs),
    cookieName: readConfigField(config?.cookieName, DEFAULTS.cookieName),
    requirePairingForLan: readConfigField(config?.requirePairingForLan, DEFAULTS.requirePairingForLan),
    publicBaseUrl: readOptionalConfigField(config?.publicBaseUrl) ?? envPublicBase,
    trustedHosts: readOptionalConfigField(config?.trustedHosts),
    devicesFile: readConfigField(config?.devicesFile, DEFAULTS.devicesFile),
    autoTunnel: readConfigField(config?.autoTunnel, DEFAULTS.autoTunnel),
    tunnelToken: readOptionalConfigField(config?.tunnelToken),
    relay: readConfigField(config?.relay, DEFAULTS.relay),
    lanBind: readOptionalConfigField(config?.lanBind),
    profile: resolveManagedProfile(readOptionalConfigField(config?.profile), launchedProfileName(ctx), process.env.DSH_PROFILE),
    enabled: readConfigField(config?.enabled, DEFAULTS.enabled)
  });
  const service = new PairingService(pairingConfigOf(resolve2()));
  const tunnel = new TunnelManager();
  let relayRegistrar;
  const publicBase = new PublicBaseKeeper((base) => {
    service.setPublicBaseUrl(base);
  });
  let relayAnnouncedFor;
  const disposeRelayRegistrar = (unregister = false) => {
    const registrar = relayRegistrar;
    relayRegistrar = void 0;
    publicBase.setRelay(void 0);
    relayAnnouncedFor = void 0;
    if (registrar === void 0) return;
    if (unregister) void registrar.unregister().catch(() => void 0);
    registrar.dispose();
  };
  const ensureRelayRegistrar = () => {
    if (resolve2().relay === false) return void 0;
    if (relayRegistrar === void 0) {
      try {
        const identity = loadRelayIdentity(resolve2().profile);
        relayRegistrar = new RelayRegistrar(identity, (state) => {
          service.setRelayStatus(state.state === "off" ? void 0 : state);
          if (state.state === "running") {
            publicBase.setRelay(state.url);
          } else if (state.state === "off") {
            publicBase.setRelay(void 0);
          } else if (state.state === "failed") {
            console.warn(`remote-web-ui: relay registration failed (${state.error}) \u2014 the stable origin may serve its offline page until the retry lands`);
          }
        });
      } catch (error) {
        console.warn(`remote-web-ui: relay registry unavailable (${error instanceof Error ? error.message : String(error)}) \u2014 the quick URL is the QR base`);
      }
    }
    return relayRegistrar;
  };
  const announceRelay = (registrar, target) => {
    if (relayAnnouncedFor === target) return;
    relayAnnouncedFor = target;
    void registrar.announce(target);
  };
  let tunnelMode = resolve2().autoTunnel ? "quick" : "off";
  tunnel.onPhase((info) => {
    if (tunnelMode === "off") return;
    if (info.phase === "running" && info.url !== void 0) {
      publicBase.markRunning(info.url);
      service.setTunnelStatus({ state: "running", url: info.url });
      const registrar = tunnelMode === "quick" ? ensureRelayRegistrar() : void 0;
      if (registrar !== void 0) announceRelay(registrar, info.url);
      runPostureProbe();
    } else if (info.phase === "starting") {
      publicBase.markReconnecting();
      service.setTunnelStatus({ state: "starting" });
    } else if (info.phase === "failed") {
      publicBase.markReconnecting();
      service.setTunnelStatus(info.error === void 0 ? { state: "failed" } : { state: "failed", error: info.error });
    }
  });
  ctx.effect(() => () => {
    disposeRelayRegistrar();
    publicBase.dispose();
    tunnel.dispose();
  }, "remote-web-ui: auto tunnel");
  const bindKnown = (ctx.webServer.host === "0.0.0.0" || ctx.webServer.host === "127.0.0.1") && Number.isFinite(ctx.webServer.port);
  if (bindKnown) {
    const lanBases = ctx.webServer.host === "0.0.0.0" ? lanIPv4Addresses().map((address) => ({ address, base: `http://${address}:${String(ctx.webServer.port)}` })) : [];
    service.setLanBases(lanBases);
  }
  let disposeRoutes;
  let disposeSweep;
  let lastKnownPort;
  let lastFirewallApplied;
  const lanBindStatus = () => {
    const resolvedNow = resolve2();
    let state;
    try {
      state = lanBindState(resolvedNow.profile);
    } catch {
      state = { blockPresent: false };
    }
    const lanOn = state.host === "0.0.0.0";
    const port = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : lastKnownPort;
    if (Number.isFinite(ctx.webServer.port)) lastKnownPort = ctx.webServer.port;
    const startup = ctx.get("webStartup");
    const desiredHost = resolvedNow.lanBind === void 0 ? void 0 : desiredBindHost(resolvedNow.lanBind === true, startup?.host);
    return {
      profile: resolvedNow.profile,
      setting: resolvedNow.lanBind ?? null,
      blockHost: state.host ?? null,
      bindHost: ctx.webServer.host,
      port,
      lanUrls: ctx.webServer.host === "0.0.0.0" && port !== void 0 ? lanIPv4Addresses().map((address) => `http://${address}:${String(port)}`) : [],
      firewall: port !== void 0 ? firewallSummary(port, lanOn) : { ok: true, managed: false },
      platform: process.platform,
      // The running bind does not follow the block on every deployment (the
      // live patch watcher is profile-shape dependent): flag the divergence
      // so the card can ask for a restart instead of looking broken. The
      // comparison uses the effective desired host (a CLI --host wins over
      // the toggle), not the raw toggle.
      pendingRestart: pendingRestartOf(resolvedNow.lanBind, desiredHost, ctx.webServer.host)
    };
  };
  const innerAuth = createInnerAuth(() => {
    if (!Number.isFinite(ctx.webServer.port)) return void 0;
    try {
      return ctx.connection.authenticatedUrl?.(`http://127.0.0.1:${String(ctx.webServer.port)}/`);
    } catch {
      return void 0;
    }
  });
  const APP_SHELL_TTL_MS = 3e4;
  let appShellCache;
  const fetchAppShell = async () => {
    if (!Number.isFinite(ctx.webServer.port)) return void 0;
    if (appShellCache !== void 0 && Date.now() - appShellCache.at < APP_SHELL_TTL_MS) return appShellCache.html;
    const cookie = await innerAuth.ready();
    try {
      const response = await fetch(`http://127.0.0.1:${String(ctx.webServer.port)}/`, withIdentityEncoding({
        headers: cookie !== void 0 ? { cookie } : void 0
      }));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) innerAuth.invalidate();
        return void 0;
      }
      const html = await response.text();
      appShellCache = { at: Date.now(), html };
      return html;
    } catch {
      return void 0;
    }
  };
  const routes = [
    ...makeRoutes({
      service,
      requirePairingForLan: () => resolve2().requirePairingForLan,
      lanBindStatus,
      indexDocument: fetchAppShell,
      trustedHosts: () => {
        const list = [];
        const envHosts = process.env.DSH_REMOTE_TRUSTED_HOSTS;
        if (typeof envHosts === "string" && envHosts.trim() !== "") {
          for (const item of envHosts.split(",")) {
            const trimmed = item.trim();
            if (trimmed !== "") list.push(trimmed);
          }
        }
        const cfgHosts = resolve2().trustedHosts;
        if (Array.isArray(cfgHosts)) {
          for (const item of cfgHosts) {
            if (typeof item === "string") {
              const trimmed = item.trim();
              if (trimmed !== "") list.push(trimmed);
            }
          }
        }
        return list;
      }
    }),
    // The remote desktop channel: a paired-credential-gated `/remote` prefix
    // that re-issues fenced paths to loopback (see remote-api.ts). The gate is
    // unconditional — requirePairingForLan governs the plain /api surface and
    // the desktop's client-side rewrite only; it is never an authorization
    // input here, because this channel attaches the process's own browser
    // credential to everything it forwards (issue #1665).
    ...makeRemoteApiRoutes({
      service,
      port: ctx.webServer.port,
      auth: innerAuth
    })
  ];
  const upgrades = makeRemoteApiUpgradeRoutes({
    service,
    port: ctx.webServer.port,
    auth: innerAuth
  });
  const gate = makeGateListener(service, () => resolve2().requirePairingForLan, () => resolve2().enabled);
  ctx.effect(() => ctx.on("api/gate", gate), "remote-web-ui: api gate");
  let postureKey;
  let postureWasExposed = false;
  const runPostureProbe = () => {
    if (!resolve2().enabled) return;
    const targets = postureTargets(service.publicBaseUrl, service.lanAddresses, ctx.webServer.port);
    if (targets.length === 0) {
      postureKey = void 0;
      service.setPosture(void 0);
      return;
    }
    const key = targets.join("|");
    const claim = claimPostureKey(postureKey, key);
    if (!claim.run) return;
    postureKey = claim.next;
    void probePosture({ port: ctx.webServer.port, targets }).then((snapshot) => {
      service.setPosture(snapshot);
      const exposedHosts = snapshot.hosts.filter((host) => host.exposed).map((host) => host.host);
      const exposed = exposedHosts.length > 0;
      if (exposed && !postureWasExposed) {
        console.error(`remote-web-ui: CRITICAL \u2014 the /api fence is OPEN for [${exposedHosts.join(", ")}]: unpaired clients reach the full host API. Remove --trusted-host for these hosts (pairing covers them) or bind loopback.`);
      } else if (!exposed && postureWasExposed) {
        console.log("remote-web-ui: the /api posture probe is clean again (every advertised origin refused with 403).");
      }
      postureWasExposed = exposed;
    }).catch(() => {
      postureKey = releasePostureKey(postureKey, key);
    });
  };
  const initialPostureTimer = nodeSetTimeout(() => {
    runPostureProbe();
  }, 5e3);
  initialPostureTimer.unref();
  ctx.effect(() => () => {
    clearTimeout(initialPostureTimer);
  }, "remote-web-ui: posture probe boot");
  new RemoteWebUiPairing(ctx, (request) => {
    if (!resolve2().enabled) return false;
    return isPairedDeviceRequest(service, request);
  });
  const presencePet = startRemotePresencePet({
    onState: (listener) => service.onState(listener),
    pet: () => {
      try {
        return ctx.get("pet");
      } catch {
        return void 0;
      }
    }
  });
  ctx.effect(() => presencePet, "remote-web-ui: remote-presence pet visibility");
  if (service.lanAddresses.length > 0) {
    const urls = service.lanAddresses.map((ip) => `http://${ip}:${String(ctx.webServer.port)}`).join(" , ");
    console.log(`remote-web-ui: the paired Web GUI is reachable on LAN at ${urls}`);
  }
  if (ctx.webServer.host === "0.0.0.0") {
    console.warn("remote-web-ui: LAN-exposed bind \u2014 pairing gates the /remote channel; direct /api stays under the harness fence + browser auth (stop() does not revoke an already-redeemed browser credential)");
  }
  const applyLanBindWork = (value) => {
    if (value.lanBind !== void 0) {
      const startup = ctx.get("webStartup");
      const desiredHost = desiredBindHost(value.lanBind === true, startup?.host);
      const desiredPort = desiredBindPort(startup?.port, Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : void 0);
      if (desiredPort === void 0) {
        console.error("remote-web-ui: cannot assert the lan-bind block \u2014 the web server port is not known yet");
      } else {
        try {
          const current = lanBindState(value.profile);
          if (current.host !== desiredHost || current.port !== desiredPort) {
            writeLanBind(desiredHost, desiredPort, value.profile);
            console.log(`remote-web-ui: lan-bind block written for profile ${value.profile} (${desiredHost}:${String(desiredPort)}); it takes effect when the profile next applies (the card reports pendingRestart until the running bind follows)`);
          }
        } catch (error) {
          console.error(`remote-web-ui: failed to write the lan-bind block: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const livePort = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : void 0;
      if (livePort === void 0) {
        console.error("remote-web-ui: cannot align the host firewall rule \u2014 the web server port is not known yet");
      } else {
        const nextFirewall = { enabled: value.lanBind === true, port: livePort };
        if (firewallActionNeeded(lastFirewallApplied, nextFirewall)) {
          const ruleOk = nextFirewall.enabled ? ensureFirewallRule(nextFirewall.port) : removeFirewallRule(nextFirewall.port);
          if (ruleOk) {
            lastFirewallApplied = nextFirewall;
          } else {
            console.error("remote-web-ui: the host firewall rule could not be updated (admin rights required on managed platforms)");
          }
        }
      }
    }
  };
  let lanBindWorkPending = false;
  const scheduleLanBindWork = () => {
    if (lanBindWorkPending) return;
    lanBindWorkPending = true;
    runDetached(() => setImmediate(() => {
      lanBindWorkPending = false;
      try {
        applyLanBindWork(resolve2());
      } catch (error) {
        console.error(`remote-web-ui: the deferred lan-bind assertion failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }));
  };
  ctx.effect(() => () => {
    lanBindWorkPending = false;
  }, "remote-web-ui: lan-bind work");
  const sync = () => {
    const value = resolve2();
    service.config = pairingConfigOf(value);
    scheduleLanBindWork();
    const plan = tunnelPlanOf(value, ctx.webServer.port);
    tunnelMode = plan.mode;
    publicBase.setMode(plan.mode);
    const liveTunnelUrl = publicBase.quickUrl();
    if (plan.mode !== "quick") {
      disposeRelayRegistrar();
      if (plan.mode !== "named") publicBase.refresh();
    } else if (value.relay === false) {
      disposeRelayRegistrar(true);
      publicBase.refresh();
    } else if (liveTunnelUrl !== void 0) {
      const registrar = ensureRelayRegistrar();
      if (registrar !== void 0) announceRelay(registrar, liveTunnelUrl);
    }
    if (plan.mode === "quick") {
      for (const ignored of plan.ignored) {
        console.warn(`remote-web-ui: autoTunnel is on \u2014 ignoring the configured ${ignored}`);
      }
      const registrar = ensureRelayRegistrar();
      const originHostHeader = registrar === void 0 ? void 0 : new URL(registrar.baseUrl).host;
      tunnel.start(originHostHeader === void 0 ? plan.targetUrl : { kind: "quick", targetUrl: plan.targetUrl, originHostHeader });
    } else if (plan.mode === "named") {
      publicBase.markRunning(plan.publicUrl);
      tunnel.start({ kind: "named", token: plan.token, publicUrl: plan.publicUrl });
    } else {
      tunnel.stop();
      if (value.tunnelToken !== void 0 && value.tunnelToken !== "") {
        console.warn("remote-web-ui: tunnelToken is set but publicBaseUrl is missing or not a valid URL \u2014 fill the fixed public hostname of the named tunnel (e.g. https://dsh.example.com) to run it");
      }
      if (value.publicBaseUrl !== void 0 && !isHttpUrl(value.publicBaseUrl)) {
        console.warn(`remote-web-ui: ignoring malformed publicBaseUrl ${JSON.stringify(value.publicBaseUrl)} (expected https://host[:port])`);
        service.setPublicBaseUrl(void 0);
      } else {
        service.setPublicBaseUrl(value.publicBaseUrl);
      }
    }
    const enabled = value.enabled;
    if (!enabled) {
      service.stop();
      tunnel.stop();
      disposeRelayRegistrar();
      publicBase.reset();
    }
    if (disposeRoutes === void 0 && enabled) {
      disposeRoutes = ctx.effect(
        () => {
          const disposers = [
            ...routes.map((route) => ctx.webServer.register(route)),
            ...upgrades.map((route) => ctx.webServer.registerUpgrade(route))
          ];
          return () => {
            for (const dispose of disposers) dispose();
          };
        },
        "remote-web-ui: pairing routes"
      );
    } else if (disposeRoutes !== void 0 && !enabled) {
      disposeRoutes();
      disposeRoutes = void 0;
    }
    if (disposeSweep === void 0 && enabled) {
      disposeSweep = ctx.effect(
        () => {
          const timer = nodeSetInterval(() => {
            service.sweep();
          }, SWEEP_INTERVAL_MS);
          timer.unref();
          return () => {
            clearInterval(timer);
          };
        },
        "remote-web-ui: presence sweep"
      );
    } else if (disposeSweep !== void 0 && !enabled) {
      disposeSweep();
      disposeSweep = void 0;
    }
    runPostureProbe();
  };
  ctx.effect(() => ctx.on("webserver/index-inject", (table) => {
    table.push({ kind: "script", placement: "head", text: UUID_POLYFILL_SCRIPT });
  }), "remote-web-ui: uuid polyfill");
  ctx.effect(() => ctx.on("webserver/index-inject", (table) => {
    const value = resolve2();
    if (!value.enabled || !value.requirePairingForLan) return;
    table.push({ kind: "script", placement: "head", text: REMOTE_CHANNEL_BOOT_SCRIPT });
  }), "remote-web-ui: remote channel boot patch");
  ctx.on("loader/volatile-update", () => {
    sync();
  });
  sync();
}
export {
  Config,
  REMOTE_WEB_UI_SETTINGS_NAMESPACE,
  apply,
  defaultDevicesFile,
  inject,
  name,
  pairingConfigOf
};
