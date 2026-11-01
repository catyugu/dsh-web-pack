/**
 * Durability for the paired-device table.
 *
 * Device ids are session credentials (the gate authorizes requests by the
 * cookie's device id), so the store is written 0600 through a temp file and an
 * atomic rename: a crash mid-write can never leave a half-written table. A
 * corrupt or missing file loads as an empty table — persistence is an
 * availability convenience, not a security boundary.
 *
 * A revocation is the one write that must not be lost: when it cannot be made
 * durable, the stale file is removed instead, because a missing file already
 * loads empty and the failure then costs a re-pair rather than silently
 * restoring access the user revoked.
 */

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Cap on the persisted/displayed User-Agent string. */
const MAX_USER_AGENT_CHARS = 180

/** One paired device session, keyed by the device id stored in its cookie. */
export interface DeviceSession {
  /** Pairing time (ms epoch). */
  createdAt: number
  /** Last time the device passed a gated request or heartbeat. */
  lastSeenAt: number
  /** Sanitized User-Agent captured at accept (optional; missing on old files). */
  userAgent?: string
}

/** File-operation seam for the revocation-durability step (tests). */
export interface PairingFsSeams {
  /** Remove the stale device store (defaults to fs.rmSync with force). */
  removeFile?(path: string): void
}

/** The device table's durable half. */
export interface DeviceStore {
  /** Restore every persisted session; an unreadable store loads empty. */
  load(): Map<string, DeviceSession>
  /** @returns whether the table reached the disk. */
  persist(devices: ReadonlyMap<string, DeviceSession>): boolean
  /** Make a revocation durable, removing the store when it cannot be written. */
  forget(devices: ReadonlyMap<string, DeviceSession>): void
}

/** Strip control characters and cap the User-Agent stored with a session. */
export function sanitizeUserAgent(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned === '') return undefined
  return cleaned.length <= MAX_USER_AGENT_CHARS ? cleaned : cleaned.slice(0, MAX_USER_AGENT_CHARS)
}

/**
 * Build the device store.
 * @param file - the JSON file to read and write; undefined keeps the table memory-only.
 * @param seams - filesystem seams (tests).
 * @returns the store.
 */
export function createDeviceStore(file: string | undefined, seams: PairingFsSeams = {}): DeviceStore {
  const removeStale = (): void => {
    if (file === undefined) return
    if (seams.removeFile !== undefined) seams.removeFile(file)
    else rmSync(file, { force: true })
  }

  return {
    load() {
      const devices = new Map<string, DeviceSession>()
      if (file === undefined) return devices
      try {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as unknown
        if (typeof saved !== 'object' || saved === null) return devices
        for (const [deviceId, session] of Object.entries(saved)) {
          if (typeof deviceId !== 'string') continue
          if (typeof session !== 'object' || session === null) continue
          const { createdAt, lastSeenAt, userAgent } = session as {
            createdAt?: unknown
            lastSeenAt?: unknown
            userAgent?: unknown
          }
          if (typeof createdAt !== 'number' || typeof lastSeenAt !== 'number') continue
          const label = typeof userAgent === 'string' ? sanitizeUserAgent(userAgent) : undefined
          devices.set(deviceId, {
            createdAt,
            lastSeenAt,
            ...(label !== undefined ? { userAgent: label } : {}),
          })
        }
      } catch {
        // Unreadable/corrupt: start empty rather than refusing to boot.
      }
      return devices
    },

    persist(devices) {
      if (file === undefined) return true
      try {
        mkdirSync(dirname(file), { recursive: true })
        const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
        const payload: Record<string, DeviceSession> = {}
        for (const [id, session] of devices) payload[id] = session
        writeFileSync(temp, JSON.stringify(payload), { mode: 0o600 })
        renameSync(temp, file)
        return true
      } catch (error) {
        console.error('dsh-remote-web: failed to persist paired devices', error)
        return false
      }
    },

    forget(devices) {
      if (this.persist(devices)) return
      try {
        removeStale()
        console.error('dsh-remote-web: the device revocation could not be persisted; removed the stale device store so a restart cannot restore it')
      } catch (error) {
        console.error('dsh-remote-web: the device revocation could not be persisted and the stale device store could not be removed', error)
      }
    },
  }
}
