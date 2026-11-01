/**
 * Hands the settings model from the client apply (which owns the staged form)
 * to the pairing panel (which renders it).
 *
 * This row keeps one settings surface: the popup a user opens to pair a device.
 * The client apply therefore publishes the model here at mount instead of
 * registering a card into the plugin manager.
 */

import type { RemoteSettingsModel } from './remote-settings.ts'

let published: RemoteSettingsModel | undefined

/**
 * Publish (or clear) the model the popup renders.
 * @param model - the settings model, or undefined on dispose.
 */
export function publishSettingsModel(model: RemoteSettingsModel | undefined): void {
  published = model
}

/**
 * The currently published model, if the client apply has run.
 * @returns the model the popup should render.
 */
export function currentSettingsModel(): RemoteSettingsModel | undefined {
  return published
}
