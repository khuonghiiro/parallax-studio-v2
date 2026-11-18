import type {
  Project,
  Shot,
  SubtitleBubbleTail,
  SubtitlePositionPreset,
  SubtitleStylePresetId,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import {
  applyStoryComicCamera,
  stageStoryComicBeat,
  type StoryComicBeatSpec
} from '../animation/storyComicDirector'
import { createProject, createShot, shotSpacing } from './factory'
import {
  loadSimLifeAssetMap,
  placeSimCharacterLayer,
  placeSimForegroundProp,
  placeSimWorldBackdrop
} from './simLifeDemoAssets'
import {
  getDefaultSubtitleConfig,
  validateAndRepairDialogueContinuity
} from './subtitleAndDialogueSync'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from './workflowV2Engine'

type SpawnCategory = Parameters<typeof attachLogicNodeToLayerV2>[2]

/** Gắn một Node logic đơn nhiệm vào `targetNodeId` và đồng bộ xuống Project. */
export function attachAtomicNode(
  project: Project,
  targetNodeId: string,
  category: SpawnCategory,
  presetId: string,
  params: Partial<WorkflowNodeParams>,
  title?: string
): WorkflowNode {
  const res = attachLogicNodeToLayerV2(
    project.workflow!,
    targetNodeId,
    category,
    presetId,
    params,
    title
  )
  project.workflow = res.workflow
  const node = project.workflow.nodes.find((n) => n.id === res.createdNodeId)
  if (!node) throw new Error(`Không thể gắn node đơn nhiệm ${presetId} vào ${targetNodeId}`)
  syncWorkflowV2NodeToProject(project, node, params)
  return node
}

/** Gắn Node Vietsub / Hộp thoại đơn nhiệm vào đúng Layer nhân vật đang nói. */
export function attachAtomicSubtitle(
  project: Project,
  speakerLayerId: string,
  opts: {
    presetId: string
    stylePreset: SubtitleStylePresetId
    speakerName: string
    text: string
    start: number
    end: number
    positionPreset?: SubtitlePositionPreset
    offsetX?: number
    offsetY?: number
    bubbleTail?: SubtitleBubbleTail
    preserveCustomSettings?: boolean
    title?: string
  }
): WorkflowNode {
  return attachAtomicNode(
    project,
    v2LayerNodeId(speakerLayerId),
    'subtitle',
    opts.presetId,
    {
      subtitleText: opts.text,
      subtitleSpeakerName: opts.speakerName,
      subtitleStylePreset: opts.stylePreset,
      ...(opts.positionPreset ? { subtitlePositionPreset: opts.positionPreset } : {}),
      ...(opts.offsetX !== undefined ? { subtitleOffsetX: opts.offsetX } : {}),
      ...(opts.offsetY !== undefined ? { subtitleOffsetY: opts.offsetY } : {}),
      ...(opts.bubbleTail ? { subtitleBubbleTail: opts.bubbleTail } : {}),
      ...(opts.preserveCustomSettings !== undefined
        ? { preserveCustomSettings: opts.preserveCustomSettings }
        : {}),
      timeStart: opts.start,
      timeEnd: opts.end
    },
    opts.title ?? `Thoại: ${opts.speakerName}`
  )
}

export function createThreeShots(project: Project, names: [string, string, string]): [Shot, Shot, Shot] {
  const stepX = shotSpacing(project.comp)
  const colors = ['#06b6d4', '#f59e0b', '#a855f7']
  const shots = names.map((name, idx) => {
    const sh = createShot(name, [idx * stepX, 0, 0], idx)
    sh.id = `shot-${idx + 1}`
    sh.color = colors[idx]
    return sh
  }) as [Shot, Shot, Shot]
  project.shots = shots
  return shots
}

/**
 * Mẫu thử 1 (`sim_life_ep1_gate` — Mẫu 4 trên menu):
 * "Mô Phỏng Nhân Sinh — Mở Màn Sơn Môn (0:00–0:32)"
 * Dựng từ phút đầu video tham khảo `eeEtV-03ivE` kết hợp kỹ thuật 2.5D Shadiao `XEEUxp_kAu8`,
 * 100% logic tách thành các Node đơn nhiệm (BBox, Lơ lửng, Mờ/Hiện, Nhịp thở, Viền sáng, Vietsub & Bóng thoại).
 */
export async function buildSimLifeEp1GateProject(): Promise<Project> {
  const project = createProject({
    name: 'Mẫu 4: Mô Phỏng Nhân Sinh — Mở Màn Sơn Môn (2.5D)',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 32,
    background: '#070b16'
  })
  project.subtitleDefaults = getDefaultSubtitleConfig('lugia_cyan')
  const assets = await loadSimLifeAssetMap(project)
  const [shot1, shot2, shot3] = createThreeShots(project, [
    'Cảnh 1 · Vòng Xoáy Xuyên Không & Hệ Thống',
    'Cảnh 2 · Bị Đuổi Khỏi Thanh Huyền Tông',
    'Cảnh 3 · Nạp Đầy Năng Lượng Khởi Động'
  ])

  // --- CẢNH 1 (0.0s -> 10.8s): 3 nhịp câu ---
  placeSimWorldBackdrop(project, assets, {
    id: 'g-s1-vortex-b1',
    shotId: shot1.id,
    assetId: 'asset-sim-vortex-bg',
    name: 'Nền Xoáy Thời Không (Nhịp 1)',
    inPoint: 0,
    outPoint: 3.4
  })
  const b1Cloud = placeSimForegroundProp(project, assets, {
    id: 'g-s1-cloud-b1',
    shotId: shot1.id,
    assetId: 'asset-sim-cloud-puff',
    name: 'Sương Linh Khí Tiền Cảnh',
    x: -360,
    y: -260,
    z: -70,
    scale: 0.9,
    inPoint: 0,
    outPoint: 3.4,
    opacity: 0.72
  })
  const b1Mc = placeSimCharacterLayer(project, assets, {
    id: 'g-s1-mc-b1',
    shotId: shot1.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch (Xuyên Không Phàm Nhân)',
    x: -90,
    y: -60,
    z: 180,
    inPoint: 0,
    outPoint: 3.4,
    bodyClass: 'standard_human',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b2Robot = placeSimCharacterLayer(project, assets, {
    id: 'g-s1-robot-b2',
    shotId: shot1.id,
    assetId: 'asset-sim-robot',
    name: 'Robot Trình Mô Phỏng (Nhịp 2)',
    x: -445,
    y: 45,
    z: 120,
    inPoint: 3.4,
    outPoint: 7.0,
    bodyClass: 'petite_chibi',
    framing: 'MCU',
    customMultiplier: 0.68
  })

  placeSimWorldBackdrop(project, assets, {
    id: 'g-s1-vortex-b3',
    shotId: shot1.id,
    assetId: 'asset-sim-vortex-bg',
    name: 'Nền Hấp Thụ Tu Vi (Nhịp 3)',
    inPoint: 7.0,
    outPoint: 10.8
  })
  const b3McGold = placeSimCharacterLayer(project, assets, {
    id: 'g-s1-mc-gold-b3',
    shotId: shot1.id,
    assetId: 'asset-sim-tieu-bach-meditate',
    name: 'Tiểu Bạch (Tổng Kết Tu Vi & Đan Dược)',
    x: 0,
    y: -20,
    z: 150,
    inPoint: 7.0,
    outPoint: 10.8,
    bodyClass: 'hero_warrior',
    framing: 'MCU'
  })

  // --- CẢNH 2 (10.8s -> 21.8s): Sơn môn Thanh Huyền Tông ---
  placeSimWorldBackdrop(project, assets, {
    id: 'g-s2-gate-b4',
    shotId: shot2.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Sơn Môn Thanh Huyền Tông (Nhịp 4)',
    inPoint: 10.8,
    outPoint: 14.8
  })
  const b4Cloud = placeSimForegroundProp(project, assets, {
    id: 'g-s2-cloud-fg-b4',
    shotId: shot2.id,
    assetId: 'asset-sim-cloud-fg',
    name: 'Biển Mây Bậc Đá Tiền Cảnh',
    x: 0,
    y: -395,
    z: -80,
    scale: 1.68,
    inPoint: 10.8,
    outPoint: 14.8,
    opacity: 0.65
  })
  const b4Gatekeeper = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-gatekeeper-b4',
    shotId: shot2.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Đệ Tử Gác Cổng Áo Tím',
    x: 270,
    y: -45,
    z: 185,
    inPoint: 10.8,
    outPoint: 14.8,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })
  const b4Mc = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-mc-sad-b4',
    shotId: shot2.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch (Bị Đuổi Rời Sơn Môn)',
    x: -290,
    y: -55,
    z: 95,
    inPoint: 10.8,
    outPoint: 14.8,
    bodyClass: 'standard_human',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b5Mc = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-mc-shock-b5',
    shotId: shot2.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch (Nghe Tiếng Hệ Thống)',
    x: -180,
    y: -50,
    z: 120,
    inPoint: 14.8,
    outPoint: 18.2,
    bodyClass: 'standard_human',
    framing: 'MCU',
    anchorBustBottom: true
  })
  const b5Robot = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-robot-b5',
    shotId: shot2.id,
    assetId: 'asset-sim-robot',
    name: 'Robot Hệ Thống Xuất Hiện',
    x: 235,
    y: 95,
    z: 85,
    inPoint: 14.8,
    outPoint: 18.2,
    bodyClass: 'petite_chibi',
    framing: 'MCU',
    customMultiplier: 0.68
  })

  placeSimWorldBackdrop(project, assets, {
    id: 'g-s2-gate-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Sơn Môn Thanh Huyền Tông (Nhịp 6)',
    inPoint: 18.2,
    outPoint: 21.8
  })
  const b6Mc = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-mc-ask-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch (Hỏi Chức Năng Hệ Thống)',
    x: -190,
    y: -50,
    z: 120,
    inPoint: 18.2,
    outPoint: 21.8,
    bodyClass: 'standard_human',
    framing: 'MCU',
    anchorBustBottom: true
  })
  const b6Robot = placeSimCharacterLayer(project, assets, {
    id: 'g-s2-robot-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-robot',
    name: 'Robot Hệ Thống Lơ Lửng',
    x: 240,
    y: 80,
    z: 95,
    inPoint: 18.2,
    outPoint: 21.8,
    bodyClass: 'petite_chibi',
    framing: 'MS',
    customMultiplier: 0.66
  })

  // --- CẢNH 3 (21.8s -> 32.0s): Giải thích quy tắc & Bắt đầu mô phỏng ---
  const b7Robot = placeSimCharacterLayer(project, assets, {
    id: 'g-s3-robot-b7',
    shotId: shot3.id,
    assetId: 'asset-sim-robot',
    name: 'Robot Giải Thích Quy Tắc Thiên Địa',
    x: 0,
    y: 45,
    z: 115,
    inPoint: 21.8,
    outPoint: 25.4,
    bodyClass: 'petite_chibi',
    framing: 'CU',
    customMultiplier: 0.78
  })

  placeSimWorldBackdrop(project, assets, {
    id: 'g-s3-gate-b8',
    shotId: shot3.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Nền Thanh Huyền Tông Trước Mô Phỏng',
    inPoint: 25.4,
    outPoint: 29.0
  })
  const b8Mc = placeSimCharacterLayer(project, assets, {
    id: 'g-s3-mc-ready-b8',
    shotId: shot3.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch (Trước Bảng Xác Nhận)',
    x: -330,
    y: -55,
    z: 110,
    inPoint: 25.4,
    outPoint: 29.0,
    bodyClass: 'standard_human',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b9McGold = placeSimCharacterLayer(project, assets, {
    id: 'g-s3-mc-start-b9',
    shotId: shot3.id,
    assetId: 'asset-sim-tieu-bach-meditate',
    name: 'Tiểu Bạch (Kích Hoạt Mô Phỏng)',
    x: 0,
    y: -15,
    z: 120,
    inPoint: 29.0,
    outPoint: 32.0,
    bodyClass: 'hero_warrior',
    framing: 'MCU'
  })

  // Dàn dựng Mood tâm lý, Hologram Quest & Lộ trình Camera phẳng 2.5D
  const beatSpecs: StoryComicBeatSpec[] = [
    { shotId: shot1.id, start: 0, end: 3.4, mood: 'world', cameraGrammar: 'cold_open_shock', subjectId: b1Mc.id },
    {
      shotId: shot1.id,
      start: 3.4,
      end: 7.0,
      mood: 'comic_burst',
      cameraGrammar: 'over_shoulder_system',
      subjectId: b2Robot.id,
      systemQuest: {
        title: '[ TRÌNH MÔ PHỎNG CUỘC ĐỜI ]',
        body: 'Chỉ có thể mô phỏng cuộc đời của người khác để nhận tu vi & linh bảo!',
        position: [230, 75, 175]
      }
    },
    { shotId: shot1.id, start: 7.0, end: 10.8, mood: 'world', cameraGrammar: 'low_angle_menace', subjectId: b3McGold.id },
    { shotId: shot2.id, start: 10.8, end: 14.8, mood: 'world', cameraGrammar: 'confrontation_push', subjectId: b4Gatekeeper.id, secondarySubjectId: b4Mc.id },
    { shotId: shot2.id, start: 14.8, end: 18.2, mood: 'question_sky', cameraGrammar: 'snap_reaction_zoom', subjectId: b5Robot.id, emoteBadge: 'question_giant', emotePosition: [-15, 110, 165] },
    { shotId: shot2.id, start: 18.2, end: 21.8, mood: 'world', cameraGrammar: 'confused_push', subjectId: b6Mc.id },
    { shotId: shot3.id, start: 21.8, end: 25.4, mood: 'speedlines_radial', cameraGrammar: 'thought_contemplation', subjectId: b7Robot.id },
    {
      shotId: shot3.id,
      start: 25.4,
      end: 29.0,
      mood: 'world',
      cameraGrammar: 'over_shoulder_system',
      subjectId: b8Mc.id,
      systemQuest: {
        title: '[ NĂNG LƯỢNG ĐÃ ĐẦY 100% ]',
        body: 'Ngài có muốn bắt đầu mô phỏng cuộc đời ngay không?  [ CÓ ]  /  [ KHÔNG ]',
        position: [215, 70, 170]
      }
    },
    { shotId: shot3.id, start: 29.0, end: 32.0, mood: 'comic_burst', cameraGrammar: 'cold_open_shock', subjectId: b9McGold.id }
  ]
  for (const spec of beatSpecs) stageStoryComicBeat(project, spec)
  applyStoryComicCamera(project, beatSpecs)

  // Khởi tạo đồ thị Workflow V2 và nối các Node đơn nhiệm độc lập (Motion, FX, Vietsub, Bóng thoại)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Beat 1: Tiểu Bạch trượt vào xoáy + Mờ/Hiện + Vietsub Lugia Cyan
  const nB1Mot = attachAtomicNode(project, v2LayerNodeId(b1Mc.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest',
    bboxTargetX: -15, bboxTargetY: -60, bboxTargetScalePct: 106, depthMode: 'keep', bboxStartZ: 180, bboxTargetZ: 145, timeStart: 0, timeEnd: 3.4
  }, 'Motion: Rơi Vào Xoáy Không Gian')
  attachAtomicNode(project, nB1Mot.id, 'fx', 'v2:fx:fadeInOut', {
    animFxPreset: 'fadeInOut', loopFadeInSec: 0.25, loopFadeOutSec: 0.2, timeStart: 0, timeEnd: 3.4
  }, 'FX: Hiện Mượt Đầu Cảnh')
  attachAtomicNode(project, v2LayerNodeId(b1Cloud.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 0.9, timeStart: 0, timeEnd: 3.4
  }, 'Motion: Sương Linh Khí Trôi')
  attachAtomicSubtitle(project, b1Mc.id, {
    presetId: 'v2:subtitle:lugia_cyan',
    stylePreset: 'lugia_cyan',
    speakerName: 'Dẫn truyện',
    text: 'Xuyên không có ý thức, nhưng ngươi lại là phàm nhân không có linh căn!',
    start: 0,
    end: 3.4
  })

  // Beat 2: Robot lơ lửng + Nhịp thở + Phụ đề Hệ Thống Hologram (khoá riêng)
  const nB2Float = attachAtomicNode(project, v2LayerNodeId(b2Robot.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 1.1, timeStart: 3.4, timeEnd: 7.0
  }, 'Motion: Robot Bay Lơ Lửng')
  attachAtomicNode(project, nB2Float.id, 'fx', 'v2:fx:pulse', {
    animFxPreset: 'pulse', intensity: 0.35, animFxSpeed: 2.2, timeStart: 3.4, timeEnd: 7.0
  }, 'FX: Nhịp Đập Điện Tử')
  attachAtomicSubtitle(project, b2Robot.id, {
    presetId: 'v2:subtitle:system_hologram',
    stylePreset: 'system_hologram',
    speakerName: 'Hệ Thống',
    text: 'Đinh! Trình mô phỏng này chỉ có thể mô phỏng cuộc đời của người khác!',
    start: 3.4,
    end: 7.0,
    preserveCustomSettings: true
  })

  // Beat 3: Tiểu Bạch tụ khí kim quang (Viền sáng + Lơ lửng)
  const nB3Float = attachAtomicNode(project, v2LayerNodeId(b3McGold.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 0.75, timeStart: 7.0, timeEnd: 10.8
  }, 'Motion: Tọa Thiền Ngự Khí')
  attachAtomicNode(project, nB3Float.id, 'fx', 'v2:fx:neonSolid', {
    animFxPreset: 'neonSolid', animFxColor: '#facc15', intensity: 0.65, animFxThickness: 7, timeStart: 7.0, timeEnd: 10.8
  }, 'FX: Kim Quang Đột Phá')
  attachAtomicSubtitle(project, b3McGold.id, {
    presetId: 'v2:subtitle:lugia_cyan',
    stylePreset: 'lugia_cyan',
    speakerName: 'Dẫn truyện',
    text: 'Sau khi mô phỏng kết thúc, hệ thống tổng kết tu vi, linh khí và đan dược!',
    start: 7.0,
    end: 10.8
  })

  // Beat 4: Đệ tử gác cổng đuổi bằng Bóng thoại truyện tranh + Tiểu Bạch lùi bước BBox
  attachAtomicNode(project, v2LayerNodeId(b4Mc.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest',
    bboxTargetX: -395, bboxTargetY: -55, bboxTargetScalePct: 97, depthMode: 'keep', bboxStartZ: 95, bboxTargetZ: 115, timeStart: 10.8, timeEnd: 14.8
  }, 'Motion: Tiểu Bạch Lùi Bước')
  attachAtomicNode(project, v2LayerNodeId(b4Cloud.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 0.65, timeStart: 10.8, timeEnd: 14.8
  }, 'Motion: Mây Sơn Môn Trôi')
  attachAtomicSubtitle(project, b4Gatekeeper.id, {
    presetId: 'v2:subtitle:comic_bubble',
    stylePreset: 'comic_bubble',
    speakerName: 'Đệ Tử Gác Cổng',
    text: 'Tiên môn trọng địa, phàm nhân không linh căn mau rời đi!',
    start: 10.8,
    end: 14.8,
    positionPreset: 'above_speaker',
    offsetX: -65,
    offsetY: 365,
    bubbleTail: 'bottom',
    preserveCustomSettings: true
  })

  // Beat 5: Hệ thống Đinh! thức tỉnh
  attachAtomicNode(project, v2LayerNodeId(b5Mc.id), 'fx', 'v2:fx:shake', {
    animFxPreset: 'shake', intensity: 0.28, animFxSpeed: 6, timeStart: 14.8, timeEnd: 16.0
  }, 'FX: Giật Mình Kinh Ngạc')
  attachAtomicNode(project, v2LayerNodeId(b5Robot.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 1.15, timeStart: 14.8, timeEnd: 18.2
  }, 'Motion: Robot Hiện Thân')
  attachAtomicSubtitle(project, b5Robot.id, {
    presetId: 'v2:subtitle:system_hologram',
    stylePreset: 'system_hologram',
    speakerName: 'Hệ Thống',
    text: 'Đinh! Trình mô phỏng cuộc đời xin phục vụ ngài!',
    start: 14.8,
    end: 18.2,
    preserveCustomSettings: true
  })

  // Beat 6: Tiểu Bạch mừng rỡ hỏi Hệ thống bằng Bóng thoại
  attachAtomicNode(project, v2LayerNodeId(b6Mc.id), 'fx', 'v2:fx:pulse', {
    animFxPreset: 'pulse', intensity: 0.3, animFxSpeed: 2.0, timeStart: 18.2, timeEnd: 21.8
  }, 'FX: Hào Hứng Hỏi Hệ Thống')
  attachAtomicNode(project, v2LayerNodeId(b6Robot.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 0.9, timeStart: 18.2, timeEnd: 21.8
  }, 'Motion: Robot Lắng Nghe')
  attachAtomicSubtitle(project, b6Mc.id, {
    presetId: 'v2:subtitle:comic_bubble',
    stylePreset: 'comic_bubble',
    speakerName: 'Tiểu Bạch',
    text: 'Hệ thống?! Mau nói cho ta biết ngươi có chức năng gì?',
    start: 18.2,
    end: 21.8,
    positionPreset: 'above_speaker',
    offsetX: 60,
    offsetY: 365,
    bubbleTail: 'bottom',
    preserveCustomSettings: true
  })

  // Beat 7: Robot giải thích quy tắc với phụ đề thẻ trắng Shadiao (Video 2)
  const nB7Float = attachAtomicNode(project, v2LayerNodeId(b7Robot.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 1.0, timeStart: 21.8, timeEnd: 25.4
  }, 'Motion: Robot Giảng Giải')
  attachAtomicNode(project, nB7Float.id, 'fx', 'v2:fx:neonSolid', {
    animFxPreset: 'neonSolid', animFxColor: '#38bdf8', intensity: 0.6, animFxThickness: 6, timeStart: 21.8, timeEnd: 25.4
  }, 'FX: Hào Quang Lam Hệ Thống')
  attachAtomicSubtitle(project, b7Robot.id, {
    presetId: 'v2:subtitle:dino_white_pill',
    stylePreset: 'dino_white_pill',
    speakerName: 'Hệ Thống',
    text: 'Mô phỏng đến khi ký chủ qua đời, tự động hấp thụ năng lượng quy tắc thiên địa!',
    start: 21.8,
    end: 25.4,
    preserveCustomSettings: true
  })

  // Beat 8: Năng lượng đầy 100%
  attachAtomicSubtitle(project, b8Mc.id, {
    presetId: 'v2:subtitle:system_hologram',
    stylePreset: 'system_hologram',
    speakerName: 'Hệ Thống',
    text: 'Năng lượng đã tích luỹ đầy! Ngài có muốn bắt đầu mô phỏng không?',
    start: 25.4,
    end: 29.0,
    preserveCustomSettings: true
  })

  // Beat 9: Cao trào kích hoạt mô phỏng
  const nB9Pulse = attachAtomicNode(project, v2LayerNodeId(b9McGold.id), 'fx', 'v2:fx:pulse', {
    animFxPreset: 'pulse', intensity: 0.42, animFxSpeed: 2.6, timeStart: 29.0, timeEnd: 32.0
  }, 'FX: Bùng Nổ Linh Khí')
  attachAtomicNode(project, nB9Pulse.id, 'fx', 'v2:fx:neonSolid', {
    animFxPreset: 'neonSolid', animFxColor: '#fde047', intensity: 0.72, animFxThickness: 8, timeStart: 29.0, timeEnd: 32.0
  }, 'FX: Viền Kim Quang Khởi Động')
  attachAtomicSubtitle(project, b9McGold.id, {
    presetId: 'v2:subtitle:comic_shout',
    stylePreset: 'comic_shout',
    speakerName: 'Tiểu Bạch',
    text: 'Bắt đầu mô phỏng ngay cho ta!',
    start: 29.0,
    end: 32.0,
    preserveCustomSettings: true
  })

  validateAndRepairDialogueContinuity(project, true)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}

export { buildSimLifeEp1TwistProject } from './simLifeEp1TwistBuilder'
