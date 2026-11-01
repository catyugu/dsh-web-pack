/**
 * Host single-instance guard for this row.
 *
 * A profile can name the same package twice: this pack's row and a standalone
 * install of the row package, an aggregate bundle's namespaced child row, or a
 * repository link beside an npm copy. The second mount would re-register the
 * same webserver routes and fail the boot, so a mount of an already-mounted
 * package is a no-op for as long as the first instance lives.
 *
 * A refused mount is QUEUED, not dropped. The holder can be disposed long after
 * the refused mount ran its course: the Host reloads a profile by creating the
 * new loader entries before the old ones are torn down, so the incoming entry
 * mounts while the previous entry still owns the name. Dropping that mount left
 * the row listed as active with nobody serving its routes. The queue is
 * replayed when the holder releases the name, unless the waiting fiber was
 * disposed first.
 *
 * The registry rides a global symbol, and that symbol is a PUBLISHED
 * CROSS-REPOSITORY CONTRACT, not this file's private state: sibling packages in
 * other repositories carry their own copy of this guard and read the same
 * value. `MOUNTED` must keep its shape (a `Set` of package names with
 * `has`/`add`/`delete`); this guard's wait queues therefore live under their
 * own additive key, and a foreign value under `MOUNTED` is replaced by a `Set`
 * instead of being trusted.
 *
 * cordis `ctx.effect` runs its callback immediately and treats the callback's
 * return value as the fiber disposer, so the unmarker is returned, not run.
 */

/** Published cross-repository contract: package names currently mounted. */
const MOUNTED = Symbol.for('dsh-web.mounted-plugins')

/** Additive key this guard owns: refused mounts waiting for the name. */
const WAITERS = Symbol.for('dsh-web.mounted-plugins.waiters')

/** The slice of a cordis context this guard touches. */
interface MountContext {
  effect?: (effect: () => unknown) => unknown
}

/** One mount that was refused while another fiber owned the package name. */
interface PendingMount {
  /** Replay the refused mount; a no-op once its own fiber has been disposed. */
  run(): void
}

interface MountRegistry {
  [MOUNTED]?: unknown
  [WAITERS]?: Map<string, PendingMount[]>
}

/**
 * The shared name registry, always a `Set` whatever another build stored here:
 * a foreign value (an interim shape, a hand-written global) must not take every
 * family plugin down with it.
 * @returns the process-wide set of mounted package names.
 */
function mountedSet(): Set<string> {
  const registry = globalThis as MountRegistry
  const existing = registry[MOUNTED]
  if (existing instanceof Set) return existing as Set<string>
  const created = new Set<string>()
  registry[MOUNTED] = created
  return created
}

/** Queue per package name for mounts refused while a holder was alive. */
function mountWaiters(): Map<string, PendingMount[]> {
  const registry = globalThis as MountRegistry
  return (registry[WAITERS] ??= new Map())
}

/**
 * Wrap a cordis plugin apply so the package runs at most once per process.
 * The first mount registers normally and releases the name when its fiber
 * disposes; a mount refused while that name is held waits for the release and
 * then runs, unless its own fiber disposes first.
 * @param packageName - npm package identity shared by every install source.
 * @param fn - the original plugin apply.
 * @returns an apply of the same shape.
 */
export function mountOnce<T extends (...args: any[]) => unknown>(packageName: string, fn: T): T {
  const mount = (...args: unknown[]): unknown => {
    const mounted = mountedSet()
    const ctx = args[0] as MountContext | undefined
    if (mounted.has(packageName)) {
      // Another fiber (the aggregate row, a standalone install, or a copy built
      // from an older revision of this guard) owns the name. Queue instead of
      // dropping: dropping lost the plugin for the rest of the process when the
      // holder was disposed by a reload.
      const waiters = mountWaiters()
      const queue = waiters.get(packageName) ?? []
      let alive = true
      const pending: PendingMount = {
        run: () => {
          if (alive) mount(...args)
        },
      }
      // A fiber that dies while it waits must not be replayed afterwards: its
      // context is disposed and registering effects on it would throw.
      ctx?.effect?.(() => () => {
        alive = false
        const index = queue.indexOf(pending)
        if (index >= 0) queue.splice(index, 1)
      })
      queue.push(pending)
      waiters.set(packageName, queue)
      return
    }
    mounted.add(packageName)
    ctx?.effect?.(() => () => {
      mounted.delete(packageName)
      const waiters = mountWaiters()
      const queue = waiters.get(packageName)
      if (queue === undefined) return
      waiters.delete(packageName)
      // Defer the handover one microtask so the disposing mount's own effects
      // (routes, ledger, timers) are torn down before the next one registers.
      for (const waiter of queue.splice(0)) queueMicrotask(() => { waiter.run() })
    })
    return fn(...args)
  }
  return mount as T
}
