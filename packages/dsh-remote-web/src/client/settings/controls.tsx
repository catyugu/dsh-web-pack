/**
 * The two controls the remote-connection card needs beyond a plain text
 * input: a switch and a small radio group. They live here rather than in the
 * family-shared card chrome because that module is generated from a shared
 * source this repository does not own, and these shapes are this card's own
 * (a switch for a decision, a radio group whose options explain themselves
 * instead of a three-state "inherit" dropdown).
 */

import type { ReactNode } from 'react'
import css from './controls.module.css'

/** Badge + reset affordance every control shows when it overrides the layer below. */
interface OverrideChrome {
  /** True when saving would leave a user-layer entry for this field. */
  overridden: boolean
  /** Copy for the overridden badge. */
  overriddenLabel: string
  /** Copy for the reset control. */
  resetLabel: string
  /** Stage a clear so the field falls back to the configured default. */
  onReset: () => void
  /** Disables every control (read-only document). */
  disabled: boolean
}

/** One labelled row with the override badge in its header. */
function FieldShell(props: OverrideChrome & {
  id: string
  label: string
  htmlFor?: string
  children: ReactNode
  hint: ReactNode
}) {
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.htmlFor ?? props.id}>{props.label}</label>
        {props.overridden
          ? (
            <span className={css.badges}>
              <span className={css.badge}>{props.overriddenLabel}</span>
              <button type="button" className={css.reset} disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      {props.children}
      <p className={css.hint}>{props.hint}</p>
    </div>
  )
}

/** Switch copy for the two states. */
export interface SwitchCopy {
  /** Copy shown beside an enabled switch. */
  onLabel: string
  /** Copy shown beside a disabled switch. */
  offLabel: string
}

/** A two-state switch: a decision, not a configuration key. */
export function SwitchField(props: OverrideChrome & SwitchCopy & {
  id: string
  label: string
  hint: ReactNode
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <FieldShell {...props}>
      <div className={css.switchRow}>
        <span className={css.state}>{props.on ? props.onLabel : props.offLabel}</span>
        <button
          type="button"
          id={props.id}
          role="switch"
          aria-checked={props.on}
          aria-label={props.label}
          className={props.on ? `${css.switch} ${css.switchOn}` : css.switch}
          disabled={props.disabled}
          onClick={() => { props.onChange(!props.on) }}
        >
          <span className={props.on ? `${css.knob} ${css.knobOn}` : css.knob} />
        </button>
      </div>
    </FieldShell>
  )
}

/** One radio choice: the stored value, its label, and why it exists. */
export interface RadioOption {
  value: string
  label: string
  detail: string
}

/** A radio group: one decision with explicit answers, no "inherit" state. */
export function RadioField(props: OverrideChrome & {
  id: string
  label: string
  hint: ReactNode
  value: string
  options: ReadonlyArray<RadioOption>
  onChange: (value: string) => void
}) {
  return (
    <FieldShell {...props}>
      <div className={css.radios} role="radiogroup" aria-labelledby={`${props.id}-label`}>
        {props.options.map(option => (
          <label key={option.value} className={css.radio}>
            <input
              type="radio"
              name={props.id}
              value={option.value}
              checked={option.value === props.value}
              disabled={props.disabled}
              onChange={() => { props.onChange(option.value) }}
            />
            <span className={css.radioText}>
              <span className={css.radioLabel}>{option.label}</span>
              <span className={css.radioDetail}>{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </FieldShell>
  )
}
