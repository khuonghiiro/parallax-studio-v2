import type { AssetMeta, AudioTrackItem, ImageLayer, ParticleLayer, Project, Shot } from '@shared/types'
import {
  applyNormalizedCharacterStaging,
  type CharacterBodyClass,
  type ShotFramingKind
} from '../animation/characterScaleNormalizer'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import {
  anchorBustLayerToFrameBottom,
  applyStoryComicCamera,
  stageStoryComicBeat,
  type StoryComicBeatSpec
} from '../animation/storyComicDirector'
import { createImageLayer, createParticleLayer, createProject, createShot, shotSpacing } from './factory'
import { validateAndRepairDialogueContinuity } from './subtitleAndDialogueSync'

export interface StoryWestAssetDef {
  id: string
  file: string
  name: string
  mime: 'image/jpeg' | 'image/png'
  width: number
  height: number
}

export const STORY_WEST_ASSETS: StoryWestAssetDef[] = [
  { id: 'asset-s5-bg-forest', file: 'bg_s5_ancient_forest.jpg', name: 'Bối cảnh — Rừng Cổ Thụ Tây Du', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s5-bg-valley', file: 'bg_s5_pine_ridge_valley.jpg', name: 'Bối cảnh — Đèo Thông Núi Hoang', mime: 'image/jpeg', width: 1920, height: 1080 },
  { id: 'asset-s5-skel-shock', file: 'chibi_skeleton_shock.png', name: 'Tiểu Khô Lâu — Hoảng Hốt Gãi Đầu', mime: 'image/png', width: 400, height: 614 },
  { id: 'asset-s5-skel-cry', file: 'chibi_skeleton_cry.png', name: 'Tiểu Khô Lâu — Ôm Đầu Khóc Ròng', mime: 'image/png', width: 393, height: 538 },
  { id: 'asset-s5-skel-back', file: 'chibi_skeleton_back_ots.png', name: 'Tiểu Khô Lâu — Góc Nhìn Qua Vai (Quay Lưng)', mime: 'image/png', width: 326, height: 384 },
  { id: 'asset-s5-sys-screen', file: 'system_pilgrimage_screen.png', name: 'Màn Hình Hệ Thống — Đoàn Thỉnh Kinh', mime: 'image/png', width: 614, height: 266 },
  { id: 'asset-s5-robot', file: 'system_robot_mascot.png', name: 'Linh Vật Hệ Thống Xuyên Không', mime: 'image/png', width: 432, height: 400 },
  { id: 'asset-s5-beast', file: 'giant_azure_beast.png', name: 'Thanh Lân Cự Thú (Toàn Thân Sau Lưng)', mime: 'image/png', width: 376, height: 457 },
  { id: 'asset-s5-cloud', file: 'cloud_puff_magic.png', name: 'Vân Đoàn Thần Thông Trắng', mime: 'image/png', width: 623, height: 441 },
  { id: 'asset-s5-cloud-bank', file: 'cloud_bank_wide_fg.png', name: 'Biển Mây Trắng Đáy Khung Hình', mime: 'image/png', width: 1032, height: 265 },
  { id: 'asset-s5-crew', file: 'pilgrimage_villains_group.png', name: 'Đoàn Thỉnh Kinh — Uy Áp Hắc Ám', mime: 'image/png', width: 1280, height: 714 },
  { id: 'asset-s5-far-party', file: 'far_pilgrimage_mini_full.png', name: 'Đoàn Thỉnh Kinh — Toàn Thân Nhỏ Trên Đồi Xa', mime: 'image/png', width: 677, height: 222 },
  { id: 'asset-s5-wukong-rage', file: 'wukong_rage_scratch.png', name: 'Hầu Vương — Đỏ Mặt Vò Đầu Phát Điên', mime: 'image/png', width: 371, height: 478 },
  { id: 'asset-s5-wukong', file: 'wukong_fury_point.png', name: 'Hầu Vương — Nổi Giận Chỉ Bổng', mime: 'image/png', width: 505, height: 470 },
  { id: 'asset-s5-staff-fg', file: 'golden_staff_strike_fg.png', name: 'Kim Cô Bổng — Phóng Đại Tiền Cảnh', mime: 'image/png', width: 670, height: 618 },
  { id: 'asset-s5-maiden-fear', file: 'bone_maiden_terrified.png', name: 'Bạch Cốt Tinh — Kinh Hãi Phòng Thủ', mime: 'image/png', width: 518, height: 755 },
  { id: 'asset-s5-maiden-prone', file: 'bone_maiden_prone_full.png', name: 'Bạch Cốt Tinh — Toàn Thân Nằm Sấp Trên Cỏ', mime: 'image/png', width: 835, height: 208 },
  { id: 'asset-s5-maiden-soul', file: 'bone_maiden_soul_escape.png', name: 'Bạch Cốt Tinh — Hồn Phách Giải Thi', mime: 'image/png', width: 592, height: 691 }
]

export interface StoryWestStageHandles {
  shots: [Shot, Shot, Shot, Shot, Shot]
  s1Beast: ImageLayer
  s1SkelHook: ImageLayer
  s1SkelConfused: ImageLayer
  s1Robot: ImageLayer
  s2SkelQuestion: ImageLayer
  s2CrewMenace: ImageLayer
  s2SkelCower: ImageLayer
  s3SkelSpotlight: ImageLayer
  s3WukongRage: ImageLayer
  s4WukongPoint: ImageLayer
  s4MaidenFear: ImageLayer
  s5SoulEscape: ImageLayer
  s5SkelObserver: ImageLayer
  s5StaffFg: ImageLayer
  beats: StoryComicBeatSpec[]
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
    rotationZ?: number
    fadeIn?: number
    fadeOut?: number
    anchorBustBottom?: boolean
    bodyClass?: CharacterBodyClass
    framing?: ShotFramingKind
  }
): ImageLayer {
  const meta = assets.get(assetId)
  if (!meta) throw new Error(`Missing Story West asset: ${assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = opts.autoScale ?? false
  layer.fadeIn = opts.fadeIn ?? 0.2
  layer.fadeOut = opts.fadeOut ?? 0.2
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.rotation.value = [0, 0, opts.rotationZ ?? 0]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  if (opts.bodyClass) {
    applyNormalizedCharacterStaging(layer, project.comp, {
      bodyClass: opts.bodyClass,
      framing: opts.framing ?? 'MS',
      anchorBustBottom: opts.anchorBustBottom,
      maxCamScale: 1.0
    })
  } else if (opts.anchorBustBottom) {
    anchorBustLayerToFrameBottom(layer, project.comp, 1.0)
  }
  project.layers.push(layer)
  return layer
}

function applyPresetToLayer(
  layer: ImageLayer,
  preset: Parameters<typeof generatePresetSpatialTracks>[0],
  time: number,
  duration: number,
  extra: Partial<Parameters<typeof generatePresetSpatialTracks>[2]> = {}
): void {
  const tracks = generatePresetSpatialTracks(
    preset,
    {
      position: layer.transform.position.value,
      rotation: layer.transform.rotation.value,
      scale: layer.transform.scale.value,
      opacity: layer.transform.opacity.value
    },
    { time, duration, ...extra }
  )
  if (tracks.position.length > 0) layer.transform.position.keyframes = tracks.position
  if (tracks.rotation.length > 0) layer.transform.rotation.keyframes = tracks.rotation
  if (tracks.scale.length > 0) layer.transform.scale.keyframes = tracks.scale
  if (tracks.opacity.length > 0) layer.transform.opacity.keyframes = tracks.opacity
}

function addSparkParticles(
  project: Project,
  shotId: string,
  id: string,
  name: string,
  color: string,
  inPoint: number,
  outPoint: number
): ParticleLayer {
  const p = createParticleLayer(project.comp)
  p.id = id
  p.name = name
  p.shotId = shotId
  p.inPoint = inPoint
  p.outPoint = outPoint
  p.transform.position.value = [0, 0, 90]
  p.props.count = 85
  p.props.seed = 202605
  p.props.size = 7
  p.props.color = color
  p.props.velocity = [0, 55, 0]
  p.props.sway = 26
  project.layers.push(p)
  return p
}

export function populateStoryWestStage(): { project: Project; handles: StoryWestStageHandles } {
  const project = createProject({
    name: 'Mẫu 5: Tiểu Khô Lâu Tây Du — Hoạt Ảnh Kể Chuyện Hài 2.5D',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 34,
    background: '#0b1020'
  })
  project.look = {
    ...project.look,
    fogEnabled: false,
    vignette: 0.12,
    contrast: 1.04,
    saturation: 1.08
  }

  const assets = new Map<string, AssetMeta>()
  for (const def of STORY_WEST_ASSETS) {
    const rel = `builtin/story_s5/${def.file}`
    const meta: AssetMeta = {
      id: def.id,
      name: def.name,
      kind: 'image',
      mime: def.mime,
      width: def.width,
      height: def.height,
      path: `assets/${rel}`,
      assetPath: rel
    }
    project.assets.push(meta)
    assets.set(def.id, meta)
  }

  const sp = shotSpacing(project.comp)
  const s1 = { ...createShot('Cảnh 1 · Xuất Thế & Hệ Thống', [0, 0, 0], 0), id: 'shot-s5-1', color: '#22c55e' }
  const s2 = { ...createShot('Cảnh 2 · Ngơ Ngác & Áp Bức', [sp, 0, 0], 1), id: 'shot-s5-2', color: '#a855f7' }
  const s3 = { ...createShot('Cảnh 3 · Spotlight & Nổi Điên', [sp * 2, 0, 0], 2), id: 'shot-s5-3', color: '#f43f5e' }
  const s4 = { ...createShot('Cảnh 4 · Đụng Độ Bạch Cốt Tinh', [sp * 3, 0, 0], 3), id: 'shot-s5-4', color: '#f59e0b' }
  const s5 = { ...createShot('Cảnh 5 · Giải Thi & Đập Kim Cô Bổng', [sp * 4, 0, 0], 4), id: 'shot-s5-5', color: '#38bdf8' }
  project.shots.push(s1, s2, s3, s4, s5)

  // --- CẢNH 1 (0.0s .. 8.8s): Rừng cổ thụ + Văng khỏi Cự Thú toàn thân + Gãi đầu ? + Bảng Hệ Thống ---
  addPlate(project, assets, 'asset-s5-bg-forest', s1.id, {
    id: 's5-s1-bg', name: 'Nền Rừng Cổ Thụ Tây Du', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 0, outPoint: 8.8, autoScale: true, fadeIn: 0.15, fadeOut: 0.15
  })
  // Nhịp 1 (0.0 .. 2.8s): Cự thú toàn thân đứng trên cỏ + Tiểu Khô Lâu văng nhào từ làn khói phía sau
  const s1Beast = addPlate(project, assets, 'asset-s5-beast', s1.id, {
    id: 's5-s1-beast', name: 'Thanh Lân Cự Thú Toàn Thân', x: 245, y: 15, z: 190, scale: 1.8, inPoint: 0, outPoint: 2.8, autoScale: true, bodyClass: 'boss_imposing', framing: 'WS'
  })
  const s1SkelHook = addPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's5-s1-skel-hook', name: 'Tiểu Khô Lâu Văng Xuất Thế', x: -210, y: -115, z: 80, scale: 0.88, inPoint: 0, outPoint: 2.8, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s1SkelHook, 'comedic_tumble_out', 0, 2.75, { deltaX: -360, deltaY: -75, jumpHeight: 105 })

  // Nhịp 2 (2.8 .. 5.5s): Ngồi gốc cây gãi đầu + Dấu ? khổng lồ bật lên PHÍA SAU lưng + lắc quả lắc
  const s1SkelConfused = addPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's5-s1-skel-confused', name: 'Tiểu Khô Lâu Gãi Đầu Ngơ Ngác', x: -35, y: -235, z: 110, scale: 0.9, inPoint: 2.8, outPoint: 5.5, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s1SkelConfused, 'pop_up_bottom', 2.8, 2.65, { deltaY: 75 })
  addPlate(project, assets, 'asset-s5-cloud', s1.id, {
    id: 's5-s1-fg-bush', name: 'Tán Mây Cỏ Tiền Cảnh', x: 610, y: -350, z: -90, scale: 0.92, inPoint: 2.8, outPoint: 5.5, opacity: 0.82
  })

  // Nhịp 3 (5.5 .. 8.8s): Góc nhìn qua vai (đầu lâu quay lưng) + Màn hình Hệ Thống Đoàn Thỉnh Kinh + Robot vàng lướt vào
  addPlate(project, assets, 'asset-s5-skel-back', s1.id, {
    id: 's5-s1-skel-ots', name: 'Tiểu Khô Lâu Quay Lưng Nhìn Hệ Thống', x: -455, y: -265, z: 45, scale: 1.4, inPoint: 5.5, outPoint: 8.8, anchorBustBottom: true, bodyClass: 'ots_foreground', framing: 'OTS'
  })
  const s1SysScreen = addPlate(project, assets, 'asset-s5-sys-screen', s1.id, {
    id: 's5-s1-sys-screen', name: 'Bảng Hệ Thống — Đoàn Thỉnh Kinh', x: 18, y: 78, z: 155, scale: 1.54, inPoint: 5.5, outPoint: 8.8
  })
  applyPresetToLayer(s1SysScreen, 'system_pop_bounce', 5.5, 3.25)
  const s1Robot = addPlate(project, assets, 'asset-s5-robot', s1.id, {
    id: 's5-s1-robot', name: 'Robot Hệ Thống Tấu Hài', x: 545, y: -15, z: 65, scale: 0.95, inPoint: 5.5, outPoint: 8.8, bodyClass: 'petite_chibi', framing: 'WS'
  })
  applyPresetToLayer(s1Robot, 'slide_in_side', 5.5, 3.25, { deltaX: 240, deltaY: 18 })

  // --- CẢNH 2 (8.8s .. 15.6s): Tiểu Khô Lâu Suy Nghĩ Tưởng Tượng 4 Thầy Trò -> Áp Bức Dâng Cao To Dần ---
  const s2SkelQuestion = addPlate(project, assets, 'asset-s5-skel-shock', s2.id, {
    id: 's5-s2-skel-q', name: 'Tiểu Khô Lâu Suy Nghĩ — Ai Cơ Tôi Á?', x: -165, y: -235, z: 110, scale: 0.9, inPoint: 8.8, outPoint: 11.6, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s2SkelQuestion, 'fade_materialize_in', 8.8, 2.75, { deltaY: 22, fadeOpacity: false })
  // Hư ảnh 4 thầy trò hiện từ mờ sang đậm trên đám mây suy nghĩ của Tiểu Khô Lâu rồi tan dần
  const s2ThoughtCrew = addPlate(project, assets, 'asset-s5-crew', s2.id, {
    id: 's5-s2-thought-crew', name: 'Hư Ảnh Suy Nghĩ 4 Thầy Trò (Mờ → Đậm → Tan)', x: 165, y: 115, z: 195, scale: 0.72, inPoint: 8.8, outPoint: 11.6, opacity: 0.88, autoScale: true, fadeIn: 0.4, fadeOut: 0.4
  })
  applyPresetToLayer(s2ThoughtCrew, 'thought_vision_manifest', 8.8, 2.75, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s2ThoughtCloudL = addPlate(project, assets, 'asset-s5-cloud', s2.id, {
    id: 's5-s2-thought-cloud-l', name: 'Mây Suy Nghĩ Tưởng Tượng (Trái)', x: -20, y: -172, z: 185, scale: 0.86, inPoint: 8.8, outPoint: 11.6, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyPresetToLayer(s2ThoughtCloudL, 'thought_vision_manifest', 8.8, 2.75, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s2ThoughtCloudM = addPlate(project, assets, 'asset-s5-cloud', s2.id, {
    id: 's5-s2-thought-cloud-m', name: 'Mây Suy Nghĩ Tưởng Tượng (Giữa)', x: 175, y: -176, z: 184, scale: 0.88, inPoint: 8.8, outPoint: 11.6, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyPresetToLayer(s2ThoughtCloudM, 'thought_vision_manifest', 8.8, 2.75, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s2ThoughtCloudR = addPlate(project, assets, 'asset-s5-cloud', s2.id, {
    id: 's5-s2-thought-cloud-r', name: 'Mây Suy Nghĩ Tưởng Tượng (Phải)', x: 375, y: -172, z: 183, scale: 0.86, inPoint: 8.8, outPoint: 11.6, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyPresetToLayer(s2ThoughtCloudR, 'thought_vision_manifest', 8.8, 2.75, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })

  // Nhịp 5 (11.6 .. 15.6s): ÁP BỨC TĂNG DẦN — 4 thầy trò dâng cao & phình to dần, Tiểu Khô Lâu co nhỏ dần & run rẩy!
  const s2CrewMenace = addPlate(project, assets, 'asset-s5-crew', s2.id, {
    id: 's5-s2-crew', name: 'Đoàn Đội Đường Tăng Áp Bức (Dâng Cao To Dần)', x: 0, y: -45, z: 185, scale: 1.25, inPoint: 11.6, outPoint: 15.6, autoScale: true, anchorBustBottom: true, bodyClass: 'boss_imposing', framing: 'MCU'
  })
  applyPresetToLayer(s2CrewMenace, 'oppressive_tower_grow', 11.6, 3.95, { deltaY: 72, endScaleMultiplier: 1.26 })
  const s2SkelCower = addPlate(project, assets, 'asset-s5-skel-cry', s2.id, {
    id: 's5-s2-skel-cower', name: 'Tiểu Khô Lâu Bị Áp Bức (Co Nhỏ Dần & Run)', x: 0, y: -275, z: 35, scale: 0.9, inPoint: 11.6, outPoint: 15.6, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s2SkelCower, 'oppressed_shrink_tremble', 11.6, 3.95, { deltaX: 6, deltaY: -46, endScaleMultiplier: 0.74 })
  addSparkParticles(project, s2.id, 's5-s2-aura-sparks', 'Hạt Sát Khí Đỏ Tím', '#ff2e93', 11.6, 15.6)

  // --- CẢNH 3 (15.6s .. 21.8s): Spotlight Bi Kịch Hài -> Ngộ Không Vò Đầu Phát Điên ---
  const s3SkelSpotlight = addPlate(project, assets, 'asset-s5-skel-cry', s3.id, {
    id: 's5-s3-skel-pity', name: 'Tiểu Khô Lâu Khóc Dưới Đèn Spotlight', x: 0, y: -235, z: 110, scale: 0.9, inPoint: 15.6, outPoint: 18.7, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s3SkelSpotlight, 'fade_materialize_in', 15.6, 3.05, { deltaY: 16, fadeOpacity: false })
  const s3WukongRage = addPlate(project, assets, 'asset-s5-wukong-rage', s3.id, {
    id: 's5-s3-wukong-rage', name: 'Hầu Vương Vò Đầu Tức Giận Phát Điên', x: 0, y: -195, z: 105, scale: 1.5, inPoint: 18.7, outPoint: 21.8, anchorBustBottom: true, bodyClass: 'hero_warrior', framing: 'MCU'
  })
  applyPresetToLayer(s3WukongRage, 'anger_vein_throb', 18.7, 3.05)

  // --- CẢNH 4 (21.8s .. 27.8s): Chạm Trán Đồi Thông -> Bạch Cốt Tinh Kinh Hãi Đen Trắng ---
  addPlate(project, assets, 'asset-s5-bg-valley', s4.id, {
    id: 's5-s4-bg', name: 'Nền Đèo Thông Núi Hoang', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 21.8, outPoint: 24.9, autoScale: true
  })
  const s4WukongPoint = addPlate(project, assets, 'asset-s5-wukong', s4.id, {
    id: 's5-s4-wukong-point', name: 'Hầu Vương Chỉ Bổng Quát Mắng', x: -115, y: -195, z: 120, scale: 1.5, inPoint: 21.8, outPoint: 24.9, anchorBustBottom: true, bodyClass: 'hero_warrior', framing: 'MS'
  })
  applyPresetToLayer(s4WukongPoint, 'fade_materialize_in', 21.8, 3.05, { deltaY: 18, fadeOpacity: false })
  const s4MaidenFear = addPlate(project, assets, 'asset-s5-maiden-fear', s4.id, {
    id: 's5-s4-maiden-fear', name: 'Bạch Cốt Tinh Kinh Hoàng Che Ngực', x: 0, y: -210, z: 110, scale: 1.0, inPoint: 24.9, outPoint: 27.8, anchorBustBottom: true, bodyClass: 'standard_human', framing: 'MCU'
  })
  applyPresetToLayer(s4MaidenFear, 'comic_shiver', 24.9, 2.85, { deltaX: 7 })

  // --- CẢNH 5 (27.8s .. 34.0s): Giải Thi Thuật 3 Tầng Z -> Kim Cô Bổng Đập Tiền Cảnh ---
  addPlate(project, assets, 'asset-s5-bg-valley', s5.id, {
    id: 's5-s5-bg', name: 'Nền Đồi Thông Đại Chiến 3 Tầng Z', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 27.8, outPoint: 34.0, autoScale: true
  })
  // Tầng Xa (Z = 680): Nhóm Đường Tăng & Ngộ Không TOÀN THÂN nhỏ xíu đứng trên thung lũng cỏ xa (không cắt ngang bụng!)
  addPlate(project, assets, 'asset-s5-far-party', s5.id, {
    id: 's5-s5-far-party', name: 'Đoàn Đường Tăng Toàn Thân Trên Đồi Xa', x: -195, y: -155, z: 680, scale: 0.48, inPoint: 27.8, outPoint: 31.0, autoScale: true
  })
  // Tầng Trung (Z = 220): Chân linh Bạch Cốt Tinh bay vút từ biển mây trắng lên chín tầng mây
  const s5SoulEscape = addPlate(project, assets, 'asset-s5-maiden-soul', s5.id, {
    id: 's5-s5-soul-escape', name: 'Chân Linh Bạch Cốt Vút Lên Chín Tầng Mây', x: 55, y: -75, z: 220, scale: 0.94, inPoint: 27.8, outPoint: 31.0, bodyClass: 'standard_human', framing: 'WS'
  })
  applyPresetToLayer(s5SoulEscape, 'soul_escape_ascend', 27.8, 3.15, { deltaX: 165, deltaY: 195, depthZ: 120, fadeOpacity: false })
  // Biển Mây Trắng trải ngang toàn bộ đáy màn hình (Z = 120) che kín tự nhiên chân hồn phách
  addPlate(project, assets, 'asset-s5-cloud-bank', s5.id, {
    id: 's5-s5-mid-cloud', name: 'Biển Mây Giải Thi Thuật Trải Đáy Khung Hình', x: 0, y: -355, z: 120, scale: 2.18, inPoint: 27.8, outPoint: 31.0, autoScale: true
  })
  // Tầng Tiền Cảnh (Z = 40): Tiểu Khô Lâu thò đầu góc phải hóng biến (kích thước chuẩn hoá petite_chibi nhất quán!)
  const s5SkelObserver = addPlate(project, assets, 'asset-s5-skel-shock', s5.id, {
    id: 's5-s5-fg-observer', name: 'Tiểu Khô Lâu Tiền Cảnh Hóng Chuyện', x: 470, y: -255, z: 40, scale: 0.88, inPoint: 27.8, outPoint: 31.0, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyPresetToLayer(s5SkelObserver, 'pop_up_bottom', 27.8, 3.1, { deltaY: 65 })

  // Nửa sau Cảnh 5 (31.0s .. 34.0s): Bạch Cốt Tinh TOÀN THÂN nằm sấp trên cỏ + Kim Cô Bổng bổ chéo xuyên tiền cảnh!
  const s5MaidenProne = addPlate(project, assets, 'asset-s5-maiden-prone', s5.id, {
    id: 's5-s5-empty-shell', name: 'Bạch Cốt Tinh Toàn Thân Nằm Sấp Trên Cỏ', x: 45, y: -145, z: 180, scale: 1.62, inPoint: 31.0, outPoint: 34.0
  })
  const s5StaffFg = addPlate(project, assets, 'asset-s5-staff-fg', s5.id, {
    id: 's5-s5-staff-fg', name: 'Kim Cô Bổng Phóng Đại Đập Xuyên Tiền Cảnh', x: -235, y: 55, z: -110, scale: 1.12, inPoint: 31.0, outPoint: 34.0
  })
  applyPresetToLayer(s5StaffFg, 'foreground_weapon_slam', 31.0, 2.95, { deltaX: 195, deltaY: -145, depthZ: -85, endScaleMultiplier: 1.14 })
  addSparkParticles(project, s5.id, 's5-s5-impact-sparks', 'Tia Lửa Chấn Động Kim Cô Bổng', '#facc15', 31.1, 34.0)

  // --- DÀN DỰNG 11 NHỊP CỐT TRUYỆN LIỀN MẠCH 0ms GAP, NODE VIETSUB GẮN ĐỐI TƯỢNG & ĐỒNG BỘ THOẠI ---
  const beats: StoryComicBeatSpec[] = [
    {
      shotId: s1.id, start: 0.0, end: 2.8,
      narration: 'Xuyên không vào thế giới Tây Du trở thành một tiểu khô lâu mới ra lò!',
      speakerName: 'Dẫn truyện', subjectId: s1SkelHook.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'world', cameraGrammar: 'cold_open_shock', focusOffset: [0, 0], transitionAtEnd: 'cut'
    },
    {
      shotId: s1.id, start: 2.8, end: 5.5,
      narration: 'Chưa kịp nhìn rõ hoàn cảnh xung quanh...',
      speakerName: 'Tiểu Khô Lâu', subjectId: s1SkelConfused.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'world', cameraGrammar: 'confused_push',
      emoteBadge: 'question_giant', emotePosition: [75, 55, 165], transitionAtEnd: 'cut'
    },
    {
      shotId: s1.id, start: 5.5, end: 8.8,
      narration: 'Hệ thống đã bắt bạn đi chặn đường Đường Tăng thỉnh kinh!',
      speakerName: 'Hệ Thống', subjectId: s1Robot.id, subtitleStylePreset: 'system_hologram', preserveSubtitleSettings: true,
      mood: 'world', cameraGrammar: 'over_shoulder_system', focusOffset: [0, 0], transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 8.8, end: 11.6,
      narration: 'Ai cơ, tôi á?! Bắt bộ xương nhỏ này chặn 4 thầy trò Đường Tăng?!',
      speakerName: 'Tiểu Khô Lâu (Suy nghĩ)', subjectId: s2SkelQuestion.id, subtitleStylePreset: 'inner_thought', preserveSubtitleSettings: true,
      mood: 'question_sky', cameraGrammar: 'thought_contemplation', transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 11.6, end: 15.6,
      narration: 'Đoàn đội Đường Tăng sát khí ngút trời, chê mệnh mình quá dài sao?!',
      speakerName: 'Tiểu Khô Lâu', subjectId: s2SkelCower.id, secondarySubjectId: s2CrewMenace.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'speedlines_radial', cameraGrammar: 'oppressive_low_push',
      emoteBadge: 'red_eye_flare', emotePosition: [-165, 155, 45], transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 15.6, end: 18.7,
      narration: 'Bắt một bộ xương nhỏ yếu ớt đáng thương đi làm chuyện đó sao...',
      speakerName: 'Tiểu Khô Lâu', subjectId: s3SkelSpotlight.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'spotlight_stage', cameraGrammar: 'spotlight_pity_pull', transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 18.7, end: 21.8,
      narration: 'Con khỉ tức giận đến phát điên, vung bổng quát lớn!',
      speakerName: 'Tôn Ngộ Không', subjectId: s3WukongRage.id, subtitleStylePreset: 'comic_shout', preserveSubtitleSettings: true,
      mood: 'anger_veins', cameraGrammar: 'rage_punch_shake', transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 21.8, end: 24.9,
      narration: 'Yêu quái đáng chết nhà ngươi, dám đến lừa gạt bọn ta, muốn đòn à!',
      speakerName: 'Tôn Ngộ Không', subjectId: s4WukongPoint.id, subtitleStylePreset: 'comic_shout', preserveSubtitleSettings: true,
      mood: 'world', cameraGrammar: 'confrontation_push', transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 24.9, end: 27.8,
      narration: 'Cảm giác sợ hãi tột độ ập đến với Bạch Cốt Tinh!',
      speakerName: 'Bạch Cốt Tinh', subjectId: s4MaidenFear.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'horror_bw_speedlines', cameraGrammar: 'snap_reaction_zoom',
      emoteBadge: 'sweat_drop', emotePosition: [120, 145, 45], transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 27.8, end: 31.0,
      narration: 'Liền vội vàng thi triển Giải Thi Thuật, bản thể bay thẳng lên chín tầng mây!',
      speakerName: 'Bạch Cốt Tinh', subjectId: s5SoulEscape.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'world', cameraGrammar: 'three_plane_escape', transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 31.0, end: 34.0,
      narration: 'Cùng lúc đó, Kim Cô Bổng của con khỉ giáng thẳng xuống đất!',
      speakerName: 'Dẫn truyện', subjectId: s5MaidenProne.id, subtitleStylePreset: 'cinema_gold',
      mood: 'world', cameraGrammar: 'foreground_weapon_slam', focusOffset: [0, 0], transitionAtEnd: 'flash_dissolve'
    }
  ]

  for (const beat of beats) {
    stageStoryComicBeat(project, beat)
  }
  applyStoryComicCamera(project, beats)

  // Gắn AudioTrack hội thoại đồng bộ 1:1 với thời gian Vietsub & nhân vật nói
  project.audioTracks = beats
    .filter((b) => Boolean(b.subjectId))
    .map((b, idx): AudioTrackItem => ({
      id: `voice-s5-b${idx + 1}`,
      assetId: 'builtin-voice-cue',
      name: `Thoại #${idx + 1} · ${b.speakerName || 'Nhân vật'}`,
      offset: b.start,
      duration: Number((b.end - b.start).toFixed(2)),
      volume: 1.0,
      targetType: 'layer',
      targetId: b.subjectId,
      targetName: b.speakerName || 'Nhân vật',
      targetShotId: b.shotId,
      characterRole: 'voice',
      lipSyncEnabled: true
    }))

  validateAndRepairDialogueContinuity(project, true)

  const handles: StoryWestStageHandles = {
    shots: [s1, s2, s3, s4, s5],
    s1Beast,
    s1SkelHook,
    s1SkelConfused,
    s1Robot,
    s2SkelQuestion,
    s2CrewMenace,
    s2SkelCower,
    s3SkelSpotlight,
    s3WukongRage,
    s4WukongPoint,
    s4MaidenFear,
    s5SoulEscape,
    s5SkelObserver,
    s5StaffFg,
    beats
  }

  return { project, handles }
}
