/**
 * Hands the settings form's injected face from the client apply (which owns
 * the staged form) to the pairing panel (which renders it).
 *
 * This fork keeps one settings surface: the popup a user opens to pair a
 * device. The controller therefore publishes its face here at mount instead
 * of registering a card into the plugin manager.
 *
 * @module dsh-remote-web/settings-face
 */
import type { RemoteSettingsCardFace } from './RemoteSettingsCard.tsx'

let published: RemoteSettingsCardFace | undefined

/**
 * Publish (or clear) the face the popup renders.
 * @param face - the controller's injected face, or undefined on dispose.
 */
export function publishSettingsFace(face: RemoteSettingsCardFace | undefined): void {
  published = face
}

/**
 * The currently published face, if the client apply has run.
 * @returns the face the popup should render.
 */
export function currentSettingsFace(): RemoteSettingsCardFace | undefined {
  return published
}
