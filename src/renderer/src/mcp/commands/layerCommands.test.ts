import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import { runCommand } from '../commands'

describe('MCP layer transform parity with viewport handles', () => {
  let id: string
  beforeEach(() => {
    const project = createProject()
    const layer = createSolidLayer(project.comp)
    id = layer.id
    project.layers.push(layer)
    useEditor.getState().loadProject(project, null)
  })
  it('changes XYZ position, degree rotation and independent scales with undo/redo', async () => {
    const original = useEditor.getState().project
    await runCommand('update_layer', { layer_id: id, position: [120, -80, 450], rotation: [15, 30, 45], scale: [2, 0.5, 1] })
    const transform = useEditor.getState().project.layers[0].transform
    expect(transform.position.value).toEqual([120, -80, 450])
    expect(transform.rotation.value).toEqual([15, 30, 45])
    expect(transform.scale.value).toEqual([2, 0.5, 1])
    useEditor.getState().undo()
    expect(useEditor.getState().project).toEqual(original)
    useEditor.getState().redo()
    expect(useEditor.getState().project.layers[0].transform).toEqual(transform)
  })
  it('inserts a key at the current playhead for animated transforms', async () => {
    await runCommand('update_layer', { layer_id: id, rotation: [0, 0, 0], at_time: 0 })
    useEditor.getState().setTime(2)
    await runCommand('update_layer', { layer_id: id, rotation: [20, 40, 90] })
    const rotation = useEditor.getState().project.layers[0].transform.rotation
    expect(rotation.keyframes).toHaveLength(2)
    expect(evaluate(rotation, 0)).toEqual([0, 0, 0])
    expect(evaluate(rotation, 2)).toEqual([20, 40, 90])
  })
  it('updates 2.5D physics, sub-mesh UV region, cave depth portal, and wind-reactive virtual light via MCP', async () => {
    await runCommand('update_layer', {
      layer_id: id,
      physics: {
        enabled: true,
        material: 'ground_terrain',
        role: 'ground_surface',
        zTolerance: 60,
        meshRegion: { label: 'Mặt đất', minU: 0, maxU: 1, minV: 0.15, maxV: 0.72 },
        depthPortal: {
          enabled: true,
          centerUV: [0.5, 0.45],
          radiusUV: [0.35, 0.35],
          minScale: 0.38,
          darkness: 0.85,
          depthPullZ: 120
        }
      },
      virtual_light: {
        enabled: true,
        kind: 'candle',
        windPreset: 'strong',
        intensity: 1.6,
        radius: 440
      }
    })
    const updated = useEditor.getState().project.layers[0]
    expect(updated.physics?.enabled).toBe(true)
    expect(updated.physics?.role).toBe('ground_surface')
    expect(updated.physics?.zTolerance).toBe(60)
    expect(updated.physics?.meshRegion?.maxV).toBeCloseTo(0.72)
    expect(updated.physics?.depthPortal?.enabled).toBe(true)
    expect(updated.virtualLight?.enabled).toBe(true)
    expect(updated.virtualLight?.kind).toBe('candle')
    expect(updated.virtualLight?.windPreset).toBe('strong')
  })
})
