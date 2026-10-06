import { beforeEach, describe, expect, it } from 'vitest'
import { anim } from '../../animation/keyframes'
import { useEditor } from '../../store/editor'
import { applyFxPresetToSelectedLayer, deleteLayerEffect, FX_PRESETS, toggleLayerEffect } from './timelineEffects'
import type { ImageLayerProps, Layer } from '@shared/types'

describe('timelineEffects (Animation FX Presets)', () => {
  beforeEach(() => {
    const mockLayer: Layer<ImageLayerProps> = {
      id: 'layer-test-fx',
      name: 'Layer Test FX',
      type: 'image',
      visible: true,
      locked: false,
      inPoint: 0,
      outPoint: 10,
      blendMode: 'normal',
      autoScale: false,
      transform: {
        position: anim([100, 200, 500]),
        rotation: anim([0, 0, 0]),
        scale: anim([1, 1, 1]),
        opacity: anim(1)
      },
      props: {
        assetId: 'test-asset'
      }
    }

    useEditor.setState({
      selectedLayerId: 'layer-test-fx',
      time: 2.5,
      project: {
        version: 2,
        comp: { width: 1920, height: 1080, fps: 30, duration: 10 },
        camera: {} as any,
        shots: [],
        layers: [mockLayer],
        assets: []
      }
    })
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

  it('generates shake keyframes for position returning to original coords', () => {
    const success = applyFxPresetToSelectedLayer('shake', { duration: 0.5, intensity: 20 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.position.keyframes
    expect(keys.length).toBeGreaterThanOrEqual(6)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toEqual([100, 200, 500])
    expect(keys[keys.length - 1].t).toBe(3.0)
    expect(keys[keys.length - 1].value).toEqual([100, 200, 500])
  })

  it('generates popIn keyframes for scale with bounce', () => {
    const success = applyFxPresetToSelectedLayer('popIn', { duration: 0.6 })
    expect(success).toBe(true)

    const layer = useEditor.getState().project.layers[0]
    const keys = layer.transform.scale.keyframes
    expect(keys.length).toBe(4)
    expect(keys[0].t).toBe(2.5)
    expect(keys[0].value).toEqual([0.001, 0.001, 1])
    expect(keys[3].t).toBe(3.1)
    expect(keys[3].value).toEqual([1, 1, 1])
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
})
