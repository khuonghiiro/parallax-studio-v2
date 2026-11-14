import type {
  AssetMeta,
  Composition,
  DepthPortalConfig,
  ImageLayer,
  LayerVirtualLight,
  ParticleLayer,
  Project,
  Shot,
  Vec3
} from '@shared/types'
import { choreographCinematicCameraRoute, type CinematicCameraBeat } from '../animation/cinematicCameraRoute'
import {
  SHADOW_MONSTER_25D_COMPOSITE,
  SPIRIT_EAGLE_25D_COMPOSITE,
  SPIRIT_WOLF_25D_COMPOSITE,
  SWORD_HUNTER_25D_COMPOSITE
} from '../ui/layerAssembly/action25dComposites'
import type { LayerComposite } from '../ui/layerAssembly/types'
import { referenceDistance } from '../animation/math'
import { createImageLayer, createParticleLayer } from './factory'
import { projectCorridorFootToWorld } from './sceneDepthCorridor'

const COMPOSITE_Z_FACTOR = 0.05
const r2 = (v: number): number => Math.round(v * 100) / 100
const r3 = (v: number): number => Math.round(v * 1000) / 1000

/** Khoảng cách dọc chưa co giãn từ khớp gốc `pelvis` xuống đế giày / bàn chân tiếp đất. */
export const HERO_FOOT_OFFSET_Y = 340
export const WOLF_FOOT_OFFSET_Y = 204
export const MONSTER_FOOT_OFFSET_Y = 271

type AssetSpec = [id: string, name: string, assetPath: string, width: number, height: number]

const RAW_ACTION_ASSETS: AssetSpec[] = [
  ['asset-act-bg-s1', 'Bối cảnh Cảnh 1 — Đèo Sương Cổ Mộ', 'scenes-action-25d/env/bg_s1_misty_pass.png', 1920, 1080],
  ['asset-act-bg-s2', 'Bối cảnh Cảnh 2 — Sân Cổ Phong Ấn', 'scenes-action-25d/env/bg_s2_sealed_courtyard.png', 1920, 1080],
  ['asset-act-bg-s3', 'Bối cảnh Cảnh 3 — Đài Quyết Chiến Trăng Đỏ', 'scenes-action-25d/env/bg_s3_crimson_arena.png', 1920, 1080],
  ['asset-act-fg-pillar', 'Cột Đá Cổ Tích Tiền Cảnh', 'scenes-action-25d/env/fg-ruin-pillar.png', 713, 680],
  ['asset-act-mid-pine-lantern', 'Cành Tùng Cổ Thụ & Lồng Đèn Trung Cảnh', 'scenes-action-25d/env/mid-pine-lantern.png', 562, 357],
  ['asset-act-mid-stone-lantern', 'Thạch Đăng Rêu Phong Lối Ngõ', 'scenes-action-25d/env/mid-stone-lantern.png', 192, 374],
  ['asset-act-fg-seal-obelisk', 'Trụ Đá Phù Văn Phong Ấn Tiền Cảnh', 'scenes-action-25d/env/fg-seal-obelisk.png', 177, 369],
  ['asset-act-mid-valley-mist', 'Mây Sương Hẻm Đèo Bán Trong Suốt', 'scenes-action-25d/env/mid-valley-mist.png', 587, 184],
  ['asset-act-vfx-crescent', 'Kiếm Khí Nguyệt Trảm VFX', 'scenes-action-25d/env/vfx-sword-crescent.png', 580, 514],
  ['asset-act-vfx-roar', 'Sóng Gầm Ma Thú VFX', 'scenes-action-25d/env/vfx-roar-shockwave.png', 520, 493],
  ['asset-act-vfx-impact', 'Tia Lửa Giao Kiếm VFX', 'scenes-action-25d/env/vfx-impact-burst.png', 500, 543],

  ['asset-act-hero-cape', 'Kiếm Khách — Áo Choàng Sau', 'scenes-action-25d/hero/cape.png', 291, 336],
  ['asset-act-hero-arm-r', 'Kiếm Khách — Bắp Tay Sau', 'scenes-action-25d/hero/arm-r.png', 45, 160],
  ['asset-act-hero-forearm-r', 'Kiếm Khách — Cẳng Tay Sau', 'scenes-action-25d/hero/forearm-r.png', 54, 168],
  ['asset-act-hero-thigh-r', 'Kiếm Khách — Đùi Sau', 'scenes-action-25d/hero/thigh-r.png', 81, 184],
  ['asset-act-hero-shin-r', 'Kiếm Khách — Chân Sau', 'scenes-action-25d/hero/shin-r.png', 96, 206],
  ['asset-act-hero-thigh-l', 'Kiếm Khách — Đùi Trước', 'scenes-action-25d/hero/thigh-l.png', 78, 186],
  ['asset-act-hero-shin-l', 'Kiếm Khách — Chân Trước', 'scenes-action-25d/hero/shin-l.png', 97, 208],
  ['asset-act-hero-torso', 'Kiếm Khách — Thân Chiến Giáp', 'scenes-action-25d/hero/torso.png', 160, 184],
  ['asset-act-hero-pelvis', 'Kiếm Khách — Đai Hông', 'scenes-action-25d/hero/pelvis.png', 174, 144],
  ['asset-act-hero-head-calm', 'Kiếm Khách — Đầu Điềm Tĩnh', 'scenes-action-25d/hero/head-calm.png', 187, 218],
  ['asset-act-hero-head-shout', 'Kiếm Khách — Đầu Hét Xung Phong', 'scenes-action-25d/hero/head-shout.png', 189, 220],
  ['asset-act-hero-arm-l', 'Kiếm Khách — Bắp Tay Kiếm', 'scenes-action-25d/hero/arm-l.png', 98, 166],
  ['asset-act-hero-forearm-l', 'Kiếm Khách — Cẳng Tay & Trường Kiếm', 'scenes-action-25d/hero/forearm-l.png', 161, 312],

  ['asset-act-wolf-leg-fr-thigh', 'Linh Lang — Đùi Trước Xa', 'scenes-action-25d/wolf/leg-fr-thigh.png', 84, 112],
  ['asset-act-wolf-leg-fr-shin', 'Linh Lang — Chân Trước Xa', 'scenes-action-25d/wolf/leg-fr-shin.png', 94, 132],
  ['asset-act-wolf-leg-br-thigh', 'Linh Lang — Đùi Sau Xa', 'scenes-action-25d/wolf/leg-br-thigh.png', 79, 120],
  ['asset-act-wolf-leg-br-shin', 'Linh Lang — Chân Sau Xa', 'scenes-action-25d/wolf/leg-br-shin.png', 74, 104],
  ['asset-act-wolf-tail-tip', 'Linh Lang — Chóp Đuôi', 'scenes-action-25d/wolf/tail-tip.png', 128, 72],
  ['asset-act-wolf-tail', 'Linh Lang — Gốc Đuôi', 'scenes-action-25d/wolf/tail.png', 138, 55],
  ['asset-act-wolf-pelvis', 'Linh Lang — Hông Sói', 'scenes-action-25d/wolf/pelvis.png', 216, 150],
  ['asset-act-wolf-torso', 'Linh Lang — Thân & Bờm', 'scenes-action-25d/wolf/torso.png', 210, 267],
  ['asset-act-wolf-jaw', 'Linh Lang — Hàm Dưới', 'scenes-action-25d/wolf/jaw.png', 120, 88],
  ['asset-act-wolf-head', 'Linh Lang — Đầu Sói Bạc', 'scenes-action-25d/wolf/head.png', 204, 180],
  ['asset-act-wolf-leg-fl-thigh', 'Linh Lang — Đùi Trước Gần', 'scenes-action-25d/wolf/leg-fl-thigh.png', 73, 112],
  ['asset-act-wolf-leg-fl-shin', 'Linh Lang — Chân Trước Gần', 'scenes-action-25d/wolf/leg-fl-shin.png', 82, 132],
  ['asset-act-wolf-leg-bl-thigh', 'Linh Lang — Đùi Sau Gần', 'scenes-action-25d/wolf/leg-bl-thigh.png', 75, 120],
  ['asset-act-wolf-leg-bl-shin', 'Linh Lang — Chân Sau Gần', 'scenes-action-25d/wolf/leg-bl-shin.png', 67, 104],

  ['asset-act-monster-arm-l', 'Ma Thú — Vai Sau Trái', 'scenes-action-25d/monster/arm-l.png', 112, 140],
  ['asset-act-monster-forearm-l', 'Ma Thú — Vuốt Sau Trái', 'scenes-action-25d/monster/forearm-l.png', 122, 188],
  ['asset-act-monster-thigh-l', 'Ma Thú — Đùi Sau Trái', 'scenes-action-25d/monster/thigh-l.png', 129, 161],
  ['asset-act-monster-shin-l', 'Ma Thú — Chân Sau Trái', 'scenes-action-25d/monster/shin-l.png', 138, 161],
  ['asset-act-monster-tail', 'Ma Thú — Gốc Đuôi Gai', 'scenes-action-25d/monster/tail.png', 178, 117],
  ['asset-act-monster-tail-tip', 'Ma Thú — Chóp Đuôi Gai', 'scenes-action-25d/monster/tail-tip.png', 176, 103],
  ['asset-act-monster-thigh-r', 'Ma Thú — Đùi Trước Gần', 'scenes-action-25d/monster/thigh-r.png', 151, 158],
  ['asset-act-monster-shin-r', 'Ma Thú — Chân Trước Gần', 'scenes-action-25d/monster/shin-r.png', 166, 160],
  ['asset-act-monster-torso', 'Ma Thú — Ngực Giáp Hắc Ám', 'scenes-action-25d/monster/torso.png', 272, 240],
  ['asset-act-monster-pelvis', 'Ma Thú — Đai Hông', 'scenes-action-25d/monster/pelvis.png', 196, 135],
  ['asset-act-monster-jaw', 'Ma Thú — Hàm Răng Nanh', 'scenes-action-25d/monster/jaw.png', 112, 87],
  ['asset-act-monster-head', 'Ma Thú — Đầu Sừng Quái Vật', 'scenes-action-25d/monster/head.png', 190, 204],
  ['asset-act-monster-arm-r', 'Ma Thú — Bắp Tay Trước Gần', 'scenes-action-25d/monster/arm-r.png', 162, 174],
  ['asset-act-monster-forearm-r', 'Ma Thú — Đại Trảo Trước Gần', 'scenes-action-25d/monster/forearm-r.png', 208, 210],

  ['asset-act-eagle-wing-r', 'Linh Ưng — Cánh Sau', 'scenes-action-25d/eagle/wing-r.png', 325, 289],
  ['asset-act-eagle-body', 'Linh Ưng — Thân Đầu & Móng', 'scenes-action-25d/eagle/bird-body.png', 340, 307],
  ['asset-act-eagle-wing-l', 'Linh Ưng — Cánh Trước', 'scenes-action-25d/eagle/wing-l.png', 355, 343]
]

export const DEFAULT_HANBETA_ASSETS: AssetMeta[] = RAW_ACTION_ASSETS.map(([id, name, assetPath, width, height]) => ({
  id,
  name,
  kind: 'image',
  mime: 'image/png',
  width,
  height,
  path: `assets/${assetPath}`,
  assetPath
}))

export interface CompositeClusterHandles {
  instanceId: string
  root: ImageLayer
  layers: ImageLayer[]
  bySourceId: Map<string, ImageLayer>
  globalScale: number
  footOffsetY: number
}

export interface HanbetaStageHandles {
  hero1: CompositeClusterHandles
  wolf1: CompositeClusterHandles
  eagle1: CompositeClusterHandles
  s1MistMid: ImageLayer
  s1PineLanternMid: ImageLayer
  s1StoneLanternMid: ImageLayer
  s1PillarFg: ImageLayer
  s1Bg: ImageLayer
  hero2: CompositeClusterHandles
  wolf2: CompositeClusterHandles
  monster2: CompositeClusterHandles
  s2MistMid: ImageLayer
  s2Shockwave: ImageLayer
  s2ObeliskFg: ImageLayer
  s2PillarFg: ImageLayer
  s2Bg: ImageLayer
  hero3: CompositeClusterHandles
  wolf3: CompositeClusterHandles
  monster3: CompositeClusterHandles
  eagle3: CompositeClusterHandles
  s3SwordCrescent: ImageLayer
  s3ImpactBurst: ImageLayer
  s3ObeliskFg: ImageLayer
  s3PillarFg: ImageLayer
  s3Bg: ImageLayer
}

interface PlateOpts {
  name: string
  pos: Vec3
  scale: number | [number, number, number]
  inPoint: number
  outPoint: number
  fadeIn?: number
  fadeOut?: number
  opacity?: number
  blendMode?: ImageLayer['blendMode']
  autoScale?: boolean
  virtualLight?: LayerVirtualLight
  depthPortal?: DepthPortalConfig
}

function addPlate(project: Project, asset: AssetMeta, shotId: string, opts: PlateOpts): ImageLayer {
  const layer = createImageLayer(asset, project.comp, opts.pos[2], shotId)
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.fadeIn = opts.fadeIn ?? 0.16
  layer.fadeOut = opts.fadeOut ?? 0.16
  layer.blendMode = opts.blendMode ?? 'normal'
  if (opts.autoScale !== undefined) layer.autoScale = opts.autoScale
  layer.transform.position.value = [...opts.pos]
  layer.transform.scale.value = Array.isArray(opts.scale) ? [...opts.scale] : [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  if (opts.virtualLight) layer.virtualLight = opts.virtualLight
  if (opts.depthPortal) {
    layer.physics = {
      enabled: true,
      material: 'none',
      depthPortal: opts.depthPortal
    }
  }
  project.layers.push(layer)
  return layer
}

function instantiateCompositeCluster(
  project: Project,
  byAssetPath: Map<string, AssetMeta>,
  composite: LayerComposite,
  shotId: string,
  opts: {
    instanceId: string
    instanceName: string
    center?: Vec3
    groundFoot?: { screenX: number; screenFootY: number; z: number }
    footOffsetY?: number
    globalScale: number
    inPoint: number
    outPoint: number
  }
): CompositeClusterHandles {
  const gs = opts.globalScale
  const footOffsetY = opts.footOffsetY ?? 0
  const rootBoneId = composite.rig?.bones[0]?.id
  const rootItem =
    composite.layers.find((it) => !it.hidden && it.boneId === rootBoneId) ?? composite.layers[0]
  const rootOff: Vec3 = [
    r2(rootItem.x * gs),
    r2(-rootItem.y * gs),
    r2(-(rootItem.z ?? 0) * COMPOSITE_Z_FACTOR * gs)
  ]

  let center: Vec3
  if (opts.groundFoot) {
    const refDist = referenceDistance(project.comp)
    const persp = refDist / Math.max(80, opts.groundFoot.z + refDist)
    const solved = projectCorridorFootToWorld(
      project.comp,
      opts.groundFoot.screenX,
      opts.groundFoot.screenFootY,
      opts.groundFoot.z,
      gs * persp,
      footOffsetY
    )
    center = [
      r2(solved.x - rootOff[0]),
      r2(solved.y - rootOff[1]),
      r2(solved.z - rootOff[2])
    ]
  } else {
    center = opts.center ?? [0, 0, 180]
  }

  const [cx, cy, cz] = center
  const builtLayers: ImageLayer[] = []
  const bySourceId = new Map<string, ImageLayer>()

  for (const item of composite.layers) {
    const asset = item.assetPath ? byAssetPath.get(item.assetPath) : undefined
    if (!asset) throw new Error(`Missing composite asset ${item.assetPath} for ${composite.id}`)
    const off: Vec3 = [r2(item.x * gs), r2(-item.y * gs), r2(-(item.z ?? 0) * COMPOSITE_Z_FACTOR * gs)]
    const pos: Vec3 = [r2(cx + off[0]), r2(cy + off[1]), r2(cz + off[2])]
    const layer = createImageLayer(asset, project.comp, pos[2], shotId)
    layer.autoScale = false
    layer.name = `[${opts.instanceName}] ${item.name}`
    layer.visible = !item.hidden
    layer.inPoint = opts.inPoint
    layer.outPoint = opts.outPoint
    layer.fadeIn = 0.12
    layer.fadeOut = 0.12
    layer.transform.position.value = pos
    layer.transform.scale.value = [r3(item.scale * gs), r3(item.scale * gs), 1]
    layer.transform.rotation.value = [0, 0, item.rotation ?? 0]
    layer.transform.opacity.value = item.opacity
    layer.composite = {
      instanceId: opts.instanceId,
      compositeId: composite.id,
      compositeName: composite.name,
      isRoot: item.id === rootItem.id,
      lockedGroup: true,
      centerPosition: [...center],
      rootOffset: off,
      sourceLayerId: item.id,
      ...(item.slot ? { slot: item.slot, variant: item.variant } : {}),
      ...(item.partGroupId ? { partGroupId: item.partGroupId } : {})
    }
    project.layers.push(layer)
    builtLayers.push(layer)
    bySourceId.set(item.id, layer)
  }

  const root = bySourceId.get(rootItem.id) ?? builtLayers[0]
  return { instanceId: opts.instanceId, root, layers: builtLayers, bySourceId, globalScale: gs, footOffsetY }
}

function addShotParticles(
  project: Project,
  shotId: string,
  name: string,
  inPoint: number,
  outPoint: number,
  color: string,
  velocity: Vec3,
  count: number,
  seed: number
): ParticleLayer {
  const p = createParticleLayer(project.comp)
  p.name = name
  p.shotId = shotId
  p.inPoint = inPoint
  p.outPoint = outPoint
  p.fadeIn = 0.2
  p.fadeOut = 0.2
  p.transform.position.value = [0, 0, 260]
  p.props = {
    ...p.props,
    count,
    seed,
    size: 4.5,
    color,
    area: [2200, 1250, 1400],
    velocity,
    sway: 18,
    twinkle: true,
    glow: true
  }
  project.layers.push(p)
  return p
}

/**
 * Lộ trình Camera điện ảnh đa nhịp (gọi SAU khi đã bake quỹ đạo nhân vật 2.5D):
 * Kết hợp mở hành lang chiều sâu, lia bám chủ thể (track_subject), nhảy tiếp hướng (match_cut),
 * lia vút (whip_pan), phóng to/thu nhỏ va chạm kèm Hitstop & Dutch Roll (punch_zoom), và xoay lượn thị sai (orbit_parallax).
 */
export function setupHanbetaCameraRoute(project: Project, shots: Shot[]): void {
  const [s1, s2, s3] = shots
  const beats: CinematicCameraBeat[] = [
    {
      shotId: s1.id,
      kind: 'establish_corridor',
      start: 0.0,
      end: 1.5,
      subjectId: 'act-hero-1',
      startScale: 0.96,
      endScale: 0.88,
      yawStart: -4.2,
      yawEnd: -1.4,
      pitchStart: 2.8,
      pitchEnd: 1.0,
      fovStart: 42,
      fovEnd: 40,
      offsetStart: [35, -135],
      offsetEnd: [30, -65]
    },
    {
      shotId: s1.id,
      kind: 'track_subject',
      start: 1.5,
      end: 4.7,
      subjectId: 'act-hero-1',
      startScale: 0.88,
      endScale: 0.88,
      yawStart: -1.4,
      yawEnd: 4.2,
      pitchStart: 1.0,
      pitchEnd: -1.8,
      fovStart: 40,
      fovEnd: 38.5,
      offsetStart: [30, -55],
      offsetEnd: [55, 22]
    },
    {
      shotId: s1.id,
      kind: 'match_cut',
      start: 4.7,
      end: 5.5,
      subjectId: 'act-hero-1',
      continuityDirX: 1,
      startScale: 0.88,
      endScale: 0.78,
      yawStart: 4.2,
      yawEnd: 6.2,
      rollEnd: 1.4,
      offsetStart: [55, 22],
      offsetEnd: [125, 18],
      cutAtEnd: true
    },

    {
      shotId: s2.id,
      kind: 'match_cut',
      start: 5.5,
      end: 6.35,
      subjectId: 'act-hero-2',
      continuityDirX: 1,
      startScale: 0.96,
      endScale: 0.86,
      yawStart: -4.2,
      yawEnd: -0.4,
      rollStart: 1.2,
      rollEnd: 0,
      offsetStart: [-55, 18],
      offsetEnd: [45, 14]
    },
    {
      shotId: s2.id,
      kind: 'whip_pan',
      start: 6.35,
      end: 7.55,
      subjectId: 'act-hero-2',
      secondarySubjectId: 'act-monster-2',
      startScale: 0.86,
      endScale: 0.84,
      yawStart: -0.4,
      yawEnd: -3.4,
      fovStart: 40,
      fovEnd: 39,
      offsetStart: [45, 14],
      offsetEnd: [-35, 20]
    },
    {
      shotId: s2.id,
      kind: 'punch_zoom',
      start: 7.55,
      end: 10.25,
      subjectId: 'act-monster-2',
      secondarySubjectId: 'act-hero-2',
      impactRatio: 0.25,
      hitstopSec: 0.14,
      impactShakePx: 18,
      startScale: 0.84,
      impactScale: 0.66,
      endScale: 0.91,
      yawStart: -3.4,
      yawEnd: 2.6,
      rollImpact: -2.8,
      fovStart: 39,
      fovImpact: 35,
      fovEnd: 40
    },
    {
      shotId: s2.id,
      kind: 'match_cut',
      start: 10.25,
      end: 11.0,
      subjectId: 'act-hero-2',
      continuityDirX: 1,
      startScale: 0.91,
      endScale: 0.8,
      yawStart: 2.6,
      yawEnd: 4.8,
      rollEnd: 1.5,
      offsetEnd: [110, 14],
      cutAtEnd: true
    },

    {
      shotId: s3.id,
      kind: 'track_subject',
      start: 11.0,
      end: 12.45,
      subjectId: 'act-hero-3',
      startScale: 0.94,
      endScale: 0.8,
      yawStart: -3.8,
      yawEnd: 1.6,
      pitchStart: 1.2,
      pitchEnd: -1.4,
      fovStart: 41,
      fovEnd: 39
    },
    {
      shotId: s3.id,
      kind: 'punch_zoom',
      start: 12.45,
      end: 14.55,
      subjectId: 'act-hero-3',
      secondarySubjectId: 'act-monster-3',
      impactRatio: 0.39,
      hitstopSec: 0.16,
      impactShakePx: 22,
      startScale: 0.8,
      impactScale: 0.64,
      endScale: 0.88,
      yawStart: 1.6,
      yawEnd: -3.6,
      rollImpact: 3.1,
      fovStart: 39,
      fovImpact: 34.5,
      fovEnd: 39.5
    },
    {
      shotId: s3.id,
      kind: 'orbit_parallax',
      start: 14.55,
      end: 16.5,
      subjectId: 'act-hero-3',
      secondarySubjectId: 'act-monster-3',
      startScale: 0.88,
      endScale: 0.98,
      yawStart: -3.6,
      yawEnd: 4.8,
      pitchStart: -1.8,
      pitchEnd: 1.5,
      fovStart: 39.5,
      fovEnd: 41,
      offsetStart: [30, 12],
      offsetEnd: [15, 18]
    }
  ]

  choreographCinematicCameraRoute(project, beats, { clearExisting: true })
}

function populateShot1Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>
) {
  const s1PillarFg = addPlate(project, byId.get('asset-act-fg-pillar')!, shot.id, {
    name: 'Tiền Cảnh Cột Đá Cổ Tích 1',
    pos: [-825, -255, -230],
    scale: 0.78,
    inPoint: 0,
    outPoint: 5.5
  })
  const s1StoneLanternMid = addPlate(project, byId.get('asset-act-mid-stone-lantern')!, shot.id, {
    name: 'Tiền Cảnh Phải Thạch Đăng Rêu Phong',
    pos: [775, -355, -180],
    scale: 1.12,
    inPoint: 0,
    outPoint: 5.5,
    virtualLight: {
      enabled: true,
      kind: 'candle',
      color: '#ff9e3d',
      intensity: 0.95,
      radius: 480,
      originUV: [0.52, 0.34],
      zReachFront: 260,
      zReachBack: 520,
      ambientDim: 0.06,
      behaviorMode: 'subtle_flicker'
    }
  })
  const s1PineLanternMid = addPlate(project, byId.get('asset-act-mid-pine-lantern')!, shot.id, {
    name: 'Trung Cảnh Tùng Cổ Vách Đá & Lồng Đèn Ấm',
    pos: [770, 160, 340],
    scale: [-1.14, 1.14, 1],
    inPoint: 0,
    outPoint: 5.5,
    virtualLight: {
      enabled: true,
      kind: 'candle',
      color: '#ffab47',
      intensity: 1.2,
      radius: 640,
      originUV: [0.36, 0.68],
      zReachFront: 420,
      zReachBack: 680,
      ambientDim: 0.08,
      behaviorMode: 'wind_reactive',
      windPreset: 'gentle'
    }
  })
  const s1MistMid = addPlate(project, byId.get('asset-act-mid-valley-mist')!, shot.id, {
    name: 'Mây Sương Họng Đèo (Z=980)',
    pos: [-155, 18, 980],
    scale: 1.32,
    opacity: 0.42,
    inPoint: 0,
    outPoint: 5.5
  })

  const hero1 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-1',
    instanceName: 'Kiếm Khách Cảnh 1',
    groundFoot: { screenX: -142, screenFootY: 38, z: 2050 },
    footOffsetY: HERO_FOOT_OFFSET_Y,
    globalScale: 0.44,
    inPoint: 0,
    outPoint: 5.5
  })
  const wolf1 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-1',
    instanceName: 'Linh Lang Cảnh 1',
    groundFoot: { screenX: -98, screenFootY: 6, z: 1900 },
    footOffsetY: WOLF_FOOT_OFFSET_Y,
    globalScale: 0.45,
    inPoint: 0,
    outPoint: 5.5
  })
  const eagle1 = instantiateCompositeCluster(project, byPath, SPIRIT_EAGLE_25D_COMPOSITE, shot.id, {
    instanceId: 'act-eagle-1',
    instanceName: 'Linh Ưng Cảnh 1',
    center: [-460, 320, 1180],
    globalScale: 0.56,
    inPoint: 0,
    outPoint: 5.5
  })
  const s1Bg = addPlate(project, byId.get('asset-act-bg-s1')!, shot.id, {
    name: 'Nền Đèo Sương Cổ Mộ',
    pos: [0, 0, 2400],
    scale: 1.18,
    inPoint: 0,
    outPoint: 5.5,
    fadeIn: 0.1,
    depthPortal: {
      enabled: true,
      centerUV: [0.43, 0.48],
      radiusUV: [0.28, 0.34],
      minScale: 0.96,
      darkness: 0.38,
      shadowTint: '#16233d',
      depthPullZ: 0,
      archShape: 'arch',
      feather: 0.68
    }
  })
  addShotParticles(project, shot.id, 'Linh Khí Đèo Sương', 0, 5.5, '#7dd3fc', [-16, 12, 0], 150, 5101)
  return { hero1, wolf1, eagle1, s1MistMid, s1PineLanternMid, s1StoneLanternMid, s1PillarFg, s1Bg }
}

function populateShot2Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>
) {
  const s2ObeliskFg = addPlate(project, byId.get('asset-act-fg-seal-obelisk')!, shot.id, {
    name: 'Tiền Cảnh Trụ Đá Phù Văn Trái',
    pos: [-790, -280, -235],
    scale: 1.08,
    inPoint: 5.5,
    outPoint: 11.0,
    virtualLight: {
      enabled: true,
      kind: 'magic_orb',
      color: '#c084fc',
      intensity: 0.85,
      radius: 440,
      zReachBack: 520,
      ambientDim: 0.05,
      behaviorMode: 'breathing'
    }
  })
  const s2PillarFg = addPlate(project, byId.get('asset-act-fg-pillar')!, shot.id, {
    name: 'Tiền Cảnh Cột Đá Phong Ấn Phải',
    pos: [805, -260, -215],
    scale: 0.74,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const s2Shockwave = addPlate(project, byId.get('asset-act-vfx-roar')!, shot.id, {
    name: 'Sóng Gầm Ma Thú VFX',
    pos: [175, -55, 175],
    scale: 0.82,
    inPoint: 7.65,
    outPoint: 10.9,
    blendMode: 'add',
    opacity: 0.94,
    virtualLight: {
      enabled: true,
      kind: 'magic_orb',
      color: '#d946ef',
      intensity: 1.2,
      radius: 640,
      zReachFront: 360,
      zReachBack: 480,
      ambientDim: 0.08,
      behaviorMode: 'breathing'
    }
  })
  const hero2 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-2',
    instanceName: 'Kiếm Khách Cảnh 2',
    groundFoot: { screenX: -395, screenFootY: -235, z: 380 },
    footOffsetY: HERO_FOOT_OFFSET_Y,
    globalScale: 0.72,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const monster2 = instantiateCompositeCluster(project, byPath, SHADOW_MONSTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-monster-2',
    instanceName: 'Ma Thú Cảnh 2',
    groundFoot: { screenX: 315, screenFootY: -245, z: 340 },
    footOffsetY: MONSTER_FOOT_OFFSET_Y,
    globalScale: 0.9,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const wolf2 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-2',
    instanceName: 'Linh Lang Cảnh 2',
    groundFoot: { screenX: -520, screenFootY: -265, z: 450 },
    footOffsetY: WOLF_FOOT_OFFSET_Y,
    globalScale: 0.72,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const s2MistMid = addPlate(project, byId.get('asset-act-mid-valley-mist')!, shot.id, {
    name: 'Khói Phong Ấn Cổ Điện (Z=590)',
    pos: [35, -105, 590],
    scale: 1.55,
    opacity: 0.45,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const s2Bg = addPlate(project, byId.get('asset-act-bg-s2')!, shot.id, {
    name: 'Nền Sân Cổ Phong Ấn',
    pos: [0, 0, 2400],
    scale: 1.18,
    inPoint: 5.5,
    outPoint: 11.0,
    depthPortal: {
      enabled: true,
      centerUV: [0.5, 0.44],
      radiusUV: [0.34, 0.3],
      minScale: 0.97,
      darkness: 0.32,
      shadowTint: '#241133',
      depthPullZ: 0,
      archShape: 'arch',
      feather: 0.65
    }
  })
  addShotParticles(project, shot.id, 'Tàn Tro Phong Ấn', 5.5, 11.0, '#c084fc', [-18, 22, 0], 160, 5202)
  return { hero2, wolf2, monster2, s2MistMid, s2Shockwave, s2ObeliskFg, s2PillarFg, s2Bg }
}

function populateShot3Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>,
  duration: number
) {
  const s3ObeliskFg = addPlate(project, byId.get('asset-act-fg-seal-obelisk')!, shot.id, {
    name: 'Tiền Cảnh Trụ Đá Huyết Ấn Phải',
    pos: [795, -285, -230],
    scale: 1.06,
    inPoint: 11.0,
    outPoint: duration
  })
  const s3PillarFg = addPlate(project, byId.get('asset-act-fg-pillar')!, shot.id, {
    name: 'Tiền Cảnh Cột Đá Quyết Chiến Trái',
    pos: [-815, -265, -215],
    scale: 0.72,
    inPoint: 11.0,
    outPoint: duration
  })
  const s3ImpactBurst = addPlate(project, byId.get('asset-act-vfx-impact')!, shot.id, {
    name: 'Tia Lửa Giao Kiếm VFX',
    pos: [125, -85, 156],
    scale: 0.88,
    inPoint: 13.2,
    outPoint: 15.6,
    blendMode: 'add',
    opacity: 0.96
  })
  const s3SwordCrescent = addPlate(project, byId.get('asset-act-vfx-crescent')!, shot.id, {
    name: 'Kiếm Khí Nguyệt Trảm VFX',
    pos: [-95, -95, 162],
    scale: 0.86,
    inPoint: 12.25,
    outPoint: 15.8,
    blendMode: 'add',
    opacity: 0.98,
    virtualLight: {
      enabled: true,
      kind: 'magic_orb',
      color: '#38bdf8',
      intensity: 1.35,
      radius: 560,
      zReachFront: 320,
      zReachBack: 440,
      ambientDim: 0.06,
      behaviorMode: 'steady'
    }
  })
  const hero3 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-3',
    instanceName: 'Kiếm Khách Cảnh 3',
    groundFoot: { screenX: -315, screenFootY: -315, z: 300 },
    footOffsetY: HERO_FOOT_OFFSET_Y,
    globalScale: 0.74,
    inPoint: 11.0,
    outPoint: duration
  })
  const monster3 = instantiateCompositeCluster(project, byPath, SHADOW_MONSTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-monster-3',
    instanceName: 'Ma Thú Cảnh 3',
    groundFoot: { screenX: 295, screenFootY: -310, z: 280 },
    footOffsetY: MONSTER_FOOT_OFFSET_Y,
    globalScale: 0.9,
    inPoint: 11.0,
    outPoint: duration
  })
  const wolf3 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-3',
    instanceName: 'Linh Lang Cảnh 3',
    groundFoot: { screenX: -535, screenFootY: -345, z: 360 },
    footOffsetY: WOLF_FOOT_OFFSET_Y,
    globalScale: 0.72,
    inPoint: 11.0,
    outPoint: duration
  })
  const eagle3 = instantiateCompositeCluster(project, byPath, SPIRIT_EAGLE_25D_COMPOSITE, shot.id, {
    instanceId: 'act-eagle-3',
    instanceName: 'Linh Ưng Cảnh 3',
    center: [-430, 315, 580],
    globalScale: 0.56,
    inPoint: 11.0,
    outPoint: duration
  })
  const s3Bg = addPlate(project, byId.get('asset-act-bg-s3')!, shot.id, {
    name: 'Nền Đài Quyết Chiến Trăng Đỏ',
    pos: [0, 0, 2400],
    scale: 1.18,
    inPoint: 11.0,
    outPoint: duration,
    fadeOut: 0.1,
    depthPortal: {
      enabled: true,
      centerUV: [0.47, 0.36],
      radiusUV: [0.36, 0.3],
      minScale: 0.97,
      darkness: 0.28,
      shadowTint: '#2b0c19',
      depthPullZ: 0,
      archShape: 'ellipse',
      feather: 0.65
    }
  })
  addShotParticles(project, shot.id, 'Kiếm Hoa Quyết Chiến', 11.0, duration, '#38bdf8', [-24, 30, 0], 185, 5303)
  return { hero3, wolf3, monster3, eagle3, s3SwordCrescent, s3ImpactBurst, s3ObeliskFg, s3PillarFg, s3Bg }
}

export function populateHanbetaStage(
  project: Project,
  shots: Shot[],
  byId: Map<string, AssetMeta>,
  comp: Composition
): HanbetaStageHandles {
  const [s1, s2, s3] = shots
  const byPath = new Map<string, AssetMeta>()
  for (const asset of byId.values()) {
    if (asset.assetPath) byPath.set(asset.assetPath, asset)
  }
  return {
    ...populateShot1Stage(project, s1, byId, byPath),
    ...populateShot2Stage(project, s2, byId, byPath),
    ...populateShot3Stage(project, s3, byId, byPath, comp.duration)
  }
}
