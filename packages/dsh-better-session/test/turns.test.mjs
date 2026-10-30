/**
 * Turn removal and replay checks for the session management sub-component: what
 * one removal shadows, which turns a regeneration takes with it, and the
 * operation identity that keeps a retry from asking twice.
 *
 * A removal is read from the session log and planned before it is applied, so
 * the fakes here are a log, a surface, and an Agent that records what it was
 * asked to replay.
 */
import assert from 'node:assert/strict'
import { regenerateFromTurn, tombstoneMeta } from '../src/turns.js'
import { removeHome, resetHome } from './support.mjs'

/**
 * One conversation: two turns, each a question and an answer.
 * @returns the events, in log order.
 */
function twoTurns() {
  return [
    { seq: 0, type: 'system/message', data: { content: [{ type: 'text', text: 'system' }] }, surfaceOp: 'append' },
    { seq: 1, type: 'turn/start', data: { turn: 0 } },
    { seq: 2, type: 'user/message', data: { id: 'question-one', role: 'user', content: [{ type: 'text', text: 'question one' }], source: { kind: 'user' } }, surfaceOp: 'append' },
    { seq: 3, type: 'assistant/message', data: { turn: 0, message: { id: 'answer-0' } }, surfaceOp: 'append' },
    { seq: 4, type: 'turn/end', data: { turn: 0 } },
    { seq: 5, type: 'turn/start', data: { turn: 1 } },
    { seq: 6, type: 'user/message', data: { id: 'question-two', role: 'user', content: [{ type: 'text', text: 'question two' }], source: { kind: 'user' } }, surfaceOp: 'append' },
    { seq: 7, type: 'assistant/message', data: { turn: 1, message: { id: 'answer-1' } }, surfaceOp: 'append' },
    { seq: 8, type: 'turn/end', data: { turn: 1 } },
  ]
}

/**
 * A live session over a fixed event log.
 * @param events - the events the session starts with.
 * @param nodes - the surface the session starts with; the append events by default.
 * @returns the session and the log it appends to.
 */
function fakeSession(events, nodes) {
  const log = events.map((event) => ({ ...event }))
  const state = {
    nodes: nodes ?? log.filter((event) => event.surfaceOp === 'append').map((event) => event.seq),
    appended: [],
  }
  const session = {
    id: 'session-turn',
    get surface() {
      return { nodes: [...state.nodes] }
    },
    snapshotEvents: () => log.map((event) => ({ ...event })),
    append(type, data, options = {}) {
      const seq = log.length
      const replacement = options.surfaceOp?.op === 'replace'
      const event = {
        seq,
        type,
        data,
        ...(replacement ? { surfaceOp: 'replace' } : options.surface === false ? {} : { surfaceOp: 'append' }),
        sourceEventSeqs: options.sourceEventSeqs ?? [],
      }
      log.push(event)
      state.appended.push(event)
      if (replacement) {
        const start = state.nodes.indexOf(options.surfaceOp.startSeq)
        const end = state.nodes.indexOf(options.surfaceOp.endSeq)
        state.nodes.splice(start, end - start + 1, seq)
      } else {
        state.nodes.push(seq)
      }
      return event
    },
  }
  return { session, state, log }
}

/**
 * The Host context the turn engine reads.
 * @param session - the live session.
 * @param options - whether the agent is working, and which turn its work belongs
 *   to; cancelling that work closes that turn, the way the Harness does.
 * @returns the context plus the spies the checks assert on.
 */
function fakeHost(session, { status = 'idle', runningTurn } = {}) {
  const state = { flushes: 0, followed: [], cancelled: [], waits: 0 }
  const ctx = {
    get: (name) => {
      if (name === 'sessions') {
        return {
          get: (id) => (id === session.id ? session : undefined),
          flush: async () => {
            state.flushes += 1
            return true
          },
        }
      }
      return undefined
    },
  }
  const agent = {
    session,
    status,
    inbox: { hasPending: () => false },
    cancel: (cause) => {
      state.cancelled.push(cause)
      // Cancelling aborts the running turn, which closes it, and clears the
      // queue with it.
      agent.status = 'idle'
      agent.inbox.hasPending = () => false
      if (runningTurn !== undefined) session.append('turn/end', { turn: runningTurn }, { surface: false })
    },
    whenIdle: async () => {
      state.waits += 1
    },
    runMaintenance: async (task) => task(new AbortController().signal),
    followup: (message) => {
      state.followed.push(message)
      // The Harness records the queued message in the log; the operation
      // identity of that record is what makes a retry idempotent.
      session.append('agent/inbox/spliced', { inserted: [{ id: message.id, source: message.source }] })
    },
  }
  return { ctx, agent, state }
}

await resetHome()

try {
  // Regenerating a turn replaces exactly that turn's surface nodes.
  {
    const { session, state } = fakeSession(twoTurns())
    const { ctx, agent } = fakeHost(session)
    const result = await regenerateFromTurn(ctx, agent, 'question-two', 'operation-a')
    assert.deepEqual(result.deletion.deletedTurns, [1])
    assert.equal(result.deletion.turn, 1)
    assert.equal(result.deletion.endTurn, 1)
    const replacements = state.appended.filter((event) => event.type === 'user/message')
    assert.equal(replacements.length, 1, 'one replacement is appended')
    const tombstone = replacements[0]
    assert.deepEqual(tombstone.data.content, [], 'the replacement carries no content')
    assert.deepEqual(tombstone.sourceEventSeqs, [6, 7], 'the replaced range is this turn\'s own nodes')
    assert.deepEqual(tombstone.data.source.kind, 'dsh-better-session-turn-delete')
    const meta = tombstoneMeta(tombstone)
    assert.equal(meta.turn, 1)
    assert.equal(meta.endTurn, 1)
    assert.deepEqual(state.nodes.slice(0, 4), [0, 2, 3, 9], 'the removed nodes leave the surface')
  }

  // Regenerating an earlier turn removes every turn after it too.
  {
    const { session, state } = fakeSession(twoTurns())
    const { ctx, agent } = fakeHost(session)
    const result = await regenerateFromTurn(ctx, agent, 'question-one', 'operation-b')
    assert.deepEqual(result.deletion.deletedTurns, [0, 1])
    assert.equal(result.deletion.endTurn, 1)
    const replacements = state.appended.filter((event) => event.type === 'user/message')
    assert.equal(replacements.length, 2, 'one replacement per removed turn')
    assert.deepEqual(replacements.map((event) => event.sourceEventSeqs), [[6, 7], [2, 3]])
    assert.deepEqual(state.nodes.slice(0, 3), [0, 10, 9], 'both turns leave the surface, in conversation order')
  }

  // A turn that shares a compacted node is refused instead of guessed.
  {
    const events = twoTurns()
    events[7] = {
      seq: 7,
      type: 'assistant/message',
      data: { turn: 1, message: { id: 'answer-1' } },
      surfaceOp: 'replace',
      sourceEventSeqs: [2, 3, 6, 7],
    }
    const { session } = fakeSession(events, [0, 2, 3, 6, 7])
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => regenerateFromTurn(ctx, agent, 'question-two', 'operation-c'), (error) => {
      assert.equal(error.code, 'TURN_COMPACTED')
      return true
    })
  }

  // A turn that never closed is refused.
  {
    const events = twoTurns().filter((event) => event.type !== 'turn/end' || event.data.turn !== 1)
    const { session } = fakeSession(events)
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => regenerateFromTurn(ctx, agent, 'question-two', 'operation-d'), (error) => {
      assert.equal(error.code, 'TURN_NOT_CLOSED')
      return true
    })
  }

  // Regenerating removes the turn and asks the original question again.
  {
    const { session, state } = fakeSession(twoTurns())
    const { ctx, agent, state: host } = fakeHost(session)
    const result = await regenerateFromTurn(ctx, agent, 'question-one', 'operation-one')
    assert.deepEqual(result.deletion.deletedTurns, [0, 1])
    assert.equal(host.followed.length, 1, 'the question is asked once')
    const replay = host.followed[0]
    assert.equal(replay.role, 'user')
    assert.deepEqual(replay.content, [{ type: 'text', text: 'question one' }])
    assert.equal(replay.source.rpcId, 'dsh-better-session-regenerate:operation-one')
    assert.equal(host.flushes, 1, 'the removal is written to disk')
    const replacements = state.appended.filter((event) => event.type === 'user/message')
    assert.equal(replacements.length, 2, 'the two turns are replaced')
  }

  // Editing asks the edited question instead.
  {
    const { session } = fakeSession(twoTurns())
    const { ctx, agent, state: host } = fakeHost(session)
    await regenerateFromTurn(ctx, agent, 'question-one', 'operation-two', 'question one, edited')
    assert.deepEqual(host.followed[0].content, [{ type: 'text', text: 'question one, edited' }])
  }

  // The same operation identity never asks the question twice.
  {
    const { session } = fakeSession(twoTurns())
    const { ctx, agent, state: host } = fakeHost(session)
    await regenerateFromTurn(ctx, agent, 'question-one', 'operation-three')
    const again = await regenerateFromTurn(ctx, agent, 'question-one', 'operation-three')
    assert.equal(again.alreadyRegenerated, true)
    assert.equal(host.followed.length, 1, 'the question is asked once')
  }

  // A turn whose answer is still streaming is interrupted, then removed: the
  // user has already said the answer is not wanted, so the operation must not
  // wait for it or refuse.
  {
    const events = [
      ...twoTurns(),
      { seq: 9, type: 'turn/start', data: { turn: 2 } },
      { seq: 10, type: 'user/message', data: { id: 'question-three', role: 'user', content: [{ type: 'text', text: 'question three' }], source: { kind: 'user' } }, surfaceOp: 'append' },
      { seq: 11, type: 'assistant/message', data: { turn: 2, message: { id: 'answer-2' } }, surfaceOp: 'append' },
    ]
    const { session, state } = fakeSession(events)
    const { ctx, agent, state: host } = fakeHost(session, { status: 'running', runningTurn: 2 })
    const result = await regenerateFromTurn(ctx, agent, 'question-three', 'operation-running')
    assert.equal(result.interrupted, true, 'the running turn is reported as interrupted')
    assert.deepEqual(host.cancelled, [{ kind: 'user' }], 'the running work is cancelled as the user\'s own')
    assert.equal(host.waits, 1, 'the removal waits for the turn to close')
    assert.deepEqual(result.deletion.deletedTurns, [2])
    assert.deepEqual(host.followed[0].content, [{ type: 'text', text: 'question three' }])
    const tombstone = state.appended.find((event) => event.type === 'user/message')
    assert.deepEqual(tombstone.sourceEventSeqs, [10, 11], 'the interrupted answer is shadowed with its turn')
  }

  // An idle session is left alone, and says so.
  {
    const { session } = fakeSession(twoTurns())
    const { ctx, agent, state } = fakeHost(session)
    const result = await regenerateFromTurn(ctx, agent, 'question-two', 'operation-idle')
    assert.equal(result.interrupted, false)
    assert.deepEqual(state.cancelled, [])
    assert.equal(state.waits, 0)
  }

  // Queued input is dropped with the answer it followed: the removal shadows
  // that range anyway, so waiting for the queue would be waiting for work the
  // user just discarded.
  {
    const { session } = fakeSession(twoTurns())
    const { ctx, agent, state } = fakeHost(session)
    agent.inbox.hasPending = () => true
    const result = await regenerateFromTurn(ctx, agent, 'question-one', 'operation-queue')
    assert.equal(result.interrupted, true)
    assert.deepEqual(state.cancelled, [{ kind: 'user' }])
    assert.equal(state.followed.length, 1, 'the edited question still goes out')
  }

  // A question sent while the turn ran is the question that comes back: the
  // removal covers its turn, the text comes from the message that was clicked.
  {
    const events = [
      ...twoTurns().slice(0, 8),
      { seq: 8, type: 'user/message', data: { id: 'steer-two', role: 'user', content: [{ type: 'text', text: 'do it differently' }], source: { kind: 'user' } }, surfaceOp: 'append' },
      { seq: 9, type: 'turn/end', data: { turn: 1 } },
    ]
    const { session } = fakeSession(events)
    const { ctx, agent, state } = fakeHost(session)
    const result = await regenerateFromTurn(ctx, agent, 'steer-two', 'operation-steer')
    assert.deepEqual(result.deletion.deletedTurns, [1])
    assert.deepEqual(state.followed[0].content, [{ type: 'text', text: 'do it differently' }])
  }

  // A question this session does not hold is refused with the code the browser
  // side reads.
  {
    const { session } = fakeSession(twoTurns())
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => regenerateFromTurn(ctx, agent, 'no-such-question', 'operation-missing'), (error) => {
      assert.equal(error.code, 'PROMPT_NOT_FOUND')
      return true
    })
  }

  console.log('manage: turn removal and replay checks passed')
} finally {
  await removeHome()
}
