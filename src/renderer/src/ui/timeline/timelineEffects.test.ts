import { beforeEach, describe, expect, it } from 'vitest'
import { anim } from '../../animation/keyframes'
import { useEditor } from '../../store/editor'
import { applyFxPresetToSelectedLayer, deleteLayerEffect, FX_PRESETS, toggleLayerEffect } from './timelineEffects'
import type { ImageLayer, Layer } from '@shared/types'

describe('timelineEffects (Animation FX Presets)', () => {
  beforeEach(() => {
    const mockLayer: ImageLayer = {
      id: 'layer-test-fx',
      name: 'Layer Test FX',
      type: 'image',
      visible: true,
      locked: false,
      inPoint: 0,
      outPoint: 10,
      blendMode: 'normal',
      autoScale: false,
      shotId: null,
      transform: {
        position: anim([100, 200, 500]),
        rotation: anim([0, 0, 0]),
        scale: anim([1, 1, 1]),
        opacity: anim(1)
      },
      props: {
        assetId: 'test-asset',
        width: 1920,
        height: 1080
      }
    }

    useEditor.setState({
      selectedLayerId: 'layer-test-fx',
      time: 2.5,
      project: {
        version: 2,
        comp: { name: 'Main Comp', background: '#000000', width: 1920, height: 1080, fps: 30, duration: 10 },
        camera: {} as any,
        shots: [],
        layers: [mockLayer],
        assets: []
      }
    } as any)
  })

  it('fails safely if no layer is selected', () => {
    useEditor.setState({ selectedLayerId: null })
    const success = applyFxPresetToSelectedLayer('blink')
    expect(success).toBe(false)
  })

  it('fails safely if layer is locked', () => {
    useEditor.setState((st) => {
      st.project.layers[0].locked = true
      return { ...st }
    })
    const success = applyFxPresetToSelectedLayer('blink')
    expect(success).toBe(false)
  })

  it('generates blink keyframes for opacity at playhead time', () => {
    const success = applyFxPresetToSelectedLayer('blink', { duration: 1.0, blinks: 4 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.opacity.keyframes
    expect(keys.length).toBeGreaterThanOrEqual(9) // start + 4*(mid+end)
    expect(keys[0].t).toBe(2.5)
    expect(keys[keys.length - 1].t).toBe(3.5)
    expect(keys[keys.length - 1].value).toBe(1)
  })

  it('generates fadeOut keyframes ending at opacity 0', () => {
    const success = applyFxPresetToSelectedLayer('fadeOut', { duration: 1.2 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.opacity.keyframes
    expect(keys.length).toBe(2)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toBe(1)
    expect(keys[1].t).toBe(3.7)
    expect(keys[1].value).toBe(0)
  })

  it('generates fadeIn keyframes starting at 0 and ending at 1', () => {
    const success = applyFxPresetToSelectedLayer('fadeIn', { duration: 0.8 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.opacity.keyframes
    expect(keys.length).toBe(2)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toBe(0)
    expect(keys[1].t).toBe(3.3)
    expect(keys[1].value).toBe(1)
  })

  it('generates breathe keyframes dipping opacity and returning to 1', () => {
    const success = applyFxPresetToSelectedLayer('breathe', { duration: 1.0 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.opacity.keyframes
    expect(keys.length).toBe(3)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toBe(1)
    expect(keys[1].t).toBe(3.0)
    expect(keys[1].value).toBe(0.2)
    expect(keys[2].t).toBe(3.5)
    expect(keys[2].value).toBe(1)
  })

  it('generates shake keyframes for position returning to original coords and respects custom shakes count', () => {
    const success = applyFxPresetToSelectedLayer('shake', { duration: 0.5, intensity: 20, shakes: 7 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.position.keyframes
    // 1 start key + 7 shake keys + 1 end key = 9 keys
    expect(keys.length).toBe(9)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toEqual([100, 200, 500])
    expect(keys[keys.length - 1].t).toBe(3.0)
    expect(keys[keys.length - 1].value).toEqual([100, 200, 500])

    const applied = layer.appliedEffects?.find((x) => x.presetId === 'shake')
    expect(applied?.count).toBe(7)
  })

  it('generates popIn keyframes for scale with customizable bounces count', () => {
    const success = applyFxPresetToSelectedLayer('popIn', { duration: 0.6, bounces: 3 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.scale.keyframes
    expect(keys.length).toBeGreaterThanOrEqual(5)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toEqual([0.001, 0.001, 1])
    expect(keys[keys.length - 1].t).toBe(3.1)
    expect(keys[keys.length - 1].value).toEqual([1, 1, 1])

    const applied = layer.appliedEffects?.find((x) => x.presetId === 'popIn')
    expect(applied?.count).toBe(3)
  })

  it('generates pulse keyframes with customizable pulses count', () => {
    const success = applyFxPresetToSelectedLayer('pulse', { duration: 0.6, pulses: 3, intensity: 1.3 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.scale.keyframes
    // 1 start + (1 peak + 1 end) * 3 = 7 keys
    expect(keys.length).toBe(7)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toEqual([1, 1, 1])
    expect(keys[keys.length - 1].t).toBe(3.1)
    expect(keys[keys.length - 1].value).toEqual([1, 1, 1])

    const applied = layer.appliedEffects?.find((x) => x.presetId === 'pulse')
    expect(applied?.count).toBe(3)
  })

  it('applies neonBreathe preset to layer glow configuration', () => {
    const success = applyFxPresetToSelectedLayer('neonBreathe', {
      color: '#ec4899',
      thickness: 14,
      side: 'both'
    })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    expect(layer.glow).toBeDefined()
    expect(layer.glow?.enabled).toBe(true)
    expect(layer.glow?.animated).toBe('breathe')
    expect(layer.glow?.color).toBe('#ec4899')
    expect(layer.glow?.thickness).toBe(14)
    expect(layer.glow?.side).toBe('both')
  })

  it('applies neonBlink and neonSolid presets', () => {
    applyFxPresetToSelectedLayer('neonBlink', { color: '#f59e0b', blinks: 6 })
    let layer = useEditor.getState().project.layers[0]
    expect(layer.glow?.animated).toBe('blink')
    expect(layer.glow?.color).toBe('#f59e0b')

    applyFxPresetToSelectedLayer('neonSolid', { color: '#3dd6f5', thickness: 8 })
    layer = useEditor.getState().project.layers[0]
    expect(layer.glow?.animated).toBe('none')
    expect(layer.glow?.color).toBe('#3dd6f5')
  })

  it('can toggle and delete applied effects on a layer', () => {
    applyFxPresetToSelectedLayer('breathe', { duration: 1.0 })
    let layer = useEditor.getState().project.layers[0]
    expect(layer.appliedEffects?.length).toBeGreaterThan(0)
    const fxId = layer.appliedEffects![0].id

    // Test toggle off
    useEditor.getState().update((d) => {
      const l = d.layers.find((x) => x.id === layer.id)!
      toggleLayerEffect(l as Layer, fxId, false)
    })
    layer = useEditor.getState().project.layers[0]
    expect(layer.appliedEffects![0].enabled).toBe(false)
    expect(layer.transform.opacity.keyframes.length).toBe(0) // stashed safely

    // Test toggle on
    useEditor.getState().update((d) => {
      const l = d.layers.find((x) => x.id === layer.id)!
      toggleLayerEffect(l as Layer, fxId, true)
    })
    layer = useEditor.getState().project.layers[0]
    expect(layer.appliedEffects![0].enabled).toBe(true)
    expect(layer.transform.opacity.keyframes.length).toBeGreaterThan(0) // restored

    // Test delete
    useEditor.getState().update((d) => {
      const l = d.layers.find((x) => x.id === layer.id)!
      deleteLayerEffect(l as Layer, fxId)
    })
    layer = useEditor.getState().project.layers[0]
    expect(layer.appliedEffects?.find((x) => x.id === fxId)).toBeUndefined()
    expect(layer.transform.opacity.keyframes.length).toBe(0)
  })

  it('supports configuring multiple neon effects on a single layer with different time intervals', () => {
    // Reset layer effects
    useEditor.getState().update((d) => {
      d.layers[0].appliedEffects = []
      delete d.layers[0].glow
    })

    // Apply Neon 1: Cyan breathe from 0s to 2s
    applyFxPresetToSelectedLayer('neonBreathe', {
      targetTime: 0,
      duration: 2.0,
      color: '#3dd6f5',
      intensity: 1.5
    })

    // Apply Neon 2: Amber blink from 2.5s to 5s
    applyFxPresetToSelectedLayer('neonBlink', {
      targetTime: 2.5,
      duration: 2.5,
      color: '#f59e0b',
      intensity: 1.8,
      blinks: 5
    })

    let layer = useEditor.getState().project.layers[0]
    const neonEffects = layer.appliedEffects?.filter((fx) => fx.category === 'glow')
    expect(neonEffects?.length).toBe(2)

    // Verify Neon 1
    const n1 = neonEffects![0]
    expect(n1.glow?.color).toBe('#3dd6f5')
    expect(n1.glow?.animated).toBe('breathe')
    expect(n1.glow?.startTime).toBe(0)
    expect(n1.glow?.duration).toBe(2.0)

    // Verify Neon 2
    const n2 = neonEffects![1]
    expect(n2.glow?.color).toBe('#f59e0b')
    expect(n2.glow?.animated).toBe('blink')
    expect(n2.glow?.startTime).toBe(2.5)
    expect(n2.glow?.duration).toBe(2.5)

    // Toggle Neon 1 off, verify Neon 2 is unaffected
    useEditor.getState().update((d) => {
      toggleLayerEffect(d.layers[0], n1.id, false)
    })
    layer = useEditor.getState().project.layers[0]
    const updatedN1 = layer.appliedEffects?.find((fx) => fx.id === n1.id)
    const updatedN2 = layer.appliedEffects?.find((fx) => fx.id === n2.id)
    expect(updatedN1?.enabled).toBe(false)
    expect(updatedN1?.glow?.enabled).toBe(false)
    expect(updatedN2?.enabled).toBe(true)
    expect(updatedN2?.glow?.enabled).toBe(true)

    // Delete Neon 1, verify Neon 2 remains
    useEditor.getState().update((d) => {
      deleteLayerEffect(d.layers[0], n1.id)
    })
    layer = useEditor.getState().project.layers[0]
    expect(layer.appliedEffects?.find((fx) => fx.id === n1.id)).toBeUndefined()
    expect(layer.appliedEffects?.find((fx) => fx.id === n2.id)).toBeDefined()
    expect(layer.glow?.color).toBe('#f59e0b')
  })
})
