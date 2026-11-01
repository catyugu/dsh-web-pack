/**
 * The remote-connection settings card: three decisions (remote access, public
 * access, LAN access) plus one collapsed group for the two knobs that remain.
 *
 * The card deliberately does not mirror the config schema: it renders the
 * decisions a user makes, with the layer mechanics (a value written here
 * overrides the profile patch) reduced to a badge and a reset link instead of
 * a per-field "inherit" choice.
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { PluginSettingsCard, ValueField } from './PluginSettingsCard.tsx'
import {
  CardForm,
  booleanField,
  choiceField,
  numberField,
  secretField,
  textField,
  type CardActions,
  type CardShell,
  type FieldState as CardFieldState,
} from './settings-form.ts'
import { RadioField, SwitchField, type RadioOption } from './controls.tsx'
import { LanBindStatusError, readLanBindStatus, shouldStopLanBindPoll, type LanBindFrame } from '../pair-api.ts'
import cardCss from './settings-card.module.css'
import css from './controls.module.css'

/** The three answers the public-access decision accepts. */
const TUNNEL_MODES = ['off', 'quick', 'named'] as const

/** The remote-connection fields this card edits. */
export interface RemoteSettings {
  /** Master switch: off revokes every device and stops the public tunnel. */
  enabled?: boolean
  /** Public access mode: how the GUI is reached from outside this machine. */
  tunnel?: string
  /** Fixed public hostname for the `named` mode. */
  tunnelHost?: string
  /** Cloudflare tunnel token for the `named` mode (stored redacted). */
  tunnelToken?: string
  /** LAN bind: writes the profile patch block; unset means "not managed". */
  lanBind?: boolean
  /** Whether non-loopback desktops must carry a paired-device cookie. */
  requirePairingForLan?: boolean
  /** Lifetime of one QR pairing link (ms). */
  tokenTtlMs?: number
}

/** What the remote-connection card renders. */
export interface RemoteSettingsCardState extends CardShell {
  /** Master switch. */
  enabled: CardFieldState
  /** Public access mode. */
  tunnel: CardFieldState
  /** Fixed public hostname. */
  tunnelHost: CardFieldState
  /** Tunnel token (stored redacted). */
  tunnelToken: CardFieldState
  /** LAN bind decision. */
  lanBind: CardFieldState
  /** LAN fence policy. */
  requirePairingForLan: CardFieldState
  /** Pairing link lifetime. */
  tokenTtlMs: CardFieldState
}

/** The registration-side face the card's slot entry injects. */
export interface RemoteSettingsCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useRemoteSettingsCard. */
    remoteSettingsCard: SnapshotStore<RemoteSettingsCardState>
  }
}

/** Read a boolean draft, falling back to the configured default while unstaged. */
function boolOf(text: string, fallback: boolean): boolean {
  if (text === 'true') return true
  if (text === 'false') return false
  return fallback
}

/** Bridges the `remote-web-ui` form onto the card's staged form. */
export class RemoteSettingsCardController {
  private readonly form: CardForm<RemoteSettings>
  private readonly store: SnapshotStore<RemoteSettingsCardState>

  /** @param scope - the configuration form for the `remote-web-ui` entry. */
  constructor(scope: ConfigForm<RemoteSettings>) {
    this.form = new CardForm(scope, [
      booleanField('enabled'),
      choiceField('tunnel', TUNNEL_MODES),
      textField('tunnelHost'),
      secretField('tunnelToken'),
      booleanField('lanBind'),
      booleanField('requirePairingForLan'),
      numberField('tokenTtlMs', { integer: true, min: 60_000 }),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): RemoteSettingsCardState {
    return {
      ...this.form.shell(),
      enabled: this.form.field('enabled'),
      tunnel: this.form.field('tunnel'),
      tunnelHost: this.form.field('tunnelHost'),
      tunnelToken: this.form.field('tunnelToken'),
      lanBind: this.form.field('lanBind'),
      requirePairingForLan: this.form.field('requirePairingForLan'),
      tokenTtlMs: this.form.field('tokenTtlMs'),
    }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): RemoteSettingsCardFace {
    return { hooks: { remoteSettingsCard: this.store }, ...this.form.actions() }
  }

  /**
   * Release the card's form subscription and bound stores; the slot
   * disposer calls this on teardown.
   */
  dispose(): void {
    this.form.dispose()
  }
}

/** Props the renderer binds for the remote-connection card. */
export type RemoteSettingsCardProps =
  PropsRuntime<'web-ui.plugin.item'>
  & PropsLocale<'remote'>
  & InjectFace<RemoteSettingsCardFace>

/**
 * Render the remote-connection card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function RemoteSettingsCard(props: RemoteSettingsCardProps) {
  const { t } = props
  const state = props.useRemoteSettingsCard(snapshot => snapshot)
  const disabled = !state.writable
  const fieldProps = {
    overriddenLabel: t('settings.overridden'),
    resetLabel: t('settings.reset'),
    invalidLabel: t('settings.invalidNumber'),
    disabled,
  }
  const enabledOn = boolOf(state.enabled.text, true)
  const tunnelValue = state.tunnel.text === '' ? 'off' : state.tunnel.text
  const lanValue = state.lanBind.text === ''
    ? 'follow'
    : state.lanBind.text === 'true' ? 'on' : 'off'
  // A `named` tunnel needs both inputs, but the token is stored redacted: an
  // empty draft means "keep the stored token" unless the user cleared it.
  const hostDraft = state.tunnelHost.text.trim()
  const tokenReady = state.tunnelToken.text.trim() !== '' || state.tunnelToken.overridden
  const namedProblemKey = tunnelValue !== 'named'
    ? undefined
    : hostDraft === ''
      ? 'settings.tunnelHostMissing'
      : !/^https?:\/\/\S+$/i.test(hostDraft)
        ? 'settings.tunnelHostInvalid'
        : !tokenReady ? 'settings.tunnelTokenMissing' : undefined

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
    <PluginSettingsCard
      t={t}
      titleKey="settings.title"
      descriptionKey="settings.description"
      defaultOpen={false}
      hideFooter
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
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
          {...state.enabled}
          onChange={(on) => { props.edit('enabled', on ? 'true' : 'false') }}
          onReset={() => { props.resetField('enabled') }}
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
          {...state.tunnel}
          onChange={(value) => { props.edit('tunnel', value) }}
          onReset={() => { props.resetField('tunnel') }}
        />
        {tunnelValue === 'named' && (
          <div className={css.subfield}>
            <ValueField
              id="settings-remote-tunnel-host"
              label={t('settings.tunnelHost')}
              hint={t('settings.tunnelHostHint')}
              placeholder="https://dsh.example.com"
              {...fieldProps}
              {...state.tunnelHost}
              onEdit={(text) => { props.edit('tunnelHost', text) }}
              onReset={() => { props.resetField('tunnelHost') }}
            />
            <ValueField
              id="settings-remote-tunnel-token"
              label={t('settings.tunnelToken')}
              hint={t('settings.tunnelTokenHint')}
              placeholder="eyJ..."
              {...fieldProps}
              {...state.tunnelToken}
              onEdit={(text) => { props.edit('tunnelToken', text) }}
              onReset={() => { props.resetField('tunnelToken') }}
            />
          </div>
        )}
        {namedProblemKey !== undefined && (
          <p className={cardCss.failed} role="status">{t(namedProblemKey)}</p>
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
          {...state.lanBind}
          onChange={(value) => {
            if (value === 'follow') props.resetField('lanBind')
            else props.edit('lanBind', value === 'on' ? 'true' : 'false')
          }}
          onReset={() => { props.resetField('lanBind') }}
        />
        <LanBindStatus t={t} />
      </section>

      <details className={css.other}>
        <summary className={css.otherSummary}>{t('settings.sectionOther')}</summary>
        <SwitchField
          id="settings-remote-fence"
          label={t('settings.requirePairingForLan')}
          hint={t('settings.requirePairingForLanHint')}
          on={boolOf(state.requirePairingForLan.text, true)}
          onLabel={t('settings.on')}
          offLabel={t('settings.off')}
          {...fieldProps}
          {...state.requirePairingForLan}
          onChange={(on) => { props.edit('requirePairingForLan', on ? 'true' : 'false') }}
          onReset={() => { props.resetField('requirePairingForLan') }}
        />
        <ValueField
          id="settings-remote-token-ttl"
          label={t('settings.tokenTtlMs')}
          hint={t('settings.tokenTtlMsHint')}
          numeric
          {...fieldProps}
          {...state.tokenTtlMs}
          onEdit={(text) => { props.edit('tokenTtlMs', text) }}
          onReset={() => { props.resetField('tokenTtlMs') }}
        />
      </details>

      <div className={cardCss.footer}>
        {state.failed
          ? (
            <p className={cardCss.failed} role="status">
              {t('settings.saveFailed')}{state.failedReason ? ' - ' + state.failedReason : ''}
            </p>
          )
          : null}
        <button
          type="button"
          className={cardCss.discard}
          disabled={!state.dirty || state.saving}
          onClick={props.discard}
        >
          {t('settings.discard')}
        </button>
        <button
          type="button"
          className={cardCss.save}
          disabled={!state.dirty || state.invalid || state.saving || namedProblemKey !== undefined}
          onClick={props.save}
        >
          {t(state.saving ? 'settings.saving' : 'settings.save')}
        </button>
      </div>
    </PluginSettingsCard>
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
        // phone) can never read it, so the 10s poll stops instead of retrying a
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
