import type { AssetMeta, Composition, EaseName, ImageLayer, ParticleLayer, Project, Shot, Vec3 } from '@shared/types'
import { addKeyframe, anim } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { createImageLayer, createParticleLayer } from './factory'

export const DEFAULT_HANBETA_ASSETS: AssetMeta[] = [
  {
    id: 'asset-hb-s1-bg',
    name: 'Cảnh 1 — Hành Lang Ký Túc Xá Đèn Đỏ',
    kind: 'image',
    mime: 'image/png',
    width: 1376,
    height: 768,
    path: 'assets/scenes-hanbeta-v2/bg-s1-red-corridor.png',
    assetPath: 'scenes-hanbeta-v2/bg-s1-red-corridor.png'
  },
  {
    id: 'asset-hb-s2-bg',
    name: 'Cảnh 2 — Cửa Phòng 404 Kính Mờ & Tờ Quy Tắc',
    kind: 'image',
    mime: 'image/png',
    width: 1376,
    height: 768,
    path: 'assets/scenes-hanbeta-v2/bg-s2-frosted-door-hall.png',
    assetPath: 'scenes-hanbeta-v2/bg-s2-frosted-door-hall.png'
  },
  {
    id: 'asset-hb-s3-bg',
    name: 'Cảnh 3 — Sân Thượng Trăng Máu Phá Cục',
    kind: 'image',
    mime: 'image/png',
    width: 1376,
    height: 768,
    path: 'assets/scenes-hanbeta-v2/bg-s3-crimson-rooftop.png',
    assetPath: 'scenes-hanbeta-v2/bg-s3-crimson-rooftop.png'
  },
  {
    id: 'asset-hb-coat-back',
    name: 'Nhân vật — Vạt Áo Khoác Bay Gió',
    kind: 'image',
    mime: 'image/png',
    width: 892,
    height: 768,
    path: 'assets/scenes-hanbeta-v2/hb-coat-back.png',
    assetPath: 'scenes-hanbeta-v2/hb-coat-back.png'
  },
  {
    id: 'asset-hb-torso-legs',
    name: 'Nhân vật — Thân & Chân Trụ',
    kind: 'image',
    mime: 'image/png',
    width: 384,
    height: 1224,
    path: 'assets/scenes-hanbeta-v2/hb-torso-legs.png',
    assetPath: 'scenes-hanbeta-v2/hb-torso-legs.png'
  },
  {
    id: 'asset-hb-arm-left',
    name: 'Nhân vật — Tay Trái',
    kind: 'image',
    mime: 'image/png',
    width: 276,
    height: 1044,
    path: 'assets/scenes-hanbeta-v2/hb-arm-left.png',
    assetPath: 'scenes-hanbeta-v2/hb-arm-left.png'
  },
  {
    id: 'asset-hb-arm-right-note',
    name: 'Nhân vật — Tay Phải Cầm Tờ Quy Tắc',
    kind: 'image',
    mime: 'image/png',
    width: 687,
    height: 808,
    path: 'assets/scenes-hanbeta-v2/hb-arm-right-note.png',
    assetPath: 'scenes-hanbeta-v2/hb-arm-right-note.png'
  },
  {
    id: 'asset-hb-head-calm',
    name: 'Biểu cảm — Điềm Tĩnh Phân Tích',
    kind: 'image',
    mime: 'image/png',
    width: 797,
    height: 984,
    path: 'assets/scenes-hanbeta-v2/hb-head-calm.png',
    assetPath: 'scenes-hanbeta-v2/hb-head-calm.png'
  },
  {
    id: 'asset-hb-head-smirk',
    name: 'Biểu cảm — Cười Nửa Miệng Thấu Thị',
    kind: 'image',
    mime: 'image/png',
    width: 796,
    height: 984,
    path: 'assets/scenes-hanbeta-v2/hb-head-smirk.png',
    assetPath: 'scenes-hanbeta-v2/hb-head-smirk.png'
  },
  {
    id: 'asset-hb-head-shock',
    name: 'Biểu cảm — Kinh Ngạc Quái Đàm',
    kind: 'image',
    mime: 'image/png',
    width: 796,
    height: 984,
    path: 'assets/scenes-hanbeta-v2/hb-head-shock.png',
    assetPath: 'scenes-hanbeta-v2/hb-head-shock.png'
  },
  {
    id: 'asset-hb-prop-lamp',
    name: 'Đèn Trần Hành Lang Đung Đưa',
    kind: 'image',
    mime: 'image/png',
    width: 636,
    height: 884,
    path: 'assets/scenes-hanbeta-v2/prop-hanging-lamp.png',
    assetPath: 'scenes-hanbeta-v2/prop-hanging-lamp.png'
  },
  {
    id: 'asset-hb-prop-shadow',
    name: 'Bóng Đen Thực Thể Sau Cửa',
    kind: 'image',
    mime: 'image/png',
    width: 770,
    height: 1006,
    path: 'assets/scenes-hanbeta-v2/prop-shadow-entity.png',
    assetPath: 'scenes-hanbeta-v2/prop-shadow-entity.png'
  },
  {
    id: 'asset-hb-prop-caution',
    name: 'Dây Cảnh Báo & Bùa Niêm Tiền Cảnh',
    kind: 'image',
    mime: 'image/png',
    width: 1376,
    height: 509,
    path: 'assets/scenes-hanbeta-v2/prop-caution-fg.png',
    assetPath: 'scenes-hanbeta-v2/prop-caution-fg.png'
  },
  {
    id: 'asset-hb-fx-seal',
    name: 'Ấn Triện Phá Giải Quy Tắc',
    kind: 'image',
    mime: 'image/png',
    width: 1024,
    height: 997,
    path: 'assets/scenes-hanbeta-v2/fx-rule-break-seal.png',
    assetPath: 'scenes-hanbeta-v2/fx-rule-break-seal.png'
  },
  {
    id: 'asset-hb-fx-mist',
    name: 'Sương Lạnh Quái Đàm',
    kind: 'image',
    mime: 'image/png',
    width: 960,
    height: 300,
    path: 'assets/scenes-hanbeta-v2/fx-eerie-mist.png',
    assetPath: 'scenes-hanbeta-v2/fx-eerie-mist.png'
  }
]

export interface HeroClusterHandles {
  instanceId: string
  torso: ImageLayer
  coatBack: ImageLayer
  armLeft: ImageLayer
  armRight: ImageLayer
  headCalm: ImageLayer
  headSmirk: ImageLayer
  headShock: ImageLayer
}

export interface HanbetaStageHandles {
  s1Bg: ImageLayer
  s1Shadow: ImageLayer
  s1Lamp: ImageLayer
  s1Mist: ImageLayer
  s1Caution: ImageLayer
  hero1: HeroClusterHandles
  s2Bg: ImageLayer
  s2Shadow: ImageLayer
  s2Lamp: ImageLayer
  s2Mist: ImageLayer
  s2Caution: ImageLayer
  hero2: HeroClusterHandles
  s3Bg: ImageLayer
  s3Seal: ImageLayer
  s3Shadow: ImageLayer
  s3Mist: ImageLayer
  s3Caution: ImageLayer
  hero3: HeroClusterHandles
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
  layer.fadeIn = opts.fadeIn ?? 0.2
  layer.fadeOut = opts.fadeOut ?? 0.2
  layer.blendMode = opts.blendMode ?? 'normal'
  layer.transform.position.value = [...opts.pos]
  const sc: Vec3 = Array.isArray(opts.scale) ? [...opts.scale] : [opts.scale, opts.scale, 1]
  layer.transform.scale.value = sc
  layer.transform.opacity.value = opts.opacity ?? 1
  project.layers.push(layer)
  return layer
}

function makePartRef(
  instanceId: string,
  centerPosition: Vec3,
  rootOffset: Vec3,
  sourceLayerId: string,
  extra: Partial<NonNullable<ImageLayer['composite']>> = {}
): NonNullable<ImageLayer['composite']> {
  return {
    instanceId,
    compositeId: 'hanbeta-detective-hero',
    compositeName: 'Thám Tử Quy Tắc (Hàn Bối Tháp)',
    lockedGroup: true,
    centerPosition: [...centerPosition],
    rootOffset: [...rootOffset],
    sourceLayerId,
    ...extra
  }
}

function addHeroCluster(
  project: Project,
  byId: Map<string, AssetMeta>,
  shotId: string,
  opts: {
    instanceId: string
    instanceName: string
    center: Vec3
    scaleMul?: number
    inPoint: number
    outPoint: number
  }
): HeroClusterHandles {
  const m = opts.scaleMul ?? 1.0
  const [cx, cy, cz] = opts.center
  const part = (
    assetId: string,
    name: string,
    offset: Vec3,
    scale: number,
    sourceLayerId: string,
    extra: Partial<NonNullable<ImageLayer['composite']>> = {},
    opacity = 1
  ): ImageLayer => {
    const pos: Vec3 = [cx + offset[0], cy + offset[1], cz + offset[2]]
    const l = addPlate(project, byId.get(assetId)!, shotId, {
      name,
      pos,
      scale,
      inPoint: opts.inPoint,
      outPoint: opts.outPoint,
      fadeIn: 0.15,
      fadeOut: 0.15,
      opacity
    })
    l.composite = makePartRef(opts.instanceId, opts.center, offset, sourceLayerId, extra)
    return l
  }

  // Đặt headCalm đầu tiên để part_swap nhận diện đây là biểu cảm mặc định (groupPool[0]).
  const headOffset: Vec3 = [0 * m, 344 * m, -2]
  const headCalm = part(
    'asset-hb-head-calm',
    `${opts.instanceName} · Mặt Điềm Tĩnh`,
    headOffset,
    0.19 * m,
    'head-calm',
    { slot: 'expression', partGroupId: 'part-expression', variant: 'calm' },
    1
  )
  const headSmirk = part(
    'asset-hb-head-smirk',
    `${opts.instanceName} · Mặt Cười Nửa Miệng`,
    headOffset,
    0.19 * m,
    'head-smirk',
    { slot: 'expression', partGroupId: 'part-expression', variant: 'smirk' },
    0
  )
  const headShock = part(
    'asset-hb-head-shock',
    `${opts.instanceName} · Mặt Kinh Ngạc`,
    headOffset,
    0.19 * m,
    'head-shock',
    { slot: 'expression', partGroupId: 'part-expression', variant: 'shock' },
    0
  )
  const armRight = part(
    'asset-hb-arm-right-note',
    `${opts.instanceName} · Tay Cầm Tờ Quy Tắc`,
    [16 * m, 214 * m, -4],
    0.40 * m,
    'arm-r'
  )
  const torso = part(
    'asset-hb-torso-legs',
    `${opts.instanceName} · Thân & Chân`,
    [0, 0, 0],
    0.52 * m,
    'torso',
    { isRoot: true }
  )
  const armLeft = part(
    'asset-hb-arm-left',
    `${opts.instanceName} · Tay Trái`,
    [54 * m, 106 * m, 4],
    0.31 * m,
    'arm-l'
  )
  const coatBack = part(
    'asset-hb-coat-back',
    `${opts.instanceName} · Vạt Áo Khoác`,
    [-110 * m, -125 * m, 8],
    0.38 * m,
    'coat-back'
  )

  return {
    instanceId: opts.instanceId,
    torso,
    coatBack,
    armLeft,
    armRight,
    headCalm,
    headSmirk,
    headShock
  }
}

function addShotParticles(
  project: Project,
  shotId: string,
  name: string,
  inPoint: number,
  outPoint: number,
  color: string,
  velocity: Vec3,
  count = 160
): ParticleLayer {
  const p = createParticleLayer(project.comp)
  p.name = name
  p.shotId = shotId
  p.inPoint = inPoint
  p.outPoint = outPoint
  p.fadeIn = 0.25
  p.fadeOut = 0.25
  p.transform.position.value = [0, 0, 260]
  p.props = {
    ...p.props,
    count,
    seed: inPoint < 4 ? 4041 : 4049,
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
    // Cảnh 1 (0..5s): Trôi rình rập -> ép cận ánh mắt cười nửa miệng khi đọc ra kẽ hở quy tắc
    { t: 0.0, shot: s1, dx: 20, dy: 10, scale: 1.0, yaw: -1.5, ease: 'easeInOut' },
    { t: 2.3, shot: s1, dx: -165, dy: 45, scale: 0.78, yaw: 2.0, ease: 'easeOut' },
    { t: 4.35, shot: s1, dx: -245, dy: 145, scale: 0.56, yaw: 3.5, roll: -1.2, ease: 'hold' },
    // Cảnh 2 (5..10s): Cắt dứt khoát + Comic Punch-In giật lùi khi Thực Thể áp sát sau cửa 404
    { t: 5.0, shot: s2, dx: 0, dy: 10, scale: 0.96, yaw: 0, roll: 0, ease: 'easeOut' },
    { t: 5.45, shot: s2, dx: -55, dy: 48, scale: 0.74, yaw: -3.0, roll: -2.2, ease: 'easeInOut' },
    { t: 9.2, shot: s2, dx: -35, dy: 58, scale: 0.7, yaw: -2.0, roll: -2.5, ease: 'hold' },
    // Cảnh 3 (10..15s): Sân thượng Trăng Máu — đẩy chéo Ấn Triện -> kéo rộng kết màn anh hùng
    { t: 10.0, shot: s3, dx: 20, dy: 0, scale: 1.02, yaw: 2.0, roll: 0, ease: 'easeOut' },
    { t: 10.65, shot: s3, dx: 35, dy: 18, scale: 0.78, yaw: -4.2, roll: 1.4, ease: 'easeInOut' },
    { t: 13.4, shot: s3, dx: 0, dy: 0, scale: 0.96, yaw: 0, roll: 0, ease: 'easeInOut' }
  ]
  for (const pose of poses) addCameraPose(project, pose)
  project.camera.position.value = [...project.camera.position.keyframes[0].value]
  project.camera.target.value = [...project.camera.target.keyframes[0].value]
  project.camera.focusDistance.value = project.camera.focusDistance.keyframes[0].value
}

export function populateHanbetaStage(
  project: Project,
  shots: Shot[],
  byId: Map<string, AssetMeta>,
  comp: Composition
): HanbetaStageHandles {
  const [s1, s2, s3] = shots

  // ── CẢNH 1: Hành Lang Ký Túc Xá Đèn Đỏ (0..5s) ──
  const s1Caution = addPlate(project, byId.get('asset-hb-prop-caution')!, s1.id, {
    name: 'Tiền Cảnh Dây Niêm Cảnh Báo 1',
    pos: [20, 415, -180],
    scale: 1.05,
    inPoint: 0,
    outPoint: 5.0
  })
  const s1Mist = addPlate(project, byId.get('asset-hb-fx-mist')!, s1.id, {
    name: 'Sương Lạnh Hành Lang 1',
    pos: [0, -430, -80],
    scale: 2.25,
    inPoint: 0,
    outPoint: 5.0,
    opacity: 0.5
  })
  const hero1 = addHeroCluster(project, byId, s1.id, {
    instanceId: 'hb-hero-1',
    instanceName: 'Thám Tử Cảnh 1',
    center: [-260, -170, 280],
    inPoint: 0,
    outPoint: 5.0
  })
  const s1Lamp = addPlate(project, byId.get('asset-hb-prop-lamp')!, s1.id, {
    name: 'Đèn Trần Hành Lang 1',
    pos: [30, 325, 700],
    scale: 0.31,
    inPoint: 0,
    outPoint: 5.0
  })
  const s1Shadow = addPlate(project, byId.get('asset-hb-prop-shadow')!, s1.id, {
    name: 'Bóng Đen Rình Rập 1',
    pos: [380, -40, 1450],
    scale: 0.44,
    inPoint: 0,
    outPoint: 5.0,
    opacity: 0.58
  })
  const s1Bg = addPlate(project, byId.get('asset-hb-s1-bg')!, s1.id, {
    name: 'Nền Hành Lang Đèn Đỏ',
    pos: [0, 0, 2400],
    scale: 1.52,
    inPoint: 0,
    outPoint: 5.0,
    fadeIn: 0.1
  })
  addShotParticles(project, s1.id, 'Bụi Đèn Đỏ Hành Lang', 0, 5.0, '#ff7a6b', [-10, 14, 0], 140)

  // ── CẢNH 2: Cửa Phòng 404 Kính Mờ (5..10s) ──
  const s2Caution = addPlate(project, byId.get('asset-hb-prop-caution')!, s2.id, {
    name: 'Tiền Cảnh Bùa Niêm Cửa 404',
    pos: [10, 420, -180],
    scale: 1.05,
    inPoint: 5.0,
    outPoint: 10.0
  })
  const s2Mist = addPlate(project, byId.get('asset-hb-fx-mist')!, s2.id, {
    name: 'Sương Lạnh Phòng 404',
    pos: [0, -420, -60],
    scale: 2.25,
    inPoint: 5.0,
    outPoint: 10.0,
    opacity: 0.54
  })
  const hero2 = addHeroCluster(project, byId, s2.id, {
    instanceId: 'hb-hero-2',
    instanceName: 'Thám Tử Cảnh 2',
    center: [-290, -160, 260],
    inPoint: 5.0,
    outPoint: 10.0
  })
  const s2Lamp = addPlate(project, byId.get('asset-hb-prop-lamp')!, s2.id, {
    name: 'Đèn Trần Phòng 404',
    pos: [-25, 325, 620],
    scale: 0.29,
    inPoint: 5.0,
    outPoint: 10.0
  })
  const s2Shadow = addPlate(project, byId.get('asset-hb-prop-shadow')!, s2.id, {
    name: 'Thực Thể Áp Sát Cửa 404',
    pos: [240, 0, 950],
    scale: 0.72,
    inPoint: 5.0,
    outPoint: 10.0,
    opacity: 0.9
  })
  const s2Bg = addPlate(project, byId.get('asset-hb-s2-bg')!, s2.id, {
    name: 'Nền Cửa Kính Phòng 404',
    pos: [0, 0, 2400],
    scale: 1.52,
    inPoint: 5.0,
    outPoint: 10.0
  })

  // ── CẢNH 3: Sân Thượng Trăng Máu Phá Cục (10..15s) ──
  const s3Caution = addPlate(project, byId.get('asset-hb-prop-caution')!, s3.id, {
    name: 'Tiền Cảnh Dây Bùa Sân Thượng',
    pos: [40, 415, -180],
    scale: 1.06,
    inPoint: 10.0,
    outPoint: comp.duration
  })
  const s3Mist = addPlate(project, byId.get('asset-hb-fx-mist')!, s3.id, {
    name: 'Sương Gió Sân Thượng',
    pos: [0, -430, -70],
    scale: 2.3,
    inPoint: 10.0,
    outPoint: comp.duration,
    opacity: 0.56
  })
  const hero3 = addHeroCluster(project, byId, s3.id, {
    instanceId: 'hb-hero-3',
    instanceName: 'Thám Tử Cảnh 3',
    center: [-300, -165, 260],
    inPoint: 10.0,
    outPoint: comp.duration
  })
  const s3Shadow = addPlate(project, byId.get('asset-hb-prop-shadow')!, s3.id, {
    name: 'Thực Thể Bị Ấn Triện Trấn Áp',
    pos: [300, -10, 560],
    scale: 0.68,
    inPoint: 10.0,
    outPoint: comp.duration,
    opacity: 0.94
  })
  const s3Seal = addPlate(project, byId.get('asset-hb-fx-seal')!, s3.id, {
    name: 'Ấn Triện Phá Giải Quy Tắc',
    pos: [275, 45, 720],
    scale: 0.72,
    inPoint: 10.0,
    outPoint: comp.duration,
    blendMode: 'add',
    opacity: 0.96
  })
  const s3Bg = addPlate(project, byId.get('asset-hb-s3-bg')!, s3.id, {
    name: 'Nền Sân Thượng Trăng Máu',
    pos: [0, 0, 2400],
    scale: 1.52,
    inPoint: 10.0,
    outPoint: comp.duration,
    fadeOut: 0.1
  })
  addShotParticles(project, s3.id, 'Tàn Lửa Trận Pháp Phá Cục', 10.0, comp.duration, '#ffd166', [-26, 36, 0], 190)

  return {
    s1Bg,
    s1Shadow,
    s1Lamp,
    s1Mist,
    s1Caution,
    hero1,
    s2Bg,
    s2Shadow,
    s2Lamp,
    s2Mist,
    s2Caution,
    hero2,
    s3Bg,
    s3Seal,
    s3Shadow,
    s3Mist,
    s3Caution,
    hero3
  }
}
