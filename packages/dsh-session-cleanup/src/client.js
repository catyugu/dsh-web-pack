/**
 * Session cleanup sub-component, browser side: the session row menu entry, the
 * workspace menu row, the sidebar cleanup trigger, the cleanup panel, and the
 * notices.
 *
 * This file is one sub-component of the `dsh-better-session` browser bundle. It
 * is written as a parenthesized function expression so the package build can
 * compose it with the other sub-components without a bundler: the build reads
 * all of them and writes the package's `client.js` entry.
 *
 * @module dsh-better-session/cleanup/client
 */
(function (require) {
  const React = require('react')
  const { createPortal } = require('react-dom')

  const h = React.createElement
  const NS = 'sessionCleanup'
  const ROUTE = 'api/sessionCleanup/remove'
  const STATE_ROUTE = 'api/sessionCleanup/state'
  const SETTINGS_ROUTE = 'api/sessionCleanup/settings'
  const BULK_ROUTE = 'api/sessionCleanup/bulk'
  const STYLE_ID = 'dsh-better-session/delete/styles.css'
  const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
  /** The workspace rows of the sidebar tree; their key carries the workspace id. */
  const WORKSPACE_ROW = '[data-row-key^="workspace:"]'
  /** How long a deletion notice stays fully visible, and how long it fades. */
  const NOTICE_HOLD_MS = 4000
  const NOTICE_FADE_MS = 1000
  /** How long the inventory read waits before the panel reports a stalled page. */
  const STATE_TIMEOUT_MS = 20_000
  /** How long one bulk deletion may run; each conversation costs a few file operations. */
  const BULK_TIMEOUT_MS = 300_000

  const ZH = {
    'menu.delete': '删除会话',
    'menu.clearArchived': '清空已归档对话',
    'dialog.title': '删除会话',
    'dialog.description': '将永久删除「{title}」的全部记录（会话日志、投影缓存与工作区登记），此操作无法撤销。',
    'dialog.descriptionUntitled': '将永久删除该会话的全部记录（会话日志、投影缓存与工作区登记），此操作无法撤销。',
    'dialog.cancel': '取消',
    'dialog.confirm': '删除会话',
    'dialog.close': '关闭',
    'error.running': '该会话正在运行，请先停止其工作后再删除。',
    'error.notFound': '没有找到该会话的磁盘记录，可能已经被删除。',
    'error.badRequest': '请求无效，未执行删除。',
    'error.failed': '删除失败，请查看 Harness 日志。',
    'bulk.title': '清空已归档对话',
    'bulk.description': '将永久删除「{title}」下的 {count} 个已归档对话（会话日志、投影缓存与工作区登记），此操作无法撤销。',
    'bulk.empty': '该工作区没有已归档对话，无需清理。',
    'bulk.cancel': '取消',
    'bulk.confirm': '清空已归档对话',
    'bulk.close': '关闭',
    'bulk.done': '已删除 {count} 个已归档对话。',
    'bulk.partial': '已删除 {count} 个，另有 {failed} 个未能删除。',
    'notice.sessionDeleted': '已删除会话「{title}」。',
    'notice.sessionUntitled': '已删除该会话。',
    'notice.subagents': '同时删除了 {count} 个子代理对话。',
    'notice.steps': '部分记录未能清理，请查看 Harness 日志。',
    'entry.label': '会话清理',
    'panel.title': '会话清理',
    'panel.settings': '清理范围',
    'panel.attachments': '同时删除相关附件',
    'panel.attachmentsHint': '删除后重新统计仍被引用的附件，只清掉没人再用的图片与文件。',
    'panel.orphaned': '无分类对话',
    'panel.orphanedHint': '所在工作区已经删除，这些对话在任何列表里都看不到。',
    'panel.detached': '其余不可见对话',
    'panel.detachedHint': '工作区还在，但这些对话没有归入任何分类。',
    'panel.deleteCount': '删除 {count} 个',
    'panel.cleanCount': '清理 {count} 个',
    'panel.refresh': '刷新',
    'panel.close': '关闭',
    'panel.loading': '正在统计…',
    'panel.empty': '没有需要清理的对话。',
    'panel.restart': '这一端还没有加载清理路由：重启一次 Harness 后可用。',
    'panel.timeout': '等待 Host 超时：这个页面可能已经没有空闲连接，刷新一次再试。',
    'panel.failed': '统计失败，请查看 Harness 日志。',
    'panel.confirmDescription': '将永久删除 {count} 个对话的全部记录，此操作无法撤销。',
    'panel.back': '返回',
    'panel.running': '正在删除…',
    'panel.done': '已删除 {count} 个对话。',
    'panel.partial': '已删除 {count} 个，另有 {failed} 个未能删除。',
    'panel.collected': '同时清理了 {count} 个不再被引用的附件。',
    'panel.settingsFailed': '设置没有保存，请查看 Harness 日志。',
  }

  const EN = {
    'menu.delete': 'Delete session',
    'menu.clearArchived': 'Clear archived conversations',
    'dialog.title': 'Delete session',
    'dialog.description': 'This permanently deletes every record of "{title}" (session log, projection cache, and workspace entry) and cannot be undone.',
    'dialog.descriptionUntitled': 'This permanently deletes every record of this session (session log, projection cache, and workspace entry) and cannot be undone.',
    'dialog.cancel': 'Cancel',
    'dialog.confirm': 'Delete session',
    'dialog.close': 'Close',
    'error.running': 'The session is running; stop its work before deleting it.',
    'error.notFound': 'No on-disk record was found for this session; it may already be deleted.',
    'error.badRequest': 'The request was invalid, so nothing was deleted.',
    'error.failed': 'Deleting failed; check the Harness log.',
    'bulk.title': 'Clear archived conversations',
    'bulk.description': 'This permanently deletes the {count} archived conversations of "{title}" (session log, projection cache, and workspace entry) and cannot be undone.',
    'bulk.empty': 'This workspace has no archived conversations to clear.',
    'bulk.cancel': 'Cancel',
    'bulk.confirm': 'Clear archived conversations',
    'bulk.close': 'Close',
    'bulk.done': 'Deleted {count} archived conversations.',
    'bulk.partial': 'Deleted {count}; {failed} could not be deleted.',
    'notice.sessionDeleted': 'Deleted session "{title}".',
    'notice.sessionUntitled': 'Deleted the session.',
    'notice.subagents': 'Also deleted {count} subagent conversations.',
    'notice.steps': 'Some records could not be cleaned up; check the Harness log.',
    'entry.label': 'Session cleanup',
    'panel.title': 'Session cleanup',
    'panel.settings': 'Cleanup scope',
    'panel.attachments': 'Delete the related attachments',
    'panel.attachmentsHint': 'Recompute which attachments are still referenced and drop only the images and files nothing uses.',
    'panel.orphaned': 'Uncategorized conversations',
    'panel.orphanedHint': 'Their workspace is gone, so no list shows them.',
    'panel.detached': 'Other invisible conversations',
    'panel.detachedHint': 'The workspace still exists, but none of them belongs to a category.',
    'panel.deleteCount': 'Delete {count}',
    'panel.cleanCount': 'Clear {count}',
    'panel.refresh': 'Refresh',
    'panel.close': 'Close',
    'panel.loading': 'Counting…',
    'panel.empty': 'Nothing to clean up.',
    'panel.restart': 'This sub-component has not loaded the cleanup routes yet: restart the Harness once.',
    'panel.timeout': 'The Host did not answer in time: this page may be out of free connections; reload and retry.',
    'panel.failed': 'Counting failed; check the Harness log.',
    'panel.confirmDescription': 'This permanently deletes all records of {count} conversations and cannot be undone.',
    'panel.back': 'Back',
    'panel.running': 'Deleting…',
    'panel.done': 'Deleted {count} conversations.',
    'panel.partial': 'Deleted {count}; {failed} could not be deleted.',
    'panel.collected': 'Also cleaned {count} attachments nothing references any more.',
    'panel.settingsFailed': 'The setting was not saved; check the Harness log.',
  }

  const CSS = `
.dsd_itemWrap { position: relative; }
.dsd_separator { height: 0.5px; margin: 3px 2px; background: var(--dsw-alias-border-l2); }
.dsd_item {
display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px;
padding: 6px 8px; border: none; border-radius: var(--dsw-radius-md);
background: transparent; cursor: pointer; font-size: 13px; line-height: 20px;
color: var(--dsw-alias-state-error-primary); text-align: left;
}
.dsd_item:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.dsd_item:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); outline: none; }
.dsd_item:disabled { opacity: 0.4; cursor: not-allowed; }
.dsd_itemIcon {
display: inline-flex; flex: none; width: 14px; height: 14px;
align-items: center; justify-content: center; color: var(--dsw-alias-state-error-primary);
}
.dsd_itemIcon svg { width: 14px; height: 14px; }
.dsd_itemLabel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsd_root {
pointer-events: auto; position: fixed; inset: 0; z-index: 1000;
display: flex; align-items: center; justify-content: center;
padding: max(24px, var(--dsh-frame-overlay-top, 24px)) 24px;
}
.dsd_mask { position: absolute; inset: var(--dsh-frame-chrome-top, 0px) 0 0; backdrop-filter: var(--dsw-mask-blur); }
.dsd_mask::after {
content: ''; position: absolute; inset: 0; background: var(--dsw-alias-bg-mask-1);
animation: dsd-enter var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsd_dialog {
box-sizing: border-box; position: relative; z-index: 1; display: flex; flex-direction: column;
gap: 20px; width: min(380px, 100%); padding: 0 0 24px; overflow: hidden; border: 0;
border-radius: var(--dsw-radius-panel); background: var(--dsw-alias-bg-layer-2);
box-shadow: var(--dsw-elevation-prominent);
animation: dsd-enter var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsd_dialog:focus { outline: none; }
.dsd_dialogWide { width: min(520px, 100%); }
.dsd_content { display: flex; flex-direction: column; width: 100%; }
.dsd_header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 22px 14px 12px 24px; }
.dsd_title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsd_close {
flex: none; display: inline-flex; align-items: center; justify-content: center;
width: 28px; height: 28px; border: none; border-radius: var(--dsw-radius-sm);
background: transparent; cursor: pointer; color: var(--dsw-alias-label-secondary);
}
.dsd_close:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsd_description {
margin: 0; padding: 0 24px; font-size: 14px; line-height: 22px;
font-weight: 400; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere;
}
.dsd_body { display: flex; flex-direction: column; min-width: 0; margin-top: 20px; padding: 0 24px; }
.dsd_footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 24px; }
.dsd_button {
box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
gap: 4px; height: 36px; padding: 0 14px; border: none; border-radius: var(--dsw-radius-md);
cursor: pointer; font-size: 14px; line-height: 22px;
color: var(--dsw-alias-label-primary); background: transparent;
}
.dsd_button:disabled { cursor: not-allowed; opacity: 0.4; }
.dsd_outline { border: 0.5px solid var(--dsw-alias-border-l3); background: transparent; }
.dsd_outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsd_destructive:not(:disabled) { color: var(--dsw-alias-state-error-primary); }
.dsd_status { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dsd_error { color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
.dsd_error + .dsd_status { margin-top: 8px; }
.dsd_notice {
position: fixed; top: 40px; left: 50%; z-index: 1100; pointer-events: none;
display: flex; align-items: center; gap: 10px; width: max-content;
max-width: min(640px, calc(100vw - 48px)); padding: 12px 16px;
border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-toast-bg);
color: var(--dsw-alias-toast-label); font-size: 14px; line-height: 22px;
box-shadow: var(--dsw-shadow-lv3); transform: translate(-50%);
animation: dsd-notice-in var(--ds-transition-duration) var(--ds-ease-in-out),
  dsd-notice-out 1s ease var(--dsh-notice-hold, 4s) forwards;
}
.dsd_noticeError { color: var(--dsw-alias-state-error-primary); }
.dsd_noticeText { flex: 1; min-width: 0; }
.dsd_noticeClose {
flex: none; display: inline-flex; align-items: center; justify-content: center;
width: 24px; height: 24px; border: none; border-radius: var(--dsw-radius-sm);
background: transparent; cursor: pointer; pointer-events: auto;
color: inherit; opacity: 0.7;
}
.dsd_noticeClose:hover { opacity: 1; background: var(--dsw-alias-interactive-bg-hover); }
@keyframes dsd-notice-in { from { opacity: 0; transform: translate(-50%, -6px); } }
@keyframes dsd-notice-out { to { opacity: 0; visibility: hidden; } }
@keyframes dsd-enter { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dsd_mask::after, .dsd_dialog { animation: none; } }
.dsd_entryRow { flex: none; display: flex; align-items: center; }
.dsd_entryRow[data-rail='rail'] { flex-direction: column-reverse; }
.dsd_trigger {
position: relative; flex: none; display: inline-flex; align-items: center;
justify-content: center; width: 36px; height: 36px; border: none; border-radius: 50%;
padding: 0; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.dsd_trigger:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsd_trigger:active { background: var(--dsw-alias-interactive-bg-active); }
.dsd_trigger:focus-visible {
outline: none;
box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);
}
.dsd_triggerIcon { display: inline-flex; }
.dsd_triggerIcon svg { width: 18px; height: 18px; }
.dsd_section { display: flex; flex-direction: column; gap: 10px; }
.dsd_section + .dsd_section { margin-top: 20px; }
.dsd_sectionTitle { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsd_row { display: flex; align-items: flex-start; gap: 12px; }
.dsd_rowText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsd_rowLabel { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dsd_rowHint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dsd_switch {
position: relative; flex: none; width: 36px; height: 20px; margin-top: 1px;
border: none; border-radius: 999px; padding: 0; cursor: pointer;
background: var(--dsw-alias-interactive-bg-secondary); transition: background var(--ds-transition-duration);
}
.dsd_switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.dsd_switch:disabled { cursor: not-allowed; opacity: 0.5; }
.dsd_switch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary); }
.dsd_knob {
position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
background: var(--dsw-alias-bg-layer-2); transition: transform var(--ds-transition-duration);
}
.dsd_switch[aria-checked='true'] .dsd_knob { transform: translateX(16px); }
.dsd_statRow { align-items: center; }
.dsd_scope { display: flex; align-items: center; gap: 12px; }
.dsd_scopeAction { flex: none; }
.dsd_panelNotice { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dsd_panelNoticeError { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
`

  function TrashIcon() {
    return h('svg', {
      width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', strokeWidth: 1,
    },
    h('path', { d: 'M1.28149 3.88831H14.7187', stroke: 'currentColor' }),
    h('path', {
      d: 'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
      stroke: 'currentColor',
    }),
    h('path', {
      d: 'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
      stroke: 'currentColor',
    }),
    h('path', { d: 'M6.44946 6.98926V11.1238', stroke: 'currentColor' }),
    h('path', { d: 'M9.55054 6.98926V11.1238', stroke: 'currentColor' }))
  }

  function CloseIcon() {
    return h('svg', {
      width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', strokeWidth: 1,
    },
    h('path', { d: 'M2.5 2.5L13.5 13.5', stroke: 'currentColor' }),
    h('path', { d: 'M13.5 2.5L2.5 13.5', stroke: 'currentColor' }))
  }

  /** The archive box the workspace menu row carries, drawn outside React. */
  const ARCHIVE_ICON_PATHS = [
    'M2.25 3.25h11.5v2.5H2.25z',
    'M3.5 5.75v7h9v-7',
    'M6.5 8.5h3',
  ]

  /**
   * The archive-box icon as plain DOM, for the row this plugin adds to the
   * shipped workspace menu.
   * @returns the SVG element.
   */
  function createArchiveIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('stroke-width', '1')
    for (const d of ARCHIVE_ICON_PATHS) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', d)
      path.setAttribute('stroke', 'currentColor')
      svg.append(path)
    }
    return svg
  }

  /** One pending deletion, shared between the menu row and the overlay dialog. */
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

  /** Insert this plugin's stylesheet once for the mounted run. */
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
   * The workspace whose action menu is open right now.
   *
   * The shipped workspace browser marks the row whose menu is open, so that
   * row is the only place a workspace menu can come from.
   * @returns the workspace identity, its title, and its row, or null when no
   *   workspace menu is open.
   */
  function openWorkspace() {
    for (const row of document.querySelectorAll(WORKSPACE_ROW)) {
      if (![...row.classList].some((name) => name.includes('menuOpen'))) continue
      const key = row.getAttribute('data-row-key')
      if (key === null) continue
      return { workspaceId: key.slice('workspace:'.length), title: row.textContent.trim(), row }
    }
    return null
  }

  /**
   * Add this plugin's row to a workspace action menu.
   *
   * The shipped workspace browser builds that menu inline and declares no
   * slot for it, so the row joins the rendered menu instead. It is cloned
   * from the menu's own first row, so it carries the menu's own styling.
   * @param menu - the rendered menu surface.
   * @param label - the localized row label.
   * @param onSelect - called when the row is chosen.
   * @returns whether the menu now carries the row, or was not far enough
   *   rendered to tell — a menu that is not ready is worth another look on the
   *   next mutation, one that already has the row is finished.
   */
  function insertWorkspaceMenuRow(menu, label, onSelect) {
    const viewport = menu.querySelector('[role="presentation"]')
    if (viewport === null) return 'not-ready'
    const rows = [...viewport.children]
    if (rows.length < 2) return 'not-ready'
    // The Session menu carries this plugin's own row; that is a different menu.
    if (rows.some((row) => row.classList.contains('dsd_itemWrap'))) return 'present'
    const wrapper = rows[0].cloneNode(true)
    const button = wrapper.querySelector('button')
    if (button === null) return 'not-ready'
    const [icon, text] = button.querySelectorAll('span')
    if (icon === undefined || text === undefined) return 'not-ready'
    icon.replaceChildren(createArchiveIcon())
    text.textContent = label
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onSelect()
    })
    viewport.insertBefore(wrapper, rows[1])
    return 'inserted'
  }

  /**
   * Watch the page for the workspace action menu and add this plugin's row
   * to it, between Rename and Delete workspace.
   * @param t - this plugin's translate function.
   * @param onSelect - called with the open workspace when the row is chosen.
   * @returns a disposer that stops watching.
   */
  function watchWorkspaceMenus(t, onSelect) {
    const handled = new WeakSet()
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          const menus = node.matches('[role="menu"]') ? [node] : [...node.querySelectorAll('[role="menu"]')]
          for (const menu of menus) {
            if (handled.has(menu)) continue
            const workspace = openWorkspace()
            if (workspace === null) continue
            // Only a menu that is already settled is done with: marking one
            // that is still rendering would skip it for the rest of the run.
            if (insertWorkspaceMenuRow(menu, t('menu.clearArchived'), () => onSelect(workspace)) === 'not-ready') continue
            handled.add(menu)
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }

  /** Dismiss the workspace menu a chosen row belongs to. */
  function closeWorkspaceMenu(workspace) {
    const trigger = workspace.row.querySelector('button')
    if (trigger instanceof HTMLElement) trigger.click()
  }

  /** Menu row: danger-styled, placed after the shipped archive row. */
  function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, requestDelete, t }) {
    const [, setMenuOpen] = useMenuOpenState()
    return h('div', { className: 'dsd_itemWrap' },
      h('div', { className: 'dsd_separator', role: 'separator' }),
      h('button', {
        type: 'button',
        role: 'menuitem',
        className: 'dsd_item',
        onClick: () => {
          setMenuOpen(false)
          requestDelete({ sessionId, displayTitle })
        },
      },
      h('span', { className: 'dsd_itemIcon' }, h(TrashIcon, null)),
      h('span', { className: 'dsd_itemLabel' }, t('menu.delete'))))
  }

  /** Overlay entry: the confirmation dialogs and the notices they report. */
  function DeleteSessionDialog({ useDeleteRequest, useClearRequest, useNotice, settleDelete, settleClear, reportNotice, dismissNotice, removeSession, removeSessions, useWorkspaces, t }) {
    const session = useDeleteRequest((pending) => pending)
    const workspace = useClearRequest((pending) => pending)
    const notice = useNotice((current) => current)
    return h(React.Fragment, null,
      session === null ? null : h(DeleteSessionForm, {
        key: session.sessionId,
        target: session,
        settleDelete,
        reportNotice,
        removeSession,
        t,
      }),
      workspace === null ? null : h(ClearArchivedForm, {
        key: workspace.workspaceId,
        target: workspace,
        settleClear,
        reportNotice,
        removeSessions,
        useWorkspaces,
        t,
      }),
      h(Notice, { notice, dismissNotice, t }))
  }

  /**
   * Confirmation for deleting one session.
   *
   * Confirming closes the dialog at once: the deletion itself runs in the
   * background and reports through a notice, so the page stays usable.
   * @param target - the session to delete.
   * @param settleDelete - dismisses the dialog.
   * @param reportNotice - shows the outcome of the deletion.
   * @param removeSession - deletes the session.
   * @param t - this plugin's translate function.
   */
  function DeleteSessionForm({ target, settleDelete, reportNotice, removeSession, t }) {
    const title = typeof target.displayTitle === 'string' ? target.displayTitle : ''
    const confirm = () => {
      settleDelete()
      removeSession(target).then((payload) => {
        const deleted = title === '' ? t('notice.sessionUntitled') : t('notice.sessionDeleted', { title })
        const notes = removalNotes(payload, t)
        reportNotice({ text: notes.length === 0 ? deleted : `${deleted} ${notes.join(' ')}` })
      }, (reason) => {
        console.warn('better-session: removal rejected:', reason)
        reportNotice({ text: failureText(reason, t), failed: true })
      })
    }
    const description = title === ''
      ? t('dialog.descriptionUntitled')
      : t('dialog.description', { title })
    return h(Modal, {
      title: t('dialog.title'),
      closeLabel: t('dialog.close'),
      description,
      onClose: settleDelete,
      footer: [
        h('button', {
          key: 'cancel',
          type: 'button',
          className: 'dsd_button dsd_outline',
          'data-modal-autofocus': true,
          onClick: settleDelete,
        }, t('dialog.cancel')),
        h('button', {
          key: 'confirm',
          type: 'button',
          className: 'dsd_button dsd_outline dsd_destructive',
          onClick: confirm,
        }, t('dialog.confirm')),
      ],
    })
  }

  /**
   * Confirmation for clearing one workspace's archived conversations.
   *
   * Confirming closes the dialog at once: the deletions run in the background
   * and report through a notice, so the page stays usable.
   * @param target - the workspace to clear.
   * @param settleClear - dismisses the dialog.
   * @param reportNotice - shows the outcome of the deletions.
   * @param removeSessions - deletes the given sessions.
   * @param useWorkspaces - the workspace projection of the page.
   * @param t - this plugin's translate function.
   */
  function ClearArchivedForm({ target, settleClear, reportNotice, removeSessions, useWorkspaces, t }) {
    const snapshot = useWorkspaces((state) => state)
    const workspace = snapshot.items.find((item) => item.workspaceId === target.workspaceId)
    const archived = workspace === undefined
      ? []
      : workspace.sessionIds.filter((id) => snapshot.archivedSessionIds.includes(id))
    const confirm = () => {
      settleClear()
      removeSessions(archived).then((outcome) => {
        reportNotice({ text: resultText(outcome, t) })
      }, (reason) => {
        console.warn('better-session: clearing archived conversations failed:', reason)
        reportNotice({ text: failureText(reason, t), failed: true })
      })
    }
    const description = archived.length === 0
      ? t('bulk.empty')
      : t('bulk.description', { title: target.title, count: archived.length })
    return h(Modal, {
      title: t('bulk.title'),
      closeLabel: t('bulk.close'),
      description,
      onClose: settleClear,
      footer: [
        h('button', {
          key: 'cancel',
          type: 'button',
          className: 'dsd_button dsd_outline',
          'data-modal-autofocus': true,
          onClick: settleClear,
        }, t('bulk.cancel')),
        h('button', {
          key: 'confirm',
          type: 'button',
          className: 'dsd_button dsd_outline dsd_destructive',
          disabled: archived.length === 0,
          onClick: confirm,
        }, t('bulk.confirm')),
      ],
    })
  }

  /**
   * What one deletion has to add beyond "deleted": the subagent conversations
   * that went with it, and the records it could not clean up.
   * @param payload - the Host's answer to one deletion.
   * @param t - this plugin's translate function.
   * @returns the localized notes, empty when the deletion was complete.
   */
  function removalNotes(payload, t) {
    const removed = payload?.removedSessions
    const subagents = Array.isArray(removed)
      ? removed.filter((sessionId) => sessionId !== payload.sessionId).length
      : 0
    const notes = subagents === 0 ? [] : [t('notice.subagents', { count: subagents })]
    if (Array.isArray(payload?.failedSteps) && payload.failedSteps.length > 0) notes.push(t('notice.steps'))
    return notes
  }

  /** The line a finished bulk deletion reports. */
  function resultText(outcome, t) {
    if (outcome.removed.length === 0 && outcome.failed.length === 0) return t('bulk.empty')
    const text = outcome.failed.length === 0
      ? t('bulk.done', { count: outcome.removed.length })
      : t('bulk.partial', { count: outcome.removed.length, failed: outcome.failed.length })
    return outcome.failedSteps.length === 0 ? text : `${text} ${t('notice.steps')}`
  }

  /** The shared dialog shell: mask, focused card, Escape, and focus return. */
  function Modal({ title, closeLabel, description, onClose, footer, wide, children }) {
    const dialog = React.useRef(null)
    useModalLayer(dialog, onClose)
    return createPortal(h('div', { className: 'dsd_root', role: 'presentation' },
      h('div', { className: 'dsd_mask', 'aria-hidden': 'true', onClick: onClose }),
      h('div', {
        ref: dialog,
        tabIndex: -1,
        className: wide === true ? 'dsd_dialog dsd_dialogWide' : 'dsd_dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
      },
      h('div', { className: 'dsd_content' },
        h('div', { className: 'dsd_header' },
          h('h2', { className: 'dsd_title' }, title),
          h('button', { type: 'button', className: 'dsd_close', 'aria-label': closeLabel, onClick: onClose }, h(CloseIcon, null))),
        description === undefined || description === '' ? null : h('p', { className: 'dsd_description' }, description),
        children === undefined ? null : h('div', { className: 'dsd_body' }, children)),
      footer === undefined ? null : h('div', { className: 'dsd_footer' }, footer))), document.body)
  }

  /**
   * The report of a finished deletion: a transient banner that never blocks
   * the page and disappears on its own.
   * @param notice - the notice to show, or null.
   * @param dismissNotice - clears the notice.
   * @param t - this plugin's translate function.
   */
  function Notice({ notice, dismissNotice, t }) {
    React.useEffect(() => {
      if (notice === null) return undefined
      const timer = window.setTimeout(dismissNotice, NOTICE_HOLD_MS + NOTICE_FADE_MS)
      return () => window.clearTimeout(timer)
    }, [notice, dismissNotice])
    if (notice === null) return null
    return createPortal(h('div', {
      className: notice.failed === true ? 'dsd_notice dsd_noticeError' : 'dsd_notice',
      role: notice.failed === true ? 'alert' : 'status',
      style: { '--dsh-notice-hold': `${NOTICE_HOLD_MS}ms` },
    },
    h('span', { className: 'dsd_noticeText' }, notice.text),
    h('button', {
      type: 'button',
      className: 'dsd_noticeClose',
      'aria-label': t('bulk.close'),
      onClick: dismissNotice,
    }, h(CloseIcon, null))), document.body)
  }

  /** Focus the dialog, keep Tab inside it, close on Escape, and return focus. */
  function useModalLayer(dialog, onClose) {
    const close = React.useRef(onClose)
    close.current = onClose
    React.useLayoutEffect(() => {
      const element = dialog.current
      if (element === null) return undefined
      const ownerDocument = element.ownerDocument
      const previous = ownerDocument.activeElement
      const initial = element.querySelector('[data-modal-autofocus]') ?? element.querySelector(FOCUSABLE) ?? element
      if (!element.contains(ownerDocument.activeElement)) initial.focus()
      const keydown = (event) => {
        if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
        if (event.key === 'Escape' && !event.shiftKey) {
          event.preventDefault()
          if (!event.repeat) close.current()
          return
        }
        if (event.key !== 'Tab') return
        const items = [...element.querySelectorAll(FOCUSABLE)].filter((item) => !item.closest('[inert], [hidden]'))
        const first = items[0] ?? element
        const last = items.at(-1) ?? element
        const atEdge = event.shiftKey ? ownerDocument.activeElement === first : ownerDocument.activeElement === last
        if (ownerDocument.activeElement === element || !element.contains(ownerDocument.activeElement) || atEdge) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
      }
      ownerDocument.addEventListener('keydown', keydown)
      return () => {
        ownerDocument.removeEventListener('keydown', keydown)
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
      }
    }, [dialog])
  }

  /** Map a Host refusal onto its localized line; diagnostics stay in the console. */
  function failureText(error, t) {
    const code = typeof error?.code === 'string' ? error.code : undefined
    if (code === 'session-running') return t('error.running')
    if (code === 'not-found') return t('error.notFound')
    if (code === 'bad-request') return t('error.badRequest')
    if (code === 'timeout') return t('panel.timeout')
    return t('error.failed')
  }

  /** Ask the host side to delete one session's stored records. */
  function removeSession(target) {
    return requestJson(ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: target.sessionId }),
    }, BULK_TIMEOUT_MS)
  }

  /**
   * Delete several conversations in one Host call.
   * @param sessionIds - the sessions to delete.
   * @returns the deleted ids and the ones the Host refused.
   */
  async function removeSessions(sessionIds) {
    const payload = await requestJson(BULK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    }, BULK_TIMEOUT_MS)
    return { removed: payload.removed, failed: payload.failed, failedSteps: payload.failedSteps ?? [] }
  }

  /**
   * One switch row: a label, its explanation, and the toggle itself.
   * @param label - the row title.
   * @param hint - what the switch changes.
   * @param checked - the current state.
   * @param disabled - whether the switch is locked while a deletion runs.
   * @param onChange - called with the requested state.
   */
  function SwitchRow({ label, hint, checked, disabled, onChange }) {
    return h('div', { className: 'dsd_row' },
      h('div', { className: 'dsd_rowText' },
        h('span', { className: 'dsd_rowLabel' }, label),
        h('span', { className: 'dsd_rowHint' }, hint)),
      h('button', {
        type: 'button',
        role: 'switch',
        className: 'dsd_switch',
        'aria-checked': checked,
        'aria-label': label,
        disabled,
        onClick: () => onChange(!checked),
      }, h('span', { className: 'dsd_knob' })))
  }

  /**
   * One cleanup scope: what it holds, how many, and the action that clears it.
   * @param title - the scope name.
   * @param hint - why these conversations are invisible.
   * @param count - how many conversations the scope currently holds.
   * @param action - the action label.
   * @param disabled - whether a deletion is already running.
   * @param onAction - called when the action is chosen.
   */
  function ScopeRow({ title, hint, count, action, disabled, onAction }) {
    return h('div', { className: 'dsd_row dsd_statRow' },
      h('div', { className: 'dsd_rowText' },
        h('span', { className: 'dsd_rowLabel' }, `${title} · ${count}`),
        h('span', { className: 'dsd_rowHint' }, hint)),
      h('button', {
        type: 'button',
        className: 'dsd_button dsd_outline dsd_destructive dsd_scopeAction',
        disabled: disabled || count === 0,
        onClick: onAction,
      }, action))
  }

  /** The sidebar footer trigger: the seat beside the remote-access icon. */
  function CleanupTrigger({ wide, t, openCleanup }) {
    return h('div', { className: 'dsd_entryRow', 'data-rail': wide ? undefined : 'rail' },
      h('button', {
        type: 'button',
        className: 'dsd_trigger',
        'data-wide': wide ? 'wide' : 'rail',
        'aria-label': t('entry.label'),
        title: t('entry.label'),
        onClick: openCleanup,
      },
      h('span', { className: 'dsd_triggerIcon' }, h(TrashIcon, null))))
  }

  /**
   * The cleanup panel: the scope switches, both inventories, and the
   * confirmation that runs one of them.
   *
   * The panel keeps one snapshot of the Host inventory; choosing a scope
   * replaces the body with its confirmation, so a bulk deletion stays one
   * panel away from the counts it would change.
   * @param useCleanupOpen - this plugin's panel-open store as a hook.
   * @param closeCleanup - closes the panel.
   * @param t - this plugin's translate function.
   */
  function CleanupPanel({ useCleanupOpen, closeCleanup, t }) {
    const open = useCleanupOpen((value) => value)
    const [snapshot, setSnapshot] = React.useState({ kind: 'loading' })
    const [scope, setScope] = React.useState(null)
    const [verdict, setVerdict] = React.useState(null)
    const [busy, setBusy] = React.useState(false)

    const load = React.useCallback(async () => {
      setSnapshot({ kind: 'loading' })
      try {
        const payload = await readCleanupState()
        setSnapshot({ kind: 'ready', settings: payload.settings, counts: payload.counts })
      } catch (reason) {
        console.warn('better-session: reading the cleanup inventory failed:', reason)
        setSnapshot({ kind: 'failed', code: reason?.code })
      }
    }, [])

    React.useEffect(() => {
      if (!open) return
      setScope(null)
      setVerdict(null)
      setBusy(false)
      load()
    }, [open, load])

    if (!open) return null

    const ready = snapshot.kind === 'ready' ? snapshot : null
    const settings = ready?.settings
    const counts = ready?.counts
    const total = counts === undefined ? 0 : counts.orphaned + counts.detached

    const toggle = async (key, value) => {
      if (ready === null) return
      const previous = ready.settings
      setSnapshot({ kind: 'ready', settings: { ...previous, [key]: value }, counts })
      try {
        const payload = await writeCleanupSettings({ [key]: value })
        setSnapshot({ kind: 'ready', settings: payload.settings, counts })
      } catch (reason) {
        console.warn('better-session: saving the cleanup settings failed:', reason)
        setSnapshot({ kind: 'ready', settings: previous, counts })
        setVerdict({ failed: t('panel.settingsFailed') })
      }
    }

    const run = async () => {
      if (scope === null) return
      setBusy(true)
      try {
        const payload = await executeCleanup(scope)
        setScope(null)
        setVerdict({
          removed: payload.removed.length,
          failed: payload.failed.length,
          collected: payload.attachments?.objects ?? 0,
        })
        if (payload.counts === undefined) await load()
        else setSnapshot((current) => current.kind === 'ready'
          ? { ...current, counts: { ...current.counts, ...payload.counts } }
          : current)
      } catch (reason) {
        console.warn('better-session: cleaning conversations failed:', reason)
        setVerdict({ failed: failureText(reason, t) })
      } finally {
        setBusy(false)
      }
    }

    const body = []
    if (snapshot.kind === 'loading') {
      body.push(h('p', { className: 'dsd_panelNotice', key: 'loading' }, t('panel.loading')))
    } else if (snapshot.kind === 'failed') {
      body.push(h('p', { className: 'dsd_panelNoticeError', key: 'failed' }, snapshot.code === 'route-missing'
        ? t('panel.restart')
        : snapshot.code === 'timeout' ? t('panel.timeout') : t('panel.failed')))
    } else if (scope === null) {
      body.push(h('div', { className: 'dsd_section', key: 'settings' },
        h('div', { className: 'dsd_sectionTitle' }, t('panel.settings')),
        h(SwitchRow, {
          label: t('panel.attachments'),
          hint: t('panel.attachmentsHint'),
          checked: settings.attachments,
          disabled: busy,
          onChange: (value) => toggle('attachments', value),
        })))
      body.push(h('div', { className: 'dsd_section', key: 'scopes' },
        h(ScopeRow, {
          title: t('panel.orphaned'),
          hint: t('panel.orphanedHint'),
          count: counts.orphaned,
          action: t('panel.deleteCount', { count: counts.orphaned }),
          disabled: busy,
          onAction: () => setScope('orphaned'),
        }),
        h(ScopeRow, {
          title: t('panel.detached'),
          hint: t('panel.detachedHint'),
          count: counts.detached,
          action: t('panel.cleanCount', { count: counts.detached }),
          disabled: busy,
          onAction: () => setScope('detached'),
        }),
        total === 0 ? h('p', { className: 'dsd_panelNotice' }, t('panel.empty')) : null))
    } else {
      const confirmed = scope === 'orphaned' ? counts.orphaned : counts.detached
      body.push(h('p', { className: 'dsd_panelNoticeError', key: 'confirm' }, t('panel.confirmDescription', { count: confirmed })))
    }
    if (verdict !== null) {
      body.push(h('p', {
        className: verdict.failed === undefined ? 'dsd_panelNotice' : 'dsd_panelNoticeError',
        key: 'verdict',
      }, verdictText(verdict, t)))
    }

    const pending = scope === null ? 0 : scope === 'orphaned' ? counts.orphaned : counts.detached
    const footer = scope === null
      ? [
        h('button', {
          key: 'refresh',
          type: 'button',
          className: 'dsd_button dsd_outline',
          disabled: busy,
          onClick: load,
        }, t('panel.refresh')),
        h('button', {
          key: 'close',
          type: 'button',
          className: 'dsd_button dsd_outline',
          onClick: closeCleanup,
        }, t('panel.close')),
      ]
      : [
        h('button', {
          key: 'back',
          type: 'button',
          className: 'dsd_button dsd_outline',
          'data-modal-autofocus': true,
          disabled: busy,
          onClick: () => setScope(null),
        }, t('panel.back')),
        h('button', {
          key: 'run',
          type: 'button',
          className: 'dsd_button dsd_outline dsd_destructive',
          disabled: busy,
          onClick: run,
        }, busy ? t('panel.running') : t('panel.deleteCount', { count: pending })),
      ]

    return h(Modal, {
      title: t('panel.title'),
      closeLabel: t('panel.close'),
      wide: true,
      onClose: closeCleanup,
      footer,
    }, body)
  }

  /** The line a finished bulk deletion reports. */
  function verdictText(verdict, t) {
    if (verdict.removed === undefined) return verdict.failed ?? ''
    const parts = [verdict.failed === 0
      ? t('panel.done', { count: verdict.removed })
      : t('panel.partial', { count: verdict.removed, failed: verdict.failed })]
    if (verdict.collected > 0) parts.push(t('panel.collected', { count: verdict.collected }))
    return parts.join(' ')
  }

  /**
   * One Host-backed JSON call on the authenticated `/api` carrier.
   *
   * A page whose event streams have exhausted the origin's connection pool
   * leaves a request queued forever, so every bounded call carries its own
   * deadline and reports a timeout instead of an endless spinner.
   * @param route - relative route path.
   * @param options - fetch options beyond the shared carrier settings.
   * @param timeoutMs - how long to wait before abandoning the request.
   * @returns the decoded payload of a successful answer.
   */
  async function requestJson(route, options = {}, timeoutMs = 0) {
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

  /** Read both cleanup scopes and the stored settings. */
  function readCleanupState() {
    return requestJson(STATE_ROUTE, {}, STATE_TIMEOUT_MS)
  }

  /**
   * Persist the cleanup switches.
   * @param patch - the switches to change.
   */
  function writeCleanupSettings(patch) {
    return requestJson(SETTINGS_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }, STATE_TIMEOUT_MS)
  }

  /**
   * Delete one cleanup scope on the Host.
   * @param target - the scope to delete.
   */
  function executeCleanup(target) {
    return requestJson(BULK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: target }),
    }, BULK_TIMEOUT_MS)
  }

  return {
    inject: ['slots', 'locale'],
    apply(ctx) {
      const request = createStore(null)
      const clearRequest = createStore(null)
      const notice = createStore(null)
      const cleanupOpen = createStore(false)
      const t = ctx.locale.bind(NS)
      const reportNotice = (next) => notice.set(next)
      const dismissNotice = () => notice.set(null)
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'better-session: dictionaries')
      ctx.effect(() => insertStyles(), 'better-session: styles')
      ctx.effect(() => watchWorkspaceMenus(t, (workspace) => {
        closeWorkspaceMenu(workspace)
        clearRequest.set({ workspaceId: workspace.workspaceId, title: workspace.title })
      }), 'better-session: workspace menu')
      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
        name: 'sidebar.workspaces.session.menu.item',
        id: 'dsh-better-session.cleanup.delete',
        order: 500,
        locale: NS,
        inject: () => ({ requestDelete: (target) => request.set(target) }),
      }, DeleteSessionMenuItem))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.cleanup.confirm',
        order: 50,
        locale: NS,
        inject: () => ({
          hooks: { deleteRequest: request, clearRequest, notice },
          settleDelete: () => request.set(null),
          settleClear: () => clearRequest.set(null),
          reportNotice,
          dismissNotice,
          removeSession,
          removeSessions,
        }),
      }, DeleteSessionDialog))
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'dsh-better-session.cleanup.cleanup',
        order: 10,
        locale: NS,
        inject: () => ({ openCleanup: () => cleanupOpen.set(true) }),
      }, CleanupTrigger))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-better-session.cleanup.cleanup-panel',
        order: 51,
        locale: NS,
        inject: () => ({
          hooks: { cleanupOpen },
          closeCleanup: () => cleanupOpen.set(false),
        }),
      }, CleanupPanel))
    },
  }
})
