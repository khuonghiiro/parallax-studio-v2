import type { ImageLayer } from '@shared/types'
import type { AnimationClip, LayerBone, LayerRig } from '@shared/layerRig'
import type { PlantSpine } from '@shared/plantSpine'
import type { HeroClusterHandles } from './hanbetaDemoScenes'
import { buildLayerSkinMesh } from './donghuaSceneryRigs'
import { makeBreathingCurveKeys, makeLoopKeys, type WaveKey } from './donghuaPuppetRigs'

type PresetTracks = Record<string, (dur: number, phaseLag: number) => ReturnType<typeof makeLoopKeys>>

function buildClipsFromSpec(
  prefix: string,
  specs: Array<{ key: string; name: string; duration: number; phaseLag: number; tracks: PresetTracks }>
): AnimationClip[] {
  return specs.map((sp) => ({
    id: `${prefix}-${sp.key}`,
    name: sp.name,
    presetKey: sp.key,
    duration: sp.duration,
    loop: true,
    tracks: Object.fromEntries(
      Object.entries(sp.tracks).map(([boneId, build]) => [boneId, build(sp.duration, sp.phaseLag)])
    )
  }))
}

function attachRigMesh(
  layer: ImageLayer,
  bones: LayerBone[],
  clips: AnimationClip[],
  primaryBoneId: string,
  segX: number,
  segY: number,
  plantSpines?: PlantSpine[]
): void {
  const defaultClip = clips[0]
  const rig: LayerRig = {
    bones,
    duration: defaultClip.duration,
    loop: true,
    tracks: defaultClip.tracks,
    clips,
    activeClipId: defaultClip.id,
    meshEnvelope: true
  }
  layer.mesh = buildLayerSkinMesh(layer, {
    segX,
    segY,
    rig,
    primaryBoneId,
    ...(plantSpines && plantSpines.length > 0 ? { plantSpines } : {})
  })
}

function hairSpine(id: string, name: string, layerId: string, points: { x: number; y: number }[], phaseOffset: number): PlantSpine {
  return {
    id,
    name,
    layerIds: [layerId],
    points,
    amplitude: 5.8,
    speed: 0.58,
    stiffness: 0.26,
    flexibility: 0.68,
    waveLag: 0.78,
    turbulence: 0.2,
    lean: -1.2,
    phaseOffset,
    reach: 145,
    verticalBob: 0,
    enabled: true
  }
}

function applyTorsoSoftRig(torso: ImageLayer): void {
  const bones: LayerBone[] = [
    { id: 'bone-legs', name: 'Chân Trụ', x: 0, y: 560, length: 520, angle: -90, strength: 2.0, meshEnvelope: true },
    { id: 'bone-torso', name: 'Thân Áo Khoác', parentId: 'bone-legs', x: 0, y: 20, length: 520, angle: -90, strength: 1.5, meshEnvelope: true }
  ]
  const stay: WaveKey[] = [{ phase: 0, pose: {} }, { phase: 0.5, pose: {} }]
  const shockKeys: WaveKey[] = [
    { phase: 0, pose: { rotation: 0 } },
    { phase: 0.08, pose: { rotation: -4.8, y: 2.5, scaleY: 0.985 } },
    { phase: 0.35, pose: { rotation: -3.6, y: 1.8, scaleY: 0.992 } },
    { phase: 0.68, pose: { rotation: -4.2, y: 2.0, scaleY: 1.006 } },
    { phase: 0.9, pose: { rotation: -1.4, y: 0.6, scaleY: 1.002 } }
  ]
  const pointKeys: WaveKey[] = [
    { phase: 0, pose: { rotation: 0 } },
    { phase: 0.1, pose: { rotation: 3.8, y: -2.0, scaleY: 1.012 } },
    { phase: 0.5, pose: { rotation: 3.2, y: -1.5, scaleY: 1.018 } },
    { phase: 0.82, pose: { rotation: 2.6, y: -0.8, scaleY: 1.008 } }
  ]
  const clips = buildClipsFromSpec('hb-torso', [
    {
      key: 'idle',
      name: 'Thở Điềm Tĩnh',
      duration: 2.8,
      phaseLag: 0,
      tracks: {
        'bone-legs': (d) => makeLoopKeys(d, stay),
        'bone-torso': (d, lag) => makeBreathingCurveKeys(d, lag, (b, s) => ({ y: Number((-2.2 * b).toFixed(2)), rotation: Number((s * 1.4).toFixed(2)), scaleY: Number((1 + b * 0.015).toFixed(4)) }))
      }
    },
    {
      key: 'scheming',
      name: 'Nghiêng Ngẫm Thấu Thị',
      duration: 2.6,
      phaseLag: 0,
      tracks: {
        'bone-legs': (d) => makeLoopKeys(d, stay),
        'bone-torso': (d, lag) => makeBreathingCurveKeys(d, lag, (b, s) => ({ y: Number((-2.0 * b).toFixed(2)), rotation: Number((1.8 + s * 1.3).toFixed(2)), scaleY: Number((1 + b * 0.016).toFixed(4)) }))
      }
    },
    {
      key: 'shock',
      name: 'Giật Lùi Kinh Ngạc',
      duration: 2.2,
      phaseLag: 0,
      tracks: { 'bone-legs': (d) => makeLoopKeys(d, stay), 'bone-torso': (d) => makeLoopKeys(d, shockKeys) }
    },
    {
      key: 'point',
      name: 'Tấn Công Chỉ Tay',
      duration: 2.4,
      phaseLag: 0,
      tracks: { 'bone-legs': (d) => makeLoopKeys(d, stay), 'bone-torso': (d) => makeLoopKeys(d, pointKeys) }
    }
  ])
  attachRigMesh(torso, bones, clips, 'bone-legs', 14, 22)
}

function applyArmLeftSoftRig(armLeft: ImageLayer): void {
  const bones: LayerBone[] = [
    { id: 'bone-shoulder-l', name: 'Vai Trái', x: 25, y: -395, length: 360, angle: 96, strength: 1.7, meshEnvelope: true },
    { id: 'bone-forearm-l', name: 'Cẳng Tay Trái', parentId: 'bone-shoulder-l', x: -18, y: -35, length: 490, angle: 84, strength: 1.4, meshEnvelope: true }
  ]
  const clips = buildClipsFromSpec('hb-arml', [
    {
      key: 'idle',
      name: 'Tay Trái Thả Lỏng',
      duration: 2.8,
      phaseLag: 0.14,
      tracks: {
        'bone-shoulder-l': (d, lag) => makeBreathingCurveKeys(d, lag, (_b, s) => ({ rotation: Number((s * 2.8).toFixed(2)) })),
        'bone-forearm-l': (d, lag) => makeBreathingCurveKeys(d, lag + 0.06, (_b, s) => ({ rotation: Number((s * 3.4).toFixed(2)) }))
      }
    },
    {
      key: 'scheming',
      name: 'Tay Trái Trụ Bình Thản',
      duration: 2.6,
      phaseLag: 0.14,
      tracks: {
        'bone-shoulder-l': (d, lag) => makeBreathingCurveKeys(d, lag, (_b, s) => ({ rotation: Number((-2.0 + s * 2.5).toFixed(2)) })),
        'bone-forearm-l': (d, lag) => makeBreathingCurveKeys(d, lag + 0.06, (_b, s) => ({ rotation: Number((-2.5 + s * 3.2).toFixed(2)) }))
      }
    },
    {
      key: 'shock',
      name: 'Tay Trái Thủ Thế',
      duration: 2.2,
      phaseLag: 0,
      tracks: {
        'bone-shoulder-l': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.08, pose: { rotation: -9.0 } }, { phase: 0.55, pose: { rotation: -7.5 } }, { phase: 0.88, pose: { rotation: -3.0 } }]),
        'bone-forearm-l': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.11, pose: { rotation: -6.0 } }, { phase: 0.58, pose: { rotation: -4.5 } }, { phase: 0.9, pose: { rotation: -1.8 } }])
      }
    },
    {
      key: 'point',
      name: 'Tay Trái Cân Bằng',
      duration: 2.4,
      phaseLag: 0,
      tracks: {
        'bone-shoulder-l': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.1, pose: { rotation: -6.0 } }, { phase: 0.6, pose: { rotation: -5.2 } }, { phase: 0.9, pose: { rotation: -2.0 } }]),
        'bone-forearm-l': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.13, pose: { rotation: -3.5 } }, { phase: 0.62, pose: { rotation: -2.8 } }, { phase: 0.9, pose: { rotation: -1.0 } }])
      }
    }
  ])
  attachRigMesh(armLeft, bones, clips, 'bone-shoulder-l', 12, 20)
}

function applyArmRightSoftRig(armRight: ImageLayer, phaseSeed: number): void {
  const bones: LayerBone[] = [
    { id: 'bone-shoulder-r', name: 'Vai Phải', x: -235, y: -95, length: 485, angle: 65, strength: 1.8, meshEnvelope: true },
    { id: 'bone-forearm-r', name: 'Cẳng Tay & Tờ Quy Tắc', parentId: 'bone-shoulder-r', x: -30, y: 345, length: 615, angle: -69, strength: 1.5, meshEnvelope: true }
  ]
  const clips = buildClipsFromSpec('hb-armr', [
    {
      key: 'idle',
      name: 'Giữ Tờ Quy Tắc',
      duration: 2.8,
      phaseLag: 0.16,
      tracks: {
        'bone-shoulder-r': (d, lag) => makeBreathingCurveKeys(d, lag, (b) => ({ rotation: Number((1.5 + b * 1.4).toFixed(2)) })),
        'bone-forearm-r': (d, lag) => makeBreathingCurveKeys(d, lag + 0.08, (_b, s) => ({ rotation: Number((16.0 + s * 2.2).toFixed(2)) }))
      }
    },
    {
      key: 'scheming',
      name: 'Nâng Tờ Quy Tắc Soi Xét',
      duration: 2.6,
      phaseLag: 0.12,
      tracks: {
        'bone-shoulder-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 1.5 } }, { phase: 0.22, pose: { rotation: 3.0 } }, { phase: 0.58, pose: { rotation: 2.4 } }, { phase: 0.88, pose: { rotation: 1.8 } }]),
        'bone-forearm-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 16.0 } }, { phase: 0.22, pose: { rotation: 18.5 } }, { phase: 0.58, pose: { rotation: 15.0 } }, { phase: 0.88, pose: { rotation: 17.0 } }])
      }
    },
    {
      key: 'shock',
      name: 'Giật Mình Co Tay',
      duration: 2.2,
      phaseLag: 0,
      tracks: {
        'bone-shoulder-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 1.0 } }, { phase: 0.08, pose: { rotation: -2.0 } }, { phase: 0.48, pose: { rotation: -1.2 } }, { phase: 0.88, pose: { rotation: 0.5 } }]),
        'bone-forearm-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 16.0 } }, { phase: 0.08, pose: { rotation: 10.5 } }, { phase: 0.35, pose: { rotation: 13.5 } }, { phase: 0.65, pose: { rotation: 11.2 } }, { phase: 0.9, pose: { rotation: 15.0 } }])
      }
    },
    {
      key: 'point',
      name: 'Đưa Tờ Quy Tắc Chỉ Điểm',
      duration: 2.4,
      phaseLag: 0,
      tracks: {
        'bone-shoulder-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 2.0 } }, { phase: 0.1, pose: { rotation: 5.0 } }, { phase: 0.6, pose: { rotation: 4.2 } }, { phase: 0.9, pose: { rotation: 2.5 } }]),
        'bone-forearm-r': (d) => makeLoopKeys(d, [{ phase: 0, pose: { rotation: 16.0 } }, { phase: 0.1, pose: { rotation: 25.0 } }, { phase: 0.58, pose: { rotation: 22.8 } }, { phase: 0.88, pose: { rotation: 18.5 } }])
      }
    }
  ])
  const noteCornerSpine: PlantSpine = {
    id: `${armRight.id}-rule-sheet-corner`,
    name: 'Góc Giấy Quy Tắc Rung Nhẹ',
    layerIds: [armRight.id],
    points: [
      { x: 170, y: -110 },
      { x: 215, y: -235 },
      { x: 265, y: -335 }
    ],
    amplitude: 6.2,
    speed: 0.62,
    stiffness: 0.25,
    flexibility: 0.65,
    waveLag: 0.72,
    turbulence: 0.22,
    lean: -1.0,
    phaseOffset: phaseSeed,
    reach: 165,
    verticalBob: 0,
    enabled: true
  }
  attachRigMesh(armRight, bones, clips, 'bone-shoulder-r', 18, 18, [noteCornerSpine])
}

function applyHeadSoftRig(head: ImageLayer, phaseSeed: number): void {
  const bones: LayerBone[] = [
    { id: 'bone-neck-base', name: 'Chân Cổ Neo Áo', x: -20, y: 440, length: 145, angle: -90, strength: 1.9, meshEnvelope: true },
    { id: 'bone-head', name: 'Đầu & Ánh Mắt', parentId: 'bone-neck-base', x: -15, y: 290, length: 580, angle: -86, strength: 1.6, meshEnvelope: true }
  ]
  const lockNeck: WaveKey[] = [{ phase: 0, pose: {} }, { phase: 0.5, pose: {} }]
  const clips = buildClipsFromSpec(`hb-head-${head.id.slice(-4)}`, [
    {
      key: 'idle',
      name: 'Nhìn Quan Sát',
      duration: 2.8,
      phaseLag: 0.1,
      tracks: {
        'bone-neck-base': (d) => makeLoopKeys(d, lockNeck),
        'bone-head': (d, lag) => makeBreathingCurveKeys(d, lag, (_b, s) => ({ rotation: Number((s * 2.2).toFixed(2)) }))
      }
    },
    {
      key: 'scheming',
      name: 'Cúi Nhẹ Suy Tính',
      duration: 2.6,
      phaseLag: 0.1,
      tracks: {
        'bone-neck-base': (d) => makeLoopKeys(d, lockNeck),
        'bone-head': (d, lag) => makeBreathingCurveKeys(d, lag, (_b, s) => ({ rotation: Number((3.8 + s * 1.6).toFixed(2)) }))
      }
    },
    {
      key: 'shock',
      name: 'Giật Ngửa Kinh Ngạc',
      duration: 2.2,
      phaseLag: 0,
      tracks: {
        'bone-neck-base': (d) => makeLoopKeys(d, lockNeck),
        'bone-head': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.08, pose: { rotation: -6.2 } }, { phase: 0.45, pose: { rotation: -5.0 } }, { phase: 0.88, pose: { rotation: -2.0 } }])
      }
    },
    {
      key: 'point',
      name: 'Khóa Cằm Quyết Đoán',
      duration: 2.4,
      phaseLag: 0,
      tracks: {
        'bone-neck-base': (d) => makeLoopKeys(d, lockNeck),
        'bone-head': (d) => makeLoopKeys(d, [{ phase: 0, pose: {} }, { phase: 0.1, pose: { rotation: 4.2 } }, { phase: 0.62, pose: { rotation: 3.6 } }, { phase: 0.9, pose: { rotation: 1.5 } }])
      }
    }
  ])
  const spines: PlantSpine[] = [
    hairSpine(`${head.id}-hair-l`, 'Tóc Bạc Gió Trái', head.id, [{ x: -145, y: -240 }, { x: -245, y: -140 }, { x: -335, y: -30 }], phaseSeed),
    hairSpine(`${head.id}-hair-r`, 'Tóc Bạc Gió Phải', head.id, [{ x: 140, y: -250 }, { x: 235, y: -135 }, { x: 295, y: -20 }], phaseSeed + 0.45)
  ]
  attachRigMesh(head, bones, clips, 'bone-neck-base', 16, 18, spines)
}

/**
 * Gắn bộ xương soft-skin giải phẫu chuẩn khớp nối cho toàn bộ Cụm Thám Tử Hàn Bối Tháp,
 * tránh hiện tượng `CUTOUT_FRONT_BONES` xoay lệch quỹ đạo làm bung tay/đầu khi áp preset Workflow V2.
 */
export function applyHeroClusterSoftRigs(hero: HeroClusterHandles, phaseSeed = 0): void {
  applyTorsoSoftRig(hero.torso)
  applyArmLeftSoftRig(hero.armLeft)
  applyArmRightSoftRig(hero.armRight, phaseSeed)
  applyHeadSoftRig(hero.headCalm, phaseSeed)
  applyHeadSoftRig(hero.headSmirk, phaseSeed)
  applyHeadSoftRig(hero.headShock, phaseSeed)
}
