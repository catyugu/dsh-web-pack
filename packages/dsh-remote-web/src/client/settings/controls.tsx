/**
 * The three controls the remote-connection card renders: a switch for a
 * decision, a radio group whose options explain themselves, and a text field.
 * They share the card's field frame, which carries the "overridden" badge and
 * the reset link for a value that overrides the layer below.
 */

import type { ReactNode } from 'react'
import css from './settings.module.css'

/** Badge + reset affordance every control shows when it overrides the layer below. */
export interface OverrideChrome {
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
  /** Id of the control the label points at. */
  id: string
  /** Visible label. */
  label: string
  /** One-line explanation under the control. */
  hint: ReactNode
  /** The control itself. */
  children: ReactNode
}) {
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.id}>{props.label}</label>
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

/** A two-state switch: a decision, not a configuration key. */
export function SwitchField(props: OverrideChrome & {
  /** Id of the switch button. */
  id: string
  /** Visible label. */
  label: string
  /** One-line explanation under the switch. */
  hint: ReactNode
  /** Current state. */
  on: boolean
  /** Copy shown beside an enabled switch. */
  onLabel: string
  /** Copy shown beside a disabled switch. */
  offLabel: string
  /** Stage the flipped state. */
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
  /** The value a selection stages. */
  value: string
  /** The option's label. */
  label: string
  /** Why this option exists, under its label. */
  detail: string
}

/** A radio group: one decision with explicit answers, no "inherit" state. */
export function RadioField(props: OverrideChrome & {
  /** Id the radio group is labelled by. */
  id: string
  /** Visible label. */
  label: string
  /** One-line explanation under the group. */
  hint: ReactNode
  /** Selected value. */
  value: string
  /** The choices in render order. */
  options: ReadonlyArray<RadioOption>
  /** Stage a selection. */
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

/** A staged text field. `numeric` only hints the keypad: the field's rule decides what it accepts. */
export function TextField(props: OverrideChrome & {
  /** Id of the input. */
  id: string
  /** Visible label. */
  label: string
  /** One-line explanation under the input. */
  hint: string
  /** Draft text the input shows. */
  text: string
  /** True when the draft is not a value this field accepts. */
  invalid: boolean
  /** Copy shown in place of the hint while the draft is invalid. */
  invalidLabel: string
  /** Hints a numeric keypad without narrowing what the field accepts. */
  numeric?: boolean
  /** Placeholder shown while the draft is empty. */
  placeholder?: string
  /** Stage draft text. */
  onEdit: (text: string) => void
}) {
  return (
    <FieldShell {...props} hint={props.invalid ? props.invalidLabel : props.hint}>
      <input
        id={props.id}
        className={props.invalid ? css.inputInvalid : css.input}
        type="text"
        {...props.numeric === true ? { inputMode: 'numeric' as const } : {}}
        {...props.invalid ? { 'aria-invalid': true } : {}}
        value={props.text}
        placeholder={props.placeholder ?? ''}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
    </FieldShell>
  )
}
