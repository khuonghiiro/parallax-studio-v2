import type { AssetMeta, AudioTrackItem, ImageLayer, Project } from '@shared/types'
import {
  applyNormalizedCharacterStaging,
  type CharacterBodyClass,
  type ShotFramingKind
} from '../animation/characterScaleNormalizer'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import {
  applyStoryComicCamera,
  stageStoryComicBeat,
  type StoryComicBeatSpec
} from '../animation/storyComicDirector'
import { createImageLayer, createParticleLayer, createProject, createShot, shotSpacing } from './factory'
import { STORY_WEST_ASSETS } from './storyWestDemoScenes'
import { validateAndRepairDialogueContinuity } from './subtitleAndDialogueSync'
import { attachLogicNodeToLayerV2 } from './workflowV2Mutations'
import { v2LayerNodeId } from './workflowV2Scope'
import { syncWorkflowV2Graph } from './workflowV2Sync'
import { createTimeGroup } from './workflowTimeGroups'

function addDramaPlate(
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
    fadeIn?: number
    fadeOut?: number
    anchorBustBottom?: boolean
    bodyClass?: CharacterBodyClass
    framing?: ShotFramingKind
  }
): ImageLayer {
  const meta = assets.get(assetId)
  if (!meta) throw new Error(`Missing asset: ${assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = opts.autoScale ?? false
  layer.fadeIn = opts.fadeIn ?? 0.22
  layer.fadeOut = opts.fadeOut ?? 0.22
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 1
  if (opts.bodyClass) {
    applyNormalizedCharacterStaging(layer, project.comp, {
      bodyClass: opts.bodyClass,
      framing: opts.framing ?? 'MS',
      anchorBustBottom: opts.anchorBustBottom,
      maxCamScale: 1.0
    })
  }
  project.layers.push(layer)
  return layer
}

function applyMotion(
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

export function createFreshStoryWestDramaV2Project(): Project {
  const project = createProject({
    name: 'Mẫu 6: Tây Du Phá Cục — Đối Thoại Vietsub & Diễn Xuất Cảm Xúc 2.5D',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 32,
    background: '#0b1020'
  })
  project.look = {
    ...project.look,
    fogEnabled: false,
    vignette: 0.14,
    contrast: 1.05,
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
  const s1 = { ...createShot('Cảnh 1 · Hồi Tỉnh & Suy Nghĩ 4 Thầy Trò', [0, 0, 0], 0), id: 'shot-s6-1', color: '#22c55e' }
  const s2 = { ...createShot('Cảnh 2 · Nhiệm Vụ Hệ Thống & Áp Bức Dâng Cao', [sp, 0, 0], 1), id: 'shot-s6-2', color: '#a855f7' }
  const s3 = { ...createShot('Cảnh 3 · Đối Thoại Đèo Thông & Bi Kịch Hài', [sp * 2, 0, 0], 2), id: 'shot-s6-3', color: '#38bdf8' }
  const s4 = { ...createShot('Cảnh 4 · Hầu Vương Nổi Điên & Uy Áp Bạch Cốt', [sp * 3, 0, 0], 3), id: 'shot-s6-4', color: '#f43f5e' }
  const s5 = { ...createShot('Cảnh 5 · Giải Thi 3 Tầng Z & Nhất Kích Bổng', [sp * 4, 0, 0], 4), id: 'shot-s6-5', color: '#f59e0b' }
  project.shots.push(s1, s2, s3, s4, s5)

  // --- CẢNH 1 (0.0s .. 6.2s): Hiện hình từ mờ sang đậm + Suy nghĩ tưởng tượng 4 thầy trò ---
  addDramaPlate(project, assets, 'asset-s5-bg-forest', s1.id, {
    id: 's6-s1-bg', name: 'Nền Rừng Cổ Thụ U Ám', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 0, outPoint: 6.2, autoScale: true
  })
  const s1SkelAwake = addDramaPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's6-s1-skel-awake', name: 'Tiểu Khô Lâu Hiện Hình Mờ → Đậm', x: -45, y: -235, z: 110, scale: 0.9, inPoint: 0, outPoint: 3.0, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyMotion(s1SkelAwake, 'fade_materialize_in', 0, 2.95, { deltaY: 24, fadeOpacity: false })

  const s1SkelThink = addDramaPlate(project, assets, 'asset-s5-skel-shock', s1.id, {
    id: 's6-s1-skel-think', name: 'Tiểu Khô Lâu Suy Nghĩ Về 4 Thầy Trò', x: -210, y: -235, z: 105, scale: 0.9, inPoint: 3.0, outPoint: 6.2, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyMotion(s1SkelThink, 'fade_materialize_in', 3.0, 3.15, { deltaY: 16, fadeOpacity: false })
  const s1ThoughtVision = addDramaPlate(project, assets, 'asset-s5-crew', s1.id, {
    id: 's6-s1-thought-crew', name: 'Hư Ảnh Suy Nghĩ 4 Thầy Trò (Mờ → Đậm → Tan)', x: 175, y: 115, z: 195, scale: 0.72, inPoint: 3.0, outPoint: 6.2, opacity: 0.88, autoScale: true, fadeIn: 0.4, fadeOut: 0.4
  })
  applyMotion(s1ThoughtVision, 'thought_vision_manifest', 3.0, 3.15, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s1ThoughtCloudL = addDramaPlate(project, assets, 'asset-s5-cloud', s1.id, {
    id: 's6-s1-thought-cloud-l', name: 'Mây Suy Nghĩ Tưởng Tượng (Trái)', x: -10, y: -172, z: 185, scale: 0.86, inPoint: 3.0, outPoint: 6.2, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyMotion(s1ThoughtCloudL, 'thought_vision_manifest', 3.0, 3.15, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s1ThoughtCloudM = addDramaPlate(project, assets, 'asset-s5-cloud', s1.id, {
    id: 's6-s1-thought-cloud-m', name: 'Mây Suy Nghĩ Tưởng Tượng (Giữa)', x: 185, y: -176, z: 184, scale: 0.88, inPoint: 3.0, outPoint: 6.2, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyMotion(s1ThoughtCloudM, 'thought_vision_manifest', 3.0, 3.15, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })
  const s1ThoughtCloudR = addDramaPlate(project, assets, 'asset-s5-cloud', s1.id, {
    id: 's6-s1-thought-cloud-r', name: 'Mây Suy Nghĩ Tưởng Tượng (Phải)', x: 385, y: -172, z: 183, scale: 0.86, inPoint: 3.0, outPoint: 6.2, opacity: 0.96, autoScale: true, fadeIn: 0.35, fadeOut: 0.35
  })
  applyMotion(s1ThoughtCloudR, 'thought_vision_manifest', 3.0, 3.15, { deltaY: 32, endScaleMultiplier: 1.06, fadeOpacity: true })

  // --- CẢNH 2 (6.2s .. 12.8s): Góc nhìn qua vai Hệ Thống -> Áp Bức Tăng Dần (4 Thầy Trò To Dần, Khô Lâu Nhỏ Dần) ---
  addDramaPlate(project, assets, 'asset-s5-bg-forest', s2.id, {
    id: 's6-s2-bg', name: 'Nền Rừng Giao Nhiệm Vụ', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 6.2, outPoint: 9.2, autoScale: true
  })
  addDramaPlate(project, assets, 'asset-s5-skel-back', s2.id, {
    id: 's6-s2-skel-ots', name: 'Tiểu Khô Lâu Quay Lưng (OTS)', x: -455, y: -265, z: 45, scale: 1.4, inPoint: 6.2, outPoint: 9.2, anchorBustBottom: true, bodyClass: 'ots_foreground', framing: 'OTS'
  })
  const s2SysScreen = addDramaPlate(project, assets, 'asset-s5-sys-screen', s2.id, {
    id: 's6-s2-sys-screen', name: 'Bảng Hệ Thống — Mục Tiêu Thỉnh Kinh', x: 18, y: 78, z: 155, scale: 1.54, inPoint: 6.2, outPoint: 9.2
  })
  applyMotion(s2SysScreen, 'system_pop_bounce', 6.2, 2.95)
  const s2Robot = addDramaPlate(project, assets, 'asset-s5-robot', s2.id, {
    id: 's6-s2-robot', name: 'Robot Hệ Thống Bay Vào', x: 545, y: -15, z: 65, scale: 0.95, inPoint: 6.2, outPoint: 9.2, bodyClass: 'petite_chibi', framing: 'WS'
  })
  applyMotion(s2Robot, 'slide_in_side', 6.2, 2.95, { deltaX: 240, deltaY: 18 })

  // Nhịp 4 (9.2 .. 12.8s): ÁP BỨC DÂNG CAO TO DẦN vs TIỂU KHÔ LÂU NHỎ DẦN
  const s2CrewTower = addDramaPlate(project, assets, 'asset-s5-crew', s2.id, {
    id: 's6-s2-crew-tower', name: 'Đoàn Đường Tăng Áp Bức (Dâng Cao & To Dần)', x: 0, y: -45, z: 185, scale: 1.25, inPoint: 9.2, outPoint: 12.8, autoScale: true, anchorBustBottom: true, bodyClass: 'boss_imposing', framing: 'MCU'
  })
  applyMotion(s2CrewTower, 'oppressive_tower_grow', 9.2, 3.55, { deltaY: 74, endScaleMultiplier: 1.28 })
  const s2SkelShrink = addDramaPlate(project, assets, 'asset-s5-skel-cry', s2.id, {
    id: 's6-s2-skel-shrink', name: 'Tiểu Khô Lâu Bị Áp Đảo (Co Nhỏ Dần & Run)', x: 0, y: -275, z: 35, scale: 0.9, inPoint: 9.2, outPoint: 12.8, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyMotion(s2SkelShrink, 'oppressed_shrink_tremble', 9.2, 3.55, { deltaX: 6, deltaY: -48, endScaleMultiplier: 0.74 })

  // --- CẢNH 3 (12.8s .. 19.2s): Đối Thoại Đèo Thông (Bạch Cốt Tinh ⇄ Tiểu Khô Lâu) ---
  addDramaPlate(project, assets, 'asset-s5-bg-valley', s3.id, {
    id: 's6-s3-bg', name: 'Nền Đèo Thông Đối Thoại', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 12.8, outPoint: 16.0, autoScale: true
  })
  const s3MaidenTalk = addDramaPlate(project, assets, 'asset-s5-maiden-fear', s3.id, {
    id: 's6-s3-maiden-talk', name: 'Bạch Cốt Tinh Hiện Hình Đối Thoại', x: 215, y: -210, z: 115, scale: 1.0, inPoint: 12.8, outPoint: 16.0, anchorBustBottom: true, bodyClass: 'standard_human', framing: 'MS'
  })
  applyMotion(s3MaidenTalk, 'fade_materialize_in', 12.8, 3.15, { deltaY: 20, fadeOpacity: false })
  addDramaPlate(project, assets, 'asset-s5-skel-shock', s3.id, {
    id: 's6-s3-skel-listen', name: 'Tiểu Khô Lâu Đứng Nghe Đối Thoại', x: -245, y: -235, z: 95, scale: 0.9, inPoint: 12.8, outPoint: 16.0, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })

  const s3SkelSpotlight = addDramaPlate(project, assets, 'asset-s5-skel-cry', s3.id, {
    id: 's6-s3-skel-pity', name: 'Tiểu Khô Lâu Khóc Dưới Đèn Spotlight', x: 0, y: -235, z: 110, scale: 0.9, inPoint: 16.0, outPoint: 19.2, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyMotion(s3SkelSpotlight, 'fade_materialize_in', 16.0, 3.15, { deltaY: 16, fadeOpacity: false })

  // --- CẢNH 4 (19.2s .. 25.6s): Đại Thánh Nổi Điên -> Chỉ Bổng Quát Mắng Bạch Cốt Tinh ---
  const s4WukongRage = addDramaPlate(project, assets, 'asset-s5-wukong-rage', s4.id, {
    id: 's6-s4-wukong-rage', name: 'Tôn Ngộ Không Đỏ Mặt Phát Điên', x: 0, y: -195, z: 105, scale: 1.5, inPoint: 19.2, outPoint: 22.4, anchorBustBottom: true, bodyClass: 'hero_warrior', framing: 'MCU'
  })
  applyMotion(s4WukongRage, 'anger_vein_throb', 19.2, 3.15)

  addDramaPlate(project, assets, 'asset-s5-bg-valley', s4.id, {
    id: 's6-s4-bg', name: 'Nền Đồi Thông Chạm Trán', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 22.4, outPoint: 25.6, autoScale: true
  })
  const s4WukongPoint = addDramaPlate(project, assets, 'asset-s5-wukong', s4.id, {
    id: 's6-s4-wukong-point', name: 'Tôn Ngộ Không Chỉ Bổng Quát Lớn', x: -115, y: -195, z: 120, scale: 1.5, inPoint: 22.4, outPoint: 25.6, anchorBustBottom: true, bodyClass: 'hero_warrior', framing: 'MS'
  })
  applyMotion(s4WukongPoint, 'fade_materialize_in', 22.4, 3.15, { deltaY: 18, fadeOpacity: false })

  // --- CẢNH 5 (25.6s .. 32.0s): Giải Thi Thuật 3 Tầng Z -> Kim Cô Bổng Đập Tiền Cảnh ---
  addDramaPlate(project, assets, 'asset-s5-bg-valley', s5.id, {
    id: 's6-s5-bg', name: 'Nền Đồi Thông Đại Chiến 3 Tầng Z', x: 0, y: 0, z: 1180, scale: 1.08, inPoint: 25.6, outPoint: 32.0, autoScale: true
  })
  addDramaPlate(project, assets, 'asset-s5-far-party', s5.id, {
    id: 's6-s5-far-party', name: 'Đoàn Đường Tăng Toàn Thân Trên Đồi Xa', x: -195, y: -155, z: 680, scale: 0.48, inPoint: 25.6, outPoint: 28.8, autoScale: true
  })
  const s5SoulEscape = addDramaPlate(project, assets, 'asset-s5-maiden-soul', s5.id, {
    id: 's6-s5-soul-escape', name: 'Chân Linh Bạch Cốt Vút Lên Mây (Đậm → Nhạt)', x: 55, y: -75, z: 220, scale: 0.94, inPoint: 25.6, outPoint: 28.8, bodyClass: 'standard_human', framing: 'WS'
  })
  applyMotion(s5SoulEscape, 'soul_escape_ascend', 25.6, 3.15, { deltaX: 165, deltaY: 195, depthZ: 120, fadeOpacity: true })
  addDramaPlate(project, assets, 'asset-s5-cloud-bank', s5.id, {
    id: 's6-s5-mid-cloud', name: 'Biển Mây Trắng Đáy Khung Hình', x: 0, y: -355, z: 120, scale: 2.18, inPoint: 25.6, outPoint: 28.8, autoScale: true
  })
  const s5SkelObserver = addDramaPlate(project, assets, 'asset-s5-skel-shock', s5.id, {
    id: 's6-s5-fg-observer', name: 'Tiểu Khô Lâu Tiền Cảnh Hóng Biến', x: 470, y: -255, z: 40, scale: 0.88, inPoint: 25.6, outPoint: 28.8, anchorBustBottom: true, bodyClass: 'petite_chibi', framing: 'MS'
  })
  applyMotion(s5SkelObserver, 'pop_up_bottom', 25.6, 3.1, { deltaY: 65 })

  const s5MaidenProne = addDramaPlate(project, assets, 'asset-s5-maiden-prone', s5.id, {
    id: 's6-s5-empty-shell', name: 'Bạch Cốt Tinh Toàn Thân Nằm Sấp Trên Cỏ', x: 45, y: -145, z: 180, scale: 1.62, inPoint: 28.8, outPoint: 32.0
  })
  const s5StaffFg = addDramaPlate(project, assets, 'asset-s5-staff-fg', s5.id, {
    id: 's6-s5-staff-fg', name: 'Kim Cô Bổng Phóng Đại Đập Xuyên Tiền Cảnh', x: -235, y: 55, z: -110, scale: 1.12, inPoint: 28.8, outPoint: 32.0
  })
  applyMotion(s5StaffFg, 'foreground_weapon_slam', 28.8, 3.15, { deltaX: 195, deltaY: -145, depthZ: -85, endScaleMultiplier: 1.14 })

  const sparks = createParticleLayer(project.comp)
  sparks.id = 's6-s5-impact-sparks'
  sparks.name = 'Tia Lửa Chấn Động Kim Cô Bổng'
  sparks.shotId = s5.id
  sparks.inPoint = 28.9
  sparks.outPoint = 32.0
  sparks.transform.position.value = [0, 0, 90]
  sparks.props.count = 90
  sparks.props.color = '#facc15'
  project.layers.push(sparks)

  const beats: StoryComicBeatSpec[] = [
    {
      shotId: s1.id, start: 0.0, end: 3.0,
      narration: 'Tỉnh dậy giữa rừng hoang Tây Du trong thân xác một tiểu khô lâu bé nhỏ!',
      speakerName: 'Tiểu Khô Lâu', subjectId: s1SkelAwake.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'world', cameraGrammar: 'confused_push',
      emoteBadge: 'question_giant', emotePosition: [75, 55, 165], transitionAtEnd: 'cut'
    },
    {
      shotId: s1.id, start: 3.0, end: 6.2,
      narration: 'Trong đầu hiện lên bóng dáng 4 thầy trò Đường Tăng... bảo ta đi chặn họ ư?!',
      speakerName: 'Tiểu Khô Lâu (Nội tâm)', subjectId: s1SkelThink.id, secondarySubjectId: s1ThoughtVision.id,
      subtitleStylePreset: 'inner_thought', subtitlePositionPreset: 'top_center', preserveSubtitleSettings: true,
      mood: 'question_sky', cameraGrammar: 'thought_contemplation', transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 6.2, end: 9.2,
      narration: 'Đinh! Nhiệm vụ bắt buộc: Chặn đường đoàn thỉnh kinh tại đèo Bạch Hổ!',
      speakerName: 'Hệ Thống', subjectId: s2Robot.id, subtitleStylePreset: 'system_hologram', preserveSubtitleSettings: true,
      mood: 'world', cameraGrammar: 'over_shoulder_system', transitionAtEnd: 'cut'
    },
    {
      shotId: s2.id, start: 9.2, end: 12.8,
      narration: 'Uy áp của 4 thầy trò ngày càng khổng lồ, ép bộ xương nhỏ muốn nát vụn!',
      speakerName: 'Tiểu Khô Lâu', subjectId: s2SkelShrink.id, secondarySubjectId: s2CrewTower.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'speedlines_radial', cameraGrammar: 'oppressive_low_push',
      emoteBadge: 'red_eye_flare', emotePosition: [-165, 155, 45], transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 12.8, end: 16.0,
      narration: 'Tiểu huynh đệ, con khỉ họ Tôn kia sắp đánh tới rồi, mau nghĩ cách đi!',
      speakerName: 'Bạch Cốt Tinh', subjectId: s3MaidenTalk.id, subtitleStylePreset: 'cinema_gold', subtitlePositionPreset: 'above_speaker',
      mood: 'world', cameraGrammar: 'confused_push', transitionAtEnd: 'cut'
    },
    {
      shotId: s3.id, start: 16.0, end: 19.2,
      narration: 'Ta chỉ là bộ xương khô cấp một, chịu một gậy là tan thành tro bụi mất!',
      speakerName: 'Tiểu Khô Lâu', subjectId: s3SkelSpotlight.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'spotlight_stage', cameraGrammar: 'spotlight_pity_pull', transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 19.2, end: 22.4,
      narration: 'Con khỉ tức giận đến phát điên, sát khí bùng nổ khắp sườn đồi!',
      speakerName: 'Tôn Ngộ Không', subjectId: s4WukongRage.id, subtitleStylePreset: 'comic_shout', preserveSubtitleSettings: true,
      mood: 'anger_veins', cameraGrammar: 'rage_punch_shake', transitionAtEnd: 'cut'
    },
    {
      shotId: s4.id, start: 22.4, end: 25.6,
      narration: 'Yêu nghiệt phương nào dám bày trò giả thần giả quỷ trước mặt Lão Tôn!',
      speakerName: 'Tôn Ngộ Không', subjectId: s4WukongPoint.id, subtitleStylePreset: 'comic_shout', preserveSubtitleSettings: true,
      mood: 'world', cameraGrammar: 'confrontation_push', transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 25.6, end: 28.8,
      narration: 'Bạch Cốt Tinh kinh hãi tột độ, vội thi triển Giải Thi Thuật vút lên tầng mây!',
      speakerName: 'Bạch Cốt Tinh', subjectId: s5SoulEscape.id, subtitleStylePreset: 'lugia_cyan',
      mood: 'world', cameraGrammar: 'three_plane_escape', transitionAtEnd: 'cut'
    },
    {
      shotId: s5.id, start: 28.8, end: 32.0,
      narration: 'Ầm! Kim Cô Bổng ngàn cân giáng thẳng xuống cái xác không hồn trên mặt cỏ!',
      speakerName: 'Dẫn truyện', subjectId: s5MaidenProne.id, subtitleStylePreset: 'cinema_gold',
      mood: 'world', cameraGrammar: 'foreground_weapon_slam', transitionAtEnd: 'flash_dissolve'
    }
  ]

  for (const beat of beats) {
    stageStoryComicBeat(project, beat)
  }
  applyStoryComicCamera(project, beats)

  project.audioTracks = beats
    .filter((b) => Boolean(b.subjectId))
    .map((b, idx): AudioTrackItem => ({
      id: `voice-s6-b${idx + 1}`,
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
  project.workflow = syncWorkflowV2Graph(project)

  // Gắn thêm các Node Logic nguyên tử và Time Group minh hoạ trên sơ đồ Workflow V2
  const res1 = attachLogicNodeToLayerV2(
    project.workflow,
    v2LayerNodeId(s2CrewTower.id),
    'fx',
    'v2:fx:glow',
    { animFxColor: '#ef4444', intensity: 1.4, timeStart: 9.2, timeEnd: 12.8 },
    'Phát sáng: Hào Quang Sát Khí Đỏ'
  )
  project.workflow = res1.workflow

  const escapeGroupIds = new Set([
    v2LayerNodeId(s5SoulEscape.id),
    v2LayerNodeId('s6-s5-mid-cloud'),
    v2LayerNodeId('s6-s5-far-party'),
    v2LayerNodeId(s5SkelObserver.id)
  ])
  createTimeGroup(
    project,
    project.workflow.nodes.filter((n) => escapeGroupIds.has(n.id)),
    { title: 'Nhịp 9: Giải Thi Thuật 3 Tầng Z (25.6s–28.8s)', color: '#38bdf8', start: 25.6, end: 28.8 }
  )

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}

export function repairStoryWestDramaV2Timing(project: Project): Project {
  project.comp.duration = Math.max(project.comp.duration, 32)
  validateAndRepairDialogueContinuity(project, true)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}
