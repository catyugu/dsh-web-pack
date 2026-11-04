/**
 * Session management sub-component, browser side: the actions on every
 * question, the dialogs they open, and the compaction settings the composer
 * offers for one session or for the whole install.
 *
 * This file is one sub-component of the `dsh-better-session` browser bundle. It
 * is written as a parenthesized function expression so the package build can
 * compose it with the other sub-components without a bundler: the build reads
 * all of them and writes the package's `client.js` entry.
 *
 * @module dsh-better-session/manage/client
 */
(function (require) {
  const React = require('react')
  const { createPortal } = require('react-dom')
  const primitives = require('@deepseek-ai/dsh-client-ui-primitives')

  const h = React.createElement
  const NS = 'sessionManage'
  const PROMPT_ROUTE = 'api/sessionManage/prompt'
  const RESEND_ROUTE = 'api/sessionManage/questions/resend'
  const COMPACTION_ROUTE = 'api/sessionManage/compaction'
  const DEFAULTS_ROUTE = 'api/sessionManage/defaults'
  const STYLE_ID = 'dsh-better-session/styles.css'
  /** How long one conversation operation may take before the page gives up on it. */
  const REQUEST_TIMEOUT_MS = 30000
  /** The rows a question is rendered in. */
  const QUESTION_ROW = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]'
  /** The element this sub-component mounts its buttons in. */
  const ACTION_HOST = 'data-dsh-better-session-actions'
  /** The attribute that marks a row the conversation no longer holds. */
  const HIDDEN_ATTR = 'data-dsh-better-session-hidden'
  /** Where the removed ranges of one session are remembered. */
  const HIDDEN_KEY = 'dsh-better-session:hidden:'

  const ZH = {
    'action.regenerate': '重新生成',
    'action.edit': '编辑并重发',
    'action.compaction': '上下文压缩配置',
    'dialog.close': '关闭',
    'dialog.cancel': '取消',
    'dialog.regenerateTitle': '重新生成这条消息',
    'dialog.regenerateDescription': '将删除这条消息及之后的所有内容，然后重新发送这条消息。',
    'dialog.regenerateConfirm': '重新生成',
    'dialog.editTitle': '编辑这条消息并重发',
    'dialog.editDescription': '将删除这条消息及之后的所有内容，然后改为发送下面的文字。',
    'dialog.editConfirm': '重发',
    'dialog.running': '这个会话正在生成回答，确认后会先中断它。',
    'dialog.loading': '正在读取这条消息…',
    'dialog.loadFailed': '读取这条消息失败，请查看 Harness 日志。',
    'dialog.attachmentsKept': '这条消息的附件会随重发一起保留。',
    'dialog.attachmentImage': '图片',
    'compaction.title': '上下文压缩配置',
    'compaction.scope': '配置范围',
    'compaction.scopeSession': '本会话',
    'compaction.scopeGlobal': '全局默认',
    'compaction.sessionDescription': '只影响这个会话，从下一轮对话开始生效。',
    'compaction.globalDescription': '新会话从这份配置开始；单独设置过的会话不受影响。',
    'compaction.thresholdRatio': '压缩阈值',
    'compaction.thresholdRatioHint': '上下文占用超过这个比例时开始压缩。',
    'compaction.range': '范围 {min} – {max}',
    'compaction.retentionRatio': '保留比例',
    'compaction.retentionRatioHint': '压缩后保留的最近上下文比例，必须小于压缩阈值。',
    'compaction.retentionTokens': '保留 token 数',
    'compaction.retentionTokensHint': '压缩后保留的最近上下文 token 数，按该模型的实际窗口判断是否合适。',
    'compaction.unit': '保留方式',
    'compaction.unitRatio': '比例',
    'compaction.unitTokens': 'Token',
    'compaction.headroomTokens': '压缩预留 token',
    'compaction.headroomTokensHint': '判断压力时为输出和缓存预留的 token；越大越早开始压缩。',
    'compaction.maxTokens': '摘要最大 token',
    'compaction.maxTokensHint': '生成摘要时允许的最大输出 token 数。',
    'compaction.compactionRetries': '压缩重试次数',
    'compaction.compactionRetriesHint': '压缩之后仍然超出阈值时再试几次。',
    'compaction.maxOverflowRetries': '溢出重试次数',
    'compaction.maxOverflowRetriesHint': '上下文溢出后的恢复重试次数，0 表示不重试。',
    'compaction.save': '保存',
    'compaction.saving': '保存中…',
    'compaction.saveFailed': '保存失败，请查看 Harness 日志。',
    'compaction.invalidThreshold': '压缩阈值必须在 0.3 – 0.9 之间。',
    'compaction.invalidRetain': '保留比例必须在 0.01 – 0.3 之间。',
    'compaction.invalidRetainTokens': '保留 token 数必须在 256 – 1048576 之间。',
    'compaction.retainFormConflict': '保留比例和保留 token 数只能填一个。',
    'compaction.retainAboveThreshold': '保留比例必须小于压缩阈值。',
    'compaction.invalidHeadroomTokens': '压缩预留 token 必须在 0 – 1048576 之间。',
    'compaction.invalidMaxTokens': '摘要最大 token 必须在 256 – 1048576 之间。',
    'compaction.invalidRetries': '重试次数必须在 0 – 10 之间。',
    'compaction.saved': '压缩配置已保存，从下一轮对话开始生效。',
    'compaction.reset': '恢复默认',
    'compaction.sessionNotStored': '这个会话还没有写入磁盘，等第一轮对话开始后再保存。',
    'notice.regenerated': '已重新生成。',
    'notice.edited': '已用新的提问重发。',
    'notice.regeneratedInterrupted': '已中断正在生成的回答，并重新生成。',
    'notice.editedInterrupted': '已中断正在生成的回答，并用新的提问重发。',
    'error.busy': '这个会话正在运行或还有排队的输入，请等它空闲后再试。',
    'error.queue': '这个会话还有排队的输入，请等队列清空后再试。',
    'error.compacted': '这条提问已经和压缩过的内容混在一起，无法单独处理。',
    'error.notFound': '没有找到这条提问。',
    'error.promptMissing': '这条提问没有可重发的内容。',
    'error.promptUnsupported': '这条提问含有无法重发的内容。',
    'error.failed': '操作失败，请查看 Harness 日志。',
    'error.timeout': 'Host 没有在规定时间内回答，刷新一次再试。',
    'error.routeMissing': '这一端还没有加载这些路由：重启一次 Harness 后可用。',
  }

  const EN = {
    'action.regenerate': 'Regenerate',
    'action.edit': 'Edit and resend',
    'action.compaction': 'Context compaction',
    'dialog.close': 'Close',
    'dialog.cancel': 'Cancel',
    'dialog.regenerateTitle': 'Regenerate this message',
    'dialog.regenerateDescription': 'This removes this message and everything after it, then sends the message again.',
    'dialog.regenerateConfirm': 'Regenerate',
    'dialog.editTitle': 'Edit the message and resend it',
    'dialog.editDescription': 'This removes this message and everything after it, then sends the text below instead.',
    'dialog.editConfirm': 'Resend',
    'dialog.running': 'This session is generating an answer; confirming interrupts it first.',
    'dialog.loading': 'Reading this message…',
    'dialog.loadFailed': 'Reading this message failed; check the Harness log.',
    'dialog.attachmentsKept': 'The attachments on this message are kept when it is resent.',
    'dialog.attachmentImage': 'Image',
    'compaction.title': 'Context compaction',
    'compaction.scope': 'Configuration',
    'compaction.scopeSession': 'This session',
    'compaction.scopeGlobal': 'Global default',
    'compaction.sessionDescription': 'This applies to this session only, from the next turn on.',
    'compaction.globalDescription': 'New sessions start from this; sessions with their own settings are unaffected.',
    'compaction.thresholdRatio': 'Compression threshold',
    'compaction.thresholdRatioHint': 'Compaction starts once the context passes this share of the window.',
    'compaction.range': 'Range {min} – {max}',
    'compaction.retentionRatio': 'Retained share',
    'compaction.retentionRatioHint': 'The share of recent context kept after compaction; it must stay below the threshold.',
    'compaction.retentionTokens': 'Retained tokens',
    'compaction.retentionTokensHint': 'The token count of recent context kept after compaction; judge it against the model window.',
    'compaction.unit': 'Retention unit',
    'compaction.unitRatio': 'Share',
    'compaction.unitTokens': 'Tokens',
    'compaction.headroomTokens': 'Compaction headroom',
    'compaction.headroomTokensHint': 'Tokens reserved for output and cache when pressure is priced; larger compacts earlier.',
    'compaction.maxTokens': 'Summary token cap',
    'compaction.maxTokensHint': 'The largest summary the compaction may produce.',
    'compaction.compactionRetries': 'Compaction retries',
    'compaction.compactionRetriesHint': 'How many times compaction runs again while the context stays over the threshold.',
    'compaction.maxOverflowRetries': 'Overflow retries',
    'compaction.maxOverflowRetriesHint': 'How many times a context overflow is recovered from; 0 disables the recovery.',
    'compaction.save': 'Save',
    'compaction.saving': 'Saving…',
    'compaction.saveFailed': 'Saving failed; check the Harness log.',
    'compaction.invalidThreshold': 'The threshold must be between 0.3 and 0.9.',
    'compaction.invalidRetain': 'The retained share must be between 0.01 and 0.3.',
    'compaction.invalidRetainTokens': 'The retained token count must be between 256 and 1048576.',
    'compaction.retainFormConflict': 'Set either the retained share or the retained tokens, never both.',
    'compaction.retainAboveThreshold': 'The retained share must stay below the threshold.',
    'compaction.invalidHeadroomTokens': 'The compaction headroom must be between 0 and 1048576.',
    'compaction.invalidMaxTokens': 'The summary cap must be between 256 and 1048576.',
    'compaction.invalidRetries': 'The retry count must be between 0 and 10.',
    'compaction.saved': 'The compaction settings are saved and take effect from the next turn.',
    'compaction.reset': 'Reset',
    'compaction.sessionNotStored': 'This session is not on disk yet; save again once its first turn has started.',
    'notice.regenerated': 'Regenerated.',
    'notice.edited': 'Resent with the edited question.',
    'notice.regeneratedInterrupted': 'Interrupted the running answer and regenerated.',
    'notice.editedInterrupted': 'Interrupted the running answer and resent the edited question.',
    'error.busy': 'This session is running or still has queued input; retry when it is idle.',
    'error.queue': 'This session still has queued input; retry when the queue is empty.',
    'error.compacted': 'This question shares a compacted range, so it cannot be handled on its own.',
    'error.notFound': 'Nothing was found for this question.',
    'error.promptMissing': 'This question has no content to resend.',
    'error.promptUnsupported': 'This question contains content that cannot be resent.',
    'error.failed': 'The operation failed; check the Harness log.',
    'error.timeout': 'The Host did not answer in time; reload and retry.',
    'error.routeMissing': 'This sub-component has not loaded these routes yet: restart the Harness once.',
  }

  /**
   * The look of this sub-component's own controls.
   *
   * The two action buttons repeat the metrics of the strip they sit in — same
   * box, same padding, same icon size, same colors — so they read as part of
   * that row rather than as a second row of widgets.
   */
  const CSS = `
[${HIDDEN_ATTR}] { display: none !important; }
.dsm_action {
box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
width: calc(28px + var(--dsh-content-font-delta, 0px)); height: calc(28px + var(--dsh-content-font-delta, 0px));
padding: 6px; border: none; border-radius: var(--dsw-radius-sm); background: none;
color: var(--dsw-alias-label-tertiary); cursor: pointer;
}
.dsm_action svg { width: calc(15px + var(--dsh-content-font-delta, 0px)); height: calc(15px + var(--dsh-content-font-delta, 0px)); }
.dsm_action:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.dsm_action:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary); }
.dsm_scope { margin-bottom: 18px; }
.dsm_footerReset { margin-right: auto; }
.dsm_rows { display: flex; flex-direction: column; gap: 16px; }
.dsm_row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dsm_rowText { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsm_rowLabel { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.dsm_rowHint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsm_rowSide { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.dsm_rowRange { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dsm_number { flex: none; width: 108px; }
.dsm_retentionControl { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.dsm_textarea {
box-sizing: border-box; width: 100%; min-height: 128px; resize: vertical; padding: 8px 10px;
border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md);
background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
font-family: inherit; font-size: 14px; line-height: 22px;
}
.dsm_textarea:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary); }
.dsm_attachments { display: flex; flex-direction: column; gap: 2px; margin-top: 10px; }
.dsm_attachmentNames { overflow: hidden; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
`

  /** One value the page keeps and every component reads. */
  function createStore(initial) {
    let value = initial
    const listeners = new Set()
    return {
      getSnapshot: () => value,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      set: (next) => {
        if (next === value) return
        value = next
        for (const listener of [...listeners]) listener()
      },
    }
  }

  /** Insert this sub-component's stylesheet once for the mounted run. */
  function insertStyles() {
    const selector = `style[data-plugin-css="${STYLE_ID}"]`
    if (document.querySelector(selector) !== null) return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-better-session'
    tag.dataset.pluginCss = STYLE_ID
    tag.textContent = CSS
    document.head.append(tag)
    return () => {
      tag.remove()
    }
  }

  /**
   * The ranges one session has removed, as remembered by the page.
   *
   * The log keeps the removed events — the log is append-only — so the page has
   * to remember which range is gone to keep showing the conversation as it is
   * now. A range starts at one question and runs to the end of a turn, so it
   * remembers that question's identity: one turn can hold several questions the
   * user sent while the agent worked, and only the ones after the clicked one are
   * gone.
   *
   * A record written before this release names no question, because the page used
   * to hide whole turns; it is read as such and rewritten in the current shape the
   * next time a range is remembered.
   * @param sessionId - the session the ranges belong to.
   * @returns the removed ranges, as `{ turn, endTurn, messageId }` records, with
   *   a null `messageId` for a range that covers whole turns.
   */
  function hiddenRemovals(sessionId) {
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY + sessionId)
      const parsed = raw === null ? [] : JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const removals = []
      for (const entry of parsed) {
        if (Array.isArray(entry)) {
          if (entry.length !== 2 || !entry.every(Number.isInteger)) continue
          removals.push({ turn: entry[0], endTurn: entry[1], messageId: null })
          continue
        }
        if (typeof entry !== 'object' || entry === null) continue
        if (!Number.isInteger(entry.turn) || !Number.isInteger(entry.endTurn)) continue
        if (typeof entry.messageId !== 'string' || entry.messageId.length === 0) continue
        removals.push(entry)
      }
      return removals
    } catch {
      return []
    }
  }

  /**
   * Remember that a range is gone, and hide it.
   * @param sessionId - the session the range belongs to.
   * @param removal - the question the range starts at, and the turn it ends at.
   */
  function rememberRemoval(sessionId, removal) {
    const removals = hiddenRemovals(sessionId)
    removals.push(removal)
    try {
      window.localStorage.setItem(HIDDEN_KEY + sessionId, JSON.stringify(removals))
    } catch {
      // A page without storage still hides the range until it reloads.
    }
    applyHiddenRows(sessionId)
  }

  /**
   * Hide the rows of the removed ranges.
   *
   * A row is gone when it sits inside a range: every turn the range covers
   * except the first one it starts in, and within that first turn only the rows
   * at or after the question the range starts at. The question's own row is the
   * only anchor the page has, so a range whose anchor row is not rendered yet
   * hides nothing of its first turn and is applied once the row appears.
   * @param sessionId - the session whose ranges apply.
   */
  function applyHiddenRows(sessionId) {
    const removals = hiddenRemovals(sessionId)
    const anchors = new Map()
    if (removals.length > 0) {
      for (const row of document.querySelectorAll(QUESTION_ROW)) {
        const messageId = messageIdOf(row)
        if (messageId !== undefined && !anchors.has(messageId)) anchors.set(messageId, row)
      }
    }
    for (const row of document.querySelectorAll('[data-chat-turn]')) {
      const turn = Number(row.dataset.chatTurn)
      if (!Number.isSafeInteger(turn)) continue
      const hidden = removals.some((removal) => isRemovedRow(removal, row, turn, anchors))
      if (hidden) row.setAttribute(HIDDEN_ATTR, '')
      else row.removeAttribute(HIDDEN_ATTR)
    }
  }

  /**
   * Whether one row belongs to one removed range.
   * @param removal - the range.
   * @param row - the candidate row.
   * @param turn - the row's turn.
   * @param anchors - the rendered question rows, by message identity.
   * @returns true when the range covers the row.
   */
  function isRemovedRow(removal, row, turn, anchors) {
    if (turn > removal.endTurn) return false
    if (turn > removal.turn) return true
    if (turn < removal.turn) return false
    if (removal.messageId === null) return true
    const anchor = anchors.get(removal.messageId)
    if (anchor === undefined) return false
    if (anchor === row) return true
    return (anchor.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  }

  /**
   * The row a node belongs to, when that row is a question.
   * @param node - the candidate node.
   * @returns the question row, or null.
   */
  function questionRowOf(node) {
    return node instanceof Element ? node.closest(QUESTION_ROW) : null
  }

  /**
   * The question identity one row carries.
   *
   * The chat addresses a user message by its message id, and the row's flow key
   * spells it: `<seq>:input-message<id>`. A row that carries no such key is not a
   * question this layer can act on.
   * @param row - the question row.
   * @returns the message identity, or undefined when the row names none.
   */
  function messageIdOf(row) {
    for (const key of [row.dataset.chatFlowKey, row.dataset.chatNodeKey, row.dataset.chatAnchorKey]) {
      if (typeof key !== 'string') continue
      const match = /input-message([^:]+)$/.exec(key)
      if (match !== null) return match[1]
    }
    return undefined
  }

  /**
   * Where in a question row the action buttons belong.
   *
   * The row's own action strip is the element the shipped actions render with a
   * clock side. A question row's first button is not a reliable landmark: a
   * message that carries a slash command or an image renders that as a button
   * inside the message body, so "the first button's div" picks out the body. A
   * row without a strip gets no buttons rather than buttons in the wrong place.
   * @param row - the question row.
   * @returns the element to mount in, or null when the row has no strip.
   */
  function actionStrip(row) {
    const strip = row.querySelector('[data-clock]')
    return strip instanceof HTMLElement ? strip : null
  }

  /**
   * One Host-backed JSON call on the authenticated `/api` carrier.
   * @param route - relative route path.
   * @param options - fetch options beyond the shared carrier settings.
   * @param timeoutMs - how long to wait before abandoning the request.
   * @returns the decoded payload of a successful answer.
   */
  async function requestJson(route, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = timeoutMs > 0 ? new AbortController() : undefined
    const timer = controller === undefined ? undefined : window.setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetch(route, {
        credentials: 'include',
        cache: 'no-store',
        ...options,
        ...(controller === undefined ? {} : { signal: controller.signal }),
      })
    } catch (error) {
      if (controller !== undefined && controller.signal.aborted) {
        const failure = new Error(`request timed out after ${timeoutMs}ms`)
        failure.code = 'timeout'
        throw failure
      }
      throw error
    } finally {
      if (timer !== undefined) window.clearTimeout(timer)
    }
    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    if (response.ok && payload !== null && payload.ok === true) return payload
    const failure = new Error(payload?.message ?? `HTTP ${response.status}`)
    failure.code = payload?.code ?? (response.status === 404 ? 'route-missing' : 'request-failed')
    throw failure
  }

  /**
   * Read one question's text.
   * @param sessionId - the session the question belongs to.
   * @param messageId - the question's message identity.
   * @returns the question's text.
   */
  function readPrompt(sessionId, messageId) {
    const query = new URLSearchParams({ sessionId, messageId })
    return requestJson(`${PROMPT_ROUTE}?${query.toString()}`).then((payload) => payload.prompt)
  }

  /**
   * One identity for one operation, so a retry finishes the same operation
   * instead of replaying the question twice.
   * @returns the operation identity.
   */
  function operationId() {
    const random = Math.random().toString(36).slice(2, 10)
    return `${Date.now().toString(36)}${random}`
  }

  /**
   * Remove one question and everything after it, then re-send the question.
   * @param sessionId - the session the question belongs to.
   * @param messageId - the question's message identity.
   * @param text - the replacement question, when the user edited it.
   * @returns what the Host did.
   */
  function resendQuestion(sessionId, messageId, text) {
    return requestJson(RESEND_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messageId,
        operationId: operationId(),
        ...(text === undefined ? {} : { text }),
      }),
    })
  }

  /**
   * Map a Host refusal onto its localized line; diagnostics stay in the console.
   * @param error - the refusal the Host answered with.
   * @param t - this plugin's translate function.
   * @returns the localized line.
   */
  function failureText(error, t) {
    const code = typeof error?.code === 'string' ? error.code : undefined
    if (code === 'agent-busy') return t('error.busy')
    if (code === 'queue-not-empty') return t('error.queue')
    if (code === 'range-compacted') return t('error.compacted')
    if (code === 'target-not-found' || code === 'session-not-active' || code === 'session-not-loaded') return t('error.notFound')
    if (code === 'prompt-not-found') return t('error.promptMissing')
    if (code === 'prompt-unsupported') return t('error.promptUnsupported')
    if (code === 'timeout') return t('error.timeout')
    if (code === 'route-missing') return t('error.routeMissing')
    return t('error.failed')
  }

  /**
   * The actions of one message: send it again, or send it again with edited
   * words. Both run the same removal, so both live behind one confirmation.
   * @param messageId - the message identity.
   * @param requestAction - opens the dialog of the chosen action.
   * @param useSession - the session projection as a hook.
   * @param t - this plugin's translate function.
   */
  function QuestionActionButtons({ messageId, requestAction, useSession, t }) {
    const running = useSession((snapshot) => snapshot.running === true)
    /**
     * One action button, in the metrics of the strip it sits in.
     *
     * The button stays usable while the session works: replacing a question
     * whose answer is still streaming is what a user asks for when the answer
     * being written is not the one they wanted. The dialog warns that confirming
     * interrupts the running turn, and the Host does that before it removes
     * anything.
     * @param icon - the icon component.
     * @param label - the button's accessible name.
     * @param kind - the action the button starts.
     * @returns the button.
     */
    const button = (icon, label, kind) => h(primitives.Tooltip, { label, side: 'bottom' },
      h('button', {
        type: 'button',
        className: 'dsm_action',
        'aria-label': label,
        onClick: () => requestAction({ kind, messageId, running: running === true }),
      }, h(icon, null)))
    return h(React.Fragment, null,
      button(primitives.IconRefreshOutlineRegular, t('action.regenerate'), 'regenerate'),
      button(primitives.IconEditOutlineRegular, t('action.edit'), 'edit'))
  }

  /**
   * The actions of every question of the session.
   *
   * A question row is rendered by the Harness itself, and it declares no slot
   * for extra actions, so this layer mounts its buttons into the row's own
   * action strip and keeps them in step with the rows the page renders.
   * @param sessionId - the session the rows belong to.
   * @param requestAction - opens the dialog of the chosen action.
   * @param useSession - the session projection as a hook.
   * @param t - this plugin's translate function.
   */
  function UserQuestionActions({ sessionId, requestAction, useSession, t }) {
    const [targets, setTargets] = React.useState([])
    const hosts = React.useRef(new Map())

    React.useEffect(() => {
      let frame = 0
      /**
       * Match the page's question rows with the mounts this layer owns.
       */
      const reconcile = () => {
        frame = 0
        const found = []
        const seen = new Set()
        for (const row of document.querySelectorAll(QUESTION_ROW)) {
          const turn = Number(row.dataset.chatTurn)
          const messageId = messageIdOf(row)
          if (!Number.isSafeInteger(turn) || messageId === undefined) continue
          const key = row.dataset.chatFlowKey ?? row.dataset.chatAnchorKey ?? row.dataset.chatNodeKey ?? messageId
          if (seen.has(key)) continue
          let record = hosts.current.get(key)
          if (record === undefined) {
            const host = document.createElement('span')
            host.dataset.dshBetterSessionActions = ''
            host.style.display = 'contents'
            record = { host, messageId }
            hosts.current.set(key, record)
          }
          record.messageId = messageId
          const strip = actionStrip(row)
          if (strip === null) continue
          if (record.host.parentElement !== strip) strip.appendChild(record.host)
          seen.add(key)
          found.push({ key, messageId, host: record.host })
        }
        for (const [key, record] of hosts.current) {
          if (seen.has(key)) continue
          record.host.remove()
          hosts.current.delete(key)
        }
        applyHiddenRows(sessionId)
        setTargets((current) => sameTargets(current, found) ? current : found)
      }
      /** Run the next reconciliation on the next frame. */
      const schedule = () => {
        if (frame !== 0) return
        frame = window.requestAnimationFrame(reconcile)
      }
      /**
       * Whether a mutation can change where the buttons belong: a question
       * row, one of its descendants, or this layer's own mount hosting a row.
       * @param node - the mutated node.
       * @returns true when the layer has to reconcile again.
       */
      const relevant = (node) => {
        if (!(node instanceof Element)) return false
        if (node.closest(`[${ACTION_HOST}]`) !== null) return false
        return node.closest(QUESTION_ROW) !== null
      }
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (relevant(record.target)) {
            schedule()
            return
          }
          for (const node of record.addedNodes) {
            if (relevant(node)) {
              schedule()
              return
            }
          }
          for (const node of record.removedNodes) {
            if (relevant(node)) {
              schedule()
              return
            }
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-chat-turn'] })
      schedule()
      return () => {
        if (frame !== 0) window.cancelAnimationFrame(frame)
        observer.disconnect()
        for (const record of hosts.current.values()) record.host.remove()
        hosts.current.clear()
      }
    }, [sessionId])

    return h(React.Fragment, null, targets.map((target) => createPortal(
      h(QuestionActionButtons, { messageId: target.messageId, requestAction, useSession, t }),
      target.host,
      target.key,
    )))
  }

  /**
   * Whether two portal target lists describe the same rows of the page.
   * @param left - the targets already mounted.
   * @param right - the targets just found.
   * @returns true when nothing has to be re-rendered.
   */
  function sameTargets(left, right) {
    return left.length === right.length && left.every((target, index) => {
      const other = right[index]
      return target.key === other.key && target.messageId === other.messageId && target.host === other.host
    })
  }

  /**
   * The dialogs the question actions open: the regeneration confirmation and the
   * editor.
   * @param useQuestionAction - the pending action as a hook.
   * @param settle - dismisses the dialog.
   * @param reportNotice - shows the outcome of an operation.
   * @param t - this plugin's translate function.
   */
  function ResendDialog({ useQuestionAction, settle, reportNotice, t }) {
    const action = useQuestionAction((pending) => pending)
    const [draft, setDraft] = React.useState('')
    const [attachments, setAttachments] = React.useState([])
    const [state, setState] = React.useState('idle')
    const [busy, setBusy] = React.useState(false)

    React.useEffect(() => {
      if (action === null) return undefined
      setBusy(false)
      setDraft('')
      setAttachments([])
      if (action.kind !== 'edit') return undefined
      let live = true
      setState('loading')
      readPrompt(action.sessionId, action.messageId).then((prompt) => {
        if (!live) return
        setDraft(typeof prompt?.text === 'string' ? prompt.text : '')
        setAttachments(Array.isArray(prompt?.attachments) ? prompt.attachments : [])
        setState('ready')
      }, (reason) => {
        if (!live) return
        console.warn('better-session: reading the question failed:', reason)
        setState('failed')
      })
      return () => {
        live = false
      }
    }, [action])

    if (action === null) return null

    /**
     * Run one conversation operation and report what it did.
     * @param text - the replacement question, left out to reuse the original.
     * @param message - the notice of a finished operation.
     * @param interruptedMessage - the notice of an operation that interrupted a
     *   running turn first.
     */
    const run = (text, message, interruptedMessage) => {
      setBusy(true)
      settle()
      resendQuestion(action.sessionId, action.messageId, text).then((payload) => {
        rememberRemoval(action.sessionId, {
          turn: payload.turn,
          endTurn: payload.endTurn ?? payload.turn,
          messageId: action.messageId,
        })
        reportNotice({ text: payload.interrupted === true ? interruptedMessage : message })
      }, (reason) => {
        console.warn('better-session: the conversation operation failed:', reason)
        reportNotice({ text: failureText(reason, t), failed: true })
      })
    }

    const runningHint = action.running === true ? ` ${t('dialog.running')}` : ''

    if (action.kind === 'edit') {
      // The attachments are not editable here: the replay keeps every image and
      // file the question carried, and the dialog says so instead of hiding it.
      const attachmentNames = attachments.map((attachment) => (
        typeof attachment?.name === 'string' && attachment.name.length > 0
          ? attachment.name
          : t('dialog.attachmentImage')
      ))
      const body = state === 'loading'
        ? h('p', { className: 'dsm_rowHint' }, t('dialog.loading'))
        : state === 'failed'
          ? h('p', { className: 'dsm_rowHint' }, t('dialog.loadFailed'))
          : h(React.Fragment, null,
            h('textarea', {
              className: 'dsm_textarea',
              value: draft,
              onChange: (event) => setDraft(event.target.value),
            }),
            attachments.length === 0 ? null : h('div', { className: 'dsm_attachments' },
              h('span', { className: 'dsm_rowHint' }, t('dialog.attachmentsKept')),
              h('span', { className: 'dsm_attachmentNames' }, attachmentNames.join(' · '))))
      return h(primitives.Modal, {
        open: true,
        onClose: settle,
        title: t('dialog.editTitle'),
        closeLabel: t('dialog.close'),
        description: t('dialog.editDescription') + runningHint,
        footer: [
          h(primitives.Button, {
            key: 'cancel',
            variant: 'outline',
            autoFocus: true,
            onClick: settle,
          }, t('dialog.cancel')),
          h(primitives.Button, {
            key: 'confirm',
            variant: 'primary',
            disabled: busy || state !== 'ready' || draft.trim().length === 0,
            onClick: () => run(draft, t('notice.edited'), t('notice.editedInterrupted')),
          }, t('dialog.editConfirm')),
        ],
      }, body)
    }

    return h(primitives.Modal, {
      open: true,
      onClose: settle,
      title: t('dialog.regenerateTitle'),
      closeLabel: t('dialog.close'),
      description: t('dialog.regenerateDescription') + runningHint,
      footer: [
        h(primitives.Button, {
          key: 'cancel',
          variant: 'outline',
          autoFocus: true,
          onClick: settle,
        }, t('dialog.cancel')),
        h(primitives.Button, {
          key: 'confirm',
          variant: 'primary',
          disabled: busy,
          onClick: () => run(undefined, t('notice.regenerated'), t('notice.regeneratedInterrupted')),
        }, t('dialog.regenerateConfirm')),
      ],
    })
  }

  /**
   * One numeric setting: its name, its explanation, the field, and the range
   * the field accepts.
   * @param label - the setting name.
   * @param hint - what the setting does.
   * @param range - the accepted range, written out for the reader.
   * @param value - the current value.
   * @param step - the step the field moves by.
   * @param min - the smallest accepted value.
   * @param max - the largest accepted value.
   * @param disabled - whether the field is locked.
   * @param onChange - called with the requested value.
   */
  function NumberRow({ label, hint, range, value, step, min, max, disabled, onChange }) {
    return h('div', { className: 'dsm_row' },
      h('div', { className: 'dsm_rowText' },
        h('span', { className: 'dsm_rowLabel' }, label),
        h('span', { className: 'dsm_rowHint' }, hint)),
      h('div', { className: 'dsm_rowSide' },
        h(primitives.Input, {
          className: 'dsm_number',
          type: 'number',
          value,
          step,
          min,
          max,
          disabled,
          'aria-label': label,
          onChange: (event) => onChange(event.target.value),
        }),
        h('span', { className: 'dsm_rowRange' }, range)))
  }

  /**
   * The retained-context setting: one number written either as a share of the
   * message budget or as a token count, chosen with the unit switch.
   * @param mode - the form in force.
   * @param label - the name of that form.
   * @param hint - what that form means.
   * @param range - the accepted range, written out for the reader.
   * @param value - the current value.
   * @param step - the step the field moves by.
   * @param min - the smallest accepted value.
   * @param max - the largest accepted value.
   * @param disabled - whether the controls are locked.
   * @param unitLabel - the accessible name of the unit switch.
   * @param ratioLabel - the share unit.
   * @param tokensLabel - the token unit.
   * @param onMode - called with the requested form.
   * @param onChange - called with the requested value.
   */
  function RetentionRow({ mode, label, hint, range, value, step, min, max, disabled, unitLabel, ratioLabel, tokensLabel, onMode, onChange }) {
    return h('div', { className: 'dsm_row' },
      h('div', { className: 'dsm_rowText' },
        h('span', { className: 'dsm_rowLabel' }, label),
        h('span', { className: 'dsm_rowHint' }, hint)),
      h('div', { className: 'dsm_rowSide' },
        h('div', { className: 'dsm_retentionControl' },
          h(primitives.SegmentedControl, {
            id: 'dsm-compaction-retention',
            value: mode,
            options: [
              { value: 'ratio', label: ratioLabel },
              { value: 'tokens', label: tokensLabel },
            ],
            onChange: onMode,
            label: unitLabel,
            disabled,
          }),
          h(primitives.Input, {
            className: 'dsm_number',
            type: 'number',
            value,
            step,
            min,
            max,
            disabled,
            'aria-label': label,
            onChange: (event) => onChange(event.target.value),
          })),
        h('span', { className: 'dsm_rowRange' }, range)))
  }

  /**
   * Map a refused save onto its localized reason; anything else stays generic.
   * @param error - the refusal the Host answered with.
   * @param t - this plugin's translate function.
   * @returns the localized line.
   */
  function saveFailureText(error, t) {
    const code = typeof error?.code === 'string' ? error.code : undefined
    if (code === 'invalid-threshold-ratio') return t('compaction.invalidThreshold')
    if (code === 'invalid-retain-ratio') return t('compaction.invalidRetain')
    if (code === 'invalid-retain-tokens') return t('compaction.invalidRetainTokens')
    if (code === 'retain-form-conflict') return t('compaction.retainFormConflict')
    if (code === 'retain-ratio-not-less-than-threshold') return t('compaction.retainAboveThreshold')
    if (code === 'invalid-headroom-tokens') return t('compaction.invalidHeadroomTokens')
    if (code === 'invalid-max-tokens') return t('compaction.invalidMaxTokens')
    if (code === 'invalid-compaction-retries' || code === 'invalid-max-overflow-retries') return t('compaction.invalidRetries')
    if (code === 'session-not-stored') return t('compaction.sessionNotStored')
    if (code === 'timeout') return t('error.timeout')
    if (code === 'route-missing') return t('error.routeMissing')
    return t('compaction.saveFailed')
  }

  /**
   * The request path one scope is read from and written to.
   * @param scope - the scope being edited.
   * @param sessionId - the session the panel was opened for.
   * @returns the path.
   */
  function compactionPath(scope, sessionId) {
    if (scope === 'global') return DEFAULTS_ROUTE
    return `${COMPACTION_ROUTE}?${new URLSearchParams({ sessionId }).toString()}`
  }

  /**
   * The fields one save carries: the pressure threshold, one of the two
   * retained-context forms, the headroom and summary budgets, and the retry
   * counts.
   * @param settings - the settings as the fields hold them, strings included.
   * @param mode - the retained-context form the panel shows.
   * @returns the body of a save.
   */
  function compactionBody(settings, mode) {
    const retention = mode === 'tokens'
      ? { retainTokens: Math.trunc(Number(settings.retainTokens)) }
      : { retainRatio: Number(settings.retainRatio) }
    return {
      thresholdRatio: Number(settings.thresholdRatio),
      ...retention,
      headroomTokens: Math.trunc(Number(settings.headroomTokens)),
      maxTokens: Math.trunc(Number(settings.maxTokens)),
      compactionRetries: Math.trunc(Number(settings.compactionRetries)),
      maxOverflowRetries: Math.trunc(Number(settings.maxOverflowRetries)),
    }
  }

  /**
   * The retained-context form one settings object uses.
   * @param settings - the settings to read.
   * @returns 'tokens' when the object carries a token count, otherwise 'ratio'.
   */
  function retentionModeOf(settings) {
    return settings?.retainTokens !== undefined ? 'tokens' : 'ratio'
  }

  /**
   * The number one retained-context form holds.
   * @param settings - the settings to read.
   * @param mode - the form to read.
   * @returns the value, or undefined when the draft has not written it yet.
   */
  function retentionValue(settings, mode) {
    return mode === 'tokens' ? settings.retainTokens : settings.retainRatio
  }

  /**
   * The value a form starts from when the draft has none of its own.
   * @param entry - the ready draft.
   * @param mode - the form to seed.
   * @returns the engine's value for that form, or its headroom as the token seed.
   */
  function retentionStart(entry, mode) {
    if (mode === 'tokens') return entry.defaults.retainTokens ?? entry.settings.headroomTokens ?? 65536
    return entry.defaults.retainRatio ?? 0.16
  }

  /**
   * The settings as the fields show them.
   *
   * The engine keeps its ratios as float32, so a field would otherwise read
   * 0.800000011920929 for 0.8.
   * @param settings - the settings one scope answered with.
   * @returns the settings with readable ratios.
   */
  function shownSettings(settings) {
    const rounded = (value) => (Number.isFinite(value) ? Math.round(value * 1e4) / 1e4 : value)
    return {
      ...settings,
      thresholdRatio: rounded(settings.thresholdRatio),
      ...(settings.retainRatio === undefined ? {} : { retainRatio: rounded(settings.retainRatio) }),
    }
  }

  /** The pressure-threshold row, shown above the retained-context row. */
  const THRESHOLD_FIELD = Object.freeze({
    key: 'thresholdRatio', label: 'compaction.thresholdRatio', hint: 'compaction.thresholdRatioHint',
    min: 0.3, max: 0.9, step: 0.01,
  })

  /** The number rows shown below the retained-context row. */
  const COMPACTION_FIELDS = Object.freeze([
    { key: 'headroomTokens', label: 'compaction.headroomTokens', hint: 'compaction.headroomTokensHint', min: 0, max: 1048576, step: 256 },
    { key: 'maxTokens', label: 'compaction.maxTokens', hint: 'compaction.maxTokensHint', min: 256, max: 1048576, step: 256 },
    { key: 'compactionRetries', label: 'compaction.compactionRetries', hint: 'compaction.compactionRetriesHint', min: 0, max: 10, step: 1 },
    { key: 'maxOverflowRetries', label: 'compaction.maxOverflowRetries', hint: 'compaction.maxOverflowRetriesHint', min: 0, max: 10, step: 1 },
  ])

  /** The range each retained-context form accepts. */
  const RETENTION_BOUNDS = Object.freeze({
    ratio: { min: 0.01, max: 0.3, step: 0.01 },
    tokens: { min: 256, max: 1048576, step: 256 },
  })

  /**
   * The compaction settings of one session, or of the whole install.
   *
   * Both scopes are edited the same way: the panel reads the values in force,
   * writes them back, and drops them to fall back — the session to the global
   * default, the global default to the engine's own values.
   * @param useCompactionOpen - the open panel as a hook: the session it names.
   * @param closeCompaction - closes the panel.
   * @param reportNotice - shows the outcome of an operation.
   * @param t - this plugin's translate function.
   */
  function CompactionDialog({ useCompactionOpen, closeCompaction, reportNotice, t }) {
    const panel = useCompactionOpen((value) => value)
    const [scope, setScope] = React.useState('session')
    const [drafts, setDrafts] = React.useState({})
    const [busy, setBusy] = React.useState(false)
    const generation = React.useRef(0)
    const sessionId = panel === null ? '' : panel.sessionId

    /**
     * Read one scope into its draft.
     * @param target - the scope to read.
     * @param session - the session the panel was opened for.
     */
    const load = React.useCallback((target, session) => {
      const current = generation.current
      setDrafts((drafts) => ({ ...drafts, [target]: { state: 'loading' } }))
      requestJson(compactionPath(target, session)).then((payload) => {
        if (current !== generation.current) return
        setDrafts((drafts) => ({
          ...drafts,
          [target]: {
            state: 'ready',
            settings: shownSettings(payload.settings),
            defaults: shownSettings(payload.defaults),
            retentionMode: retentionModeOf(payload.settings),
          },
        }))
      }, (reason) => {
        if (current !== generation.current) return
        console.warn('better-session: reading the compaction settings failed:', reason)
        setDrafts((drafts) => ({ ...drafts, [target]: { state: 'failed' } }))
      })
    }, [])

    React.useEffect(() => {
      generation.current += 1
      if (panel === null) return
      setScope('session')
      setDrafts({})
      setBusy(false)
      load('session', panel.sessionId)
    }, [panel])

    React.useEffect(() => {
      if (panel === null || drafts[scope] !== undefined) return
      load(scope, panel.sessionId)
    }, [panel, scope, drafts])

    if (panel === null) return null

    const draft = drafts[scope]
    const ready = draft?.state === 'ready'
    const retentionMode = draft?.retentionMode ?? 'ratio'

    /**
     * Replace one field of the draft in view.
     * @param key - the setting.
     * @param value - the value the field holds.
     */
    const patch = (key, value) => setDrafts((drafts) => {
      const entry = drafts[scope]
      if (entry?.state !== 'ready') return drafts
      return {
        ...drafts,
        [scope]: { ...entry, settings: { ...entry.settings, [key]: value } },
      }
    })

    /**
     * Write the retained-context number in the form in force.
     * @param mode - the form the field writes.
     * @param value - the value the field holds.
     */
    const patchRetention = (mode, value) => patch(mode === 'tokens' ? 'retainTokens' : 'retainRatio', value)

    /**
     * Switch the retained-context form, seeding it from the engine's own value
     * for that form the first time it is shown.
     * @param nextMode - the form to show.
     */
    const switchRetention = (nextMode) => setDrafts((drafts) => {
      const entry = drafts[scope]
      if (entry?.state !== 'ready') return drafts
      const current = entry.retentionMode ?? 'ratio'
      if (current === nextMode) return drafts
      const key = nextMode === 'tokens' ? 'retainTokens' : 'retainRatio'
      const settings = entry.settings[key] === undefined
        ? { ...entry.settings, [key]: retentionStart(entry, nextMode) }
        : entry.settings
      return { ...drafts, [scope]: { ...entry, settings, retentionMode: nextMode } }
    })

    const save = () => {
      if (draft?.state !== 'ready') return
      setBusy(true)
      requestJson(compactionPath(scope, sessionId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(compactionBody(draft.settings, retentionMode)),
      }).then(() => {
        setBusy(false)
        closeCompaction()
        reportNotice({ text: t('compaction.saved') })
      }, (reason) => {
        setBusy(false)
        console.warn('better-session: saving the compaction settings failed:', reason)
        reportNotice({ text: saveFailureText(reason, t), failed: true })
      })
    }

    /**
     * Put the engine's own values in the fields, without writing anything.
     *
     * Resetting is an edit like any other: the values only land when the user
     * saves them.
     */
    const restore = () => setDrafts((drafts) => {
      const entry = drafts[scope]
      if (entry?.state !== 'ready') return drafts
      return {
        ...drafts,
        [scope]: {
          ...entry,
          settings: { ...entry.defaults },
          retentionMode: retentionModeOf(entry.defaults),
        },
      }
    })

    const bounds = RETENTION_BOUNDS[retentionMode]
    const retentionLabel = retentionMode === 'tokens' ? 'compaction.retentionTokens' : 'compaction.retentionRatio'

    const body = h(React.Fragment, null,
      h('div', { className: 'dsm_scope' },
        h(primitives.SegmentedControl, {
          id: 'dsm-compaction',
          value: scope,
          options: [
            { value: 'session', label: t('compaction.scopeSession') },
            { value: 'global', label: t('compaction.scopeGlobal') },
          ],
          onChange: (next) => setScope(next),
          label: t('compaction.scope'),
          disabled: busy,
        })),
      draft === undefined || draft.state === 'loading'
        ? h('p', { className: 'dsm_rowHint' }, t('dialog.loading'))
        : draft.state === 'failed'
          ? h('p', { className: 'dsm_rowHint' }, t('dialog.loadFailed'))
          : h('div', { className: 'dsm_rows' },
            h(NumberRow, {
              key: THRESHOLD_FIELD.key,
              label: t(THRESHOLD_FIELD.label),
              hint: t(THRESHOLD_FIELD.hint),
              range: t('compaction.range', { min: THRESHOLD_FIELD.min, max: THRESHOLD_FIELD.max }),
              value: draft.settings[THRESHOLD_FIELD.key],
              step: THRESHOLD_FIELD.step,
              min: THRESHOLD_FIELD.min,
              max: THRESHOLD_FIELD.max,
              disabled: busy,
              onChange: (value) => patch(THRESHOLD_FIELD.key, value),
            }),
            h(RetentionRow, {
              key: 'retention',
              mode: retentionMode,
              label: t(retentionLabel),
              hint: t(`${retentionLabel}Hint`),
              range: t('compaction.range', { min: bounds.min, max: bounds.max }),
              value: retentionValue(draft.settings, retentionMode),
              step: bounds.step,
              min: bounds.min,
              max: bounds.max,
              disabled: busy,
              unitLabel: t('compaction.unit'),
              ratioLabel: t('compaction.unitRatio'),
              tokensLabel: t('compaction.unitTokens'),
              onMode: switchRetention,
              onChange: (value) => patchRetention(retentionMode, value),
            }),
            COMPACTION_FIELDS.map((field) => h(NumberRow, {
              key: field.key,
              label: t(field.label),
              hint: t(field.hint),
              range: t('compaction.range', { min: field.min, max: field.max }),
              value: draft.settings[field.key],
              step: field.step,
              min: field.min,
              max: field.max,
              disabled: busy,
              onChange: (value) => patch(field.key, value),
            }))))

    return h(primitives.Modal, {
      open: true,
      onClose: closeCompaction,
      title: t('compaction.title'),
      closeLabel: t('dialog.close'),
      description: t(scope === 'global' ? 'compaction.globalDescription' : 'compaction.sessionDescription'),
      footer: [
        h(primitives.Button, {
          key: 'reset',
          variant: 'ghost',
          className: 'dsm_footerReset',
          disabled: busy || !ready,
          onClick: restore,
        }, t('compaction.reset')),
        h(primitives.Button, {
          key: 'cancel',
          variant: 'outline',
          onClick: closeCompaction,
        }, t('dialog.cancel')),
        h(primitives.Button, {
          key: 'save',
          variant: 'primary',
          disabled: busy || !ready,
          onClick: save,
        }, busy ? t('compaction.saving') : t('compaction.save')),
      ],
    }, body)
  }

  /** The composer entry that opens the compaction settings. */
  function CompactionTrigger({ openCompaction, t }) {
    return h(primitives.Tooltip, { label: t('action.compaction'), side: 'bottom' },
      h('button', {
        type: 'button',
        className: 'dsm_action',
        'aria-label': t('action.compaction'),
        onClick: openCompaction,
      }, h(primitives.IconSlidersTwoOutlineRegular, null)))
  }

  /**
   * The report of a finished operation, as the shipped transient banner.
   * @param useNotice - the notice store as a hook.
   * @param dismissNotice - clears the notice.
   */
  function NoticeLayer({ useNotice, dismissNotice }) {
    const notice = useNotice((current) => current)
    if (notice === null) return null
    return h(primitives.Toast, {
      key: notice.id,
      text: notice.text,
      ...(notice.failed === true ? {} : { tone: 'success' }),
      onDone: dismissNotice,
    })
  }

  return {
    inject: ['slots', 'locale'],
    apply(ctx) {
      const questionAction = createStore(null)
      const compactionOpen = createStore(null)
      const notice = createStore(null)
      let notices = 0
      const t = ctx.locale.bind(NS)
      const reportNotice = (next) => {
        notices += 1
        notice.set({ ...next, id: notices })
      }
      const dismissNotice = () => notice.set(null)
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'better-session: dictionaries')
      ctx.effect(() => insertStyles(), 'better-session: styles')
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'dsh-better-session.question-actions',
        order: 92,
        locale: NS,
        inject: (sessionId) => ({
          requestAction: (action) => questionAction.set({ ...action, sessionId }),
        }),
      }, UserQuestionActions))
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'dsh-better-session.compaction',
        order: 20,
        locale: NS,
        inject: (sessionId) => ({
          openCompaction: () => {
            if (typeof sessionId !== 'string' || sessionId.length === 0) return
            compactionOpen.set({ sessionId })
          },
        }),
      }, CompactionTrigger))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.question-dialog',
        order: 52,
        locale: NS,
        inject: () => ({
          hooks: { questionAction },
          settle: () => questionAction.set(null),
          reportNotice,
        }),
      }, ResendDialog))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.compaction-dialog',
        order: 53,
        locale: NS,
        inject: () => ({
          hooks: { compactionOpen },
          closeCompaction: () => compactionOpen.set(null),
          reportNotice,
        }),
      }, CompactionDialog))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.notice',
        order: 54,
        locale: NS,
        inject: () => ({
          hooks: { notice },
          dismissNotice,
        }),
      }, NoticeLayer))
    },
  }
})
