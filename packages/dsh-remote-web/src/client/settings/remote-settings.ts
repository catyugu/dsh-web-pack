/**
 * The remote-connection settings model.
 *
 * One row, seven editable fields, one staged draft map. The model decides what
 * a save would write and whether the Host accepted it; the form component only
 * renders. Staging keeps what the user typed until the Host settles the batch:
 * a save is one atomic form mutation, so either every staged write lands or
 * none does, and a refusal leaves the drafts in place to correct.
 *
 * The layer mechanics stay out of the UI: a value written here overrides the
 * profile patch, which the form shows as an "overridden" badge plus a reset
 * link instead of a per-field inherit choice.
 */

import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

/** The three answers the public-access decision accepts. */
export const TUNNEL_MODES = ['off', 'quick', 'named'] as const

/** The values this row edits, as the settings form reads them back. */
export interface RemoteSettings {
  /** Master switch: off revokes every device and stops the public tunnel. */
  enabled?: boolean
  /** Public access mode: how the GUI is reached from outside this machine. */
  tunnel?: string
  /** Fixed public hostname for the `named` mode. */
  tunnelHost?: string
  /** Cloudflare tunnel token for the `named` mode (stored redacted). */
  tunnelToken?: string
  /** LAN bind: writes the profile patch block; unset means "not managed". */
  lanBind?: boolean
  /** Whether non-loopback desktops must carry a paired-device cookie. */
  requirePairingForLan?: boolean
  /** Lifetime of one QR pairing link (ms). */
  tokenTtlMs?: number
}

/** Every field the card can edit. */
export type RemoteField =
  | 'enabled'
  | 'tunnel'
  | 'tunnelHost'
  | 'tunnelToken'
  | 'lanBind'
  | 'requirePairingForLan'
  | 'tokenTtlMs'

/** One field as the form renders it. */
export interface RemoteFieldState {
  /** Draft text the control shows. */
  text: string
  /** Whether saving would leave a user-layer entry for this field. */
  overridden: boolean
  /** Whether the draft is not a value this field accepts, which blocks saving. */
  invalid: boolean
}

/** Everything the form renders. */
export interface RemoteSettingsState {
  /** False while the namespace is still loading; the card renders nothing. */
  available: boolean
  /** Whether the Host serves this namespace to this client at all. */
  exposed: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Whether the form holds edits a save would write. */
  dirty: boolean
  /** Whether any staged draft is invalid, which blocks the save. */
  invalid: boolean
  /** Whether a save is crossing the wire. */
  saving: boolean
  /** Whether the last save did not land as staged. */
  failed: boolean
  /** The rejection reason the Host or transport returned for the last failure. */
  failedReason?: string
  /** One entry per editable field. */
  fields: Record<RemoteField, RemoteFieldState>
}

/** The write one field's draft text performs when the card is saved. */
type FieldWrite = { kind: 'set'; value: unknown } | { kind: 'clear' }

/** How one field converts between its stored value and its draft text. */
interface FieldRule {
  /** Whether the Host redacts this field from every read-back view. */
  secret?: boolean
  /** Render a stored value as draft text; the empty string when the section carries none. */
  format: (value: unknown) => string
  /** The write this draft text stages, or undefined when the draft is not accepted. */
  parse: (text: string) => FieldWrite | undefined
}

/**
 * Read one number draft. An empty draft clears the field; a draft that is not
 * a whole number of at least `min` blocks the save.
 * @param text - the draft text.
 * @param min - smallest accepted value.
 * @returns the staged write, or undefined when the draft is refused.
 */
function parseInteger(text: string, min: number): FieldWrite | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'clear' }
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= min ? { kind: 'set', value: parsed } : undefined
}

/** Format a boolean as its draft text. */
function formatBoolean(value: unknown): string {
  return typeof value === 'boolean' ? String(value) : ''
}

/** Read a boolean draft: empty clears, `true`/`false` set, anything else blocks. */
function parseBoolean(text: string): FieldWrite | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'clear' }
  if (trimmed === 'true') return { kind: 'set', value: true }
  if (trimmed === 'false') return { kind: 'set', value: false }
  return undefined
}

/** Format a string as its draft text. */
function formatText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Read a text draft: empty clears, anything else is the trimmed value. */
function parseText(text: string): FieldWrite {
  const trimmed = text.trim()
  return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
}

/** Shortest pairing-link lifetime the Host accepts, in ms. */
const MIN_TOKEN_TTL_MS = 60_000

/** One rule per editable field. */
const FIELD_RULES: Record<RemoteField, FieldRule> = {
  enabled: { format: formatBoolean, parse: parseBoolean },
  tunnel: {
    format: value => (typeof value === 'string' && (TUNNEL_MODES as readonly string[]).includes(value) ? value : ''),
    parse: (text) => {
      if (text === '') return { kind: 'clear' }
      return (TUNNEL_MODES as readonly string[]).includes(text) ? { kind: 'set', value: text } : undefined
    },
  },
  tunnelHost: { format: formatText, parse: parseText },
  tunnelToken: { format: formatText, parse: parseText, secret: true },
  lanBind: { format: formatBoolean, parse: parseBoolean },
  requirePairingForLan: { format: formatBoolean, parse: parseBoolean },
  tokenTtlMs: {
    format: value => (typeof value === 'number' ? String(value) : ''),
    parse: text => parseInteger(text, MIN_TOKEN_TTL_MS),
  },
}

/** Every field in the order the form declares them. */
export const REMOTE_FIELDS: readonly RemoteField[] = [
  'enabled',
  'tunnel',
  'tunnelHost',
  'tunnelToken',
  'lanBind',
  'requirePairingForLan',
  'tokenTtlMs',
]

/** One staged edit. */
interface StagedEdit {
  /** Draft text the control shows. */
  text: string
  /** True when this edit clears the field whatever text it shows. */
  clear: boolean
}

/** One staged edit resolved into the write a save performs. */
interface PlannedWrite {
  /** Field this entry writes. */
  field: RemoteField
  /** set stores a value; unset drops the leaf. */
  op: { op: 'set'; value: unknown } | { op: 'unset' }
  /** Read-back judgment, or undefined when the draft is refused (blocks the save). */
  judge: (() => boolean) | undefined
}

/** One durable write inside the save's atomic form mutation. */
type FormOp =
  | { op: 'set'; path: string[]; value: string | number | boolean }
  | { op: 'unset'; path: string[] }

/**
 * Stage edits over the `remote-web-ui` settings form and write them on save.
 *
 * The Host is the only authority on whether a value was accepted, so the
 * outcome is read back from the settled section instead of predicted here. A
 * save asked for while one is in flight is queued and runs against the settled
 * state: dropping it left the edit unexplained ("the save button stops working
 * after a few rounds").
 */
export class RemoteSettingsModel {
  private readonly form: ConfigForm<RemoteSettings>
  private readonly staged = new Map<RemoteField, StagedEdit>()
  private readonly listeners = new Set<() => void>()
  private readonly disposeForm: () => void
  private disposed = false
  private saving = false
  private saveQueued = false
  private failed = false
  private failedReason: string | undefined

  /** @param form - the configuration form for the `remote-web-ui` row. */
  constructor(form: ConfigForm<RemoteSettings>) {
    this.form = form
    this.disposeForm = form.subscribe(() => { this.publish() })
  }

  /** Release the form subscription and every listener; later calls are no-ops. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeForm()
    this.listeners.clear()
  }

  /**
   * Subscribe to state changes.
   * @param listener - called after every change.
   * @returns the unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** The current projection (a fresh object per call). */
  getState(): RemoteSettingsState {
    const snapshot = this.form.getSnapshot()
    const plan = this.plan()
    const fields = {} as Record<RemoteField, RemoteFieldState>
    for (const field of REMOTE_FIELDS) fields[field] = this.fieldState(field)
    return {
      available: snapshot.status !== 'loading',
      exposed: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some(item => item.judge === undefined),
      saving: this.saving,
      failed: this.failed,
      ...(this.failedReason === undefined ? {} : { failedReason: this.failedReason }),
      fields,
    }
  }

  /**
   * Stage one draft.
   * @param field - the field to edit.
   * @param text - the draft text.
   */
  edit(field: RemoteField, text: string): void {
    this.stage(field, { text, clear: false })
  }

  /**
   * Stage a clear, so saving lets the field re-inherit the layer below.
   * @param field - the field to reset.
   */
  reset(field: RemoteField): void {
    this.stage(field, { text: FIELD_RULES[field].format(this.baseValue(field)), clear: true })
  }

  /** Drop every staged edit and the failure state. */
  discard(): void {
    if (this.staged.size === 0 && !this.failed) return
    this.staged.clear()
    this.failed = false
    this.failedReason = undefined
    this.publish()
  }

  /**
   * Write every staged edit, then re-seed from what the Host settled on.
   *
   * The whole batch rides one mutate, so the Host applies every write or
   * refuses the batch. The settled snapshot is then read back per write: a
   * redacted secret cannot be compared (the Host strips it from every view),
   * so a staged secret is judged by the mutation settling alone.
   */
  async save(): Promise<void> {
    if (this.saving) {
      this.saveQueued = true
      return
    }
    await this.runSave()
    if (!this.saveQueued) return
    this.saveQueued = false
    await this.save()
  }

  private async runSave(): Promise<void> {
    const plan = this.plan()
    const valid = plan.filter((item): item is PlannedWrite & { judge: () => boolean } => item.judge !== undefined)
    if (plan.length === 0 || this.saving || valid.length !== plan.length) return
    // Remember the staged entry each write started from: an edit staged while
    // the save is in flight replaces the same key and must survive.
    const pending = new Map<RemoteField, StagedEdit | undefined>()
    for (const item of plan) pending.set(item.field, this.staged.get(item.field))
    this.saving = true
    this.failed = false
    this.failedReason = undefined
    this.publish()
    let accepted = false
    let failedReason: string | undefined
    try {
      accepted = await this.form.mutate(valid.map(item => toFormOp(item)))
    } catch (error) {
      failedReason = error instanceof Error ? error.message : String(error)
    }
    const landed = accepted && failedReason === undefined && valid.every(item => item.judge())
    for (const [field, before] of pending) {
      if (landed && this.staged.get(field) === before) this.staged.delete(field)
    }
    this.saving = false
    this.failed = !landed
    this.failedReason = failedReason
    this.publish()
  }

  /** One field's state: the effective section value, or the staged draft over it. */
  private fieldState(field: RemoteField): RemoteFieldState {
    const rule = FIELD_RULES[field]
    const staged = this.staged.get(field)
    if (staged === undefined) {
      return { text: rule.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false }
    }
    const write = staged.clear ? { kind: 'clear' as const } : rule.parse(staged.text)
    return { text: staged.text, overridden: write?.kind === 'set', invalid: write === undefined }
  }

  /**
   * Every staged edit a save would write. A draft that matches the effective
   * section is not a write at all; a draft the field refuses is still part of
   * the plan (with no judgment) so the save refuses instead of dropping it.
   * @returns the planned writes, in staging order.
   */
  private plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [field, staged] of this.staged) {
      const rule = FIELD_RULES[field]
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, op: { op: 'unset' }, judge: () => !this.stored(field) })
        continue
      }
      if (staged.text === rule.format(this.sectionValue(field))) continue
      const write = rule.parse(staged.text)
      if (write === undefined) plan.push({ field, op: { op: 'unset' }, judge: undefined })
      else if (write.kind === 'clear') plan.push({ field, op: { op: 'unset' }, judge: () => !this.stored(field) })
      else plan.push({ field, op: { op: 'set', value: write.value }, judge: () => this.landedSet(field, write.value) })
    }
    return plan
  }

  /** Whether the settled user layer holds the value a staged set wrote. */
  private landedSet(field: RemoteField, value: unknown): boolean {
    if (FIELD_RULES[field].secret === true) return true
    return this.userLayer()?.[field] === value
  }

  private stage(field: RemoteField, edit: StagedEdit): void {
    this.staged.set(field, edit)
    this.failed = false
    this.failedReason = undefined
    this.publish()
  }

  private snapshotOf(): ConfigFormSnapshot<RemoteSettings> {
    return this.form.getSnapshot()
  }

  private sectionValue(field: RemoteField): unknown {
    return (this.snapshotOf().value as Record<string, unknown> | undefined)?.[field]
  }

  private baseValue(field: RemoteField): unknown {
    return (this.snapshotOf().base as Record<string, unknown> | undefined)?.[field]
  }

  private userLayer(): Record<string, unknown> | undefined {
    return this.snapshotOf().user as Record<string, unknown> | undefined
  }

  private stored(field: RemoteField): boolean {
    const user = this.userLayer()
    return user !== undefined && Object.hasOwn(user, field)
  }

  private publish(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Turn one planned write into the form contract's path operation.
 * @param item - the planned write.
 * @returns the operation the atomic mutation carries.
 */
function toFormOp(item: PlannedWrite): FormOp {
  if (item.op.op === 'unset') return { op: 'unset', path: [item.field] }
  const value = item.op.value
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new Error(`settings field ${item.field} has no scalar value to write`)
  }
  return { op: 'set', path: [item.field], value }
}
