import type { AssetMeta, Composition, EaseName, ImageLayer, ParticleLayer, Project, Shot, Vec3 } from '@shared/types'
import { addKeyframe, anim } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import {
  SHADOW_MONSTER_25D_COMPOSITE,
  SPIRIT_EAGLE_25D_COMPOSITE,
  SPIRIT_WOLF_25D_COMPOSITE,
  SWORD_HUNTER_25D_COMPOSITE
} from '../ui/layerAssembly/action25dComposites'
import type { LayerComposite } from '../ui/layerAssembly/types'
import { createImageLayer, createParticleLayer } from './factory'

const COMPOSITE_Z_FACTOR = 0.05
const r2 = (v: number): number => Math.round(v * 100) / 100
const r3 = (v: number): number => Math.round(v * 1000) / 1000

type AssetSpec = [id: string, name: string, assetPath: string, width: number, height: number]

const RAW_ACTION_ASSETS: AssetSpec[] = [
  ['asset-act-bg-s1', 'Bối cảnh Cảnh 1 — Đèo Sương Cổ Mộ', 'scenes-action-25d/env/bg_s1_misty_pass.png', 1920, 1080],
  ['asset-act-bg-s2', 'Bối cảnh Cảnh 2 — Sân Cổ Phong Ấn', 'scenes-action-25d/env/bg_s2_sealed_courtyard.png', 1920, 1080],
  ['asset-act-bg-s3', 'Bối cảnh Cảnh 3 — Đài Quyết Chiến Trăng Đỏ', 'scenes-action-25d/env/bg_s3_crimson_arena.png', 1920, 1080],
  ['asset-act-fg-pillar', 'Cột Đá Cổ Tích Tiền Cảnh', 'scenes-action-25d/env/fg-ruin-pillar.png', 713, 680],
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
}

export interface HanbetaStageHandles {
  hero1: CompositeClusterHandles
  wolf1: CompositeClusterHandles
  eagle1: CompositeClusterHandles
  s1PillarFg: ImageLayer
  s1Bg: ImageLayer
  hero2: CompositeClusterHandles
  wolf2: CompositeClusterHandles
  monster2: CompositeClusterHandles
  s2Shockwave: ImageLayer
  s2PillarFg: ImageLayer
  s2Bg: ImageLayer
  hero3: CompositeClusterHandles
  wolf3: CompositeClusterHandles
  monster3: CompositeClusterHandles
  eagle3: CompositeClusterHandles
  s3SwordCrescent: ImageLayer
  s3ImpactBurst: ImageLayer
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
}

function addPlate(project: Project, asset: AssetMeta, shotId: string, opts: PlateOpts): ImageLayer {
  const layer = createImageLayer(asset, project.comp, opts.pos[2], shotId)
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.fadeIn = opts.fadeIn ?? 0.16
  layer.fadeOut = opts.fadeOut ?? 0.16
  layer.blendMode = opts.blendMode ?? 'normal'
  layer.transform.position.value = [...opts.pos]
  layer.transform.scale.value = Array.isArray(opts.scale) ? [...opts.scale] : [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
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
    center: Vec3
    globalScale: number
    inPoint: number
    outPoint: number
  }
): CompositeClusterHandles {
  const [cx, cy, cz] = opts.center
  const gs = opts.globalScale
  const rootBoneId = composite.rig?.bones[0]?.id
  const rootItemId =
    composite.layers.find((it) => !it.hidden && it.boneId === rootBoneId)?.id ?? composite.layers[0].id
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
      isRoot: item.id === rootItemId,
      lockedGroup: true,
      centerPosition: [...opts.center],
      rootOffset: off,
      sourceLayerId: item.id,
      ...(item.slot ? { slot: item.slot, variant: item.variant } : {}),
      ...(item.partGroupId ? { partGroupId: item.partGroupId } : {})
    }
    project.layers.push(layer)
    builtLayers.push(layer)
    bySourceId.set(item.id, layer)
  }

  const root = bySourceId.get(rootItemId) ?? builtLayers[0]
  return { instanceId: opts.instanceId, root, layers: builtLayers, bySourceId }
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

interface CamPoseSpec {
  t: number
  shot: Shot
  dx: number
  dy: number
  scale: number
  yaw?: number
  pitch?: number
  roll?: number
  ease: EaseName
}

function addCameraPose(project: Project, spec: CamPoseSpec): void {
  const cam = project.camera
  const dist = referenceDistance(project.comp) * spec.scale
  const yawRad = ((spec.yaw ?? 0) * Math.PI) / 180
  const pitchRad = ((spec.pitch ?? 0) * Math.PI) / 180
  const [sx, sy, sz] = spec.shot.position.value
  const tx = sx + spec.dx
  const ty = sy + spec.dy
  const tz = sz
  const px = tx + dist * Math.sin(yawRad) * Math.cos(pitchRad)
  const py = ty + dist * Math.sin(pitchRad)
  const pz = tz - dist * Math.cos(yawRad) * Math.cos(pitchRad)

  addKeyframe(cam.target, spec.t, [Math.round(tx), Math.round(ty), Math.round(tz)], spec.ease)
  addKeyframe(cam.position, spec.t, [Math.round(px), Math.round(py), Math.round(pz)], spec.ease)
  addKeyframe(cam.focusDistance, spec.t, Math.round(dist), spec.ease)
  cam.roll ??= anim(0)
  addKeyframe(cam.roll, spec.t, spec.roll ?? 0, spec.ease)
}

export function setupHanbetaCameraRoute(project: Project, shots: Shot[]): void {
  const [s1, s2, s3] = shots
  const poses: CamPoseSpec[] = [
    { t: 0.0, shot: s1, dx: -120, dy: 0, scale: 0.98, yaw: -1.2, ease: 'easeInOut' },
    { t: 2.8, shot: s1, dx: 10, dy: 5, scale: 0.9, yaw: 1.2, ease: 'easeInOut' },
    { t: 4.85, shot: s1, dx: 85, dy: 15, scale: 0.84, yaw: 2.0, ease: 'hold' },
    { t: 5.5, shot: s2, dx: 10, dy: 0, scale: 0.98, yaw: 0, roll: 0, ease: 'easeOut' },
    { t: 7.75, shot: s2, dx: 45, dy: 12, scale: 0.8, yaw: -2.5, roll: -1.5, ease: 'easeInOut' },
    { t: 10.35, shot: s2, dx: 15, dy: 8, scale: 0.84, yaw: -1.2, roll: -0.8, ease: 'hold' },
    { t: 11.0, shot: s3, dx: 0, dy: 0, scale: 1.0, yaw: 1.5, roll: 0, ease: 'easeOut' },
    { t: 13.35, shot: s3, dx: 30, dy: 12, scale: 0.78, yaw: -3.0, roll: 1.6, ease: 'easeInOut' },
    { t: 15.4, shot: s3, dx: 10, dy: 0, scale: 0.94, yaw: 0, roll: 0, ease: 'easeInOut' }
  ]
  for (const pose of poses) addCameraPose(project, pose)
  project.camera.position.value = [...project.camera.position.keyframes[0].value]
  project.camera.target.value = [...project.camera.target.keyframes[0].value]
  project.camera.focusDistance.value = project.camera.focusDistance.keyframes[0].value
}

function populateShot1Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>
) {
  const s1PillarFg = addPlate(project, byId.get('asset-act-fg-pillar')!, shot.id, {
    name: 'Tiền Cảnh Cột Đá Cổ Tích 1',
    pos: [-760, -250, -220],
    scale: 0.76,
    inPoint: 0,
    outPoint: 5.5
  })
  const hero1 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-1',
    instanceName: 'Kiếm Khách Cảnh 1',
    center: [-520, -65, 180],
    globalScale: 0.72,
    inPoint: 0,
    outPoint: 5.5
  })
  const wolf1 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-1',
    instanceName: 'Linh Lang Cảnh 1',
    center: [-210, -175, 250],
    globalScale: 0.74,
    inPoint: 0,
    outPoint: 5.5
  })
  const eagle1 = instantiateCompositeCluster(project, byPath, SPIRIT_EAGLE_25D_COMPOSITE, shot.id, {
    instanceId: 'act-eagle-1',
    instanceName: 'Linh Ưng Cảnh 1',
    center: [-480, 255, 520],
    globalScale: 0.54,
    inPoint: 0,
    outPoint: 5.5
  })
  const s1Bg = addPlate(project, byId.get('asset-act-bg-s1')!, shot.id, {
    name: 'Nền Đèo Sương Cổ Mộ',
    pos: [0, 0, 2400],
    scale: 1.18,
    inPoint: 0,
    outPoint: 5.5,
    fadeIn: 0.1
  })
  addShotParticles(project, shot.id, 'Linh Khí Đèo Sương', 0, 5.5, '#7dd3fc', [-16, 12, 0], 150, 5101)
  return { hero1, wolf1, eagle1, s1PillarFg, s1Bg }
}

function populateShot2Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>
) {
  const s2PillarFg = addPlate(project, byId.get('asset-act-fg-pillar')!, shot.id, {
    name: 'Tiền Cảnh Cột Đá Phong Ấn 2',
    pos: [780, -255, -220],
    scale: 0.74,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const s2Shockwave = addPlate(project, byId.get('asset-act-vfx-roar')!, shot.id, {
    name: 'Sóng Gầm Ma Thú VFX',
    pos: [220, 15, 186],
    scale: 0.78,
    inPoint: 7.65,
    outPoint: 10.9,
    blendMode: 'add',
    opacity: 0.94
  })
  const hero2 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-2',
    instanceName: 'Kiếm Khách Cảnh 2',
    center: [-460, -65, 175],
    globalScale: 0.72,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const monster2 = instantiateCompositeCluster(project, byPath, SHADOW_MONSTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-monster-2',
    instanceName: 'Ma Thú Cảnh 2',
    center: [420, -42, 200],
    globalScale: 0.92,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const wolf2 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-2',
    instanceName: 'Linh Lang Cảnh 2',
    center: [-640, -185, 255],
    globalScale: 0.74,
    inPoint: 5.5,
    outPoint: 11.0
  })
  const s2Bg = addPlate(project, byId.get('asset-act-bg-s2')!, shot.id, {
    name: 'Nền Sân Cổ Phong Ấn',
    pos: [0, 0, 2400],
    scale: 1.18,
    inPoint: 5.5,
    outPoint: 11.0
  })
  addShotParticles(project, shot.id, 'Tàn Tro Phong Ấn', 5.5, 11.0, '#c084fc', [-18, 22, 0], 160, 5202)
  return { hero2, wolf2, monster2, s2Shockwave, s2PillarFg, s2Bg }
}

function populateShot3Stage(
  project: Project,
  shot: Shot,
  byId: Map<string, AssetMeta>,
  byPath: Map<string, AssetMeta>,
  duration: number
) {
  const s3ImpactBurst = addPlate(project, byId.get('asset-act-vfx-impact')!, shot.id, {
    name: 'Tia Lửa Giao Kiếm VFX',
    pos: [110, -15, 158],
    scale: 0.86,
    inPoint: 13.2,
    outPoint: 15.6,
    blendMode: 'add',
    opacity: 0.96
  })
  const s3SwordCrescent = addPlate(project, byId.get('asset-act-vfx-crescent')!, shot.id, {
    name: 'Kiếm Khí Nguyệt Trảm VFX',
    pos: [-65, -20, 162],
    scale: 0.84,
    inPoint: 12.25,
    outPoint: 15.8,
    blendMode: 'add',
    opacity: 0.98
  })
  const hero3 = instantiateCompositeCluster(project, byPath, SWORD_HUNTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-hero-3',
    instanceName: 'Kiếm Khách Cảnh 3',
    center: [-330, -65, 170],
    globalScale: 0.74,
    inPoint: 11.0,
    outPoint: duration
  })
  const monster3 = instantiateCompositeCluster(project, byPath, SHADOW_MONSTER_25D_COMPOSITE, shot.id, {
    instanceId: 'act-monster-3',
    instanceName: 'Ma Thú Cảnh 3',
    center: [340, -42, 195],
    globalScale: 0.92,
    inPoint: 11.0,
    outPoint: duration
  })
  const wolf3 = instantiateCompositeCluster(project, byPath, SPIRIT_WOLF_25D_COMPOSITE, shot.id, {
    instanceId: 'act-wolf-3',
    instanceName: 'Linh Lang Cảnh 3',
    center: [-620, -185, 250],
    globalScale: 0.74,
    inPoint: 11.0,
    outPoint: duration
  })
  const eagle3 = instantiateCompositeCluster(project, byPath, SPIRIT_EAGLE_25D_COMPOSITE, shot.id, {
    instanceId: 'act-eagle-3',
    instanceName: 'Linh Ưng Cảnh 3',
    center: [-440, 325, 480],
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
    fadeOut: 0.1
  })
  addShotParticles(project, shot.id, 'Kiếm Hoa Quyết Chiến', 11.0, duration, '#38bdf8', [-24, 30, 0], 185, 5303)
  return { hero3, wolf3, monster3, eagle3, s3SwordCrescent, s3ImpactBurst, s3Bg }
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
