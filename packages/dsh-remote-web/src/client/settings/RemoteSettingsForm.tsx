/**
 * The remote-connection settings card: three decisions (remote access, public
 * access, LAN access) plus one collapsed group for the two remaining knobs.
 *
 * The card renders decisions, not the config schema: the layer mechanics (a
 * value written here overrides the profile patch) collapse to a badge and a
 * reset link. All staging, validation and save judgment live in
 * {@link RemoteSettingsModel}; this file only renders the state.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RadioField, SwitchField, TextField, type RadioOption } from './controls.tsx'
import { RemoteSettingsModel } from './remote-settings.ts'
import { namedTunnelProblem } from './tunnel-readiness.ts'
import { LanBindStatusError, readLanBindStatus, readPairFacts, shouldStopLanBindPoll, type LanBindFrame } from '../pair-api.ts'
import css from './settings.module.css'

/** Read a boolean draft, falling back to the configured default while unstaged. */
function boolOf(text: string, fallback: boolean): boolean {
  if (text === 'true') return true
  if (text === 'false') return false
  return fallback
}

/** Props of the settings card. */
export interface RemoteSettingsFormProps {
  /** The staged form model the client apply owns. */
  model: RemoteSettingsModel
  /** Locale reader for the `remote` namespace. */
  t: TranslateNS<'remote'>
}

/**
 * Render the card.
 * @param props - the model and the locale seat.
 * @returns the card, or nothing while the namespace is still loading.
 */
export function RemoteSettingsForm({ model, t }: RemoteSettingsFormProps) {
  const subscribe = useCallback((listener: () => void) => model.subscribe(listener), [model])
  const read = useCallback(() => model.getState(), [model])
  const state = useSyncExternalStore(subscribe, read, read)
  const [open, setOpen] = useState(false)
  if (!state.available) return null

  const expanded = open
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    disabled,
  }
  const enabledOn = boolOf(state.fields.enabled.text, true)
  const tunnelValue = state.fields.tunnel.text === '' ? 'off' : state.fields.tunnel.text
  const lanValue = state.fields.lanBind.text === ''
    ? 'follow'
    : state.fields.lanBind.text === 'true' ? 'on' : 'off'
  // A `named` tunnel needs both inputs, but the token is a secret the form can
  // never read back: the host says whether one is stored, and an empty draft
  // then means "keep it" rather than "missing".
  const [tokenStored, setTokenStored] = useState(false)
  useEffect(() => {
    let alive = true
    void readPairFacts().then((facts) => {
      if (alive) setTokenStored(facts.tunnelTokenStored)
    }).catch(() => {
      // The status endpoint is loopback-first: on a phone the card still works,
      // it just cannot corroborate a stored token.
    })
    return () => { alive = false }
  }, [state.dirty, state.saving])
  const namedProblemKey = namedTunnelProblem({
    tunnel: tunnelValue,
    host: state.fields.tunnelHost.text,
    tokenDraft: state.fields.tunnelToken.text,
    tokenStored,
  })

  const tunnelOptions: RadioOption[] = [
    { value: 'off', label: t('settings.tunnelOff'), detail: t('settings.tunnelOffDetail') },
    { value: 'quick', label: t('settings.tunnelQuick'), detail: t('settings.tunnelQuickDetail') },
    { value: 'named', label: t('settings.tunnelNamed'), detail: t('settings.tunnelNamedDetail') },
  ]
  const lanOptions: RadioOption[] = [
    { value: 'follow', label: t('settings.lanFollow'), detail: t('settings.lanFollowDetail') },
    { value: 'on', label: t('settings.lanOn'), detail: t('settings.lanOnDetail') },
    { value: 'off', label: t('settings.lanOff'), detail: t('settings.lanOffDetail') },
  ]

  return (
    <section className={expanded ? `${css.card} ${css.cardOpen}` : css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'settings.collapse' : 'settings.expand')}: ${t('settings.title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name} title={t('settings.title')}>{t('settings.title')}</span>
          <span className={css.description} title={t('settings.description')}>{t('settings.description')}</span>
        </span>
        {state.dirty ? <span className={css.pending} title={t('settings.unsaved')}>{t('settings.unsaved')}</span> : null}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron}
        >
          <path
            d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {expanded
        ? (
          <div className={css.body}>
            {!state.exposed ? <p className={css.notExposed} role="status">{t('settings.notExposed')}</p> : (
              <>
                {!state.writable ? <p className={css.readOnly} role="status">{t('settings.readOnly')}</p> : null}

                <section className={css.section}>
                  <h3 className={css.sectionTitle}>{t('settings.sectionAccess')}</h3>
                  <SwitchField
                    id="settings-remote-enabled"
                    label={t('settings.enabled')}
                    hint={t('settings.enabledHint')}
                    on={enabledOn}
                    onLabel={t('settings.on')}
                    offLabel={t('settings.off')}
                    {...fieldProps}
                    {...state.fields.enabled}
                    onChange={(on) => { model.edit('enabled', on ? 'true' : 'false') }}
                    onReset={() => { model.reset('enabled') }}
                  />
                </section>

                <section className={css.section}>
                  <h3 className={css.sectionTitle}>{t('settings.sectionPublic')}</h3>
                  <RadioField
                    id="settings-remote-tunnel"
                    label={t('settings.tunnel')}
                    hint={t('settings.tunnelHint')}
                    value={tunnelValue}
                    options={tunnelOptions}
                    {...fieldProps}
                    {...state.fields.tunnel}
                    onChange={(value) => { model.edit('tunnel', value) }}
                    onReset={() => { model.reset('tunnel') }}
                  />
                  {tunnelValue === 'named' && (
                    <div className={css.subfield}>
                      <TextField
                        id="settings-remote-tunnel-host"
                        label={t('settings.tunnelHost')}
                        hint={t('settings.tunnelHostHint')}
                        placeholder="https://dsh.example.com"
                        invalidLabel={t('settings.tunnelHostInvalid')}
                        {...fieldProps}
                        {...state.fields.tunnelHost}
                        onEdit={(text) => { model.edit('tunnelHost', text) }}
                        onReset={() => { model.reset('tunnelHost') }}
                      />
                      <TextField
                        id="settings-remote-tunnel-token"
                        label={t('settings.tunnelToken')}
                        hint={t('settings.tunnelTokenHint')}
                        placeholder="eyJ..."
                        invalidLabel={t('settings.tunnelTokenHint')}
                        {...fieldProps}
                        {...state.fields.tunnelToken}
                        onEdit={(text) => { model.edit('tunnelToken', text) }}
                        onReset={() => { model.reset('tunnelToken') }}
                      />
                    </div>
                  )}
                  {namedProblemKey !== undefined && (
                    <p className={css.failed} role="status">{t(namedProblemKey)}</p>
                  )}
                </section>

                <section className={css.section}>
                  <h3 className={css.sectionTitle}>{t('settings.sectionLan')}</h3>
                  <RadioField
                    id="settings-remote-lan-bind"
                    label={t('settings.lanBind')}
                    hint={t('settings.lanBindHint')}
                    value={lanValue}
                    options={lanOptions}
                    {...fieldProps}
                    {...state.fields.lanBind}
                    onChange={(value) => {
                      if (value === 'follow') model.reset('lanBind')
                      else model.edit('lanBind', value === 'on' ? 'true' : 'false')
                    }}
                    onReset={() => { model.reset('lanBind') }}
                  />
                  <LanBindStatus t={t} />
                </section>

                <details className={css.other}>
                  <summary className={css.otherSummary}>{t('settings.sectionOther')}</summary>
                  <SwitchField
                    id="settings-remote-fence"
                    label={t('settings.requirePairingForLan')}
                    hint={t('settings.requirePairingForLanHint')}
                    on={boolOf(state.fields.requirePairingForLan.text, true)}
                    onLabel={t('settings.on')}
                    offLabel={t('settings.off')}
                    {...fieldProps}
                    {...state.fields.requirePairingForLan}
                    onChange={(on) => { model.edit('requirePairingForLan', on ? 'true' : 'false') }}
                    onReset={() => { model.reset('requirePairingForLan') }}
                  />
                  <TextField
                    id="settings-remote-token-ttl"
                    label={t('settings.tokenTtlMs')}
                    hint={t('settings.tokenTtlMsHint')}
                    invalidLabel={t('settings.invalidNumber')}
                    numeric
                    {...fieldProps}
                    {...state.fields.tokenTtlMs}
                    onEdit={(text) => { model.edit('tokenTtlMs', text) }}
                    onReset={() => { model.reset('tokenTtlMs') }}
                  />
                </details>

                <div className={css.footer}>
                  {state.failed
                    ? (
                      <p className={css.failed} role="status">
                        {t('settings.saveFailed')}{state.failedReason ? ' - ' + state.failedReason : ''}
                      </p>
                    )
                    : null}
                  <button
                    type="button"
                    className={css.discard}
                    disabled={!state.dirty || state.saving}
                    onClick={() => { model.discard() }}
                  >
                    {t('settings.discard')}
                  </button>
                  <button
                    type="button"
                    className={css.save}
                    disabled={blocked || namedProblemKey !== undefined}
                    onClick={() => { void model.save() }}
                  >
                    {t(state.saving ? 'settings.saving' : 'settings.save')}
                  </button>
                </div>
              </>
            )}
          </div>
        )
        : null}
    </section>
  )
}

/**
 * Live LAN-bind facts under the decision: the managed block's host, the live
 * bind, the firewall summary, and the reachable LAN URLs. Polls the
 * loopback-only status endpoint; a failure (non-loopback origin) renders
 * nothing — the pairing panel carries the loopback banner instead.
 */
function LanBindStatus({ t }: { t: TranslateNS<'remote'> }) {
  const [frame, setFrame] = useState<LanBindFrame | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const read = (): void => {
      void readLanBindStatus().then((value) => {
        if (alive) setFrame(value)
      }).catch((error: unknown) => {
        // The endpoint is loopback-only: a 401/403 means this origin (a paired
        // phone) can never read it, so the poll stops instead of retrying a
        // known refusal for as long as the card stays expanded.
        if (error instanceof LanBindStatusError && shouldStopLanBindPoll(error.status)) window.clearInterval(timer)
      })
    }
    const timer = window.setInterval(read, 10_000)
    read()
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])
  if (frame === undefined) return null
  const lanOn = frame.blockHost === '0.0.0.0'
  const firewallText = frame.firewall.managed
    ? t(frame.firewall.ok ? 'lan.firewall.ok' : 'lan.firewall.bad')
    : t('lan.firewall.unmanaged')
  const lines: string[] = [
    t('lan.bind', { host: frame.bindHost, port: String(frame.port) }) + ' · ' + firewallText,
  ]
  if (lanOn && frame.lanUrls.length > 0) {
    lines.push(t('lan.urls', { urls: frame.lanUrls.join('  ') }))
  }
  if (!lanOn) {
    lines.push(t('lan.off'))
  }
  if (frame.setting === null) {
    lines.push(t('lan.untouched'))
  }
  if (frame.pendingRestart === true) {
    lines.push(t('lan.pendingRestart'))
  }
  return (
    <div className={css.status}>
      {lines.map((line, index) => (
        <div key={index} className={css.statusLine}>{line}</div>
      ))}
    </div>
  )
}
