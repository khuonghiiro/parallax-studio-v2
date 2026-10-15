import { afterEach, describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import { layerMotionSketchCommands } from './layerMotionSketchCommands'
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import { sampleBonePose } from '../../engine/layerRig'

const runCommand = async (params: Record<string, unknown>) =>
  layerMotionSketchCommands.layer_assembly_motion_sketch(params as never, {} as never)

const rig = (duration = 2): LayerRig => ({
  bones: [{ id: 'arm', name: 'Cánh tay', x: 0, y: 0, length: 100, angle: 0 }],
  tracks: {},
  duration,
  loop: false
})

let unregister: (() => void) | null = null
afterEach(() => { unregister?.(); unregister = null })

function openWorkshop(withRig = true) {
  let comp: LayerComposite = {
    id: 'c', name: 'Nhân vật', category: 'character', width: 400, height: 400, layers: [],
    rig: withRig ? rig() : undefined
  }
  const state = { time: 0, playing: false }
  unregister = registerLayerAssemblySession({
    getComposite: () => comp,
    setComposite: (c) => { comp = typeof c === 'function' ? c(comp) : c },
    getSelectedLayerId: () => null,
    setSelectedLayerId: () => {},
    getSelectedLayerIds: () => [],
    getIsPlaying: () => state.playing,
    setIsPlaying: (v) => { state.playing = v },
    getTime: () => state.time,
    setTime: (t) => { state.time = t },
    save: async () => {},
    insertToScene: async () => {},
    close: () => {}
  })
  return { get: () => comp, state }
}

/** Cung tròn bán kính 100 quanh gốc, kèm thời gian t tăng đều. */
const arc = (a0: number, a1: number, n: number) =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180
    return [100 * Math.cos(a), 100 * Math.sin(a), k / n]
  })

describe('layer_assembly_motion_sketch', () => {
  it('biến đường đi ngọn xương thành keyframe xoay và phát thử', async () => {
    const ws = openWorkshop()
    const res = (await runCommand({ bone_id: 'arm', points: arc(0, 90, 20), duration: 1, play: true })) as {
      key_count: number; end_time: number; mode: string; timing: string
    }
    expect(res.mode).toBe('rotate')
    expect(res.timing).toBe('hand')
    expect(res.key_count).toBeGreaterThanOrEqual(2)
    expect(res.end_time).toBeCloseTo(1)
    const r = { ...ws.get().rig!, loop: false }
    expect(sampleBonePose(r, 'arm', 1).rotation).toBeCloseTo(90, 0)
    expect(ws.state.playing).toBe(true)
  })

  it('khứ hồi nới thời lượng clip và quay về tư thế ban đầu', async () => {
    const ws = openWorkshop()
    await runCommand({ bone_id: 'arm', points: [[100, 0], [0, 100]], duration: 1.5, start_time: 0.5, loop_back: true })
    const r = { ...ws.get().rig!, loop: false }
    expect(r.duration).toBeGreaterThanOrEqual(3.5)
    expect(sampleBonePose(r, 'arm', 2).rotation).toBeCloseTo(90, 0)
    expect(sampleBonePose(r, 'arm', 3.5).rotation).toBeCloseTo(0, 1)
  })

  it('báo lỗi khi thiếu khung xương, sai xương hoặc thiếu điểm', async () => {
    openWorkshop(false)
    await expect(runCommand({ bone_id: 'arm', points: arc(0, 90, 4) })).rejects.toThrow(/skeleton/)
    unregister?.()
    openWorkshop()
    await expect(runCommand({ bone_id: 'leg', points: arc(0, 90, 4) })).rejects.toThrow(/Unknown bone_id/)
    await expect(runCommand({ bone_id: 'arm', points: [[1, 2]] })).rejects.toThrow(/at least 2/)
    await expect(runCommand({ bone_id: 'arm', points: [[0, 0, 1], [1, 1, 0.5]] })).rejects.toThrow(/must not decrease/)
    await expect(runCommand({ bone_id: 'arm', points: arc(0, 90, 4), mode: 'spin' })).rejects.toThrow(/mode/)
    await expect(runCommand({ bone_id: 'arm', points: arc(0, 90, 4), duration: 50 })).rejects.toThrow(/duration/)
  })
})
