/**
 * Generated from src/client.js — do not edit. Run `npm run build`.
 */
window.__ModuleLoader__.load({
  id: "dsh-better-session",
  factory(require) {
    return (/**
 * Session management sub-component, browser side: the actions on every
 * question, the dialogs they open, and the compaction settings in the session
 * header.
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
  const REGENERATE_ROUTE = 'api/sessionManage/turns/regenerate'
  const COMPACTION_ROUTE = 'api/sessionManage/compaction'
  const STYLE_ID = 'dsh-better-session/styles.css'
  /** How long one turn operation may take before the page gives up on it. */
  const REQUEST_TIMEOUT_MS = 30000
  /** The rows a question is rendered in. */
  const QUESTION_ROW = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]'
  /** The element this sub-component mounts its buttons in. */
  const ACTION_HOST = 'data-dsh-better-session-actions'
  /** The attribute that marks a row of a removed turn. */
  const HIDDEN_ATTR = 'data-dsh-better-session-hidden'
  /** Where the removed turns of one session are remembered. */
  const HIDDEN_KEY = 'dsh-better-session:hidden:'

  const ZH = {
    'action.regenerate': '重新生成',
    'action.edit': '编辑并重发',
    'action.compaction': '上下文压缩配置',
    'dialog.close': '关闭',
    'dialog.cancel': '取消',
    'dialog.regenerateTitle': '重新生成本轮',
    'dialog.regenerateDescription': '将删除本轮及之后的所有内容，并用这一轮原来的提问重新提问。',
    'dialog.regenerateConfirm': '重新生成',
    'dialog.editTitle': '编辑提问并重发',
    'dialog.editDescription': '将删除本轮及之后的所有内容，并用下面的文字重新提问。',
    'dialog.editConfirm': '重发',
    'dialog.running': '这个会话正在生成回答，确认后会先中断它。',
    'dialog.loading': '正在读取这一轮的提问…',
    'dialog.loadFailed': '读取这一轮的提问失败，请查看 Harness 日志。',
    'compaction.title': '上下文压缩配置',
    'compaction.enabled': '启用运行时覆盖',
    'compaction.enabledHint': '关闭后，Harness 回到自己的压缩配置。',
    'compaction.thresholdRatio': '压缩阈值',
    'compaction.thresholdRatioHint': '上下文占用超过这个比例时开始压缩。',
    'compaction.range': '范围 {min} – {max}',
    'compaction.retainRatio': '保留比例',
    'compaction.retainRatioHint': '压缩后保留的最近上下文比例，必须小于压缩阈值。',
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
    'compaction.retainAboveThreshold': '保留比例必须小于压缩阈值。',
    'compaction.invalidMaxTokens': '摘要最大 token 必须在 256 – 65536 之间。',
    'compaction.invalidRetries': '重试次数必须在 0 – 10 之间。',
    'compaction.saved': '压缩配置已保存。',
    'notice.regenerated': '已重新生成。',
    'notice.edited': '已用新的提问重发。',
    'notice.regeneratedInterrupted': '已中断正在生成的回答，并重新生成。',
    'notice.editedInterrupted': '已中断正在生成的回答，并用新的提问重发。',
    'error.busy': '这个会话正在运行或还有排队的输入，请等它空闲后再试。',
    'error.queue': '这个会话还有排队的输入，请等队列清空后再试。',
    'error.compacted': '这一轮已经和压缩过的内容混在一起，无法单独处理。',
    'error.notClosed': '这一轮还没有结束，无法处理。',
    'error.notFound': '没有找到这一轮的内容。',
    'error.promptMissing': '这一轮没有可重发的文字提问。',
    'error.promptUnsupported': '这一轮的提问不是纯文本，无法重发。',
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
    'dialog.regenerateTitle': 'Regenerate this turn',
    'dialog.regenerateDescription': 'This removes this turn and everything after it, then asks the original question again.',
    'dialog.regenerateConfirm': 'Regenerate',
    'dialog.editTitle': 'Edit the question and resend it',
    'dialog.editDescription': 'This removes this turn and everything after it, then asks the text below instead.',
    'dialog.editConfirm': 'Resend',
    'dialog.running': 'This session is generating an answer; confirming interrupts it first.',
    'dialog.loading': 'Reading the question of this turn…',
    'dialog.loadFailed': 'Reading the question failed; check the Harness log.',
    'compaction.title': 'Context compaction',
    'compaction.enabled': 'Override at runtime',
    'compaction.enabledHint': 'With this off, the Harness uses its own compaction settings.',
    'compaction.thresholdRatio': 'Compression threshold',
    'compaction.thresholdRatioHint': 'Compaction starts once the context passes this share of the window.',
    'compaction.range': 'Range {min} – {max}',
    'compaction.retainRatio': 'Retained share',
    'compaction.retainRatioHint': 'The share of recent context kept after compaction; it must stay below the threshold.',
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
    'compaction.retainAboveThreshold': 'The retained share must stay below the threshold.',
    'compaction.invalidMaxTokens': 'The summary cap must be between 256 and 65536.',
    'compaction.invalidRetries': 'The retry count must be between 0 and 10.',
    'compaction.saved': 'The compaction settings are saved.',
    'notice.regenerated': 'Regenerated.',
    'notice.edited': 'Resent with the edited question.',
    'notice.regeneratedInterrupted': 'Interrupted the running answer and regenerated.',
    'notice.editedInterrupted': 'Interrupted the running answer and resent the edited question.',
    'error.busy': 'This session is running or still has queued input; retry when it is idle.',
    'error.queue': 'This session still has queued input; retry when the queue is empty.',
    'error.compacted': 'This turn shares a compacted range, so it cannot be handled on its own.',
    'error.notClosed': 'This turn has not ended yet, so it cannot be handled.',
    'error.notFound': 'Nothing was found for this turn.',
    'error.promptMissing': 'This turn has no text question to resend.',
    'error.promptUnsupported': 'The question of this turn is not plain text, so it cannot be resent.',
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
.dsm_rows { display: flex; flex-direction: column; gap: 16px; }
.dsm_row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dsm_rowText { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsm_rowLabel { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.dsm_rowHint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsm_rowSide { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.dsm_rowRange { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dsm_number { flex: none; width: 108px; }
.dsm_textarea {
box-sizing: border-box; width: 100%; min-height: 128px; resize: vertical; padding: 8px 10px;
border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md);
background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
font-family: inherit; font-size: 14px; line-height: 22px;
}
.dsm_textarea:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary); }
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
   * The turns one session has removed, as remembered by the page.
   *
   * The log keeps the removed events — the log is append-only — so the page
   * has to remember which turns are gone to keep showing the conversation as
   * it is now.
   * @param sessionId - the session the ranges belong to.
   * @returns the removed ranges, as `[startTurn, endTurn]` pairs.
   */
  function hiddenRanges(sessionId) {
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY + sessionId)
      const parsed = raw === null ? [] : JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((range) => Array.isArray(range) && range.length === 2 && range.every(Number.isInteger))
    } catch {
      return []
    }
  }

  /**
   * Remember that a turn range is gone.
   * @param sessionId - the session the range belongs to.
   * @param startTurn - first removed turn.
   * @param endTurn - last removed turn.
   */
  function rememberHiddenRange(sessionId, startTurn, endTurn) {
    if (!Number.isInteger(startTurn) || !Number.isInteger(endTurn)) return
    const ranges = hiddenRanges(sessionId)
    ranges.push([startTurn, endTurn])
    try {
      window.localStorage.setItem(HIDDEN_KEY + sessionId, JSON.stringify(ranges))
    } catch {
      // A page without storage still hides the range until it reloads.
    }
    applyHiddenRanges(sessionId)
  }

  /**
   * Hide the rows of the removed turns.
   * @param sessionId - the session whose ranges apply.
   */
  function applyHiddenRanges(sessionId) {
    const ranges = hiddenRanges(sessionId)
    for (const row of document.querySelectorAll('[data-chat-turn]')) {
      const turn = Number(row.dataset.chatTurn)
      if (!Number.isSafeInteger(turn)) continue
      if (ranges.some(([start, end]) => turn >= start && turn <= end)) row.setAttribute(HIDDEN_ATTR, '')
      else row.removeAttribute(HIDDEN_ATTR)
    }
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
   * Remove one question's turn and re-send the question.
   * @param sessionId - the session the question belongs to.
   * @param messageId - the question's message identity.
   * @param text - the replacement question, when the user edited it.
   * @returns what the Host did.
   */
  function regenerateTurn(sessionId, messageId, text) {
    return requestJson(REGENERATE_ROUTE, {
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
    if (code === 'turn-compacted') return t('error.compacted')
    if (code === 'turn-not-closed') return t('error.notClosed')
    if (code === 'target-not-found' || code === 'session-not-active' || code === 'session-not-loaded') return t('error.notFound')
    if (code === 'prompt-not-found') return t('error.promptMissing')
    if (code === 'prompt-unsupported') return t('error.promptUnsupported')
    if (code === 'timeout') return t('error.timeout')
    if (code === 'route-missing') return t('error.routeMissing')
    return t('error.failed')
  }

  /**
   * The actions of one question: ask it again, or ask it again with edited
   * words. Both run the same removal, so both live behind one confirmation.
   * @param messageId - the question's message identity.
   * @param requestAction - opens the dialog of the chosen action.
   * @param useSession - the session projection as a hook.
   * @param t - this plugin's translate function.
   */
  function TurnActionButtons({ messageId, requestAction, useSession, t }) {
    const running = useSession((snapshot) => snapshot.running === true)
    /**
     * One action button, in the metrics of the strip it sits in.
     *
     * The button stays usable while the session works: replacing a turn whose
     * answer is still streaming is what a user asks for when the answer being
     * written is not the one they wanted. The dialog warns that confirming
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
  function UserTurnActions({ sessionId, requestAction, useSession, t }) {
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
        applyHiddenRanges(sessionId)
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
      h(TurnActionButtons, { messageId: target.messageId, requestAction, useSession, t }),
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
   * The dialogs the turn actions open: the regeneration confirmation and the
   * editor.
   * @param useTurnAction - the pending action as a hook.
   * @param settle - dismisses the dialog.
   * @param reportNotice - shows the outcome of an operation.
   * @param t - this plugin's translate function.
   */
  function TurnDialog({ useTurnAction, settle, reportNotice, t }) {
    const action = useTurnAction((pending) => pending)
    const [draft, setDraft] = React.useState('')
    const [state, setState] = React.useState('idle')
    const [busy, setBusy] = React.useState(false)

    React.useEffect(() => {
      if (action === null) return undefined
      setBusy(false)
      if (action.kind !== 'edit') return undefined
      let live = true
      setState('loading')
      readPrompt(action.sessionId, action.messageId).then((prompt) => {
        if (!live) return
        setDraft(prompt)
        setState('ready')
      }, (reason) => {
        if (!live) return
        console.warn('better-session: reading the turn question failed:', reason)
        setState('failed')
      })
      return () => {
        live = false
      }
    }, [action])

    if (action === null) return null

    /**
     * Run one turn operation and report what it did.
     * @param text - the replacement question, left out to reuse the original.
     * @param message - the notice of a finished operation.
     * @param interruptedMessage - the notice of an operation that interrupted a
     *   running turn first.
     */
    const run = (text, message, interruptedMessage) => {
      setBusy(true)
      settle()
      regenerateTurn(action.sessionId, action.messageId, text).then((payload) => {
        rememberHiddenRange(action.sessionId, payload.turn, payload.endTurn ?? payload.turn)
        reportNotice({ text: payload.interrupted === true ? interruptedMessage : message })
      }, (reason) => {
        console.warn('better-session: the turn operation failed:', reason)
        reportNotice({ text: failureText(reason, t), failed: true })
      })
    }

    const runningHint = action.running === true ? ` ${t('dialog.running')}` : ''

    if (action.kind === 'edit') {
      const body = state === 'loading'
        ? h('p', { className: 'dsm_rowHint' }, t('dialog.loading'))
        : state === 'failed'
          ? h('p', { className: 'dsm_rowHint' }, t('dialog.loadFailed'))
          : h('textarea', {
            className: 'dsm_textarea',
            value: draft,
            onChange: (event) => setDraft(event.target.value),
          })
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
   * Map a refused save onto its localized reason; anything else stays generic.
   * @param error - the refusal the Host answered with.
   * @param t - this plugin's translate function.
   * @returns the localized line.
   */
  function saveFailureText(error, t) {
    const code = typeof error?.code === 'string' ? error.code : undefined
    if (code === 'invalid-threshold-ratio') return t('compaction.invalidThreshold')
    if (code === 'invalid-retain-ratio') return t('compaction.invalidRetain')
    if (code === 'retain-ratio-not-less-than-threshold') return t('compaction.retainAboveThreshold')
    if (code === 'invalid-max-tokens') return t('compaction.invalidMaxTokens')
    if (code === 'invalid-compaction-retries' || code === 'invalid-max-overflow-retries' || code === 'invalid-enabled') return t('compaction.invalidRetries')
    if (code === 'timeout') return t('error.timeout')
    if (code === 'route-missing') return t('error.routeMissing')
    return t('compaction.saveFailed')
  }

  /**
   * The compaction settings: the five parameters the Harness compresses at,
   * and the switch that turns the runtime override on.
   * @param useCompactionOpen - the panel-open store as a hook.
   * @param closeCompaction - closes the panel.
   * @param reportNotice - shows the outcome of a save.
   * @param t - this plugin's translate function.
   */
  function CompactionDialog({ useCompactionOpen, closeCompaction, reportNotice, t }) {
    const open = useCompactionOpen((value) => value)
    const [snapshot, setSnapshot] = React.useState(null)
    const [settings, setSettings] = React.useState(null)
    const [busy, setBusy] = React.useState(false)

    React.useEffect(() => {
      if (!open) return undefined
      let live = true
      setSnapshot(null)
      setSettings(null)
      requestJson(COMPACTION_ROUTE).then((payload) => {
        if (!live) return
        setSnapshot(payload)
        setSettings(payload.settings)
      }, (reason) => {
        if (!live) return
        console.warn('better-session: reading the compaction settings failed:', reason)
        setSnapshot({ failed: true })
      })
      return () => {
        live = false
      }
    }, [open])

    if (!open) return null

    const patch = (key, value) => setSettings({ ...settings, [key]: value })
    const body = snapshot === null
      ? h('p', { className: 'dsm_rowHint' }, t('dialog.loading'))
      : snapshot.failed === true
        ? h('p', { className: 'dsm_rowHint' }, t('dialog.loadFailed'))
        : h('div', { className: 'dsm_rows' },
          h('div', { className: 'dsm_row' },
            h('div', { className: 'dsm_rowText' },
              h('span', { className: 'dsm_rowLabel' }, t('compaction.enabled')),
              h('span', { className: 'dsm_rowHint' }, t('compaction.enabledHint'))),
            h(primitives.Switch, {
              checked: settings.enabled,
              disabled: busy,
              label: t('compaction.enabled'),
              onChange: (value) => patch('enabled', value),
            })),
          h(NumberRow, {
            label: t('compaction.thresholdRatio'),
            hint: t('compaction.thresholdRatioHint'),
            range: t('compaction.range', { min: 0.3, max: 0.9 }),
            value: settings.thresholdRatio,
            step: 0.01,
            min: 0.3,
            max: 0.9,
            disabled: busy,
            onChange: (value) => patch('thresholdRatio', value),
          }),
          h(NumberRow, {
            label: t('compaction.retainRatio'),
            hint: t('compaction.retainRatioHint'),
            range: t('compaction.range', { min: 0.01, max: 0.3 }),
            value: settings.retainRatio,
            step: 0.01,
            min: 0.01,
            max: 0.3,
            disabled: busy,
            onChange: (value) => patch('retainRatio', value),
          }),
          h(NumberRow, {
            label: t('compaction.maxTokens'),
            hint: t('compaction.maxTokensHint'),
            range: t('compaction.range', { min: 256, max: 65536 }),
            value: settings.maxTokens,
            step: 256,
            min: 256,
            max: 65536,
            disabled: busy,
            onChange: (value) => patch('maxTokens', value),
          }),
          h(NumberRow, {
            label: t('compaction.compactionRetries'),
            hint: t('compaction.compactionRetriesHint'),
            range: t('compaction.range', { min: 0, max: 10 }),
            value: settings.compactionRetries,
            step: 1,
            min: 0,
            max: 10,
            disabled: busy,
            onChange: (value) => patch('compactionRetries', value),
          }),
          h(NumberRow, {
            label: t('compaction.maxOverflowRetries'),
            hint: t('compaction.maxOverflowRetriesHint'),
            range: t('compaction.range', { min: 0, max: 10 }),
            value: settings.maxOverflowRetries,
            step: 1,
            min: 0,
            max: 10,
            disabled: busy,
            onChange: (value) => patch('maxOverflowRetries', value),
          }))

    const save = () => {
      setBusy(true)
      requestJson(COMPACTION_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          thresholdRatio: Number(settings.thresholdRatio),
          retainRatio: Number(settings.retainRatio),
          maxTokens: Math.trunc(Number(settings.maxTokens)),
          compactionRetries: Math.trunc(Number(settings.compactionRetries)),
          maxOverflowRetries: Math.trunc(Number(settings.maxOverflowRetries)),
        }),
      }).then((answer) => {
        setBusy(false)
        setSettings(answer.settings)
        closeCompaction()
        reportNotice({ text: t('compaction.saved') })
      }, (reason) => {
        setBusy(false)
        console.warn('better-session: saving the compaction settings failed:', reason)
        reportNotice({ text: saveFailureText(reason, t), failed: true })
      })
    }

    return h(primitives.Modal, {
      open: true,
      onClose: closeCompaction,
      title: t('compaction.title'),
      closeLabel: t('dialog.close'),
      footer: [
        h(primitives.Button, {
          key: 'cancel',
          variant: 'outline',
          onClick: closeCompaction,
        }, t('dialog.cancel')),
        h(primitives.Button, {
          key: 'save',
          variant: 'primary',
          disabled: busy || snapshot === null || snapshot.failed === true,
          onClick: save,
        }, busy ? t('compaction.saving') : t('compaction.save')),
      ],
    }, body)
  }

  /** The session header entry that opens the compaction settings. */
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
      const turnAction = createStore(null)
      const compactionOpen = createStore(false)
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
        id: 'dsh-better-session.turn-actions',
        order: 92,
        locale: NS,
        inject: (sessionId) => ({
          requestAction: (action) => turnAction.set({ ...action, sessionId }),
        }),
      }, UserTurnActions))
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'dsh-better-session.compaction',
        order: 30,
        locale: NS,
        inject: () => ({
          openCompaction: () => compactionOpen.set(true),
        }),
      }, CompactionTrigger))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.turn-dialog',
        order: 52,
        locale: NS,
        inject: () => ({
          hooks: { turnAction },
          settle: () => turnAction.set(null),
          reportNotice,
        }),
      }, TurnDialog))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.compaction-dialog',
        order: 53,
        locale: NS,
        inject: () => ({
          hooks: { compactionOpen },
          closeCompaction: () => compactionOpen.set(false),
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
}))(require)
  },
})
