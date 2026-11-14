import type { AssetMeta, ImageLayer, ParticleLayer, Project, Shot } from '@shared/types'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import {
  applyStoryComicCamera,
  stageStoryComicBeat,
  type StoryComicBeatSpec
} from '../animation/storyComicDirector'
import { createImageLayer, createParticleLayer, createProject, createShot, shotSpacing } from './factory'

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
  { id: 'asset-s5-robot', file: 'system_robot_mascot.png', name: 'Linh Vật Hệ Thống Xuyên Không', mime: 'image/png', width: 432, height: 400 },
  { id: 'asset-s5-beast', file: 'giant_azure_beast.png', name: 'Thanh Lân Cự Thú Gầm Rống', mime: 'image/png', width: 534, height: 682 },
  { id: 'asset-s5-cloud', file: 'cloud_puff_magic.png', name: 'Vân Đoàn Thần Thông Trắng', mime: 'image/png', width: 623, height: 441 },
  { id: 'asset-s5-crew', file: 'pilgrimage_villains_group.png', name: 'Đoàn Thỉnh Kinh — Uy Áp Hắc Ám', mime: 'image/png', width: 1280, height: 714 },
  { id: 'asset-s5-wukong', file: 'wukong_fury_point.png', name: 'Hầu Vương — Nổi Giận Chỉ Bổng', mime: 'image/png', width: 651, height: 559 },
  { id: 'asset-s5-staff-fg', file: 'golden_staff_strike_fg.png', name: 'Kim Cô Bổng — Phóng Đại Tiền Cảnh', mime: 'image/png', width: 670, height: 618 },
  { id: 'asset-s5-maiden-fear', file: 'bone_maiden_terrified.png', name: 'Bạch Cốt Tinh — Kinh Hãi Phòng Thủ', mime: 'image/png', width: 518, height: 755 },
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
  if (opts.fadeIn !== undefined) layer.fadeIn = opts.fadeIn
  if (opts.fadeOut !== undefined) layer.fadeOut = opts.fadeOut
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.rotation.value = [0, 0, opts.rotationZ ?? 0]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
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

function addSparkParticles(project: Project, shotId: string, id: string, name: string, color: string, inPoint: number, outPoint: number): ParticleLayer {
  const p = createParticleLayer(project.comp)
  p.id = id
  p.name = name
  p.shotId = shotId
  p.inPoint = inPoint
  p.outPoint = outPoint
  p.transform.position.value = [0, 0, 90]
  p.props.count = 95
  p.props.seed = 202605
  p.props.size = 7
  p.props.color = color
  p.props.velocity = [0, 55, 0]
  p.props.sway = 28
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
    vignette: 0.14,
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

  // --- CẢNH 1 (0.0s .. 8.8s): Rừng cổ thụ + Văng ra khỏi Cự Thú + Gãi đầu ? + Bảng Hệ Thống ---
  addPlate(project, assets, 'asset-s5-bg-forest', s1.id, {
    id: 's5-s1-bg', name: 'Nền Rừng Cổ Thụ Tây Du', x: 0, y: 0, z: 1180, scale: 1.06, inPoint: 0, outPoint: 8.85, autoScale: true
  })
  const s1Beast = addPlate(project, assets, 'asset-s5-beast', s1.id, {
    id: 's5-s1-beast', name: 'Thanh Lân Cự Thú', x: 250, y: 40, z: 220, scale: 1.18, inPoint: 0, outPoint: 2.82, autoScale: true
  })
  const s1SkelHook = addPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's5-s1-skel-hook', name: 'Tiểu Khô Lâu Văng Xuất Thế', x: -230, y: -75, z: 85, scale: 0.92, inPoint: 0, outPoint: 2.82
  })
  applyPresetToLayer(s1SkelHook, 'comedic_tumble_out', 0, 2.65)

  const s1SkelConfused = addPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's5-s1-skel-confused', name: 'Tiểu Khô Lâu Gãi Đầu Ngơ Ngác', x: -35, y: -65, z: 120, scale: 0.98, inPoint: 2.82, outPoint: 5.52
  })
  addPlate(project, assets, 'asset-s5-cloud', s1.id, {
    id: 's5-s1-fg-bush', name: 'Mây Sương Tiền Cảnh Rừng', x: 560, y: -320, z: -90, scale: 0.85, inPoint: 2.82, outPoint: 5.52, opacity: 0.72
  })

  addPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's5-s1-skel-ots', name: 'Tiểu Khô Lâu Nhìn Bảng Hệ Thống', x: -470, y: -125, z: 45, scale: 0.95, inPoint: 5.52, outPoint: 8.85
  })
  const s1Robot = addPlate(project, assets, 'asset-s5-robot', s1.id, {
    id: 's5-s1-robot', name: 'Robot Hệ Thống Tấu Hài', x: 525, y: 20, z: 75, scale: 0.86, inPoint: 5.52, outPoint: 8.85
  })
  applyPresetToLayer(s1Robot, 'floating_hover', 5.55, 3.2, { deltaY: 28 })

  // --- CẢNH 2 (8.8s .. 15.6s): Nền Tâm Lý Ngơ Ngác (?) -> Uy Áp Đoàn Đường Tăng ---
  const s2SkelQuestion = addPlate(project, assets, 'asset-s5-skel-shock', s2.id, {
    id: 's5-s2-skel-q', name: 'Tiểu Khô Lâu — Ai Cơ Tôi Á?', x: 0, y: -55, z: 110, scale: 1.05, inPoint: 8.8, outPoint: 11.62
  })
  const s2CrewMenace = addPlate(project, assets, 'asset-s5-crew', s2.id, {
    id: 's5-s2-crew', name: 'Đoàn Đội Đường Tăng Áp Bức', x: 0, y: 55, z: 185, scale: 1.16, inPoint: 11.62, outPoint: 15.65, autoScale: true
  })
  const s2SkelCower = addPlate(project, assets, 'asset-s5-skel-cry', s2.id, {
    id: 's5-s2-skel-cower', name: 'Tiểu Khô Lâu Ôm Đầu Run Rẩy', x: 0, y: -230, z: -40, scale: 0.66, inPoint: 11.62, outPoint: 15.65
  })
  applyPresetToLayer(s2SkelCower, 'comic_shiver', 11.65, 3.9, { deltaX: 8 })
  addSparkParticles(project, s2.id, 's5-s2-aura-sparks', 'Hạt Sát Khí Đỏ Tím', '#ff2e93', 11.62, 15.65)

  // --- CẢNH 3 (15.6s .. 21.8s): Spotlight Bi Kịch Hài -> Ngộ Không Nổi Trận Lôi Đình ---
  const s3SkelSpotlight = addPlate(project, assets, 'asset-s5-skel-cry', s3.id, {
    id: 's5-s3-skel-pity', name: 'Tiểu Khô Lâu Khóc Dưới Đèn Spotlight', x: 0, y: -55, z: 110, scale: 1.02, inPoint: 15.6, outPoint: 18.72
  })
  const s3WukongRage = addPlate(project, assets, 'asset-s5-wukong', s3.id, {
    id: 's5-s3-wukong-rage', name: 'Hầu Vương Tức Giận Phát Điên', x: 0, y: -135, z: 105, scale: 1.32, inPoint: 18.72, outPoint: 21.85
  })
  applyPresetToLayer(s3WukongRage, 'comic_shiver', 18.75, 3.0, { deltaX: 5 })

  // --- CẢNH 4 (21.8s .. 27.8s): Chạm Trán Đồi Thông -> Bạch Cốt Tinh Kinh Hãi ---
  addPlate(project, assets, 'asset-s5-bg-valley', s4.id, {
    id: 's5-s4-bg', name: 'Nền Đèo Thông Núi Hoang', x: 0, y: 0, z: 1180, scale: 1.06, inPoint: 21.8, outPoint: 24.92, autoScale: true
  })
  const s4WukongPoint = addPlate(project, assets, 'asset-s5-wukong', s4.id, {
    id: 's5-s4-wukong-point', name: 'Hầu Vương Chỉ Bổng Quát Mắng', x: -75, y: -145, z: 135, scale: 1.34, inPoint: 21.8, outPoint: 24.92
  })
  const s4MaidenFear = addPlate(project, assets, 'asset-s5-maiden-fear', s4.id, {
    id: 's5-s4-maiden-fear', name: 'Bạch Cốt Tinh Kinh Hoàng Che Ngực', x: 0, y: -125, z: 110, scale: 1.12, inPoint: 24.92, outPoint: 27.85
  })
  applyPresetToLayer(s4MaidenFear, 'comic_shiver', 24.95, 2.8, { deltaX: 7 })

  // --- CẢNH 5 (27.8s .. 34.0s): Giải Thi Thuật 3 Tầng Z -> Kim Cô Bổng Đập Tiền Cảnh ---
  addPlate(project, assets, 'asset-s5-bg-valley', s5.id, {
    id: 's5-s5-bg', name: 'Nền Đồi Thông Đại Chiến 3 Tầng Z', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 27.8, outPoint: 34.05, autoScale: true
  })
  // Tầng Xa (Z = 780): Nhóm Đường Tăng & Ngộ Không phía sườn đồi xa khuất sau mây mù
  addPlate(project, assets, 'asset-s5-crew', s5.id, {
    id: 's5-s5-far-party', name: 'Đoàn Đường Tăng Phía Đồi Xa', x: -340, y: -210, z: 780, scale: 0.42, inPoint: 27.8, outPoint: 31.05, autoScale: true
  })
  addPlate(project, assets, 'asset-s5-cloud', s5.id, {
    id: 's5-s5-far-mist', name: 'Sương Mây Chân Đồi Xa', x: -335, y: -330, z: 720, scale: 0.72, inPoint: 27.8, outPoint: 31.05, autoScale: true, opacity: 0.92
  })
  // Tầng Trung (Z = 240): Mây trắng thần thông + Hồn Bạch Cốt Tinh bay vút lên mây
  addPlate(project, assets, 'asset-s5-cloud', s5.id, {
    id: 's5-s5-mid-cloud', name: 'Vân Đoàn Giải Thi Thuật', x: -30, y: -155, z: 260, scale: 1.18, inPoint: 27.8, outPoint: 31.05, fadeIn: 0.15
  })
  const s5SoulEscape = addPlate(project, assets, 'asset-s5-maiden-soul', s5.id, {
    id: 's5-s5-soul-escape', name: 'Chân Linh Bạch Cốt Vút Lên Chín Tầng Mây', x: 20, y: -25, z: 220, scale: 0.86, inPoint: 27.8, outPoint: 31.05
  })
  applyPresetToLayer(s5SoulEscape, 'soul_escape_ascend', 27.85, 3.1, { deltaX: 210, deltaY: 225, depthZ: 150 })
  // Tầng Tiền Cảnh (Z = -85): Tiểu Khô Lâu thò đầu góc phải hóng biến!
  const s5SkelObserver = addPlate(project, assets, 'asset-s5-skel-shock', s5.id, {
    id: 's5-s5-fg-observer', name: 'Tiểu Khô Lâu Tiền Cảnh Hóng Chuyện', x: 455, y: -215, z: -85, scale: 0.76, inPoint: 27.8, outPoint: 34.05
  })

  // Nửa sau Cảnh 5 (31.05s .. 34.0s): Thể xác rỗng nằm dưới cỏ + Kim Cô Bổng bổ chéo xuyên tiền cảnh!
  addPlate(project, assets, 'asset-s5-maiden-fear', s5.id, {
    id: 's5-s5-empty-shell', name: 'Phân Thân Giả Nằm Dưới Cỏ', x: 185, y: -185, z: 220, scale: 0.84, rotationZ: -74, inPoint: 31.05, outPoint: 34.05, opacity: 0.9
  })
  const s5StaffFg = addPlate(project, assets, 'asset-s5-staff-fg', s5.id, {
    id: 's5-s5-staff-fg', name: 'Kim Cô Bổng Phóng Đại Đập Xuyên Tiền Cảnh', x: -135, y: 45, z: -110, scale: 1.16, inPoint: 31.05, outPoint: 34.05
  })
  applyPresetToLayer(s5StaffFg, 'foreground_weapon_slam', 31.05, 2.9, { deltaX: 185, deltaY: -135, depthZ: -85, endScaleMultiplier: 1.14 })
  addSparkParticles(project, s5.id, 's5-s5-impact-sparks', 'Tia Lửa Chấn Động Kim Cô Bổng', '#facc15', 31.15, 34.05)

  // --- DÀN DỰNG 10 NHỊP CỐT TRUYỆN & PHỤ ĐỀ VIỀN ĐÔI BẰNG ENGINE stageStoryComicBeat ---
  const beats: StoryComicBeatSpec[] = [
    {
      shotId: s1.id, start: 0.0, end: 2.8,
      narration: 'Xuyên không vào thế giới Tây Du trở thành một tiểu khô lâu mới ra lò!',
      mood: 'world', cameraGrammar: 'cold_open_shock', focusOffset: [0, 0], transitionAtEnd: 'cut'
    },
    {
      shotId: s1.id, start: 2.85, end: 5.5,
      narration: 'Chưa kịp nhìn rõ hoàn cảnh xung quanh...',
      mood: 'world', cameraGrammar: 'confused_push', subjectId: s1SkelConfused.id,
      emoteBadge: 'question_giant', emotePosition: [95, 55, 250], transitionAtEnd: 'cut'
    },
    {
      shotId: s1.id, start: 5.55, end: 8.8,
      narration: 'Hệ thống đã bắt bạn đi chặn đường Đường Tăng thỉnh kinh!',
      mood: 'world', cameraGrammar: 'over_shoulder_system',
      systemQuest: {
        title: '⚡ [NHIỆM VỤ HỆ THỐNG]',
        body: 'Đi chặn đường đoàn đội Đường Tăng thỉnh kinh!',
        position: [20, 75, 190]
      },
      transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 8.8, end: 11.6,
      narration: 'Ai cơ, tôi á?! Một bộ xương nhỏ xíu thế này?!',
      mood: 'question_sky', cameraGrammar: 'snap_reaction_zoom', subjectId: s2SkelQuestion.id, transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 11.65, end: 15.6,
      narration: 'Đi chặn đường đoàn đội Đường Tăng? Chê mệnh mình quá dài sao?!',
      mood: 'speedlines_radial', cameraGrammar: 'low_angle_menace', subjectId: s2CrewMenace.id,
      emoteBadge: 'red_eye_flare', emotePosition: [-155, 165, 45], transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 15.6, end: 18.7,
      narration: 'Bắt một bộ xương nhỏ yếu ớt đáng thương đi làm chuyện đó sao...',
      mood: 'spotlight_stage', cameraGrammar: 'spotlight_pity_pull', subjectId: s3SkelSpotlight.id, transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 18.75, end: 21.8,
      narration: 'Con khỉ tức giận đến phát điên, vung bổng quát lớn!',
      mood: 'anger_veins', cameraGrammar: 'rage_punch_shake', subjectId: s3WukongRage.id,
      emoteBadge: 'anger_cross', emotePosition: [185, 175, 55], transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 21.8, end: 24.9,
      narration: 'Yêu quái đáng chết nhà ngươi, dám đến lừa gạt bọn ta, muốn đòn à!',
      mood: 'world', cameraGrammar: 'confrontation_push', subjectId: s4WukongPoint.id, transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 24.95, end: 27.8,
      narration: 'Cảm giác sợ hãi tột độ ập đến với Bạch Cốt Tinh!',
      mood: 'speedlines_radial', cameraGrammar: 'snap_reaction_zoom', subjectId: s4MaidenFear.id,
      emoteBadge: 'sweat_drop', emotePosition: [120, 155, 45], transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 27.8, end: 31.0,
      narration: 'Liền vội vàng thi triển Giải Thi Thuật, bản thể bay thẳng lên chín tầng mây!',
      mood: 'world', cameraGrammar: 'three_plane_escape', subjectId: s5SoulEscape.id, transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 31.05, end: 34.0,
      narration: 'Cùng lúc đó, Kim Cô Bổng của con khỉ giáng thẳng xuống đất!',
      mood: 'world', cameraGrammar: 'foreground_weapon_slam', focusOffset: [0, 0], transitionAtEnd: 'flash_dissolve'
    }
  ]

  for (const beat of beats) {
    stageStoryComicBeat(project, beat)
  }
  applyStoryComicCamera(project, beats)

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
