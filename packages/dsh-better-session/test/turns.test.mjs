/**
 * Question removal and replay checks for the session management sub-component:
 * what one resend shadows, which questions survive it, and the operation
 * identity that keeps a retry from asking twice.
 *
 * A removal is read from the session log and planned before it is applied, so
 * the fakes here are a log, a surface, and an Agent that records what it was
 * asked to replay.
 */
import assert from 'node:assert/strict'
import { readQuestion, resendQuestion, tombstoneMeta } from '../src/turns.js'
import { removeHome, resetHome } from './support.mjs'

/** One durable image reference, as the attachment service records it. */
const IMAGE = Object.freeze({
  attachmentId: 'sha256:11',
  mediaType: 'image/png',
  bytes: 64,
  width: 2,
  height: 2,
  name: 'chart.png',
})

/** One durable file reference, as the attachment service records it. */
const FILE = Object.freeze({ attachmentId: 'sha256:22', name: 'notes.pdf', bytes: 128 })

/**
 * One conversation whose first turn holds three questions.
 *
 * A question the user sends while the agent works is delivered inside the
 * running turn, so `question-two` and `question-three` sit in turn 0 between the
 * answers they steered, and `question-four` starts turn 1.
 * @returns the events, in log order.
 */
function conversation() {
  return [
    { seq: 0, type: 'system/message', data: { content: [{ type: 'text', text: 'system' }] }, surfaceOp: 'append' },
    { seq: 1, type: 'turn/start', data: { turn: 0 } },
    { seq: 2, type: 'user/message', data: question('question-one', 'question one'), surfaceOp: 'append' },
    { seq: 3, type: 'assistant/message', data: { turn: 0, message: { id: 'answer-one', content: [{ type: 'text', text: 'answer one' }] } }, surfaceOp: 'append' },
    { seq: 4, type: 'tool/result', data: { turn: 0, message: { id: 'result-one', content: [{ type: 'text', text: 'result one' }] } }, surfaceOp: 'append' },
    { seq: 5, type: 'user/message', data: question('question-two', 'question two'), surfaceOp: 'append' },
    { seq: 6, type: 'assistant/message', data: { turn: 0, message: { id: 'answer-two', content: [{ type: 'text', text: 'answer two' }] } }, surfaceOp: 'append' },
    { seq: 7, type: 'tool/result', data: { turn: 0, message: { id: 'result-two', content: [{ type: 'text', text: 'result two' }] } }, surfaceOp: 'append' },
    { seq: 8, type: 'user/message', data: question('question-three', 'question three'), surfaceOp: 'append' },
    { seq: 9, type: 'assistant/message', data: { turn: 0, message: { id: 'answer-three', content: [{ type: 'text', text: 'answer three' }] } }, surfaceOp: 'append' },
    { seq: 10, type: 'turn/end', data: { turn: 0 } },
    { seq: 11, type: 'turn/start', data: { turn: 1 } },
    { seq: 12, type: 'user/message', data: question('question-four', 'question four'), surfaceOp: 'append' },
    { seq: 13, type: 'assistant/message', data: { turn: 1, message: { id: 'answer-four', content: [{ type: 'text', text: 'answer four' }] } }, surfaceOp: 'append' },
    { seq: 14, type: 'turn/end', data: { turn: 1 } },
  ]
}

/**
 * One plain-text question the user sent.
 * @param id - the message identity.
 * @param text - its text.
 * @returns the event payload.
 */
function question(id, text) {
  return questionWithContent(id, [{ type: 'text', text }])
}

/**
 * One question with the exact content blocks it carried.
 * @param id - the message identity.
 * @param content - its content blocks.
 * @returns the event payload.
 */
function questionWithContent(id, content) {
  return { id, role: 'user', content, source: { kind: 'user' } }
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
      const surface = replacement || options.surface !== false
      const event = {
        seq,
        type,
        data,
        ...(replacement ? { surfaceOp: 'replace' } : surface ? { surfaceOp: 'append' } : {}),
        sourceEventSeqs: options.sourceEventSeqs ?? [],
      }
      log.push(event)
      state.appended.push(event)
      if (replacement) {
        const start = state.nodes.indexOf(options.surfaceOp.startSeq)
        const end = state.nodes.indexOf(options.surfaceOp.endSeq)
        state.nodes.splice(start, end - start + 1, seq)
      } else if (surface) {
        state.nodes.push(seq)
      }
      return event
    },
  }
  return { session, state, log }
}

/**
 * The Host context the resend engine reads.
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
      session.append('agent/inbox/spliced', { inserted: [{ id: message.id, source: message.source }] }, { surface: false })
    },
  }
  return { ctx, agent, state }
}

/** The tombstones one session appended, in log order. */
function tombstones(state) {
  return state.appended.filter((event) => event.type === 'user/message')
}

await resetHome()

try {
  // Re-sending a question the user sent while the turn ran keeps the questions
  // before it, and the work they caused: one turn is not one question.
  {
    const { session, state } = fakeSession(conversation())
    const { ctx, agent, state: host } = fakeHost(session)
    const result = await resendQuestion(ctx, agent, 'question-three', 'operation-mid-turn')
    assert.equal(result.removal.turn, 0)
    assert.equal(result.removal.endTurn, 1)
    const replacements = tombstones(state)
    assert.equal(replacements.length, 1, 'one replacement covers the whole removed range')
    assert.deepEqual(replacements[0].sourceEventSeqs, [8, 9, 12, 13], 'only question-three and what followed it is shadowed')
    assert.deepEqual(state.nodes, [0, 2, 3, 4, 5, 6, 7, 15], 'question-one, question-two and their work stay')
    assert.deepEqual(host.followed[0].content, [{ type: 'text', text: 'question three' }], 'the clicked question is asked again')
  }

  // The replacement names the question it starts at, so the page can hide the
  // rows from that question on rather than from the turn's first question.
  {
    const { session, state } = fakeSession(conversation())
    const { ctx, agent } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-two', 'operation-meta')
    const meta = tombstoneMeta(tombstones(state)[0])
    assert.deepEqual(meta, { turn: 0, endTurn: 1, question: 'question-two', operationId: 'operation-meta' })
  }

  // A question followed by its own answer and a later turn takes exactly that
  // much with it.
  {
    const { session, state } = fakeSession(conversation())
    const { ctx, agent } = fakeHost(session)
    const result = await resendQuestion(ctx, agent, 'question-four', 'operation-later-turn')
    assert.equal(result.removal.turn, 1)
    assert.equal(result.removal.endTurn, 1)
    assert.deepEqual(tombstones(state)[0].sourceEventSeqs, [12, 13])
    assert.deepEqual(state.nodes, [0, 2, 3, 4, 5, 6, 7, 8, 9, 15], 'turn 0 is untouched')
  }

  // Re-sending the turn's first question removes the turn and everything after
  // it, which is what a user who asks the same thing again expects.
  {
    const { session, state } = fakeSession(conversation())
    const { ctx, agent } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-one', 'operation-first')
    assert.deepEqual(tombstones(state)[0].sourceEventSeqs, [2, 3, 4, 5, 6, 7, 8, 9, 12, 13])
    assert.deepEqual(state.nodes, [0, 15])
  }

  // A range that shares a node with compacted history is refused instead of
  // guessed: the node belongs to both sides, and half of it cannot be removed.
  {
    const events = conversation()
    events[9] = {
      seq: 9,
      type: 'assistant/message',
      data: { turn: 0, message: { id: 'answer-three', content: [{ type: 'text', text: 'summary' }] } },
      surfaceOp: 'replace',
      sourceEventSeqs: [2, 8],
    }
    const { session } = fakeSession(events, [0, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13])
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => resendQuestion(ctx, agent, 'question-three', 'operation-compacted'), (error) => {
      assert.equal(error.code, 'RANGE_COMPACTED')
      return true
    })
  }

  // A system prompt at the head of the surface survives the removal.
  {
    const { session, state } = fakeSession(conversation())
    const { ctx, agent } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-one', 'operation-head')
    assert.equal(state.nodes[0], 0, 'the system message keeps its position')
  }

  // A running turn is interrupted, then the range is removed: the user has
  // already said the answer is not wanted, so the operation must not wait for it
  // or refuse.
  {
    const events = conversation().filter((event) => event.seq <= 9)
    const { session, state } = fakeSession(events, [0, 2, 3, 4, 5, 6, 7, 8, 9])
    const { ctx, agent, state: host } = fakeHost(session, { status: 'running', runningTurn: 0 })
    const result = await resendQuestion(ctx, agent, 'question-three', 'operation-running')
    assert.equal(result.interrupted, true, 'the running turn is reported as interrupted')
    assert.deepEqual(host.cancelled, [{ kind: 'user' }], 'the running work is cancelled as the user\'s own')
    assert.equal(host.waits, 1, 'the removal waits for the turn to close')
    assert.deepEqual(tombstones(state)[0].sourceEventSeqs, [8, 9], 'the interrupted answer is shadowed with its question')
    assert.deepEqual(host.followed[0].content, [{ type: 'text', text: 'question three' }])
  }

  // An idle session is left alone, and says so.
  {
    const { session } = fakeSession(conversation())
    const { ctx, agent, state } = fakeHost(session)
    const result = await resendQuestion(ctx, agent, 'question-four', 'operation-idle')
    assert.equal(result.interrupted, false)
    assert.deepEqual(state.cancelled, [])
    assert.equal(state.waits, 0)
  }

  // Queued input is dropped with the answer it followed: the removal shadows
  // that range anyway, so waiting for the queue would be waiting for work the
  // user just discarded.
  {
    const { session } = fakeSession(conversation())
    const { ctx, agent, state } = fakeHost(session)
    agent.inbox.hasPending = () => true
    const result = await resendQuestion(ctx, agent, 'question-one', 'operation-queue')
    assert.equal(result.interrupted, true)
    assert.deepEqual(state.cancelled, [{ kind: 'user' }])
    assert.equal(state.followed.length, 1, 'the question still goes out')
  }

  // Editing asks the edited question instead.
  {
    const { session } = fakeSession(conversation())
    const { ctx, agent, state: host } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-three', 'operation-edited', 'question three, edited')
    assert.deepEqual(host.followed[0].content, [{ type: 'text', text: 'question three, edited' }])
  }

  // The same operation identity never asks the question twice.
  {
    const { session } = fakeSession(conversation())
    const { ctx, agent, state: host } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-three', 'operation-retry')
    const again = await resendQuestion(ctx, agent, 'question-three', 'operation-retry')
    assert.equal(again.removal.alreadyDeleted, true)
    assert.equal(again.interrupted, false, 'a retry reports no interruption')
    assert.equal(host.followed.length, 1, 'the question is asked once')
  }

  // A question the log does not hold is refused with the code the page reads.
  {
    const { session } = fakeSession(conversation())
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => resendQuestion(ctx, agent, 'no-such-question', 'operation-missing'), (error) => {
      assert.equal(error.code, 'PROMPT_NOT_FOUND')
      return true
    })
  }

  // A question that carries an image is re-sent with it: the image is a durable
  // reference, not text, so the replay has to carry the block itself.
  {
    const events = conversation()
    events[8] = {
      seq: 8,
      type: 'user/message',
      data: questionWithContent('question-three', [
        { type: 'text', text: 'question three' },
        { type: 'image', attachment: IMAGE },
      ]),
      surfaceOp: 'append',
    }
    const { session } = fakeSession(events)
    const { ctx, agent, state: host } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-three', 'operation-image')
    assert.deepEqual(host.followed[0].content, [
      { type: 'text', text: 'question three' },
      { type: 'image', attachment: IMAGE },
    ], 'the image travels with the question')
  }

  // Editing an image question changes the words and keeps every attachment.
  {
    const events = conversation()
    events[8] = {
      seq: 8,
      type: 'user/message',
      data: questionWithContent('question-three', [
        { type: 'text', text: 'question three' },
        { type: 'image', attachment: IMAGE },
        { type: 'file', attachment: FILE },
      ]),
      surfaceOp: 'append',
    }
    const { session } = fakeSession(events)
    const { ctx, agent, state: host } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-three', 'operation-image-edit', 'question three, edited')
    assert.deepEqual(host.followed[0].content, [
      { type: 'text', text: 'question three, edited' },
      { type: 'image', attachment: IMAGE },
      { type: 'file', attachment: FILE },
    ], 'the edited words replace the text and the attachments stay')
  }

  // An image-only question has no text to read, but a person can still add some
  // while editing; the image keeps its place.
  {
    const events = conversation()
    events[8] = {
      seq: 8,
      type: 'user/message',
      data: questionWithContent('question-three', [{ type: 'image', attachment: IMAGE }]),
      surfaceOp: 'append',
    }
    const { session } = fakeSession(events)
    const { ctx, agent, state: host } = fakeHost(session)
    await resendQuestion(ctx, agent, 'question-three', 'operation-image-only', 'what is in this picture?')
    assert.deepEqual(host.followed[0].content, [
      { type: 'text', text: 'what is in this picture?' },
      { type: 'image', attachment: IMAGE },
    ])
  }

  // The editor reads the text and names the attachments, so the replay is not a
  // surprise to the person who asked for it.
  {
    const events = conversation()
    events[8] = {
      seq: 8,
      type: 'user/message',
      data: questionWithContent('question-three', [
        { type: 'text', text: 'question three' },
        { type: 'image', attachment: IMAGE },
        { type: 'file', attachment: FILE },
      ]),
      surfaceOp: 'append',
    }
    const { session } = fakeSession(events)
    assert.deepEqual(readQuestion(session, 'question-three'), {
      text: 'question three',
      attachments: [
        { type: 'image', name: 'chart.png', mediaType: 'image/png', bytes: 64 },
        { type: 'file', name: 'notes.pdf', bytes: 128 },
      ],
    })
  }

  // A block type this layer does not know is refused instead of guessed.
  {
    const events = conversation()
    events[8] = {
      seq: 8,
      type: 'user/message',
      data: questionWithContent('question-three', [{ type: 'audio', attachment: { attachmentId: 'sha256:33' } }]),
      surfaceOp: 'append',
    }
    const { session } = fakeSession(events)
    const { ctx, agent } = fakeHost(session)
    await assert.rejects(() => resendQuestion(ctx, agent, 'question-three', 'operation-audio'), (error) => {
      assert.equal(error.code, 'PROMPT_UNSUPPORTED')
      return true
    })
  }

  console.log('manage: question removal and replay checks passed')
} finally {
  await removeHome()
}
