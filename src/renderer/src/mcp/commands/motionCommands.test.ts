import { describe, expect, it } from 'vitest'
import { motionCommands } from './motionCommands'
import { useEditor } from '../../store/editor'
import type { ImageLayer } from '@shared/types'

const mockCmd = (method: string, params: any = {}) => ({ reqId: 'test', method, params })

describe('motionCommands', () => {
  it('get_motion_presets returns all catalog presets with bilingual descriptions', () => {
    const res = motionCommands.get_motion_presets({}, mockCmd('get_motion_presets')) as any
    expect(res.presets).toBeDefined()
    expect(res.presets.length).toBeGreaterThanOrEqual(8)

    const walk = res.presets.find((p: any) => p.id === 'walk_into_depth')
    expect(walk).toBeDefined()
    expect(walk.name).toBe('Đi vào chiều sâu / Rừng sâu')
    expect(walk.name_en).toContain('Walk into Depth')
    expect(walk.category).toBe('depth')
  })

  it('apply_motion_preset creates keyframes on target layer', () => {
    // Setup 1 layer trong editor store
    const layer: ImageLayer = {
      id: 'layer-solo-hero',
      name: 'Hero Solo',
      type: 'image',
      visible: true,
      locked: false,
      inPoint: 0,
      outPoint: 10,
      blendMode: 'normal',
      autoScale: false,
      shotId: 'shot-1',
      transform: {
        position: { value: [100, 50, 0], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] },
        scale: { value: [1, 1, 1], keyframes: [] },
        opacity: { value: 1.0, keyframes: [] }
      },
      props: {
        assetId: 'asset-1',
        width: 200,
        height: 200
      }
    }

    useEditor.getState().update((p) => {
      p.layers = [layer]
    })

    const res = motionCommands.apply_motion_preset(
      {
        target_id: 'layer-solo-hero',
        preset: 'walk_into_depth',
        time: 1.0,
        duration: 3.0,
        depth_z: 2200
      },
      mockCmd('apply_motion_preset')
    ) as any

    expect(res.ok).toBe(true)
    expect(res.appliedLayers).toBe(1)

    const updated = useEditor.getState().project.layers[0]
    expect(updated.transform.position.keyframes.length).toBeGreaterThan(0)
    expect(updated.transform.scale.keyframes.length).toBeGreaterThan(0)
    expect(updated.transform.opacity.keyframes.length).toBeGreaterThan(0)
  })

  it('choreograph_motion_sequence creates multi-step sequence', async () => {
    const res = (await motionCommands.choreograph_motion_sequence(
      {
        target_id: 'layer-solo-hero',
        start_time: 0,
        steps: [
          {
            name: 'Đi vào rừng sâu',
            motion: 'walk_into_depth',
            duration: 3.0,
            depth_z: 2000
          },
          {
            name: 'Nhảy qua hố sâu',
            motion: 'jump_arc',
            duration: 1.5,
            delta_x: 200,
            jump_height: 160
          },
          {
            name: 'Vấp ngã',
            motion: 'trip_and_fall',
            duration: 1.8
          }
        ]
      },
      mockCmd('choreograph_motion_sequence')
    )) as any

    expect(res.ok).toBe(true)
    expect(res.totalSteps).toBe(3)
    expect(res.totalDuration).toBeCloseTo(6.3, 1)
  })
})
