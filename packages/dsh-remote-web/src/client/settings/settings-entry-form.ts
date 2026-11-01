/**
 * The settings form bound to the profile entry id this Host actually serves.
 *
 * A form is addressed by PROFILE ENTRY ID, while this card knows only its own
 * settings namespace. The family binder (`ctx.get('webUiSettings')`, published
 * by dsh-web-settings) resolves one onto the other and is the preferred
 * transport; this module is the fallback for a page that serves no binder —
 * the group plugin is not installed, or its client half has not applied yet.
 *
 * The shared describe mirror is the only local evidence of which row id this
 * profile serves, and it answers asynchronously: at plugin activation it
 * usually holds nothing yet. An unanswered or empty mirror is not evidence of
 * absence, so it keeps the most likely row; a mirror that answers without any
 * of this package's rows falls back to the bare namespace (the pre-0.1.7
 * keying shape). The form therefore rebinds as soon as the mirror names a
 * different one of this package's rows, and the caller disposes the
 * subscription with the form.
 */

import type { ConfigForm, ConfigFormSnapshot, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'

/** Options of {@link createServedEntryForm}. */
export interface ServedEntryFormOptions<T> {
  /** The shared configuration forms service (`ctx.configForms`). */
  forms: ConfigForms
  /**
   * Profile entry ids this package's rows carry, most likely first: this
   * pack's own row id, the aggregate's generated row, the package's own
   * standalone row, then the bare namespace.
   */
  entryIds: readonly string[]
}

/** A form plus the subscription that keeps it bound. */
export interface ServedEntryForm<T> {
  /** The form the card stages and saves through. */
  form: ConfigForm<T>
  /** Release the describe-mirror subscription; later calls are no-ops. */
  dispose(): void
}

/** The snapshot a form reports before the Host has answered with this entry. */
function pendingSnapshot<T>(): ConfigFormSnapshot<T> {
  return {
    status: 'loading',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: false,
    mode: 'host',
  }
}

/**
 * Bind a settings form to the profile entry id this Host serves.
 * @param options - the shared forms service and this package's candidate row ids.
 * @returns the form and its dispose.
 */
export function createServedEntryForm<T>(options: ServedEntryFormOptions<T>): ServedEntryForm<T> {
  const { forms, entryIds } = options
  const fallbackId = entryIds[0]
  const namespaceId = entryIds[entryIds.length - 1]
  const listeners = new Set<() => void>()
  let boundId: string | undefined
  let bound: ConfigForm<T> | undefined
  let offBound: (() => void) | undefined
  let snapshot: ConfigFormSnapshot<T> = pendingSnapshot<T>()

  /** Republish: the delegated snapshot when one is bound, the pending one otherwise. */
  const publish = (): void => {
    if (bound !== undefined) snapshot = bound.getSnapshot()
    for (const listener of [...listeners]) listener()
  }

  /**
   * The entry id the mirror currently justifies. An unanswered or empty mirror
   * is not evidence of absence, so it keeps the fallback candidate.
   * @returns the entry id to bind.
   */
  const resolve = (): string => {
    let served: readonly string[] | undefined
    try {
      served = forms.describe().getSnapshot().view?.namespaces.map(row => row.ns)
    } catch {
      // A mirror that refuses the read is unanswered too, not absent.
      served = undefined
    }
    if (served === undefined || served.length === 0) return fallbackId
    return entryIds.find(id => served.includes(id)) ?? namespaceId
  }

  /** Bind (or rebind) the resolved entry's form; a no-op while it is unchanged. */
  const bind = (): void => {
    const target = resolve()
    if (target === boundId) return
    offBound?.()
    offBound = undefined
    let form: ConfigForm<T>
    try {
      form = forms.get<T>(target)
    } catch {
      // A service that refuses the id stays unbound; the next mirror answer
      // retries rather than pinning a wrong entry for the session.
      boundId = undefined
      return
    }
    boundId = target
    bound = form
    offBound = form.subscribe(() => { publish() })
    publish()
  }

  let offDescribe: (() => void) | undefined
  try {
    offDescribe = forms.describe().subscribe(() => { bind() })
  } catch {
    // A describe face that refuses the subscription: the initial binding stands.
  }
  bind()

  return {
    form: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      set: (field, value) => bound?.set(field, value) ?? Promise.resolve(false),
      unset: (field) => bound?.unset(field) ?? Promise.resolve(false),
      mutate: (ops, expectedRevision) => bound?.mutate(ops, expectedRevision) ?? Promise.resolve(false),
    },
    dispose(): void {
      offDescribe?.()
      offDescribe = undefined
      offBound?.()
      offBound = undefined
      bound = undefined
      boundId = undefined
      listeners.clear()
    },
  }
}
