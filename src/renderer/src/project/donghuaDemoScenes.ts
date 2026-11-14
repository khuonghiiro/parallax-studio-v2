import type { AssetMeta, ImageLayer, ParticleLayer, Project, Shot } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { createImageLayer, createParticleLayer, createProject, createShot, shotSpacing } from './factory'

export interface DonghuaAssetInput {
  id: string
  file: string
  name: string
  width: number
  height: number
  dataUrl?: string
}

/** Danh mục 20 tấm mỹ thuật Quốc Phong (3 cảnh nền + 17 lớp bộ phận/cảnh vật/VFX tách nền alpha). */
export const DEFAULT_DONGHUA_ASSETS: DonghuaAssetInput[] = [
  { id: 'asset-dg-s1-bg', file: 'bg-s1-jade-sea-clouds.png', name: 'Cảnh 1 — Vân Hải Thanh Sơn Bình Minh', width: 1376, height: 768 },
  { id: 'asset-dg-s2-bg', file: 'bg-s2-moonlit-bamboo-mist.png', name: 'Cảnh 2 — Trúc Lâm Nguyệt Ảnh Sương Bạc', width: 1376, height: 768 },
  { id: 'asset-dg-s3-bg', file: 'bg-s3-jiangnan-starry-river.png', name: 'Cảnh 3 — Giang Nam Cổ Trấn Tinh Hà', width: 1376, height: 768 },
  { id: 'asset-dg-s1-cliff', file: 's1-cliff-pavilion.png', name: 'Đình Cổ Vách Núi Tùng Bách', width: 872, height: 728 },
  { id: 'asset-dg-s1-peach', file: 's1-peach-branch-fg.png', name: 'Cành Đào Cổ Thụ Tiền Cảnh', width: 1140, height: 733 },
  { id: 'asset-dg-crane-body', file: 'crane-body-core.png', name: 'Tiên Hạc — Thân & Cổ Ngự Vân', width: 1185, height: 342 },
  { id: 'asset-dg-crane-wing-near', file: 'crane-wing-near.png', name: 'Tiên Hạc — Cánh Gần Tiền Cảnh', width: 1004, height: 828 },
  { id: 'asset-dg-crane-wing-far', file: 'crane-wing-far.png', name: 'Tiên Hạc — Cánh Xa Hậu Cảnh', width: 1004, height: 827 },
  { id: 'asset-dg-hero-cloak', file: 'hero-cloak-back.png', name: 'Kiếm Khách — Áo Choàng Lụa Đỏ', width: 786, height: 866 },
  { id: 'asset-dg-hero-calm', file: 'hero-swordsman-calm.png', name: 'Kiếm Khách — Thần Thái Điềm Tĩnh', width: 538, height: 1218 },
  { id: 'asset-dg-hero-fierce', file: 'hero-swordsman-fierce.png', name: 'Kiếm Khách — Khai Phong Kiếm Ý', width: 724, height: 1262 },
  { id: 'asset-dg-hero-sword', file: 'hero-spirit-sword.png', name: 'Linh Kiếm Cổ Phong', width: 942, height: 735 },
  { id: 'asset-dg-s2-bridge', file: 's2-stone-bridge.png', name: 'Cầu Đá Cổ Rừng Trúc', width: 1280, height: 568 },
  { id: 'asset-dg-s2-bamboo', file: 's2-bamboo-rock-fg.png', name: 'Trúc Xanh & Đá Thái Hồ Tiền Cảnh', width: 1172, height: 768 },
  { id: 'asset-dg-s3-boat', file: 's3-gondola-boat.png', name: 'Thuyền Gỗ Ô Bồng Giang Nam', width: 1272, height: 488 },
  { id: 'asset-dg-s3-maiden', file: 's3-maiden-puppet.png', name: 'Thiếu Nữ Hán Phục Đèn Hoa Sen', width: 831, height: 1076 },
  { id: 'asset-dg-s3-lanterns', file: 's3-sky-lanterns.png', name: 'Đèn Trời Hoa Đăng', width: 1044, height: 622 },
  { id: 'asset-dg-fx-sword-qi', file: 'fx-sword-qi-slash.png', name: 'Kiếm Khí Trảm Thanh Ngọc', width: 1091, height: 647 },
  { id: 'asset-dg-fx-mist', file: 'fx-cloud-mist.png', name: 'Dải Mây Sương Vân Hải', width: 960, height: 320 },
  { id: 'asset-dg-fx-shimmer', file: 'fx-water-shimmer.png', name: 'Gợn Sóng Phản Chiếu Ánh Trăng', width: 760, height: 180 }
]

export interface CraneRigHandles {
  instId: string
  body: ImageLayer
  wingNear: ImageLayer
  wingFar: ImageLayer
}

export interface DonghuaStageHandles {
  shots: [Shot, Shot, Shot]
  s1HeroInst: string
  s1HeroCloak: ImageLayer
  s1HeroCalm: ImageLayer
  s1Sword: ImageLayer
  s1CraneLead: CraneRigHandles
  s1CraneMate: CraneRigHandles
  s1MistFar: ImageLayer
  s1MistMid: ImageLayer
  s1Cliff: ImageLayer
  s1Peach: ImageLayer
  s2HeroInst: string
  s2HeroCloak: ImageLayer
  s2HeroCalm: ImageLayer
  s2HeroFierce: ImageLayer
  s2Sword: ImageLayer
  s2SwordQi: ImageLayer
  s2Mist: ImageLayer
  s2StreamShimmer: ImageLayer
  s2Bridge: ImageLayer
  s2Bamboo: ImageLayer
  s3MaidenInst: string
  s3Boat: ImageLayer
  s3Maiden: ImageLayer
  s3WaterShimmer: ImageLayer
  s3Mist: ImageLayer
  s3LanternsFar: ImageLayer
  s3LanternsFg: ImageLayer
}

function addPlate(
  project: Project,
  assets: Map<string, AssetMeta>,
  assetId: string,
  shotId: string,
  opts: {
    id: string
    name?: string
    x: number
    y: number
    z: number
    scale: number
    inPoint: number
    outPoint: number
    opacity?: number
    blendMode?: ImageLayer['blendMode']
  }
): ImageLayer {
  const meta = assets.get(assetId)
  if (!meta) throw new Error(`Missing donghua asset: ${assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, shotId)
  layer.id = opts.id
  if (opts.name) layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  if (opts.blendMode) layer.blendMode = opts.blendMode
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  project.layers.push(layer)
  return layer
}

function addCraneCluster(
  project: Project,
  assets: Map<string, AssetMeta>,
  shotId: string,
  opts: {
    prefix: string
    instId: string
    label: string
    x: number
    y: number
    z: number
    scale: number
    inPoint: number
    outPoint: number
  }
): CraneRigHandles {
  const wingNearOffX = -Math.round(452 * opts.scale)
  const wingNearOffY = Math.round(274 * opts.scale)
  const wingFarOffX = Math.round(335 * opts.scale)
  const wingFarOffY = Math.round(288 * opts.scale)

  const wingFar = addPlate(project, assets, 'asset-dg-crane-wing-far', shotId, {
    id: `${opts.prefix}-wing-far`,
    name: `${opts.label} — Cánh Xa`,
    x: opts.x + wingFarOffX,
    y: opts.y + wingFarOffY,
    z: opts.z + 4,
    scale: opts.scale,
    inPoint: opts.inPoint,
    outPoint: opts.outPoint
  })
  wingFar.composite = {
    compositeId: 'comp-dg-crane',
    instanceId: opts.instId,
    compositeName: opts.label,
    partGroupId: 'part-wing-far',
    slot: 'wing_far',
    lockedGroup: true,
    rootOffset: [wingFarOffX, wingFarOffY, 4]
  }

  const body = addPlate(project, assets, 'asset-dg-crane-body', shotId, {
    id: `${opts.prefix}-body`,
    name: `${opts.label} — Thân Hạc`,
    x: opts.x,
    y: opts.y,
    z: opts.z,
    scale: opts.scale,
    inPoint: opts.inPoint,
    outPoint: opts.outPoint
  })
  body.composite = {
    compositeId: 'comp-dg-crane',
    instanceId: opts.instId,
    compositeName: opts.label,
    partGroupId: 'part-body',
    slot: 'body',
    isRoot: true,
    lockedGroup: true,
    rootOffset: [0, 0, 0]
  }

  const wingNear = addPlate(project, assets, 'asset-dg-crane-wing-near', shotId, {
    id: `${opts.prefix}-wing-near`,
    name: `${opts.label} — Cánh Gần`,
    x: opts.x + wingNearOffX,
    y: opts.y + wingNearOffY,
    z: opts.z - 4,
    scale: opts.scale,
    inPoint: opts.inPoint,
    outPoint: opts.outPoint
  })
  wingNear.composite = {
    compositeId: 'comp-dg-crane',
    instanceId: opts.instId,
    compositeName: opts.label,
    partGroupId: 'part-wing-near',
    slot: 'wing_near',
    lockedGroup: true,
    rootOffset: [wingNearOffX, wingNearOffY, -4]
  }

  return { instId: opts.instId, body, wingNear, wingFar }
}

function addAmbientParticles(
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
    sway?: number
  }
): ParticleLayer {
  const layer = createParticleLayer(project.comp)
  layer.id = opts.id
  layer.name = opts.name
  layer.shotId = shotId
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.transform.position.value = [0, 0, opts.z]
  layer.props.count = opts.count
  layer.props.seed = opts.seed
  layer.props.size = opts.size
  layer.props.color = opts.color
  layer.props.velocity = opts.velocity
  layer.props.sway = opts.sway ?? 26
  project.layers.push(layer)
  return layer
}

function setupCameraRoute(project: Project, spacing: number): void {
  const d = 1483.64
  addKeyframe(project.camera.position, 0.0, [0, 0, -d], 'easeInOut')
  addKeyframe(project.camera.target, 0.0, [0, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 2.6, [55, 18, -d * 0.88], 'hold')
  addKeyframe(project.camera.target, 2.6, [55, 18, 0], 'hold')
  addKeyframe(project.camera.position, 5.0, [55, 18, -d * 0.88], 'easeInOut')
  addKeyframe(project.camera.target, 5.0, [55, 18, 0], 'easeInOut')

  addKeyframe(project.camera.position, 6.0, [spacing, 0, -d], 'easeInOut')
  addKeyframe(project.camera.target, 6.0, [spacing, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 9.0, [spacing - 48, 12, -d * 0.87], 'hold')
  addKeyframe(project.camera.target, 9.0, [spacing - 48, 12, 0], 'hold')
  addKeyframe(project.camera.position, 11.0, [spacing - 48, 12, -d * 0.87], 'easeInOut')
  addKeyframe(project.camera.target, 11.0, [spacing - 48, 12, 0], 'easeInOut')

  addKeyframe(project.camera.position, 12.0, [spacing * 2, 0, -d], 'easeInOut')
  addKeyframe(project.camera.target, 12.0, [spacing * 2, 0, 0], 'easeInOut')
  addKeyframe(project.camera.position, 15.0, [spacing * 2 + 45, -14, -d * 0.9], 'easeInOut')
  addKeyframe(project.camera.target, 15.0, [spacing * 2 + 45, -14, 0], 'easeInOut')
  addKeyframe(project.camera.position, 18.0, [spacing * 2 + 78, 14, -d * 0.85], 'easeInOut')
  addKeyframe(project.camera.target, 18.0, [spacing * 2 + 78, 14, 0], 'easeInOut')
}

/** Khởi tạo khung Dự án + Camera + 3 Cảnh + toàn bộ Layer tách nền & rối 2.5D cho phim Quốc Phong. */
export function populateDonghuaStage(assetInputs: DonghuaAssetInput[] = DEFAULT_DONGHUA_ASSETS): {
  project: Project
  handles: DonghuaStageHandles
} {
  const project = createProject({
    name: 'Vân Sơn Kiếm Khúc — Hoạt Ảnh Quốc Phong 2.5D',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 18,
    background: '#090e1a'
  })

  const assets = new Map<string, AssetMeta>()
  for (const item of assetInputs) {
    const meta: AssetMeta = {
      id: item.id,
      name: item.name,
      kind: 'image',
      mime: 'image/png',
      width: item.width,
      height: item.height,
      path: `assets/scenes-donghua-v2/${item.file}`,
      assetPath: `scenes-donghua-v2/${item.file}`,
      ...(item.dataUrl ? { dataUrl: item.dataUrl } : {})
    }
    project.assets.push(meta)
    assets.set(item.id, meta)
  }

  const spacing = shotSpacing(project.comp)
  const shot1 = { ...createShot('Vân Hải Thanh Sơn', [0, 0, 0], 0), id: 'shot-dg-1', color: '#f59e0b' }
  const shot2 = { ...createShot('Trúc Lâm Nguyệt Ảnh', [spacing, 0, 0], 1), id: 'shot-dg-2', color: '#14b8a6' }
  const shot3 = { ...createShot('Giang Nam Tinh Hà', [spacing * 2, 0, 0], 2), id: 'shot-dg-3', color: '#8b5cf6' }
  project.shots.push(shot1, shot2, shot3)
  setupCameraRoute(project, spacing)

  // --- CẢNH 1 (0..6s) ---
  addPlate(project, assets, 'asset-dg-s1-bg', shot1.id, { id: 'layer-dg-s1-bg', name: 'Nền Vân Hải Thanh Sơn', x: 0, y: 0, z: 1200, scale: 1.68, inPoint: 0, outPoint: 6 })
  const s1MistFar = addPlate(project, assets, 'asset-dg-fx-mist', shot1.id, { id: 'layer-dg-s1-mist-far', name: 'Mây Trôi Đỉnh Núi', x: -340, y: -115, z: 740, scale: 1.15, inPoint: 0, outPoint: 6, opacity: 0.85 })
  addAmbientParticles(project, shot1.id, { id: 'layer-dg-s1-mist', name: 'Kim Quang Vân Hải', color: '#fde68a', count: 220, size: 7, z: 580, seed: 101, inPoint: 0, outPoint: 6, velocity: [14, 10, 0], sway: 24 })

  const s1CraneMate = addCraneCluster(project, assets, shot1.id, { prefix: 'layer-dg-s1-crane2', instId: 'cluster-dg-crane2-s1', label: 'Hạc Đôi Tầng Xa', x: -560, y: 315, z: 540, scale: 0.135, inPoint: 0, outPoint: 6 })
  const s1CraneLead = addCraneCluster(project, assets, shot1.id, { prefix: 'layer-dg-s1-crane', instId: 'cluster-dg-crane-s1', label: 'Tiên Hạc Ngự Vân', x: -245, y: 205, z: 430, scale: 0.195, inPoint: 0, outPoint: 6 })

  const s1MistMid = addPlate(project, assets, 'asset-dg-fx-mist', shot1.id, { id: 'layer-dg-s1-mist-mid', name: 'Sương Mù Khe Núi', x: 260, y: -235, z: 325, scale: 1.25, inPoint: 0, outPoint: 6, opacity: 0.78 })
  const s1Cliff = addPlate(project, assets, 'asset-dg-s1-cliff', shot1.id, { id: 'layer-dg-s1-cliff', name: 'Đình Cổ & Vách Đá Tùng', x: 255, y: -215, z: 260, scale: 0.9, inPoint: 0, outPoint: 6 })

  const s1HeroInst = 'cluster-dg-hero-s1'
  const s1HeroCloak = addPlate(project, assets, 'asset-dg-hero-cloak', shot1.id, { id: 'layer-dg-s1-cloak', name: 'Kiếm Khách — Áo Choàng Lụa Đỏ', x: 112, y: -135, z: 196, scale: 0.36, inPoint: 0, outPoint: 6 })
  s1HeroCloak.composite = { compositeId: 'comp-dg-hero', instanceId: s1HeroInst, compositeName: 'Kiếm Khách Vân Sơn', partGroupId: 'part-cloak', slot: 'cloak', variant: 'Áo choàng đỏ', isRoot: true, lockedGroup: true, rootOffset: [0, 0, 0] }

  const s1HeroCalm = addPlate(project, assets, 'asset-dg-hero-calm', shot1.id, { id: 'layer-dg-s1-calm', name: 'Kiếm Khách — Điềm Tĩnh', x: 145, y: -120, z: 190, scale: 0.34, inPoint: 0, outPoint: 6 })
  s1HeroCalm.composite = { compositeId: 'comp-dg-hero', instanceId: s1HeroInst, compositeName: 'Kiếm Khách Vân Sơn', partGroupId: 'part-stance', slot: 'stance', variant: 'Điềm tĩnh', lockedGroup: true, rootOffset: [33, 15, -6] }

  const s1Sword = addPlate(project, assets, 'asset-dg-hero-sword', shot1.id, { id: 'layer-dg-s1-sword', name: 'Linh Kiếm Hộ Thân (Đạo Cụ)', x: 245, y: -62, z: 204, scale: 0.16, inPoint: 0, outPoint: 6 })
  const s1Peach = addPlate(project, assets, 'asset-dg-s1-peach', shot1.id, { id: 'layer-dg-s1-peach', name: 'Cành Đào Tiền Cảnh', x: -535, y: 245, z: -185, scale: 0.74, inPoint: 0, outPoint: 6 })
  addAmbientParticles(project, shot1.id, { id: 'layer-dg-s1-petals', name: 'Cánh Hoa Đào Bay', color: '#fbcfe8', count: 160, size: 6, z: -90, seed: 102, inPoint: 0, outPoint: 6, velocity: [22, -16, 0], sway: 32 })

  // --- CẢNH 2 (6..12s) ---
  addPlate(project, assets, 'asset-dg-s2-bg', shot2.id, { id: 'layer-dg-s2-bg', name: 'Nền Trúc Lâm Đêm Trăng', x: 0, y: 0, z: 1180, scale: 1.68, inPoint: 5, outPoint: 12 })
  const s2Mist = addPlate(project, assets, 'asset-dg-fx-mist', shot2.id, { id: 'layer-dg-s2-mist-band', name: 'Sương Trăng Trôi Rừng Trúc', x: 240, y: 80, z: 540, scale: 1.32, inPoint: 5, outPoint: 12, opacity: 0.56 })
  addAmbientParticles(project, shot2.id, { id: 'layer-dg-s2-mist', name: 'Sương Bạc Đêm Trăng', color: '#99f6e4', count: 220, size: 7, z: 500, seed: 201, inPoint: 5, outPoint: 12, velocity: [-12, 8, 0], sway: 22 })
  const s2StreamShimmer = addPlate(project, assets, 'asset-dg-fx-shimmer', shot2.id, { id: 'layer-dg-s2-stream-shimmer', name: 'Ánh Nước Suối Đêm Trăng', x: 35, y: -335, z: 365, scale: 0.92, inPoint: 5, outPoint: 12, opacity: 0.75, blendMode: 'screen' })
  const s2Bridge = addPlate(project, assets, 'asset-dg-s2-bridge', shot2.id, { id: 'layer-dg-s2-bridge', name: 'Cầu Đá Cổ Vòm Trăng', x: 52, y: -268, z: 335, scale: 1.05, inPoint: 5, outPoint: 12 })

  const s2HeroInst = 'cluster-dg-hero-s2'
  const s2HeroCloak = addPlate(project, assets, 'asset-dg-hero-cloak', shot2.id, { id: 'layer-dg-s2-cloak', name: 'Kiếm Khách — Áo Choàng Xuất Chiêu', x: -162, y: -14, z: 226, scale: 0.44, inPoint: 5, outPoint: 12 })
  s2HeroCloak.composite = { compositeId: 'comp-dg-hero-s2', instanceId: s2HeroInst, compositeName: 'Kiếm Khách Xuất Chiêu', partGroupId: 'part-cloak', slot: 'cloak', variant: 'Áo choàng đỏ', isRoot: true, lockedGroup: true, rootOffset: [0, 0, 0] }

  const s2HeroCalm = addPlate(project, assets, 'asset-dg-hero-calm', shot2.id, { id: 'layer-dg-s2-calm', name: 'Dáng Đứng — Tụ Lực', x: -130, y: 6, z: 220, scale: 0.45, inPoint: 5, outPoint: 12, opacity: 1 })
  s2HeroCalm.composite = { compositeId: 'comp-dg-hero-s2', instanceId: s2HeroInst, compositeName: 'Kiếm Khách Xuất Chiêu', partGroupId: 'part-stance', slot: 'stance', variant: 'Tụ lực điềm tĩnh', lockedGroup: true, rootOffset: [32, 20, -6] }

  const s2HeroFierce = addPlate(project, assets, 'asset-dg-hero-fierce', shot2.id, { id: 'layer-dg-s2-fierce', name: 'Dáng Đứng — Khai Phong Kiếm Ý', x: -130, y: 6, z: 220, scale: 0.45, inPoint: 5, outPoint: 12, opacity: 0 })
  s2HeroFierce.composite = { compositeId: 'comp-dg-hero-s2', instanceId: s2HeroInst, compositeName: 'Kiếm Khách Xuất Chiêu', partGroupId: 'part-stance', slot: 'stance', variant: 'Khai phong kiếm ý', lockedGroup: true, rootOffset: [32, 20, -6] }

  const s2Sword = addPlate(project, assets, 'asset-dg-hero-sword', shot2.id, { id: 'layer-dg-s2-sword', name: 'Linh Kiếm Khai Phong', x: 55, y: 24, z: 196, scale: 0.165, inPoint: 5, outPoint: 12 })
  const s2SwordQi = addPlate(project, assets, 'asset-dg-fx-sword-qi', shot2.id, { id: 'layer-dg-s2-sword-qi', name: 'Kiếm Khí Trảm Thanh Ngọc', x: 115, y: -18, z: 145, scale: 0.34, inPoint: 5, outPoint: 12, opacity: 0, blendMode: 'add' })
  const s2Bamboo = addPlate(project, assets, 'asset-dg-s2-bamboo', shot2.id, { id: 'layer-dg-s2-bamboo', name: 'Khóm Trúc & Đá Thái Hồ Tiền Cảnh', x: -845, y: -20, z: -200, scale: 1.35, inPoint: 5, outPoint: 12 })
  addAmbientParticles(project, shot2.id, { id: 'layer-dg-s2-qi', name: 'Đom Đóm Kiếm Khí Thanh Ngọc', color: '#2dd4bf', count: 210, size: 5.5, z: 85, seed: 202, inPoint: 5, outPoint: 12, velocity: [18, 22, 0], sway: 28 })

  // --- CẢNH 3 (12..18s) ---
  addPlate(project, assets, 'asset-dg-s3-bg', shot3.id, { id: 'layer-dg-s3-bg', name: 'Nền Giang Nam Tinh Hà', x: 0, y: 0, z: 1200, scale: 1.68, inPoint: 11, outPoint: 18 })
  const s3Mist = addPlate(project, assets, 'asset-dg-fx-mist', shot3.id, { id: 'layer-dg-s3-mist', name: 'Khói Sương Mặt Sông Đêm', x: -260, y: -115, z: 620, scale: 1.25, inPoint: 11, outPoint: 18, opacity: 0.48 })
  const s3LanternsFar = addPlate(project, assets, 'asset-dg-s3-lanterns', shot3.id, { id: 'layer-dg-s3-lanterns-far', name: 'Đèn Trời Khổng Minh Xa', x: 220, y: 125, z: 480, scale: 0.4, inPoint: 11, outPoint: 18 })

  const s3MaidenInst = 'cluster-dg-maiden-s3'
  const s3WaterShimmer = addPlate(project, assets, 'asset-dg-fx-shimmer', shot3.id, { id: 'layer-dg-s3-shimmer', name: 'Gợn Nước Hoa Đăng Dưới Thuyền', x: -165, y: -318, z: 198, scale: 0.92, inPoint: 11, outPoint: 18, opacity: 0.92, blendMode: 'screen' })
  s3WaterShimmer.composite = { compositeId: 'comp-dg-maiden', instanceId: s3MaidenInst, compositeName: 'Thiếu Nữ Thuyền Sen', partGroupId: 'part-water', slot: 'water', lockedGroup: true, rootOffset: [0, -73, 4] }

  const s3Boat = addPlate(project, assets, 'asset-dg-s3-boat', shot3.id, { id: 'layer-dg-s3-boat', name: 'Thuyền Gỗ Ô Bồng', x: -165, y: -235, z: 194, scale: 0.56, inPoint: 11, outPoint: 18 })
  s3Boat.composite = { compositeId: 'comp-dg-maiden', instanceId: s3MaidenInst, compositeName: 'Thiếu Nữ Thuyền Sen', partGroupId: 'part-boat', slot: 'boat', isRoot: true, lockedGroup: true, rootOffset: [0, 0, 0] }

  const s3Maiden = addPlate(project, assets, 'asset-dg-s3-maiden', shot3.id, { id: 'layer-dg-s3-maiden', name: 'Thiếu Nữ Hán Phục — Đèn Sen', x: -195, y: -84, z: 186, scale: 0.37, inPoint: 11, outPoint: 18 })
  s3Maiden.composite = { compositeId: 'comp-dg-maiden', instanceId: s3MaidenInst, compositeName: 'Thiếu Nữ Thuyền Sen', partGroupId: 'part-maiden', slot: 'maiden', lockedGroup: true, rootOffset: [-30, 151, -8] }

  const s3LanternsFg = addPlate(project, assets, 'asset-dg-s3-lanterns', shot3.id, { id: 'layer-dg-s3-lanterns-fg', name: 'Đèn Trời Tiền Cảnh', x: -515, y: 145, z: -170, scale: 0.48, inPoint: 11, outPoint: 18 })
  addAmbientParticles(project, shot3.id, { id: 'layer-dg-s3-sparkles', name: 'Hoa Đăng Tinh Tú', color: '#fcd34d', count: 240, size: 6, z: 75, seed: 301, inPoint: 11, outPoint: 18, velocity: [6, 18, 0], sway: 20 })

  return {
    project,
    handles: {
      shots: [shot1, shot2, shot3],
      s1HeroInst,
      s1HeroCloak,
      s1HeroCalm,
      s1Sword,
      s1CraneLead,
      s1CraneMate,
      s1MistFar,
      s1MistMid,
      s1Cliff,
      s1Peach,
      s2HeroInst,
      s2HeroCloak,
      s2HeroCalm,
      s2HeroFierce,
      s2Sword,
      s2SwordQi,
      s2Mist,
      s2StreamShimmer,
      s2Bridge,
      s2Bamboo,
      s3MaidenInst,
      s3Boat,
      s3Maiden,
      s3WaterShimmer,
      s3Mist,
      s3LanternsFar,
      s3LanternsFg
    }
  }
}
