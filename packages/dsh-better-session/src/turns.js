/**
 * Turn-level conversation editing: regenerating a turn and re-sending an
 * edited prompt.
 *
 * The session log is append-only, so a removal is not an erase: the plugin
 * appends a replacement that shadows the removed range on the model-visible
 * surface. The original events stay in the log; what changes is what the model
 * reads and what the transcript shows from now on.
 *
 * The replacement is an empty `user/message` carrying the removed range in its
 * source summary. An empty user message never enters the model context, so the
 * shadowed range leaves the conversation without leaving a hole in it.
 *
 * @module dsh-better-session/manage/turns
 */
import { randomUUID } from 'node:crypto'

/** Producer kind of the replacement that shadows a removed range. */
export const TOMBSTONE_SOURCE = 'dsh-better-session-turn-delete'

/** Prefix of the replay message identity, so one regeneration is one operation. */
export const REPLAY_RPC_PREFIX = 'dsh-better-session-regenerate:'

/**
 * A refusal the caller can act on: the code says what kind of refusal it was,
 * the message says why.
 */
export class TurnError extends Error {
  /**
   * @param code - machine-readable reason.
   * @param message - human-readable reason, safe to log.
   */
  constructor(code, message) {
    super(message)
    this.name = 'TurnError'
    this.code = code
  }
}

/**
 * Whether one event entered the surface at its own log position.
 * @param event - session event.
 * @returns true for an append-origin surface event.
 */
function isAppend(event) {
  return event.surfaceOp === 'append'
}

/**
 * Whether one event shadowed an existing surface range.
 * @param event - session event.
 * @returns true for a surface replacement.
 */
function isReplacement(event) {
  return event.surfaceOp !== undefined && event.surfaceOp !== 'append'
}

/**
 * Read the removal record a tombstone carries.
 * @param event - session event.
 * @returns the removed turn range, or undefined when the event is not a tombstone.
 */
export function tombstoneMeta(event) {
  if (event.type !== 'user/message' || !isReplacement(event)) return undefined
  const source = event.data?.source
  if (!Array.isArray(event.data?.content) || event.data.content.length !== 0) return undefined
  let meta = {}
  try {
    const parsed = JSON.parse(source?.summary ?? '')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed
  } catch {
    meta = {}
  }
  const turn = Number.isSafeInteger(meta.turn) && meta.turn >= 0 ? meta.turn : undefined
  if (turn === undefined) return undefined
  const endTurn = Number.isSafeInteger(meta.endTurn) && meta.endTurn >= turn ? meta.endTurn : turn
  return { turn, endTurn, regeneration: meta.regeneration }
}

/**
 * The events of one live session.
 * @param session - live session.
 * @returns its events in log order.
 */
function sessionEvents(session) {
  const events = session?.snapshotEvents?.()
  return Array.isArray(events) ? events : []
}

/**
 * The turn an event belongs to.
 * @param event - session event.
 * @returns the turn number, or undefined for events that carry none.
 */
function eventTurn(event) {
  if (event.type === 'assistant/message' || event.type === 'tool/result') return event.data.turn
  return undefined
}

/**
 * The event range one turn occupies.
 *
 * A turn that was stopped by hand has no `turn/end` yet, so the bracket falls
 * back to the turn's last event: a question must stay locatable even while its
 * answer is incomplete.
 * @param events - session events.
 * @param turn - turn number.
 * @param targetSeq - position the bracket is measured around.
 * @returns the bracket, or undefined when the turn does not start before it.
 */
function turnBracket(events, turn, targetSeq) {
  const start = events.findLast((event) => event.seq <= targetSeq && event.type === 'turn/start' && event.data.turn === turn)
  if (start === undefined) return undefined
  const end = events.find((event) => event.seq >= targetSeq && event.type === 'turn/end' && event.data.turn === turn)
  if (end !== undefined) return { start: start.seq, end: end.seq }
  const lastOfTurn = events.findLast((event) => event.data?.turn === turn && event.seq > start.seq)
  if (lastOfTurn === undefined) return undefined
  return { start: start.seq, end: lastOfTurn.seq + 1 }
}

/**
 * The position one turn's closing event occupies.
 * @param events - session events.
 * @param turn - turn number.
 * @returns the closing event's position.
 * @throws {TurnError} when the turn never closed.
 */
function turnEndSeq(events, turn) {
  const end = events.find((event) => event.type === 'turn/end' && event.data.turn === turn)
  if (end === undefined) throw new TurnError('TURN_NOT_CLOSED', `turn ${String(turn)} is not closed`)
  return end.seq
}

/**
 * The append-origin events one turn owns.
 * @param events - session events.
 * @param turn - turn number.
 * @param targetSeq - position the turn is measured around.
 * @returns the positions the turn appended to the surface.
 */
function appendOriginsForTurn(events, turn, targetSeq) {
  const bracket = turnBracket(events, turn, targetSeq)
  if (bracket === undefined) throw new TurnError('TURN_NOT_CLOSED', `turn ${String(turn)} is not closed`)
  return new Set(events
    .filter((event) => isAppend(event) && ((event.seq > bracket.start && event.seq < bracket.end) || eventTurn(event) === turn))
    .map((event) => event.seq))
}

/**
 * The append-origin events behind one surface node.
 *
 * A node may be a replacement copy whose own origins reach further back, so
 * the answer is the transitive closure over `sourceEventSeqs`.
 * @param seq - surface node position.
 * @param events - session events.
 * @param memo - cache of answers already computed.
 * @param visiting - positions on the current path, for cycle safety.
 * @returns the positions the node ultimately derives from.
 */
function surfaceOrigins(seq, events, memo, visiting = new Set()) {
  const cached = memo.get(seq)
  if (cached !== undefined) return cached
  if (visiting.has(seq)) return new Set()
  visiting.add(seq)
  const event = events[seq]
  const origins = new Set()
  if (event !== undefined) {
    if (isAppend(event)) origins.add(seq)
    for (const source of event.sourceEventSeqs ?? []) {
      for (const origin of surfaceOrigins(source, events, memo, visiting)) origins.add(origin)
    }
  }
  visiting.delete(seq)
  memo.set(seq, origins)
  return origins
}

/**
 * The turns that closed at or after one turn.
 * @param events - session events.
 * @param startTurn - first turn of the range.
 * @returns the closed turns, in log order.
 */
function completedTurnsFrom(events, startTurn) {
  return events
    .filter((event) => event.type === 'turn/end' && event.data.turn >= startTurn)
    .map((event) => event.data.turn)
}

/**
 * The tombstone that already removed one turn.
 * @param events - session events.
 * @param turn - turn number.
 * @returns the tombstone event, or undefined when the turn is still present.
 */
function tombstoneForTurn(events, turn) {
  return events.find((event) => {
    const meta = tombstoneMeta(event)
    return meta !== undefined && turn >= meta.turn && turn <= meta.endTurn
  })
}

/**
 * The surface nodes one turn may be removed from.
 *
 * A turn can only be dropped when its nodes are still its own: a node shared
 * with a compacted range carries history this operation cannot reconstruct, so
 * the operation is refused instead of guessing.
 * @param session - live session.
 * @param events - session events.
 * @param turn - turn number.
 * @param targetSeq - position the turn is measured around.
 * @param options - the surface to select from, for the planning pass.
 * @returns the positions to shadow.
 * @throws {TurnError} when the turn is compacted, mixed, or gone.
 */
function selectTurnSurface(session, events, turn, targetSeq, options = {}) {
  const originSeqs = appendOriginsForTurn(events, turn, targetSeq)
  const nodes = options.nodes ?? session.surface.nodes
  // The first node carries the system head: only a system message may replace
  // it, so a user-message tombstone must leave it alone.
  const headSeq = nodes[0]
  const headProtected = headSeq !== undefined && events[headSeq]?.type === 'system/message'
  if (headProtected) originSeqs.delete(headSeq)
  const memo = new Map()
  const selected = []
  for (const seq of nodes) {
    if (headProtected && seq === headSeq) continue
    const origins = surfaceOrigins(seq, events, memo)
    if (![...origins].some((origin) => originSeqs.has(origin))) continue
    if ([...origins].some((origin) => !originSeqs.has(origin))) {
      throw new TurnError('TURN_COMPACTED', `turn ${String(turn)} shares a compacted surface node`)
    }
    selected.push(seq)
  }
  if (selected.length === 0) throw new TurnError('TARGET_NOT_FOUND', `turn ${String(turn)} has no live surface nodes`)
  const positions = selected.map((seq) => nodes.indexOf(seq))
  const first = positions[0]
  if (first === undefined || positions.some((position, index) => position !== first + index)) {
    throw new TurnError('TURN_COMPACTED', `turn ${String(turn)} is not a contiguous surface span`)
  }
  return selected
}

/**
 * One identified user message.
 * @param content - the message's content blocks.
 * @param source - the producer's source record.
 * @returns the message, ready to publish.
 */
function createUserMessage(content, source) {
  return { id: randomUUID(), role: 'user', content, source }
}

/**
 * Append the replacement that shadows one range.
 * @param session - live session.
 * @param turn - first removed turn.
 * @param endTurn - last removed turn.
 * @param selected - the surface positions to shadow.
 * @param regeneration - the regeneration this removal belongs to, when there is one.
 * @returns the appended event.
 */
function appendTombstone(session, turn, endTurn, selected, regeneration) {
  const summary = JSON.stringify({ turn, endTurn, ...(regeneration === undefined ? {} : { regeneration }) })
  const message = createUserMessage([], { kind: TOMBSTONE_SOURCE, form: 'notice', summary })
  return session.append('user/message', message, {
    surfaceOp: { op: 'replace', startSeq: selected[0], endSeq: selected.at(-1) },
    sourceEventSeqs: selected,
  })
}

/**
 * Whether the agent holds queued input.
 * @param agent - live agent.
 * @returns true when the inbox still has work waiting.
 */
function hasInboxPending(agent) {
  const inbox = agent?.inbox
  if (inbox === undefined || inbox === null) return false
  if (typeof inbox.hasPending === 'function') {
    try {
      return inbox.hasPending() === true
    } catch {
      return false
    }
  }
  if (inbox.hasPending === true) return true
  return (Array.isArray(inbox.nextTurn) && inbox.nextTurn.length > 0)
    || (Array.isArray(inbox.nextStep) && inbox.nextStep.length > 0)
}

/**
 * Whether the agent is doing work right now.
 * @param agent - live agent.
 * @returns true when a turn is running or input is queued.
 */
function isWorking(agent) {
  return agent?.status === 'running' || hasInboxPending(agent)
}

/**
 * Interrupt whatever the agent is doing, and wait for it to settle.
 *
 * A user who removes a turn while an answer is streaming has already decided
 * that the answer is not wanted, so the running turn is cancelled instead of
 * the operation being refused. The cancel also clears queued input, which the
 * removal shadows anyway.
 * @param agent - live agent.
 * @returns whether a running turn or queued input was interrupted.
 * @throws {TurnError} when the agent cannot be interrupted.
 */
async function interruptAgent(agent) {
  if (!isWorking(agent)) return false
  if (typeof agent.cancel !== 'function') {
    throw new TurnError('AGENT_BUSY', 'the session is working and cannot be interrupted')
  }
  agent.cancel({ kind: 'user' })
  if (typeof agent.whenIdle === 'function') await agent.whenIdle()
  return true
}

/**
 * Run one operation while the agent holds its maintenance lock.
 *
 * The lock is the agent's own: it keeps the operation from racing a running
 * turn. A transient race is awaited instead of refused, because a user who
 * clicks during a turn that is about to end expects the click to land.
 * @param agent - live agent.
 * @param task - the operation to run under the lock.
 * @returns the operation's result.
 */
async function runAgentMaintenance(agent, task) {
  if (typeof agent?.runMaintenance === 'function') {
    for (;;) {
      try {
        return await agent.runMaintenance(task)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!/already has active work/i.test(message) || typeof agent.whenIdle !== 'function') throw error
        await agent.whenIdle()
      }
    }
  }
  if (agent?.status === 'running' || hasInboxPending(agent)) {
    throw new TurnError('AGENT_BUSY', 'the session is running or has queued input; retry when it is idle')
  }
  const controller = new AbortController()
  return task(controller.signal)
}

/**
 * Remove one turn and every turn after it.
 *
 * The plan is made first and applied second: a range that cannot be removed
 * whole must not remove half of itself.
 * @param ctx - host context.
 * @param agent - the agent that owns the session.
 * @param turn - first removed turn.
 * @param signal - cancellation signal of the maintenance lock.
 * @param options - `flush` writes the removal to disk, `regeneration` names the operation.
 * @returns what was removed.
 */
function removeTurns(ctx, agent, turn, signal, options = {}) {
  const { flush = true, regeneration } = options
  signal.throwIfAborted()
  const session = agent.session
  const sessions = ctx.get('sessions')
  if (sessions?.get(session.id) !== session) {
    throw new TurnError('TARGET_NOT_FOUND', `session "${session.id}" is no longer live`)
  }
  const initialEvents = sessionEvents(session)
  const targetSeq = turnEndSeq(initialEvents, turn)
  if (turnBracket(initialEvents, turn, targetSeq) === undefined) {
    throw new TurnError('TURN_NOT_CLOSED', `turn ${String(turn)} is not closed`)
  }
  const requestedTurns = completedTurnsFrom(initialEvents, turn)
  if (requestedTurns.length === 0) throw new TurnError('TURN_NOT_CLOSED', `turn ${String(turn)} is not closed`)

  const removed = new Set(requestedTurns.filter((candidate) => tombstoneForTurn(initialEvents, candidate) !== undefined))
  const plan = []
  let simulated = [...session.surface.nodes]
  for (const candidate of [...requestedTurns].reverse()) {
    signal.throwIfAborted()
    if (removed.has(candidate)) continue
    const events = sessionEvents(session)
    const assistant = events.findLast((event) => event.type === 'assistant/message' && isAppend(event)
      && event.data.turn === candidate && simulated.includes(event.seq))
      ?? events.findLast((event) => event.type === 'assistant/message' && isAppend(event) && event.data.turn === candidate)
    const selectSeq = assistant?.seq ?? turnEndSeq(events, candidate)
    const selected = selectTurnSurface(session, events, candidate, selectSeq, { nodes: simulated })
    const start = simulated.indexOf(selected[0])
    simulated = [...simulated.slice(0, start), -1, ...simulated.slice(start + selected.length)]
    plan.push({ turn: candidate, selected })
  }

  const endTurn = requestedTurns.at(-1)
  const seqs = []
  const deletedTurns = []
  for (const item of plan) {
    signal.throwIfAborted()
    const tombstone = appendTombstone(session, turn, endTurn, item.selected, regeneration)
    deletedTurns.unshift(item.turn)
    seqs.unshift(tombstone.seq)
  }
  const result = { turn, endTurn, seqs, deletedTurns, alreadyDeleted: seqs.length === 0 }
  if (!flush) return result
  return sessions.flush(session).then((durable) => {
    if (durable !== true) {
      throw new Error('the removal was applied in memory but no persistence listener confirmed a durable flush')
    }
    return result
  })
}

/**
 * The question one message identity names.
 *
 * The page addresses a question by its message id rather than by a turn number:
 * a turn may hold several questions the user sent while it ran, and only the one
 * that was clicked may be replayed.
 * @param events - session events.
 * @param messageId - the question's message identity.
 * @returns the turn the question belongs to, and the question event.
 * @throws {TurnError} when no turn carries that question.
 */
export function locateQuestion(events, messageId) {
  const question = events.find((event) => event.type === 'user/message'
    && isAppend(event)
    && event.data?.id === messageId)
  if (question === undefined) {
    throw new TurnError('PROMPT_NOT_FOUND', `no question carries the message id "${messageId}"`)
  }
  const start = events.findLast((event) => event.type === 'turn/start' && event.seq < question.seq)
  if (start === undefined) {
    throw new TurnError('TURN_NOT_CLOSED', `the question "${messageId}" is not inside a turn`)
  }
  return { turn: start.data.turn, question }
}

/**
 * The plain text of one question.
 * @param question - the question event.
 * @returns its text.
 * @throws {TurnError} when the question is empty or not plain text.
 */
function textOfQuestion(question) {
  const content = question.data?.content
  if (!Array.isArray(content) || content.length === 0) {
    throw new TurnError('PROMPT_NOT_FOUND', `the question "${String(question.data?.id)}" is empty`)
  }
  if (content.some((part) => part.type !== 'text')) {
    throw new TurnError('PROMPT_UNSUPPORTED', `the question "${String(question.data?.id)}" is not plain text`)
  }
  return content.map((part) => part.text).join('')
}

/**
 * Every turn range a tombstone removed, in log order.
 * @param events - session events.
 * @returns `[first turn, last turn]` pairs.
 */
export function removedRanges(events) {
  const ranges = []
  for (const event of events) {
    const meta = tombstoneMeta(event)
    if (meta !== undefined) ranges.push([meta.turn, meta.endTurn])
  }
  return ranges
}


/**
 * The tombstone of one regeneration.
 * @param events - session events.
 * @param operationId - the operation's identity.
 * @returns the tombstone event, or undefined.
 */
function regenerationTombstone(events, operationId) {
  return events.find((event) => tombstoneMeta(event)?.regeneration?.operationId === operationId)
}

/**
 * The replay message of one regeneration.
 * @param events - session events.
 * @param operationId - the operation's identity.
 * @returns the replayed message identity, or undefined.
 */
function replayMessageId(events, operationId) {
  const replay = events.find((event) => event.type === 'agent/inbox/spliced'
    && event.data.inserted?.[0]?.source?.rpcId === `${REPLAY_RPC_PREFIX}${operationId}`)
  return replay?.data.inserted?.[0]?.id
}

/**
 * Remove a turn and re-send its question, optionally with edited text.
 *
 * The removal and the replay share one operation identity, so a retry after a
 * crash finishes the same operation instead of replaying the question twice.
 * @param ctx - host context.
 * @param agent - the agent that owns the session.
 * @param target - the turn to cut from, and the question that was clicked.
 * @param operationId - the operation's identity.
 * @param signal - cancellation signal of the maintenance lock.
 * @param options - `text` replaces the question's text.
 * @returns the removal and the replayed message.
 */
function regenerateTurn(ctx, agent, target, operationId, signal, options = {}) {
  const session = agent.session
  const events = sessionEvents(session)
  const prior = regenerationTombstone(events, operationId)
  const priorReplay = replayMessageId(events, operationId)
  if (prior !== undefined && priorReplay !== undefined) {
    const related = events
      .map((event) => ({ event, meta: tombstoneMeta(event) }))
      .filter(({ meta }) => meta?.regeneration?.operationId === operationId)
    return {
      deletion: {
        turn: Math.min(...related.map(({ meta }) => meta.turn)),
        endTurn: Math.max(...related.map(({ meta }) => meta.endTurn ?? meta.turn)),
        seqs: related.map(({ event }) => event.seq),
        deletedTurns: [],
        alreadyDeleted: true,
      },
      replayMessageId: priorReplay,
      alreadyRegenerated: true,
    }
  }
  if (hasInboxPending(agent)) {
    throw new TurnError('QUEUE_NOT_EMPTY', 'the session has queued input; retry when the queue is empty')
  }
  const text = typeof options.text === 'string' ? options.text : textOfQuestion(target.question)
  const removal = removeTurns(ctx, agent, target.turn, signal, { flush: false, regeneration: { operationId } })
  signal.throwIfAborted()
  const replay = createUserMessage([{ type: 'text', text }], { kind: 'user', rpcId: `${REPLAY_RPC_PREFIX}${operationId}` })
  agent.followup(replay)
  return ctx.get('sessions').flush(session).then(() => ({
    deletion: removal,
    replayMessageId: replay.id,
    alreadyRegenerated: false,
  }))
}

/**
 * Remove the turn one question belongs to and re-send that question.
 * @param ctx - host context.
 * @param agent - the agent that owns the session.
 * @param messageId - the identity of the question that was clicked.
 * @param operationId - the operation's identity.
 * @param text - the replacement question, when the user edited it.
 * @returns the removal, the replayed message, and whether a running turn was
 *   interrupted for it.
 */
export async function regenerateFromTurn(ctx, agent, messageId, operationId, text) {
  try {
    const interrupted = await interruptAgent(agent)
    const target = await runAgentMaintenance(agent, async () => {
      const live = agent.session
      const sessions = ctx.get('sessions')
      if (sessions?.get(live.id) !== live) {
        throw new TurnError('TARGET_NOT_FOUND', `session "${live.id}" is no longer live`)
      }
      return locateQuestion(sessionEvents(live), messageId)
    })
    const result = await runAgentMaintenance(agent, (signal) => regenerateTurn(ctx, agent, target, operationId, signal, { text }))
    // A retry that finished an earlier operation interrupted nothing, and the
    // caller must not report an interruption that did not happen.
    return { ...result, interrupted: interrupted && result.alreadyRegenerated !== true }
  } catch (error) {
    if (error instanceof TurnError) throw error
    throw new TurnError('REGENERATE_FAILED', error instanceof Error ? error.message : String(error))
  }
}

/**
 * Read one question's text.
 * @param session - live session.
 * @param messageId - the question's message identity.
 * @returns the question's text.
 */
export function readQuestionText(session, messageId) {
  const { question } = locateQuestion(sessionEvents(session), messageId)
  return textOfQuestion(question)
}
