import type { Project } from '@shared/types'
import {
  applyStoryComicCamera,
  stageStoryComicBeat,
  type StoryComicBeatSpec
} from '../animation/storyComicDirector'
import { createProject } from './factory'
import {
  loadSimLifeAssetMap,
  placeSimCharacterLayer,
  placeSimForegroundProp,
  placeSimWorldBackdrop
} from './simLifeDemoAssets'
import {
  attachAtomicNode,
  attachAtomicSubtitle,
  createThreeShots
} from './simLifeDemoBuilder'
import {
  getDefaultSubtitleConfig,
  validateAndRepairDialogueContinuity
} from './subtitleAndDialogueSync'
import { syncWorkflowV2Graph, v2LayerNodeId } from './workflowV2Engine'

/**
 * Mẫu thử 2 (`sim_life_ep1_twist` — Mẫu 5 trên menu):
 * "Mô Phỏng Nhân Sinh — Oan Gia Gác Cổng (0:32–1:05)"
 * Dựng cú twist hài kịch (đuổi chính bản thân mình khỏi sơn môn, khoanh tay phồng má Shadiao,
 * canh cổng 2 tháng, tái ngộ Tiểu Bạch và nhận thưởng Trúc Cơ Sơ Kỳ).
 */
export async function buildSimLifeEp1TwistProject(): Promise<Project> {
  const project = createProject({
    name: 'Mẫu 5: Mô Phỏng Nhân Sinh — Oan Gia Gác Cổng (2.5D)',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 33,
    background: '#080c18'
  })
  project.subtitleDefaults = getDefaultSubtitleConfig('lugia_cyan')
  const assets = await loadSimLifeAssetMap(project)
  const [shot1, shot2, shot3] = createThreeShots(project, [
    'Cảnh 1 · Cú Twist Đuổi Chính Mình Ở Sơn Môn',
    'Cảnh 2 · Ngơ Ngác Cạn Lời & Hai Tháng Canh Cổng',
    'Cảnh 3 · Tái Ngộ Tiểu Bạch & Thưởng Trúc Cơ'
  ])

  // --- CẢNH 1 (0.0s -> 11.2s) ---
  placeSimWorldBackdrop(project, assets, {
    id: 't-s1-gate-b1',
    shotId: shot1.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Sơn Môn Thanh Huyền Môn (Nhịp 1)',
    inPoint: 0,
    outPoint: 3.6
  })
  const b1Keeper = placeSimCharacterLayer(project, assets, {
    id: 't-s1-keeper-b1',
    shotId: shot1.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Nhập Vai Đệ Tử Gác Cổng',
    x: -360,
    y: -45,
    z: 130,
    inPoint: 0,
    outPoint: 3.6,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })

  placeSimWorldBackdrop(project, assets, {
    id: 't-s1-gate-b2',
    shotId: shot1.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Sơn Môn Thanh Huyền Môn (Nhịp 2)',
    inPoint: 3.6,
    outPoint: 7.4
  })
  const b2Keeper = placeSimCharacterLayer(project, assets, {
    id: 't-s1-keeper-b2',
    shotId: shot1.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Đệ Tử Gác Cổng Đuổi Khách',
    x: 250,
    y: -45,
    z: 165,
    inPoint: 3.6,
    outPoint: 7.4,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })
  const b2Mortal = placeSimCharacterLayer(project, assets, {
    id: 't-s1-mortal-b2',
    shotId: shot1.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Người Phàm Bị Đuổi Khỏi Cổng',
    x: -250,
    y: -55,
    z: 95,
    inPoint: 3.6,
    outPoint: 7.4,
    bodyClass: 'standard_human',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b3Pout = placeSimCharacterLayer(project, assets, {
    id: 't-s1-pout-b3',
    shotId: shot1.id,
    assetId: 'asset-sim-tieu-bach-pout',
    name: 'Tiểu Bạch Khoanh Tay Phồng Má (Nổi Điên)',
    x: 0,
    y: -45,
    z: 110,
    inPoint: 7.4,
    outPoint: 11.2,
    bodyClass: 'standard_human',
    framing: 'CU',
    anchorBustBottom: true
  })

  // --- CẢNH 2 (11.2s -> 22.0s) ---
  const b4Pout = placeSimCharacterLayer(project, assets, {
    id: 't-s2-pout-b4',
    shotId: shot2.id,
    assetId: 'asset-sim-tieu-bach-pout',
    name: 'Tiểu Bạch Ngơ Ngác Nhận Ra Chính Mình',
    x: -150,
    y: -45,
    z: 115,
    inPoint: 11.2,
    outPoint: 14.8,
    bodyClass: 'standard_human',
    framing: 'MCU',
    anchorBustBottom: true
  })

  const b5Robot = placeSimCharacterLayer(project, assets, {
    id: 't-s2-robot-b5',
    shotId: shot2.id,
    assetId: 'asset-sim-robot',
    name: 'Robot Giả Ngơ Im Lặng',
    x: 0,
    y: 30,
    z: 130,
    inPoint: 14.8,
    outPoint: 18.4,
    bodyClass: 'petite_chibi',
    framing: 'MS',
    customMultiplier: 0.72
  })

  placeSimWorldBackdrop(project, assets, {
    id: 't-s2-bamboo-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-bamboo-bg',
    name: 'Hành Lang Canh Cổng Tháng Thứ Hai',
    inPoint: 18.4,
    outPoint: 22.0
  })
  const b6Cloud = placeSimForegroundProp(project, assets, {
    id: 't-s2-cloud-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-cloud-fg',
    name: 'Mây Trôi Qua Tháng Năm',
    x: 0,
    y: -395,
    z: -75,
    scale: 1.65,
    inPoint: 18.4,
    outPoint: 22.0,
    opacity: 0.65
  })
  const b6Keeper = placeSimCharacterLayer(project, assets, {
    id: 't-s2-keeper-b6',
    shotId: shot2.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Canh Cổng Ròng Rã Hai Tháng',
    x: 90,
    y: -45,
    z: 155,
    inPoint: 18.4,
    outPoint: 22.0,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })

  // --- CẢNH 3 (22.0s -> 33.0s) ---
  placeSimWorldBackdrop(project, assets, {
    id: 't-s3-gate-b78',
    shotId: shot3.id,
    assetId: 'asset-sim-sect-gate-bg',
    name: 'Sơn Môn Tái Ngộ Tiểu Bạch',
    inPoint: 22.0,
    outPoint: 29.4
  })
  const b7Mortal = placeSimCharacterLayer(project, assets, {
    id: 't-s3-mortal-walk-b7',
    shotId: shot3.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch Bước Lên Bậc Đá Sơn Môn',
    x: -340,
    y: -35,
    z: 310,
    inPoint: 22.0,
    outPoint: 25.8,
    bodyClass: 'standard_human',
    framing: 'WS'
  })
  const b7Keeper = placeSimCharacterLayer(project, assets, {
    id: 't-s3-keeper-watch-b7',
    shotId: shot3.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Đệ Tử Gác Cổng Nhìn Xuống',
    x: 265,
    y: -45,
    z: 120,
    inPoint: 22.0,
    outPoint: 25.8,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b8Mortal = placeSimCharacterLayer(project, assets, {
    id: 't-s3-mortal-listen-b8',
    shotId: shot3.id,
    assetId: 'asset-sim-tieu-bach-mortal',
    name: 'Tiểu Bạch Lắng Nghe Khuyên Nhủ',
    x: -260,
    y: -55,
    z: 125,
    inPoint: 25.8,
    outPoint: 29.4,
    bodyClass: 'standard_human',
    framing: 'MS',
    anchorBustBottom: true
  })
  const b8Keeper = placeSimCharacterLayer(project, assets, {
    id: 't-s3-keeper-talk-b8',
    shotId: shot3.id,
    assetId: 'asset-sim-gatekeeper',
    name: 'Đệ Tử Gác Cổng Giải Thích Quy Tắc Tông Môn',
    x: 255,
    y: -45,
    z: 135,
    inPoint: 25.8,
    outPoint: 29.4,
    bodyClass: 'hero_warrior',
    framing: 'MS',
    anchorBustBottom: true
  })

  const b9RewardMc = placeSimCharacterLayer(project, assets, {
    id: 't-s3-mc-reward-b9',
    shotId: shot3.id,
    assetId: 'asset-sim-tieu-bach-meditate',
    name: 'Tiểu Bạch Nhận Tu Vi Trúc Cơ Sơ Kỳ',
    x: -380,
    y: -20,
    z: 120,
    inPoint: 29.4,
    outPoint: 33.0,
    bodyClass: 'hero_warrior',
    framing: 'MS'
  })

  const beatSpecs: StoryComicBeatSpec[] = [
    {
      shotId: shot1.id,
      start: 0,
      end: 3.6,
      mood: 'world',
      cameraGrammar: 'over_shoulder_system',
      subjectId: b1Keeper.id,
      systemQuest: {
        title: '[ BẮT ĐẦU MÔ PHỎNG — NGÀY THỨ NHẤT ]',
        body: 'Thân phận: Đệ tử ngoại môn gác cổng của Thanh Huyền Môn.',
        position: [225, 75, 175]
      }
    },
    { shotId: shot1.id, start: 3.6, end: 7.4, mood: 'world', cameraGrammar: 'confrontation_push', subjectId: b2Keeper.id, secondarySubjectId: b2Mortal.id },
    { shotId: shot1.id, start: 7.4, end: 11.2, mood: 'anger_veins', cameraGrammar: 'rage_punch_shake', subjectId: b3Pout.id, emoteBadge: 'anger_cross', emotePosition: [165, 195, 55] },
    { shotId: shot2.id, start: 11.2, end: 14.8, mood: 'question_sky', cameraGrammar: 'snap_reaction_zoom', subjectId: b4Pout.id, emoteBadge: 'question_giant', emotePosition: [215, 75, 160] },
    { shotId: shot2.id, start: 14.8, end: 18.4, mood: 'spotlight_stage', cameraGrammar: 'spotlight_pity_pull', subjectId: b5Robot.id, emoteBadge: 'sweat_drop', emotePosition: [145, 145, 55] },
    { shotId: shot2.id, start: 18.4, end: 22.0, mood: 'world', cameraGrammar: 'three_plane_escape', subjectId: b6Keeper.id },
    { shotId: shot3.id, start: 22.0, end: 25.8, mood: 'world', cameraGrammar: 'confrontation_push', subjectId: b7Mortal.id, secondarySubjectId: b7Keeper.id },
    { shotId: shot3.id, start: 25.8, end: 29.4, mood: 'world', cameraGrammar: 'thought_contemplation', subjectId: b8Keeper.id, secondarySubjectId: b8Mortal.id },
    {
      shotId: shot3.id,
      start: 29.4,
      end: 33.0,
      mood: 'comic_burst',
      cameraGrammar: 'low_angle_menace',
      subjectId: b9RewardMc.id,
      systemQuest: {
        title: '[ TỔNG KẾT MÔ PHỎNG · CHỌN PHẦN THƯỞNG ]',
        body: '① Trúc Cơ Sơ Kỳ hoàn mỹ  ·  ② Kim Đan sát khí  ·  ③ Pháp khí trung phẩm',
        position: [235, 75, 175]
      }
    }
  ]
  for (const spec of beatSpecs) stageStoryComicBeat(project, spec)
  applyStoryComicCamera(project, beatSpecs)

  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Beat 1: Nhập vai đệ tử gác cổng
  attachAtomicNode(project, v2LayerNodeId(b1Keeper.id), 'fx', 'v2:fx:fadeInOut', {
    animFxPreset: 'fadeInOut', loopFadeInSec: 0.25, loopFadeOutSec: 0.2, timeStart: 0, timeEnd: 3.6
  }, 'FX: Hiện Thân Phận Mô Phỏng')
  attachAtomicSubtitle(project, b1Keeper.id, {
    presetId: 'v2:subtitle:lugia_cyan',
    stylePreset: 'lugia_cyan',
    speakerName: 'Hệ Thống',
    text: 'Ngày thứ nhất: Ngươi trở thành đệ tử gác cổng của Thanh Huyền Môn!',
    start: 0,
    end: 3.6
  })

  // Beat 2: Đuổi người phàm ở sơn môn (thẻ trắng Shadiao + BBox rời đi)
  attachAtomicNode(project, v2LayerNodeId(b2Mortal.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest',
    bboxTargetX: -410, bboxTargetY: -55, bboxTargetScalePct: 95, depthMode: 'keep', bboxStartZ: 95, bboxTargetZ: 120, timeStart: 3.6, timeEnd: 7.4
  }, 'Motion: Người Phàm Lủi Thủi Rời Đi')
  attachAtomicSubtitle(project, b2Keeper.id, {
    presetId: 'v2:subtitle:dino_white_pill',
    stylePreset: 'dino_white_pill',
    speakerName: 'Nhật ký mô phỏng',
    text: 'Mới sáng sớm đã phải đuổi một tên phàm nhân cầu tiên rời khỏi sơn môn...',
    start: 3.6,
    end: 7.4,
    preserveCustomSettings: true
  })

  // Beat 3: Tiểu Bạch khoanh tay phồng má + Rung chấn + Viền Sticker trắng Shadiao + Hét lớn!
  const nB3Shake = attachAtomicNode(project, v2LayerNodeId(b3Pout.id), 'fx', 'v2:fx:shake', {
    animFxPreset: 'shake', intensity: 0.42, animFxSpeed: 8, timeStart: 7.4, timeEnd: 11.2
  }, 'FX: Rung Chấn Bất Mãn')
  attachAtomicNode(project, nB3Shake.id, 'fx', 'v2:fx:neonSolid', {
    animFxPreset: 'neonSolid', animFxColor: '#ffffff', intensity: 0.85, animFxThickness: 8, timeStart: 7.4, timeEnd: 11.2
  }, 'FX: Viền Sticker Trắng Shadiao')
  attachAtomicSubtitle(project, b3Pout.id, {
    presetId: 'v2:subtitle:comic_shout',
    stylePreset: 'comic_shout',
    speakerName: 'Tiểu Bạch',
    text: 'Dừng, dừng, dừng! Hệ thống này có vấn đề gì vậy?!',
    start: 7.4,
    end: 11.2,
    preserveCustomSettings: true
  })

  // Beat 4: Ngơ ngác dấu chấm hỏi khổng lồ + Bóng thoại suy nghĩ cao thoáng trên đầu
  attachAtomicNode(project, v2LayerNodeId(b4Pout.id), 'fx', 'v2:fx:pulse', {
    animFxPreset: 'pulse', intensity: 0.25, animFxSpeed: 1.8, timeStart: 11.2, timeEnd: 14.8
  }, 'FX: Đứng Hình Ngơ Ngác')
  attachAtomicSubtitle(project, b4Pout.id, {
    presetId: 'v2:subtitle:comic_bubble',
    stylePreset: 'comic_bubble',
    speakerName: 'Tiểu Bạch',
    text: 'Vừa đuổi một người phàm... Không phải đang nói chính ta lúc nãy đấy chứ?!',
    start: 11.2,
    end: 14.8,
    positionPreset: 'above_speaker',
    offsetX: 65,
    offsetY: 365,
    bubbleTail: 'bottom',
    preserveCustomSettings: true
  })

  // Beat 5: Robot giả ngơ dưới đèn Spotlight
  attachAtomicNode(project, v2LayerNodeId(b5Robot.id), 'action', 'v2:action:float', {
    actionPreset: 'float', intensity: 0.7, timeStart: 14.8, timeEnd: 18.4
  }, 'Motion: Robot Lơ Lửng Giả Ngơ')
  attachAtomicSubtitle(project, b5Robot.id, {
    presetId: 'v2:subtitle:dino_white_pill',
    stylePreset: 'dino_white_pill',
    speakerName: 'Dẫn truyện',
    text: 'Hệ thống im lặng giả ngơ, dòng thời gian mô phỏng vẫn tiếp tục chạy...',
    start: 14.8,
    end: 18.4,
    preserveCustomSettings: true
  })

  // Beat 6: Tua nhanh thời gian 2 tháng canh cổng
  attachAtomicNode(project, v2LayerNodeId(b6Cloud.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest',
    bboxTargetX: 160, bboxTargetY: -395, bboxTargetScalePct: 104, depthMode: 'keep', bboxStartZ: -75, bboxTargetZ: -75, timeStart: 18.4, timeEnd: 22.0
  }, 'Motion: Mây Trôi Tua Nhanh Tháng Năm')
  attachAtomicSubtitle(project, b6Keeper.id, {
    presetId: 'v2:subtitle:lugia_cyan',
    stylePreset: 'lugia_cyan',
    speakerName: 'Nhật ký mô phỏng',
    text: 'Ngày thứ hai... đến tháng thứ hai, ngươi vẫn ngày ngày đứng canh sơn môn!',
    start: 18.4,
    end: 22.0
  })

  // Beat 7: Tiểu Bạch bước từ tầng Z xa (Z=310 -> Z=155) tiến lên bậc đá sơn môn
  attachAtomicNode(project, v2LayerNodeId(b7Mortal.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest',
    bboxTargetX: -225, bboxTargetY: -50, bboxTargetScalePct: 112, depthMode: 'depth_z',
    depthRefLayerId: b7Keeper.id, depthRelation: 'behind', bboxStartZ: 310, bboxTargetZ: 155, timeStart: 22.0, timeEnd: 25.8
  }, 'Motion: Bước Lên Bậc Đá Chiều Sâu Z')
  attachAtomicSubtitle(project, b7Mortal.id, {
    presetId: 'v2:subtitle:lugia_cyan',
    stylePreset: 'lugia_cyan',
    speakerName: 'Dẫn truyện',
    text: 'Bỗng một bóng người quen thuộc lại lững thững bước lên bậc đá sơn môn...',
    start: 22.0,
    end: 25.8
  })

  // Beat 8: Đối thoại 2 chiều với Bóng thoại truyện tranh thoáng trên bầu trời
  attachAtomicSubtitle(project, b8Keeper.id, {
    presetId: 'v2:subtitle:comic_bubble',
    stylePreset: 'comic_bubble',
    speakerName: 'Đệ Tử Gác Cổng',
    text: 'Tiểu Bạch à, tông môn chỉ nhận đệ tử do các vương triều lớn tiến cử thôi!',
    start: 25.8,
    end: 29.4,
    positionPreset: 'above_speaker',
    offsetX: -65,
    offsetY: 365,
    bubbleTail: 'bottom',
    preserveCustomSettings: true
  })

  // Beat 9: Nhận thưởng Trúc Cơ Sơ Kỳ
  const nB9Glow = attachAtomicNode(project, v2LayerNodeId(b9RewardMc.id), 'fx', 'v2:fx:neonSolid', {
    animFxPreset: 'neonSolid', animFxColor: '#facc15', intensity: 0.78, animFxThickness: 8, timeStart: 29.4, timeEnd: 33.0
  }, 'FX: Kim Quang Trúc Cơ Viên Mãn')
  attachAtomicNode(project, nB9Glow.id, 'fx', 'v2:fx:pulse', {
    animFxPreset: 'pulse', intensity: 0.36, animFxSpeed: 2.4, timeStart: 29.4, timeEnd: 33.0
  }, 'FX: Xung Mạch Đột Phá')
  attachAtomicSubtitle(project, b9RewardMc.id, {
    presetId: 'v2:subtitle:system_hologram',
    stylePreset: 'system_hologram',
    speakerName: 'Hệ Thống',
    text: 'Mô phỏng kết thúc! Chọn thưởng số 1: Đột phá Trúc Cơ Sơ Kỳ không tác dụng phụ!',
    start: 29.4,
    end: 33.0,
    preserveCustomSettings: true
  })

  validateAndRepairDialogueContinuity(project, true)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}
