import { describe, expect, it } from 'vitest'
import {
  generatePresetSpatialTracks,
  MOTION_PRESETS_CATALOG,
  type MotionPresetId
} from './motionPresets'
import {
  findMotionTargetGroup,
  applyMotionTracksToGroup,
  choreographSequence,
  getCharacterActionCatalog
} from './motionEngine'
import type { Project, ImageLayer, Vec3 } from '@shared/types'

function makeMockProject(): Project {
  const layer1: ImageLayer = {
    id: 'layer-hero-head',
    name: '[Hiệp Sĩ] Đầu',
    type: 'image',
    visible: true,
    locked: false,
    inPoint: 0,
    outPoint: 10,
    blendMode: 'normal',
    autoScale: false,
    shotId: 'shot-1',
    composite: {
      instanceId: 'comp-inst-hero',
      compositeId: 'comp-male-hero',
      compositeName: 'Nam Hiệp Sĩ',
      isRoot: true,
      lockedGroup: true,
      centerPosition: [0, 0, 0],
      rootOffset: [0, -60, 0]
    },
    transform: {
      position: { value: [0, -60, 0], keyframes: [] },
      rotation: { value: [0, 0, 0], keyframes: [] },
      scale: { value: [1, 1, 1], keyframes: [] },
      opacity: { value: 1.0, keyframes: [] }
    },
    props: {
      assetId: 'asset-head',
      width: 100,
      height: 100
    }
  }

  const layer2: ImageLayer = {
    id: 'layer-hero-body',
    name: '[Hiệp Sĩ] Thân',
    type: 'image',
    visible: true,
    locked: false,
    inPoint: 0,
    outPoint: 10,
    blendMode: 'normal',
    autoScale: false,
    shotId: 'shot-1',
    composite: {
      instanceId: 'comp-inst-hero',
      compositeId: 'comp-male-hero',
      compositeName: 'Nam Hiệp Sĩ',
      isRoot: false,
      lockedGroup: true,
      centerPosition: [0, 0, 0],
      rootOffset: [0, 0, 0]
    },
    transform: {
      position: { value: [0, 0, 0], keyframes: [] },
      rotation: { value: [0, 0, 0], keyframes: [] },
      scale: { value: [1, 1, 1], keyframes: [] },
      opacity: { value: 1.0, keyframes: [] }
    },
    props: {
      assetId: 'asset-body',
      width: 120,
      height: 150
    }
  }

  return {
    version: 2,
    audio: null,
    comp: {
      name: 'Test Project',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 10,
      background: '#000000'
    },
    camera: {
      position: { value: [0, 0, -1483], keyframes: [] },
      target: { value: [0, 0, 0], keyframes: [] },
      fov: { value: 40, keyframes: [] },
      dofEnabled: false,
      focusDistance: { value: 1483, keyframes: [] },
      aperture: { value: 0, keyframes: [] },
      shakeAmount: 0,
      shakeSpeed: 1,
      fade: { value: 0, keyframes: [] }
    },
    shots: [
      {
        id: 'shot-1',
        name: 'Shot 1',
        color: '#ffaa00',
        visible: true,
        position: { value: [0, 0, 0], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] }
      }
    ],
    layers: [layer1, layer2],
    assets: [],
    look: {
      fogEnabled: false,
      fogColor: '#000000',
      fogNear: 1000,
      fogFar: 4000,
      vignette: 0,
      grain: 0,
      exposure: 0,
      contrast: 0,
      saturation: 0
    }
  }
}

describe('motionPresets & motionEngine', () => {
  it('generates spatial tracks for walk_into_depth with decreasing scale and vanishing opacity', () => {
    const tracks = generatePresetSpatialTracks(
      'walk_into_depth',
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1.0 },
      { time: 0, duration: 3.0, depthZ: 2500, fadeOpacity: true }
    )

    // Position Z tăng mạnh vào rừng sâu
    expect(tracks.position).toHaveLength(2)
    expect(tracks.position[0].value[2]).toBe(0)
    expect(tracks.position[1].value[2]).toBe(2500)

    // Scale thu nhỏ dần theo phối cảnh
    expect(tracks.scale).toHaveLength(2)
    expect(tracks.scale[0].value[0]).toBe(1)
    expect(tracks.scale[1].value[0]).toBeLessThan(0.2)

    // Opacity mờ dần về 0 ở cuối
    expect(tracks.opacity.length).toBeGreaterThanOrEqual(3)
    const lastOp = tracks.opacity[tracks.opacity.length - 1]
    expect(lastOp.t).toBe(3.0)
    expect(lastOp.value).toBe(0)
  })

  it('generates spatial tracks for jump_arc with parabolic Y and squash-stretch', () => {
    const tracks = generatePresetSpatialTracks(
      'jump_arc',
      { position: [100, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1.0 },
      { time: 1.0, duration: 1.4, deltaX: 200, jumpHeight: 150 }
    )

    // Y tại đỉnh parabol phải cao hơn điểm xuất phát
    expect(tracks.position).toHaveLength(3)
    expect(tracks.position[0].value[1]).toBe(0)
    expect(tracks.position[1].value[1]).toBe(150)
    expect(tracks.position[2].value[1]).toBe(0)
    expect(tracks.position[2].value[0]).toBe(300)

    // Scale co giãn
    expect(tracks.scale.length).toBeGreaterThanOrEqual(4)
  })

  it('generates spatial tracks for trip_and_fall with forward rotation and ground impact', () => {
    const tracks = generatePresetSpatialTracks(
      'trip_and_fall',
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1.0 },
      { time: 0, duration: 1.8 }
    )

    // Chúi ngã xuống sàn Y và xoay nghiêng Z
    expect(tracks.position.length).toBeGreaterThanOrEqual(4)
    expect(tracks.rotation.length).toBeGreaterThanOrEqual(4)
    const finalRot = tracks.rotation[tracks.rotation.length - 1]
    expect(finalRot.value[2]).toBeGreaterThan(60) // ngả sấp nghiêng hơn 60 độ
  })

  it('finds group by composite instance and applies synchronized motion to all parts', () => {
    const proj = makeMockProject()
    const group = findMotionTargetGroup(proj, 'comp-inst-hero')
    expect(group).not.toBeNull()
    expect(group?.type).toBe('composite')
    expect(group?.layers).toHaveLength(2)

    // Gắn motion cho cả nhóm
    const tracks = generatePresetSpatialTracks(
      'walk_into_depth',
      { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1.0 },
      { time: 0, duration: 3.0, depthZ: 2000 }
    )
    applyMotionTracksToGroup(group!, tracks)

    // Cả 2 layer đều được ghi keyframes đồng bộ
    const l1 = proj.layers[0]
    const l2 = proj.layers[1]
    expect(l1.transform.position.keyframes.length).toBeGreaterThan(0)
    expect(l2.transform.position.keyframes.length).toBeGreaterThan(0)
    expect(l1.transform.scale.keyframes.length).toBeGreaterThan(0)
    expect(l2.transform.scale.keyframes.length).toBeGreaterThan(0)
  })

  it('choreographs a multi-step sequence chaining walk into depth, jump, and fall', async () => {
    const proj = makeMockProject()
    const res = await choreographSequence(proj, {
      compositeInstanceId: 'comp-inst-hero',
      startTime: 0,
      steps: [
        {
          name: 'Đi sâu vào rừng',
          duration: 3.0,
          motionPreset: 'walk_into_depth',
          depthZ: 1800,
          fadeOpacity: false
        },
        {
          name: 'Bật nhảy qua suối',
          duration: 1.4,
          motionPreset: 'jump_arc',
          deltaX: 150,
          jumpHeight: 120
        },
        {
          name: 'Vấp ngã sấp và biến mất',
          duration: 2.0,
          motionPreset: 'trip_and_fall',
          toOpacity: 0
        }
      ]
    })

    expect(res.ok).toBe(true)
    expect(res.totalSteps).toBe(3)
    expect(res.appliedLayers).toBe(2)

    // Kiểm tra các mốc thời gian nối tiếp nhau
    const rootLayer = proj.layers.find((l) => l.composite?.isRoot)
    const pKeys = rootLayer!.transform.position.keyframes
    expect(pKeys.length).toBeGreaterThanOrEqual(6)
    // Mốc cuối cùng phải ở t >= 6.4s
    const lastKey = pKeys[pKeys.length - 1]
    expect(lastKey.t).toBeCloseTo(6.4, 1)
  })

  it('reads character action catalog for AI script choreography', () => {
    const proj = makeMockProject()
    const catalog = getCharacterActionCatalog(proj, 'comp-inst-hero')
    expect(catalog.targetType).toBe('composite')
    expect(catalog.availableMotionPresets.length).toBeGreaterThanOrEqual(6)
    expect(catalog.suggestedChoreographies.length).toBeGreaterThan(0)
  })
})
