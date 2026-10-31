/**
 * Question-level conversation editing: re-sending one question, and re-sending
 * it with edited text.
 *
 * The session log is append-only, so a removal is not an erase: the plugin
 * appends a replacement that shadows the removed range on the model-visible
 * surface. The original events stay in the log; what changes is what the model
 * reads and what the transcript shows from now on.
 *
 * The unit of removal is one question, not one turn. Input a user sends while
 * the agent works is delivered inside the running turn, so one turn can hold
 * several questions; re-sending one of them has to leave the questions before
 * it, and the work they caused, in place.
 *
 * The replacement is an empty `user/message` that names the removed range in its
 * source summary. An empty user message never enters the model context, so the
 * shadowed range leaves the conversation without leaving a hole in it.
 *
 * @module dsh-better-session/manage/turns
 */
import { randomUUID } from 'node:crypto'

/** Producer kind of the replacement that shadows a removed range. */
export const TOMBSTONE_SOURCE = 'dsh-better-session-question-delete'

/** Prefix of the replay message identity, so one resend is one operation. */
export const REPLAY_RPC_PREFIX = 'dsh-better-session-resend:'

/**
 * A refusal the caller can act on: the code says what kind of refusal it was,
 * the message says why.
 */
export class EditError extends Error {
  /**
   * @param code - machine-readable reason.
   * @param message - human-readable reason, safe to log.
   */
  constructor(code, message) {
    super(message)
    this.name = 'EditError'
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
 * @returns the removed range, or undefined when the event is not a tombstone.
 */
export function tombstoneMeta(event) {
  if (event.type !== 'user/message' || !isReplacement(event)) return undefined
  if (!Array.isArray(event.data?.content) || event.data.content.length !== 0) return undefined
  let meta = {}
  try {
    const parsed = JSON.parse(event.data?.source?.summary ?? '')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed
  } catch {
    meta = {}
  }
  const turn = Number.isSafeInteger(meta.turn) && meta.turn >= 0 ? meta.turn : undefined
  if (turn === undefined) return undefined
  const endTurn = Number.isSafeInteger(meta.endTurn) && meta.endTurn >= turn ? meta.endTurn : turn
  const question = typeof meta.question === 'string' && meta.question.length > 0 ? meta.question : undefined
  const operationId = typeof meta.resend?.operationId === 'string' ? meta.resend.operationId : undefined
  return { turn, endTurn, question, operationId }
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
 * The greatest turn number the log has reached.
 *
 * The answer bounds what a removal covers: every turn up to and including it
 * loses its surface, and a turn the replay starts afterwards is a later one.
 * @param events - session events.
 * @returns the greatest turn number, or 0 for a log without turns.
 */
function lastTurn(events) {
  let last = 0
  for (const event of events) {
    const turn = event.data?.turn
    if (Number.isSafeInteger(turn) && turn > last) last = turn
  }
  return last
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
 * The surface nodes a cut sends away: everything the surface holds from the cut
 * onward, in surface order.
 *
 * A node belongs to the cut's own side when every append-origin behind it sits
 * at or after the cut. A node that also reaches before it carries history this
 * operation cannot reconstruct — only a compaction produces one — so the removal
 * is refused instead of guessing.
 * @param session - live session.
 * @param events - session events.
 * @param cutSeq - the clicked question's log position.
 * @returns the positions to shadow.
 * @throws {EditError} when a node straddles the cut or the range is not contiguous.
 */
function shadowedNodes(session, events, cutSeq) {
  const nodes = session.surface.nodes
  // The first node carries the system head: only a system message may replace
  // it, so a user-message tombstone must leave it alone.
  const headSeq = nodes[0]
  const headProtected = headSeq !== undefined && events[headSeq]?.type === 'system/message'
  const memo = new Map()
  const selected = []
  for (const seq of nodes) {
    if (headProtected && seq === headSeq) continue
    const origins = [...surfaceOrigins(seq, events, memo)]
    if (origins.length === 0 || !origins.some((origin) => origin >= cutSeq)) continue
    if (origins.some((origin) => origin < cutSeq)) {
      throw new EditError('RANGE_COMPACTED', 'the removed range shares a surface node with earlier history')
    }
    selected.push(seq)
  }
  const first = selected.length === 0 ? -1 : nodes.indexOf(selected[0])
  if (selected.some((seq, index) => nodes.indexOf(seq) !== first + index)) {
    throw new EditError('RANGE_COMPACTED', 'the removed range is not one contiguous surface span')
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
 * @param meta - the range, the question, and the operation that asked for it.
 * @param selected - the surface positions to shadow.
 * @returns the appended event.
 */
function appendTombstone(session, meta, selected) {
  const summary = JSON.stringify({
    turn: meta.turn,
    endTurn: meta.endTurn,
    question: meta.question,
    ...(meta.operationId === undefined ? {} : { resend: { operationId: meta.operationId } }),
  })
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
 * A user who re-sends a question while an answer is streaming has already
 * decided that the answer is not wanted, so the running turn is cancelled
 * instead of the operation being refused. The cancel also clears queued input,
 * which the removal shadows anyway.
 * @param agent - live agent.
 * @returns whether a running turn or queued input was interrupted.
 * @throws {EditError} when the agent cannot be interrupted.
 */
async function interruptAgent(agent) {
  if (!isWorking(agent)) return false
  if (typeof agent.cancel !== 'function') {
    throw new EditError('AGENT_BUSY', 'the session is working and cannot be interrupted')
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
    throw new EditError('AGENT_BUSY', 'the session is running or has queued input; retry when it is idle')
  }
  const controller = new AbortController()
  return task(controller.signal)
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
 * @throws {EditError} when no turn carries that question.
 */
export function locateQuestion(events, messageId) {
  const question = events.find((event) => event.type === 'user/message'
    && isAppend(event)
    && event.data?.id === messageId)
  if (question === undefined) {
    throw new EditError('PROMPT_NOT_FOUND', `no question carries the message id "${messageId}"`)
  }
  const start = events.findLast((event) => event.type === 'turn/start' && event.seq < question.seq)
  if (start === undefined) {
    throw new EditError('PROMPT_NOT_FOUND', `the question "${messageId}" is not inside a turn`)
  }
  return { turn: start.data.turn, question }
}

/**
 * The plain text of one question.
 * @param question - the question event.
 * @returns its text.
 * @throws {EditError} when the question is empty or not plain text.
 */
function textOfQuestion(question) {
  const content = question.data?.content
  if (!Array.isArray(content) || content.length === 0) {
    throw new EditError('PROMPT_NOT_FOUND', `the question "${String(question.data?.id)}" is empty`)
  }
  if (content.some((part) => part.type !== 'text')) {
    throw new EditError('PROMPT_UNSUPPORTED', `the question "${String(question.data?.id)}" is not plain text`)
  }
  return content.map((part) => part.text).join('')
}

/**
 * Shadow one question and everything the surface holds after it.
 *
 * The plan is made in one pass over the surface and applied in one append: a
 * range that cannot be shadowed whole must not shadow half of itself.
 * @param ctx - host context.
 * @param agent - the agent that owns the session.
 * @param messageId - the question's message identity.
 * @param signal - cancellation signal of the maintenance lock.
 * @param options - `flush` writes the removal to disk, `operationId` names the resend.
 * @returns what was removed.
 * @throws {EditError} when the session is gone or the range cannot be removed whole.
 */
function shadowFromQuestion(ctx, agent, messageId, signal, options = {}) {
  const { flush = true, operationId } = options
  signal.throwIfAborted()
  const session = agent.session
  const sessions = ctx.get('sessions')
  if (sessions?.get(session.id) !== session) {
    throw new EditError('TARGET_NOT_FOUND', `session "${session.id}" is no longer live`)
  }
  const events = sessionEvents(session)
  const { turn, question } = locateQuestion(events, messageId)
  const removal = {
    turn,
    endTurn: lastTurn(events),
    question: messageId,
    seqs: [],
    alreadyDeleted: false,
  }
  const selected = shadowedNodes(session, events, question.seq)
  if (selected.length === 0) return { ...removal, alreadyDeleted: true }
  const tombstone = appendTombstone(session, { ...removal, operationId }, selected)
  removal.seqs = [tombstone.seq]
  if (!flush) return removal
  return sessions.flush(session).then((durable) => {
    if (durable !== true) {
      throw new Error('the removal was applied in memory but no persistence listener confirmed a durable flush')
    }
    return removal
  })
}

/**
 * The tombstone of one resend.
 * @param events - session events.
 * @param operationId - the operation's identity.
 * @returns the tombstone event, or undefined.
 */
function resendTombstone(events, operationId) {
  return events.find((event) => tombstoneMeta(event)?.operationId === operationId)
}

/**
 * The replay message of one resend.
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
 * Re-send one question: shadow it and everything after it, then ask it again.
 *
 * The removal and the replay share one operation identity, so a retry after a
 * crash finishes the same operation instead of replaying the question twice.
 * @param ctx - host context.
 * @param agent - the agent that owns the session.
 * @param messageId - the identity of the question that was clicked.
 * @param operationId - the operation's identity.
 * @param text - the replacement question, when the user edited it.
 * @returns the removal, the replayed message, and whether a running turn was
 *   interrupted for it.
 */
export async function resendQuestion(ctx, agent, messageId, operationId, text) {
  try {
    const interrupted = await interruptAgent(agent)
    return await runAgentMaintenance(agent, async (signal) => {
      const session = agent.session
      const sessions = ctx.get('sessions')
      if (sessions?.get(session.id) !== session) {
        throw new EditError('TARGET_NOT_FOUND', `session "${session.id}" is no longer live`)
      }
      const events = sessionEvents(session)
      const prior = resendTombstone(events, operationId)
      const priorReplay = replayMessageId(events, operationId)
      if (prior !== undefined && priorReplay !== undefined) {
        const meta = tombstoneMeta(prior)
        return {
          removal: {
            turn: meta.turn,
            endTurn: meta.endTurn,
            question: meta.question,
            seqs: [prior.seq],
            alreadyDeleted: true,
          },
          replayMessageId: priorReplay,
          // A retry that finished an earlier operation interrupted nothing, and
          // the caller must not report an interruption that did not happen.
          interrupted: false,
        }
      }
      if (hasInboxPending(agent)) {
        throw new EditError('QUEUE_NOT_EMPTY', 'the session has queued input; retry when the queue is empty')
      }
      const question = locateQuestion(events, messageId).question
      const replayText = typeof text === 'string' ? text : textOfQuestion(question)
      const removal = await shadowFromQuestion(ctx, agent, messageId, signal, { flush: false, operationId })
      signal.throwIfAborted()
      const replay = createUserMessage([{ type: 'text', text: replayText }], { kind: 'user', rpcId: `${REPLAY_RPC_PREFIX}${operationId}` })
      agent.followup(replay)
      await sessions.flush(agent.session)
      return { removal, replayMessageId: replay.id, interrupted }
    })
  } catch (error) {
    if (error instanceof EditError) throw error
    throw new EditError('RESEND_FAILED', error instanceof Error ? error.message : String(error))
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
