/**
 * Compaction settings checks for the session management sub-component: the
 * ranges a submission must respect, the clamping a stored value gets, the
 * settings artifact, and the runtime override that gives an engine back its own
 * configuration.
 *
 * The override is what makes the settings act on sessions that are already
 * running, so it is checked against a fake engine rather than a real Harness.
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  createRuntimeController,
  normalizeSettings,
  readSettings,
  validateSettings,
  writeSettings,
} from '../src/compaction.js'
import { removeHome, resetHome } from './support.mjs'

await resetHome()

try {
  // The settings accept the official ranges and refuse the rest.
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true }), undefined)
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.95 }), 'invalid-threshold-ratio')
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, retainRatio: 0.9 }), 'invalid-retain-ratio')
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.6, retainRatio: 0.3 }), undefined)
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.3, retainRatio: 0.2 }), undefined)
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.29 }), 'invalid-threshold-ratio')
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.3, retainRatio: 0.3 }), 'retain-ratio-not-less-than-threshold')
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: true, maxTokens: 12 }), 'invalid-max-tokens')
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, enabled: 'yes' }), 'invalid-enabled')

  // A stored value is clamped into its range, and a retained share that reaches
  // the threshold is pulled back below it.
  const normalized = normalizeSettings({ enabled: true, thresholdRatio: 5, retainRatio: 0.4, maxTokens: 10 })
  assert.equal(normalized.thresholdRatio, 0.9, 'the threshold is clamped into its range')
  assert.ok(normalized.retainRatio < normalized.thresholdRatio, 'the retained share stays below the threshold')
  assert.equal(normalized.maxTokens, 256, 'the summary cap is clamped into its range')

  // The settings survive a round trip through the Harness home.
  await writeSettings({ enabled: true, thresholdRatio: 0.75, retainRatio: 0.2, maxTokens: 4096 })
  const stored = await readSettings()
  assert.equal(stored.enabled, true)
  assert.equal(stored.thresholdRatio, 0.75)
  assert.equal(stored.retainRatio, 0.2)
  assert.equal(stored.maxTokens, 4096)

  // The runtime override patches the engine and gives it back.
  {
    const engine = { config: { thresholdRatio: 0.8, retainRatio: 0.16, maxTokens: 8192, auto: true } }
    const ctx = {
      get: (name) => (name === 'compaction' ? engine : undefined),
      agents: { list: () => [] },
    }
    const settings = { current: { ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.7, retainRatio: 0.1 } }
    const controller = createRuntimeController(ctx, () => settings.current)
    controller.applyToLiveAgents()
    assert.equal(engine.config.thresholdRatio, 0.7)
    assert.equal(engine.config.retainRatio, 0.1)
    assert.equal(engine.config.auto, true, 'the engine keeps the rest of its configuration')
    controller.restore()
    assert.equal(engine.config.thresholdRatio, 0.8, 'the original configuration comes back')
  }

  // The defaults stay the engine's own values while the override is active, so
  // a settings panel never reports the override as the official default.
  {
    const engine = { config: { thresholdRatio: 0.75, retainRatio: 0.2, maxTokens: 1024 } }
    const ctx = { get: (name) => (name === 'compaction' ? engine : undefined), agents: { list: () => [] } }
    const settings = { current: { ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.85 } }
    const controller = createRuntimeController(ctx, () => settings.current)
    controller.applyToLiveAgents()
    assert.equal(engine.config.thresholdRatio, 0.85, 'the override reaches the engine')
    const defaults = controller.defaults()
    assert.equal(defaults.thresholdRatio, 0.75, 'the default is the engine\'s own value')
    assert.equal(defaults.retainRatio, 0.2)
    assert.equal(defaults.maxTokens, 1024)
    assert.equal(defaults.compactionRetries, DEFAULT_SETTINGS.compactionRetries)
    controller.restore()
    assert.equal(controller.defaults().thresholdRatio, 0.75, 'the default survives the restore')
  }

  // Switching the override off restores the engine without waiting for an
  // unmount.
  {
    const engine = { config: { thresholdRatio: 0.8, retainRatio: 0.16, maxTokens: 8192 } }
    const ctx = { get: (name) => (name === 'compaction' ? engine : undefined), agents: { list: () => [] } }
    const settings = { current: { ...DEFAULT_SETTINGS, enabled: true, thresholdRatio: 0.5, retainRatio: 0.1 } }
    const controller = createRuntimeController(ctx, () => settings.current)
    controller.applyToLiveAgents()
    assert.equal(engine.config.thresholdRatio, 0.5)
    settings.current = { ...settings.current, enabled: false }
    controller.applyToLiveAgents()
    assert.equal(engine.config.thresholdRatio, 0.8, 'a disabled override leaves the engine alone')
  }

  console.log('manage: compaction settings checks passed')
} finally {
  await removeHome()
}
