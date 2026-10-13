import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  BUILTIN_SLOT_PRESETS,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
  getAllPresets,
  createPresetFromLayers,
  exportPresetJson,
  importPresetJson
} from './slotPresets'
import type { AssembledLayerItem } from '../types'

describe('slotPresets & custom template management', () => {
  let mockStore: Record<string, string> = {}

  beforeEach(() => {
    mockStore = {}
    const mockStorage = {
      getItem: (k: string) => mockStore[k] ?? null,
      setItem: (k: string, v: string) => { mockStore[k] = v },
      removeItem: (k: string) => { delete mockStore[k] },
      clear: () => { mockStore = {} },
      length: 0,
      key: () => null
    }
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage as Storage
  })

  it('has valid built-in presets', () => {
    expect(BUILTIN_SLOT_PRESETS.length).toBeGreaterThanOrEqual(2)
    const anime = BUILTIN_SLOT_PRESETS.find((p) => p.id === 'humanoid_anime')
    expect(anime).toBeDefined()
    expect(anime?.slots.length).toBeGreaterThan(5)
  })

  it('creates, saves, loads and deletes custom preset', () => {
    const mockLayers: AssembledLayerItem[] = [
      {
        id: 'l1',
        name: 'Đầu',
        x: 0,
        y: -100,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'l2',
        name: 'Thân áo',
        x: 0,
        y: 20,
        z: 5,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ]

    const preset = createPresetFromLayers('Mẫu Chibi', 'Mẫu thử nghiệm', mockLayers)
    expect(preset.name).toBe('Mẫu Chibi')
    expect(preset.slots.length).toBe(2)
    expect(preset.isCustom).toBe(true)

    saveCustomPreset(preset)
    const loaded = loadCustomPresets()
    expect(loaded.length).toBe(1)
    expect(loaded[0].name).toBe('Mẫu Chibi')

    const all = getAllPresets()
    expect(all.length).toBe(BUILTIN_SLOT_PRESETS.length + 1)

    deleteCustomPreset(preset.id)
    expect(loadCustomPresets().length).toBe(0)
  })

  it('exports and imports preset json accurately', () => {
    const mockLayers: AssembledLayerItem[] = [
      {
        id: 'l1',
        name: 'Vũ khí',
        x: 80,
        y: 10,
        z: -2,
        scale: 1.2,
        rotation: 15,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ]

    const preset = createPresetFromLayers('Mẫu Kiếm', 'Test', mockLayers)
    const jsonStr = exportPresetJson(preset)
    expect(typeof jsonStr).toBe('string')

    const imported = importPresetJson(jsonStr)
    expect(imported.name).toBe('Mẫu Kiếm')
    expect(imported.slots.length).toBe(1)
    expect(imported.slots[0].name).toBe('Vũ khí')
    expect(imported.slots[0].x).toBe(80)
  })
})
