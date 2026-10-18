import { afterEach, describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import { layerAnimProCommands } from './layerAnimProCommands'
import { layerMotionSketchCommands } from './layerMotionSketchCommands'
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import { buildIkChain } from '../../ui/layerAssembly/workshopIk'

const run = async (name: string, params: Record<string, unknown>) =>
  ({ ...layerAnimProCommands, ...layerMotionSketchCommands })[name](params as never, {} as never)

const rig = (): LayerRig => ({
  bones: [
    { id: 'body', name: 'Thân', x: 0, y: 0, length: 80, angle: -90 },
    { id: 'upper', name: 'Bắp tay', parentId: 'body', x: 0, y: -80, length: 100, angle: 0 },
    { id: 'lower', name: 'Cẳng tay', parentId: 'upper', x: 100, y: -80, length: 100, angle: 0 },
    { id: 'hair', name: 'Tóc', parentId: 'body', x: 0, y: -80, length: 40, angle: 90 }
  ],
  tracks: {
    body: [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
      { time: 0.5, x: 0, y: 0, rotation: 30, easing: 'smooth' },
      { time: 1, x: 0, y: 0, rotation: 0, easing: 'smooth' }
    ]
  },
  duration: 1,
  loop: false
})

let unregister: (() => void) | null = null
afterEach(() => { unregister?.(); unregister = null })

function openWorkshop() {
  let comp: LayerComposite = { id: 'c', name: 'Nhân vật', category: 'character', width: 400, height: 400, layers: [], rig: rig() }
  const state = { time: 0.25, playing: false }
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

describe('layer_assembly_ik_pose', () => {
  it('kéo ngọn cẳng tay tới đích: ghi key xoay cho cả chuỗi tại đầu phát', async () => {
    const ws = openWorkshop()
    const base = buildIkChain(ws.get().rig!, 'lower', 2, 0.25).points[0]
    const res = (await run('layer_assembly_ik_pose', { bone_id: 'lower', target: [base.x + 60, base.y + 110] })) as {
      time: number; chain_bones: string[]
    }
    expect(res.time).toBe(0.25)
    expect(res.chain_bones.sort()).toEqual(['lower', 'upper'])
    const tracks = ws.get().rig!.tracks
    expect(tracks.upper.some((k) => k.time === 0.25)).toBe(true)
    expect(tracks.lower.some((k) => k.time === 0.25)).toBe(true)
  })

  it('kiểm tra tham số', async () => {
    openWorkshop()
    await expect(run('layer_assembly_ik_pose', { bone_id: 'nope', target: [0, 0] })).rejects.toThrow()
    await expect(run('layer_assembly_ik_pose', { bone_id: 'lower', target: [0] })).rejects.toThrow()
    await expect(run('layer_assembly_ik_pose', { bone_id: 'lower', target: [0, 0], chain_length: 9 })).rejects.toThrow()
  })
})

describe('layer_assembly_secondary_motion', () => {
  it('nướng vật lý cho nhánh tóc theo preset và phát thử', async () => {
    const ws = openWorkshop()
    const res = (await run('layer_assembly_secondary_motion', { bone_id: 'hair', preset: 'antenna' })) as {
      bone_ids: string[]; key_count: number; settings: { stiffness: number }
    }
    expect(res.bone_ids).toEqual(['hair'])
    expect(res.key_count).toBeGreaterThan(1)
    expect(res.settings.stiffness).toBe(0.6)
    expect(ws.state.playing).toBe(true)
    expect(ws.get().rig!.tracks.hair.length).toBeGreaterThan(1)
    await expect(run('layer_assembly_secondary_motion', { bone_id: 'hair', preset: 'wings' })).rejects.toThrow()
    await expect(run('layer_assembly_secondary_motion', { bone_id: 'hair', damping: 3 })).rejects.toThrow()
  })
})

describe('layer_assembly_motion_sketch + chain_length', () => {
  it('chain_length 2 tạo keyframe cho cả xương cha (IK)', async () => {
    const ws = openWorkshop()
    const chain = buildIkChain(ws.get().rig!, 'lower', 2, 0)
    const tip = chain.points[chain.points.length - 1]
    const points = Array.from({ length: 11 }, (_, k) => [tip.x - k * 6, tip.y + k * 8, k * 0.05])
    const res = (await run('layer_assembly_motion_sketch', { bone_id: 'lower', points, chain_length: 2, timing: 'live', start_time: 0 })) as {
      chain_bones: string[]; track_key_counts: Record<string, number>; timing: string; end_time: number
    }
    expect(res.timing).toBe('live')
    expect(res.chain_bones.sort()).toEqual(['lower', 'upper'])
    expect(res.track_key_counts.upper).toBeGreaterThan(1)
    expect(res.end_time).toBeCloseTo(0.5, 2)
    await expect(run('layer_assembly_motion_sketch', { bone_id: 'lower', points: [[0, 0], [10, 10]], timing: 'live' })).rejects.toThrow()
  })
})

describe('layer_assembly_pose_tools', () => {
  it('điều hướng key, chèn dáng trung gian và khép vòng lặp', async () => {
    const ws = openWorkshop()
    const nav = (await run('layer_assembly_pose_tools', { op: 'next_key' })) as { time: number; moved: boolean }
    expect(nav).toMatchObject({ time: 0.5, moved: true })
    expect(ws.state.time).toBe(0.5)
    await run('layer_assembly_pose_tools', { op: 'breakdown', time: 0.25, favor: 0.5 })
    expect(ws.get().rig!.tracks.body.find((k) => k.time === 0.25)!.rotation).toBeCloseTo(15)
    const loop = (await run('layer_assembly_pose_tools', { op: 'close_loop' })) as { loop: boolean }
    expect(loop.loop).toBe(true)
    const re = (await run('layer_assembly_pose_tools', { op: 'retime', factor: 2 })) as { duration: number }
    expect(re.duration).toBe(2)
  })

  it('kiểm tra tham số', async () => {
    openWorkshop()
    await expect(run('layer_assembly_pose_tools', { op: 'nope' })).rejects.toThrow()
    await expect(run('layer_assembly_pose_tools', { op: 'overlap', bone_id: 'ghost' })).rejects.toThrow()
    await expect(run('layer_assembly_pose_tools', { op: 'retime', factor: 99 })).rejects.toThrow()
  })
})
