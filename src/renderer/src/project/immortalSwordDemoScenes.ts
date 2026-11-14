import type { AssetMeta, ImageLayer, ParticleLayer, Project, Shot } from '@shared/types'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import { addKeyframe } from '../animation/keyframes'
import { choreographCinematicCameraRoute, type CinematicCameraBeat } from '../animation/cinematicCameraRoute'
import { buildLayerSkinMesh } from './donghuaSceneryRigs'
import { createImageLayer, createParticleLayer, createProject, createShot, shotSpacing } from './factory'
import { hyperbolicDepthScreenProgress, projectCorridorFootToWorld } from './sceneDepthCorridor'

export interface ImmortalSwordAssetDef {
  id: string
  file: string
  name: string
  mime: 'image/jpeg' | 'image/png'
  width: number
  height: number
}

export const IMMORTAL_SWORD_ASSETS: ImmortalSwordAssetDef[] = [
  { id: 'asset-s4-bg1', file: 'bg_s1_cloud_sword_terrace.jpg', name: 'Cảnh 1 — Vân Hải Kiếm Đài Hoàng Hôn', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s4-bg2', file: 'bg_s2_moonlit_bamboo_corridor.jpg', name: 'Cảnh 2 — Trúc Lâm Tuyệt Ảnh Hành Lang Sâu', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s4-bg3', file: 'bg_s3_abyssal_dragon_lake.jpg', name: 'Cảnh 3 — Hàn Đàm Cổ Long Băng Động', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s4-bg4', file: 'bg_s4_myriad_swords_heaven.jpg', name: 'Cảnh 4 — Vạn Kiếm Quy Tông Tinh Hà', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s4-hero-stance', file: 'hero_stance.png', name: 'Kiếm Tiên — Thanh Vân Tĩnh Lập', mime: 'image/png', width: 521, height: 980 },
  { id: 'asset-s4-hero-slash', file: 'hero_leap_slash.png', name: 'Kiếm Tiên — Phi Thiên Phá Không Trảm', mime: 'image/png', width: 1040, height: 645 },
  { id: 'asset-s4-silk-cape', file: 'silk_cape.png', name: 'Dải Lụa Tiên Phong Phiêu Vũ', mime: 'image/png', width: 585, height: 668 },
  { id: 'asset-s4-cloud', file: 'fg_cloud_wisp.png', name: 'Vân Vụ Lưu Quang Tầng Nổi', mime: 'image/png', width: 666, height: 469 },
  { id: 'asset-s4-dragon', file: 'azure_flood_dragon.png', name: 'Huyền Băng Cổ Long Xuất Thế', mime: 'image/png', width: 1001, height: 755 },
  { id: 'asset-s4-crane', file: 'celestial_crane.png', name: 'Bạch Hạc Linh Vũ Triển Dực', mime: 'image/png', width: 676, height: 582 },
  { id: 'asset-s4-monolith', file: 'fg_sword_monolith.png', name: 'Cổ Kiếm Thạch Bia & Đèn Lồng Đá', mime: 'image/png', width: 638, height: 684 },
  { id: 'asset-s4-slash-vfx', file: 'vfx_crescent_slash.png', name: 'Kiếm Khí Bán Nguyệt Kim Lam', mime: 'image/png', width: 610, height: 575 },
  { id: 'asset-s4-myriad-swords', file: 'vfx_myriad_swords.png', name: 'Kiếm Trận Thất Tinh Thăng Thiên', mime: 'image/png', width: 622, height: 617 }
]

export interface ImmortalSwordStageHandles {
  shots: [Shot, Shot, Shot, Shot]
  s1Hero: ImageLayer
  s1Cape: ImageLayer
  s1Crane: ImageLayer
  s1Monolith: ImageLayer
  s1CloudFg: ImageLayer
  s2Hero: ImageLayer
  s2Crane: ImageLayer
  s2MonolithL: ImageLayer
  s2MonolithR: ImageLayer
  s3Dragon: ImageLayer
  s3HeroSlash: ImageLayer
  s3SlashVfx: ImageLayer
  s4Hero: ImageLayer
  s4Cape: ImageLayer
  s4SwordsMain: ImageLayer
  s4SwordsLeft: ImageLayer
  s4SwordsRight: ImageLayer
}

function makeLightSpine(
  id: string,
  name: string,
  layerId: string,
  points: PlantSpinePoint[],
  amplitude: number,
  speed: number,
  phaseOffset = 0,
  reach = 180
): PlantSpine {
  return {
    id,
    name,
    layerIds: [layerId],
    points,
    amplitude,
    speed,
    stiffness: 0.2,
    flexibility: 0.72,
    turbulence: 0.25,
    lean: 0,
    phaseOffset,
    reach,
    verticalBob: 0,
    waveLag: 0.75,
    enabled: true
  }
}

/** Gắn lưới uốn mềm siêu nhẹ (`8x10` = 99 đỉnh) giúp tà lụa, cánh hạc và thân rồng uốn mượt ở 60fps. */
export function applyImmortalOrganicMeshes(h: ImmortalSwordStageHandles): void {
  for (const cape of [h.s1Cape, h.s4Cape]) {
    const spines = [
      makeLightSpine(`${cape.id}-sp1`, 'Lụa thượng', cape.id, [{ x: 80, y: -180 }, { x: -40, y: -140 }, { x: -210, y: -90 }], 16, 0.78, 0, 210),
      makeLightSpine(`${cape.id}-sp2`, 'Lụa hạ', cape.id, [{ x: 60, y: -40 }, { x: -65, y: 95 }, { x: -195, y: 245 }], 19, 0.84, 0.32, 230)
    ]
    cape.mesh = buildLayerSkinMesh(cape, { segX: 8, segY: 10, plantSpines: spines })
  }

  for (const hero of [h.s1Hero, h.s2Hero, h.s4Hero]) {
    const spines = [
      makeLightSpine(`${hero.id}-robe`, 'Tà áo kiếm tiên', hero.id, [{ x: 0, y: 60 }, { x: 25, y: 240 }, { x: 55, y: 420 }], 10, 0.66, 0.15, 220),
      makeLightSpine(`${hero.id}-hair`, 'Tóc & dải trán', hero.id, [{ x: -15, y: -360 }, { x: -115, y: -300 }, { x: -210, y: -235 }], 12, 0.76, 0.4, 165)
    ]
    hero.mesh = buildLayerSkinMesh(hero, { segX: 8, segY: 10, plantSpines: spines })
  }

  for (const crane of [h.s1Crane, h.s2Crane]) {
    const spines = [
      makeLightSpine(`${crane.id}-wingL`, 'Cánh hạc trái', crane.id, [{ x: -30, y: 20 }, { x: -165, y: -85 }, { x: -295, y: -210 }], 22, 1.25, 0, 220),
      makeLightSpine(`${crane.id}-wingR`, 'Cánh hạc phải', crane.id, [{ x: 55, y: 35 }, { x: 185, y: 15 }, { x: 295, y: -15 }], 20, 1.25, 0.08, 210)
    ]
    crane.mesh = buildLayerSkinMesh(crane, { segX: 8, segY: 8, plantSpines: spines })
  }

  const dragonSpines = [
    makeLightSpine('s3-dragon-coil', 'Thân rồng uốn sóng', h.s3Dragon.id, [{ x: -320, y: 110 }, { x: -95, y: 45 }, { x: 165, y: -35 }, { x: 310, y: 95 }], 15, 0.88, 0, 260),
    makeLightSpine('s3-dragon-mane', 'Bờm băng cổ long', h.s3Dragon.id, [{ x: 10, y: -195 }, { x: 115, y: -285 }, { x: 245, y: -315 }], 14, 1.05, 0.35, 180)
  ]
  h.s3Dragon.mesh = buildLayerSkinMesh(h.s3Dragon, { segX: 10, segY: 10, plantSpines: dragonSpines })
}

function addPlate(
  project: Project,
  assets: Map<string, AssetMeta>,
  assetId: string,
  shotId: string,
  opts: {
    id: string
    name: string
    x: number
    y: number
    z: number
    scale: number
    inPoint: number
    outPoint: number
    opacity?: number
    autoScale?: boolean
    blendMode?: ImageLayer['blendMode']
    fadeIn?: number
    fadeOut?: number
  }
): ImageLayer {
  const meta = assets.get(assetId)
  if (!meta) throw new Error(`Missing Immortal Sword asset: ${assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = opts.autoScale ?? true
  if (opts.blendMode) layer.blendMode = opts.blendMode
  if (opts.fadeIn !== undefined) layer.fadeIn = opts.fadeIn
  if (opts.fadeOut !== undefined) layer.fadeOut = opts.fadeOut
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  project.layers.push(layer)
  return layer
}

function addParticles(
  project: Project,
  shotId: string,
  opts: {
    id: string
    name: string
    color: string
    count: number
    size: number
    z: number
    seed: number
    inPoint: number
    outPoint: number
    velocity: [number, number, number]
  }
): ParticleLayer {
  const p = createParticleLayer(project.comp)
  p.id = opts.id
  p.name = opts.name
  p.shotId = shotId
  p.inPoint = opts.inPoint
  p.outPoint = opts.outPoint
  p.transform.position.value = [0, 0, opts.z]
  p.props.count = opts.count
  p.props.seed = opts.seed
  p.props.size = opts.size
  p.props.color = opts.color
  p.props.velocity = opts.velocity
  p.props.sway = 24
  project.layers.push(p)
  return p
}

export function getImmortalSwordCameraBeats(h: ImmortalSwordStageHandles): CinematicCameraBeat[] {
  const [s1, s2, s3, s4] = h.shots
  return [
    {
      shotId: s1.id,
      kind: 'crane_descent',
      start: 0.0,
      end: 2.7,
      subjectId: h.s1Hero.id,
      startScale: 0.96,
      endScale: 0.78,
      pitchStart: 16.5,
      pitchEnd: -5.0,
      offsetStart: [-20, 95],
      offsetEnd: [15, 22]
    },
    {
      shotId: s1.id,
      kind: 'whip_pan',
      start: 2.8,
      end: 4.5,
      subjectId: h.s1Hero.id,
      continuityDirX: 1,
      startScale: 0.78,
      endScale: 0.74,
      offsetStart: [15, 22],
      offsetEnd: [135, 18],
      transitionAtEnd: 'whip_glide',
      transitionDuration: 0.56
    },
    {
      shotId: s2.id,
      kind: 'track_subject',
      start: 4.5,
      end: 7.2,
      subjectId: h.s2Hero.id,
      startScale: 0.94,
      endScale: 0.78,
      yawStart: -4.5,
      yawEnd: 4.5,
      offsetStart: [0, 42],
      offsetEnd: [0, 28]
    },
    {
      shotId: s2.id,
      kind: 'crane_rise',
      start: 7.3,
      end: 9.0,
      subjectId: h.s2Hero.id,
      startScale: 0.78,
      endScale: 0.94,
      pitchStart: -5.5,
      pitchEnd: 16.5,
      offsetStart: [0, 28],
      offsetEnd: [0, 120],
      transitionAtEnd: 'silk_fade',
      transitionDuration: 0.60
    },
    {
      shotId: s3.id,
      kind: 'orbit_parallax',
      start: 9.0,
      end: 11.1,
      subjectId: h.s3Dragon.id,
      startScale: 0.94,
      endScale: 0.82,
      yawStart: -17.5,
      yawEnd: 16.8,
      pitchStart: 4.0,
      pitchEnd: -2.0
    },
    {
      shotId: s3.id,
      kind: 'punch_zoom',
      start: 11.2,
      end: 13.5,
      subjectId: h.s3HeroSlash.id,
      secondarySubjectId: h.s3Dragon.id,
      startScale: 0.84,
      impactScale: 0.45,
      endScale: 0.88,
      impactRatio: 0.36,
      hitstopSec: 0.20,
      rollImpact: -9.0,
      transitionAtEnd: 'flash_dissolve',
      transitionDuration: 0.48
    },
    {
      shotId: s4.id,
      kind: 'hero_low_ascent',
      start: 13.5,
      end: 15.8,
      subjectId: h.s4Hero.id,
      startScale: 0.86,
      endScale: 0.72,
      pitchStart: -7.5,
      pitchEnd: -19.0,
      offsetStart: [0, 35],
      offsetEnd: [0, 135]
    },
    {
      shotId: s4.id,
      kind: 'corkscrew_reveal',
      start: 15.9,
      end: 18.0,
      subjectId: h.s4SwordsMain.id,
      startScale: 0.60,
      endScale: 0.95,
      yawStart: -13.5,
      yawEnd: 5.5,
      rollStart: -15.0,
      rollEnd: 0,
      offsetStart: [0, 45],
      offsetEnd: [0, 15]
    }
  ]
}

function buildScene1(project: Project, assets: Map<string, AssetMeta>, s1: Shot) {
  addPlate(project, assets, 'asset-s4-bg1', s1.id, { id: 's4-s1-bg', name: 'Nền Vân Hải Kiếm Đài', x: 0, y: 0, z: 1180, scale: 1.48, inPoint: 0, outPoint: 4.55 })
  const s1CloudFar = addPlate(project, assets, 'asset-s4-cloud', s1.id, { id: 's4-s1-cloud-far', name: 'Mây Hoàng Hôn Tầng Xa', x: -460, y: 175, z: 680, scale: 0.88, inPoint: 0, outPoint: 4.55, opacity: 0.44 })
  addKeyframe(s1CloudFar.transform.position, 0, [-460, 175, 680], 'linear')
  addKeyframe(s1CloudFar.transform.position, 4.5, [-275, 188, 680], 'linear')

  const s1Crane = addPlate(project, assets, 'asset-s4-crane', s1.id, { id: 's4-s1-crane', name: 'Bạch Hạc Lướt Mây', x: -520, y: 235, z: 440, scale: 0.34, inPoint: 0, outPoint: 4.55 })
  addKeyframe(s1Crane.transform.position, 0, [-520, 225, 460], 'easeInOut')
  addKeyframe(s1Crane.transform.position, 4.5, [180, 295, 340], 'easeInOut')

  const s1Cape = addPlate(project, assets, 'asset-s4-silk-cape', s1.id, { id: 's4-s1-cape', name: 'Dải Lụa Tiên Phong', x: -48, y: 4, z: 215, scale: 0.54, inPoint: 0, outPoint: 4.55, opacity: 0.92 })
  const s1Hero = addPlate(project, assets, 'asset-s4-hero-stance', s1.id, { id: 's4-s1-hero', name: 'Kiếm Tiên Thanh Vân', x: 36, y: -18, z: 195, scale: 0.58, inPoint: 0, outPoint: 4.55 })
  const s1Monolith = addPlate(project, assets, 'asset-s4-monolith', s1.id, { id: 's4-s1-monolith', name: 'Thạch Bia Cổ Kiếm Tiền Cảnh', x: -640, y: -235, z: -120, scale: 0.72, inPoint: 0, outPoint: 4.55 })
  s1Monolith.virtualLight = { enabled: true, kind: 'candle', color: '#fbbf24', intensity: 1.05, radius: 420, originUV: [0.28, 0.44], coneAngleDeg: 360, beamAngleDeg: 0, behaviorMode: 'wind_reactive' }

  const s1CloudFg = addPlate(project, assets, 'asset-s4-cloud', s1.id, { id: 's4-s1-cloud-fg', name: 'Vân Vụ Chuyển Cảnh', x: 460, y: -285, z: -180, scale: 1.08, inPoint: 0, outPoint: 4.55, opacity: 0.72 })
  addKeyframe(s1CloudFg.transform.position, 0, [520, -295, -180], 'easeInOut')
  addKeyframe(s1CloudFg.transform.position, 3.6, [340, -275, -180], 'easeInOut')
  addKeyframe(s1CloudFg.transform.position, 4.5, [-80, -140, -220], 'easeIn')
  addParticles(project, s1.id, { id: 's4-s1-sparks', name: 'Kim Quang Linh Khí', color: '#fde68a', count: 90, size: 5.5, z: 120, seed: 401, inPoint: 0, outPoint: 4.55, velocity: [18, 12, 0] })
  return { s1Hero, s1Cape, s1Crane, s1Monolith, s1CloudFg }
}

function buildScene2(project: Project, assets: Map<string, AssetMeta>, s2: Shot) {
  addPlate(project, assets, 'asset-s4-bg2', s2.id, { id: 's4-s2-bg', name: 'Nền Trúc Lâm Hành Lang Trăng', x: 0, y: 0, z: 1180, scale: 1.48, inPoint: 4.45, outPoint: 9.05 })
  const s2Mist = addPlate(project, assets, 'asset-s4-cloud', s2.id, { id: 's4-s2-mist', name: 'Sương Trăng Cuối Ngõ Đá', x: 0, y: -215, z: 720, scale: 1.08, inPoint: 4.45, outPoint: 9.05, opacity: 0.22 })
  addKeyframe(s2Mist.transform.position, 4.5, [-90, -215, 720], 'linear')
  addKeyframe(s2Mist.transform.position, 9.0, [110, -195, 720], 'linear')

  const heroFootOffY = 980 * 0.47
  const startCorr = projectCorridorFootToWorld(project.comp, -8, -58, 940, 0.22, heroFootOffY)
  const s2Hero = addPlate(project, assets, 'asset-s4-hero-stance', s2.id, {
    id: 's4-s2-hero', name: 'Kiếm Tiên Ngự Phong Xuyên Ngõ',
    x: startCorr.x, y: startCorr.y, z: startCorr.z, scale: startCorr.scaleRatio,
    autoScale: false, inPoint: 4.45, outPoint: 9.05
  })
  for (let i = 0; i <= 6; i++) {
    const u = i / 6
    const t = Number((4.5 + 4.3 * u).toFixed(3))
    const zVal = 940 + (170 - 940) * u
    const p = hyperbolicDepthScreenProgress(u, 940, 170, project.comp)
    const wp = projectCorridorFootToWorld(project.comp, -8 + 26 * p, -58 - 357 * p, zVal, 0.22 + 0.42 * p, heroFootOffY)
    addKeyframe(s2Hero.transform.position, t, [wp.x, wp.y, wp.z], 'linear')
    addKeyframe(s2Hero.transform.scale, t, [wp.scaleRatio, wp.scaleRatio, 1], 'linear')
  }

  const s2Crane = addPlate(project, assets, 'asset-s4-crane', s2.id, { id: 's4-s2-crane', name: 'Linh Hạc Dẫn Lộ Trăng Thanh', x: 140, y: 170, z: 620, scale: 0.26, inPoint: 4.45, outPoint: 9.05 })
  addKeyframe(s2Crane.transform.position, 4.5, [120, 145, 680], 'easeInOut')
  addKeyframe(s2Crane.transform.position, 9.0, [-260, 265, 140], 'easeInOut')

  const s2MonolithL = addPlate(project, assets, 'asset-s4-monolith', s2.id, { id: 's4-s2-mono-l', name: 'Trụ Đèn Đá Tiền Cảnh Trái', x: -720, y: -250, z: -135, scale: 0.78, inPoint: 4.45, outPoint: 9.05 })
  const s2MonolithR = addPlate(project, assets, 'asset-s4-monolith', s2.id, { id: 's4-s2-mono-r', name: 'Trụ Đèn Đá Trung Cảnh Phải', x: 645, y: -185, z: 160, scale: 0.54, inPoint: 4.45, outPoint: 9.05 })
  s2MonolithL.virtualLight = { enabled: true, kind: 'candle', color: '#fcd34d', intensity: 0.95, radius: 390, originUV: [0.28, 0.44], coneAngleDeg: 360, beamAngleDeg: 0, behaviorMode: 'subtle_flicker' }
  addParticles(project, s2.id, { id: 's4-s2-fireflies', name: 'Đom Đóm Rừng Trúc', color: '#5eead4', count: 95, size: 5, z: 95, seed: 402, inPoint: 4.45, outPoint: 9.05, velocity: [-10, 14, 0] })
  return { s2Hero, s2Crane, s2MonolithL, s2MonolithR }
}

function buildScene3(project: Project, assets: Map<string, AssetMeta>, s3: Shot) {
  addPlate(project, assets, 'asset-s4-bg3', s3.id, { id: 's4-s3-bg', name: 'Nền Hàn Đàm Băng Động', x: 0, y: 0, z: 1180, scale: 1.52, inPoint: 8.95, outPoint: 13.55 })
  const s3Dragon = addPlate(project, assets, 'asset-s4-dragon', s3.id, { id: 's4-s3-dragon', name: 'Huyền Băng Cổ Long', x: 185, y: 38, z: 310, scale: 0.86, inPoint: 8.95, outPoint: 13.55 })
  s3Dragon.virtualLight = { enabled: true, kind: 'cave_crystal', color: '#38bdf8', intensity: 1.15, radius: 520, originUV: [0.48, 0.42], coneAngleDeg: 360, beamAngleDeg: 0, behaviorMode: 'breathing' }
  addKeyframe(s3Dragon.transform.position, 9.0, [215, 18, 340], 'easeInOut')
  addKeyframe(s3Dragon.transform.position, 11.7, [145, 52, 275], 'easeOut')
  addKeyframe(s3Dragon.transform.position, 12.1, [235, 28, 320], 'easeOut')
  addKeyframe(s3Dragon.transform.position, 13.5, [195, 42, 300], 'easeInOut')

  const s3HeroSlash = addPlate(project, assets, 'asset-s4-hero-slash', s3.id, { id: 's4-s3-hero-slash', name: 'Kiếm Tiên Phi Thiên Trảm', x: -285, y: 24, z: 165, scale: 0.62, inPoint: 8.95, outPoint: 13.55 })
  addKeyframe(s3HeroSlash.transform.position, 9.0, [-440, -45, 240], 'easeInOut')
  addKeyframe(s3HeroSlash.transform.position, 11.1, [-310, 48, 195], 'easeIn')
  addKeyframe(s3HeroSlash.transform.position, 11.85, [-115, 32, 150], 'hold')
  addKeyframe(s3HeroSlash.transform.position, 12.1, [-115, 32, 150], 'easeOut')
  addKeyframe(s3HeroSlash.transform.position, 13.5, [-210, -8, 175], 'easeInOut')

  const s3SlashVfx = addPlate(project, assets, 'asset-s4-slash-vfx', s3.id, {
    id: 's4-s3-slash-vfx', name: 'Kiếm Khí Bán Nguyệt Băng Kim',
    x: 25, y: 35, z: 125, scale: 0.88, inPoint: 11.45, outPoint: 13.45,
    blendMode: 'screen', fadeIn: 0.12, fadeOut: 0.45
  })
  s3SlashVfx.glow = { enabled: true, color: '#60a5fa', intensity: 1.25, thickness: 10 }
  addKeyframe(s3SlashVfx.transform.scale, 11.45, [0.42, 0.42, 1], 'easeOut')
  addKeyframe(s3SlashVfx.transform.scale, 11.85, [0.96, 0.96, 1], 'easeOut')
  addKeyframe(s3SlashVfx.transform.scale, 13.4, [1.18, 1.18, 1], 'easeInOut')

  addPlate(project, assets, 'asset-s4-monolith', s3.id, { id: 's4-s3-fg-rock', name: 'Bia Đá Bờ Hàn Đàm', x: -690, y: -275, z: -150, scale: 0.74, inPoint: 8.95, outPoint: 13.55 })
  addParticles(project, s3.id, { id: 's4-s3-ice-sparks', name: 'Tinh Thể Băng Quang', color: '#7dd3fc', count: 110, size: 6, z: 90, seed: 403, inPoint: 8.95, outPoint: 13.55, velocity: [22, 26, 0] })
  return { s3Dragon, s3HeroSlash, s3SlashVfx }
}

function buildScene4(project: Project, assets: Map<string, AssetMeta>, s4: Shot) {
  addPlate(project, assets, 'asset-s4-bg4', s4.id, { id: 's4-s4-bg', name: 'Nền Tinh Hà Vạn Kiếm', x: 0, y: 0, z: 1180, scale: 1.54, inPoint: 13.45, outPoint: 18.0 })
  const s4SwordsLeft = addPlate(project, assets, 'asset-s4-myriad-swords', s4.id, { id: 's4-s4-swords-l', name: 'Tả Dực Thất Tinh Kiếm Trận', x: -460, y: 125, z: 480, scale: 0.68, inPoint: 13.45, outPoint: 18.0, blendMode: 'screen', opacity: 0.86 })
  const s4SwordsRight = addPlate(project, assets, 'asset-s4-myriad-swords', s4.id, { id: 's4-s4-swords-r', name: 'Hữu Dực Thất Tinh Kiếm Trận', x: 465, y: 135, z: 460, scale: 0.68, inPoint: 13.45, outPoint: 18.0, blendMode: 'screen', opacity: 0.86 })
  const s4SwordsMain = addPlate(project, assets, 'asset-s4-myriad-swords', s4.id, { id: 's4-s4-swords-main', name: 'Trung Tâm Vạn Kiếm Quy Tông', x: 0, y: 195, z: 320, scale: 0.96, inPoint: 13.45, outPoint: 18.0, blendMode: 'screen' })
  s4SwordsMain.glow = { enabled: true, color: '#fbbf24', intensity: 1.15, thickness: 8 }

  addKeyframe(s4SwordsMain.transform.position, 13.5, [0, 85, 360], 'easeOut')
  addKeyframe(s4SwordsMain.transform.position, 18.0, [0, 235, 290], 'easeInOut')
  addKeyframe(s4SwordsLeft.transform.position, 13.5, [-480, 40, 500], 'easeOut')
  addKeyframe(s4SwordsLeft.transform.position, 18.0, [-430, 185, 450], 'easeInOut')
  addKeyframe(s4SwordsRight.transform.position, 13.5, [480, 45, 490], 'easeOut')
  addKeyframe(s4SwordsRight.transform.position, 18.0, [435, 190, 440], 'easeInOut')

  addPlate(project, assets, 'asset-s4-monolith', s4.id, { id: 's4-s4-pedestal', name: 'Đài Kiếm Đá Lơ Lửng', x: 18, y: -395, z: 220, scale: 0.82, inPoint: 13.45, outPoint: 18.0 })
  const s4Cape = addPlate(project, assets, 'asset-s4-silk-cape', s4.id, { id: 's4-s4-cape', name: 'Thiên Y Lụa Bạc', x: -62, y: -105, z: 205, scale: 0.54, inPoint: 13.45, outPoint: 18.0, opacity: 0.92 })
  const s4Hero = addPlate(project, assets, 'asset-s4-hero-stance', s4.id, { id: 's4-s4-hero', name: 'Kiếm Tiên Ngự Đỉnh Tinh Hà', x: 14, y: -125, z: 185, scale: 0.58, inPoint: 13.45, outPoint: 18.0 })
  addPlate(project, assets, 'asset-s4-cloud', s4.id, { id: 's4-s4-cloud-l', name: 'Vân Hải Chân Đài Trái', x: -560, y: -335, z: -90, scale: 1.05, inPoint: 13.45, outPoint: 18.0, opacity: 0.78 })
  addPlate(project, assets, 'asset-s4-cloud', s4.id, { id: 's4-s4-cloud-r', name: 'Vân Hải Chân Đài Phải', x: 585, y: -345, z: -110, scale: 1.05, inPoint: 13.45, outPoint: 18.0, opacity: 0.78 })
  addParticles(project, s4.id, { id: 's4-s4-stars', name: 'Tinh Quang Kiếm Ý Thăng Thiên', color: '#fde047', count: 120, size: 5.5, z: 110, seed: 404, inPoint: 13.45, outPoint: 18.0, velocity: [0, 34, 0] })
  return { s4Hero, s4Cape, s4SwordsMain, s4SwordsLeft, s4SwordsRight }
}

export function populateImmortalSwordStage(): { project: Project; handles: ImmortalSwordStageHandles } {
  const project = createProject()
  project.comp.name = 'Mẫu 4: Thương Lan Kiếm Cảnh — Tiên Hiệp Điện Ảnh 2.5D'
  project.comp.width = 1920
  project.comp.height = 1080
  project.comp.fps = 30
  project.comp.duration = 18
  project.comp.background = '#070b16'
  project.look = {
    ...project.look,
    fogEnabled: true,
    fogColor: '#131d38',
    fogNear: 1450,
    fogFar: 5400,
    vignette: 0.22,
    contrast: 1.05,
    saturation: 1.08
  }

  const assets = new Map<string, AssetMeta>()
  for (const def of IMMORTAL_SWORD_ASSETS) {
    const rel = `builtin/donghua_s4/${def.file}`
    const meta: AssetMeta = {
      id: def.id, name: def.name, kind: 'image', mime: def.mime, width: def.width, height: def.height,
      path: `assets/${rel}`, assetPath: rel
    }
    project.assets.push(meta)
    assets.set(def.id, meta)
  }

  const sp = shotSpacing(project.comp)
  const s1 = { ...createShot('Cảnh 1 · Vân Hải Kiếm Đài', [0, 0, 0], 0), id: 'shot-s4-1', color: '#f59e0b' }
  const s2 = { ...createShot('Cảnh 2 · Trúc Lâm Tuyệt Ảnh', [sp, 0, 0], 1), id: 'shot-s4-2', color: '#14b8a6' }
  const s3 = { ...createShot('Cảnh 3 · Hàn Đàm Cổ Long', [sp * 2, 0, 0], 2), id: 'shot-s4-3', color: '#3b82f6' }
  const s4 = { ...createShot('Cảnh 4 · Vạn Kiếm Quy Tông', [sp * 3, 0, 0], 3), id: 'shot-s4-4', color: '#a855f7' }
  project.shots.push(s1, s2, s3, s4)

  const h1 = buildScene1(project, assets, s1)
  const h2 = buildScene2(project, assets, s2)
  const h3 = buildScene3(project, assets, s3)
  const h4 = buildScene4(project, assets, s4)

  const handles: ImmortalSwordStageHandles = { shots: [s1, s2, s3, s4], ...h1, ...h2, ...h3, ...h4 }
  applyImmortalOrganicMeshes(handles)
  choreographCinematicCameraRoute(project, getImmortalSwordCameraBeats(handles), { clearExisting: true })
  return { project, handles }
}
