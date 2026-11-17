import { describe, expect, it } from 'vitest'
import { computeNormalizedCharacterScale } from '../animation/characterScaleNormalizer'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import * as factory from './factory'
import { createFreshStoryWestDramaV2Project } from './storyWestDramaV2Builder'
import {
  applySubtitleDefaultsToAllNodes,
  enforceSpeakerAndSceneContinuity,
  resetSubtitleNodeToDefaults,
  syncSubtitleNodeToProject,
  validateAndRepairDialogueContinuity
} from './subtitleAndDialogueSync'
import { attachLogicNodeToLayerV2, syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { v2LayerNodeId } from './workflowV2Scope'
import { syncWorkflowV2Graph } from './workflowV2Sync'

describe('subtitleAndDialogueSync & Dramatic Animation System', () => {
  it('attaches per-object Vietsub node, applies global defaults to unprotected nodes, and protects preserveCustomSettings nodes', () => {
    const project = factory.createProject({ duration: 15 })
    const shot = factory.createShot('Cảnh 1', [0, 0, 0], 0)
    project.shots.push(shot)

    const meta = { id: 'a1', name: 'Hero', kind: 'image' as const, mime: 'image/png', width: 500, height: 700 }
    project.assets.push(meta)
    const hero1 = factory.createImageLayer(meta, project.comp, 100, shot.id)
    hero1.id = 'layer-hero-1'
    hero1.name = 'Tiểu Khô Lâu'
    hero1.inPoint = 0
    hero1.outPoint = 4
    const hero2 = factory.createImageLayer(meta, project.comp, 120, shot.id)
    hero2.id = 'layer-hero-2'
    hero2.name = 'Tôn Ngộ Không'
    hero2.inPoint = 4
    hero2.outPoint = 8
    project.layers.push(hero1, hero2)

    project.workflow = syncWorkflowV2Graph(project)

    // Gắn Node Vietsub thường cho Tiểu Khô Lâu
    const r1 = attachLogicNodeToLayerV2(
      project.workflow,
      v2LayerNodeId(hero1.id),
      'subtitle',
      'v2:subtitle:lugia_cyan',
      { subtitleText: 'Ai cơ, tôi á?!', subtitleSpeakerName: 'Tiểu Khô Lâu', timeStart: 0, timeEnd: 4 }
    )
    project.workflow = r1.workflow
    const n1 = project.workflow.nodes.find((n) => n.id === r1.createdNodeId)!
    syncWorkflowV2NodeToProject(project, n1)

    // Gắn Node Vietsub Đặc Biệt (Khoá preserveCustomSettings = true) cho Tôn Ngộ Không
    const r2 = attachLogicNodeToLayerV2(
      project.workflow,
      v2LayerNodeId(hero2.id),
      'subtitle',
      'v2:subtitle:comic_shout',
      {
        subtitleText: 'Yêu quái muốn đòn à!',
        subtitleSpeakerName: 'Tôn Ngộ Không',
        preserveCustomSettings: true,
        timeStart: 4,
        timeEnd: 8
      }
    )
    project.workflow = r2.workflow
    const n2 = project.workflow.nodes.find((n) => n.id === r2.createdNodeId)!
    syncWorkflowV2NodeToProject(project, n2)

    // Áp dụng cấu hình chung (Apply to All) sang Vàng Kim Điện Ảnh (cinema_gold, fontSize 48)
    const applyRes = applySubtitleDefaultsToAllNodes(project, {
      presetId: 'cinema_gold',
      fontSize: 48,
      color: '#fde047'
    })

    expect(applyRes.updatedCount).toBe(1)
    expect(applyRes.skippedProtectedCount).toBe(1)

    const sub1 = project.layers.find((l) => l.type === 'text' && l.props.speakerLayerId === hero1.id)
    const sub2 = project.layers.find((l) => l.type === 'text' && l.props.speakerLayerId === hero2.id)
    expect(sub1?.type === 'text' && sub1.props.fontSize).toBe(48)
    expect(sub1?.type === 'text' && sub1.props.color).toBe('#fde047')
    // Node đặc biệt của Ngộ Không giữ nguyên cỡ chữ 42 của comic_shout, không bị ghi đè!
    expect(sub2?.type === 'text' && sub2.props.fontSize).toBe(42)
    expect(sub2?.type === 'text' && sub2.props.preserveCustomSettings).toBe(true)

    // Khôi phục Node 2 về mặc định chung
    resetSubtitleNodeToDefaults(project, n2.id)
    expect(sub2?.type === 'text' && sub2.props.preserveCustomSettings).toBe(false)
    expect(sub2?.type === 'text' && sub2.props.fontSize).toBe(48)
  })

  it('automatically extends character display duration when Vietsub or Voice Audio is longer than layer outPoint', () => {
    const project = factory.createProject({ duration: 10 })
    const shot = factory.createShot('Cảnh 1', [0, 0, 0], 0)
    project.shots.push(shot)
    const meta = { id: 'a1', name: 'Speaker', kind: 'image' as const, mime: 'image/png', width: 500, height: 700 }
    project.assets.push(meta)

    // Nhân vật ban đầu chỉ hiển thị từ 2s -> 4s, nhưng lời thoại kéo dài từ 2s -> 6.5s
    const speaker = factory.createImageLayer(meta, project.comp, 100, shot.id)
    speaker.id = 'speaker-1'
    speaker.inPoint = 2.0
    speaker.outPoint = 4.0
    project.layers.push(speaker)

    enforceSpeakerAndSceneContinuity(project, speaker, 2.0, 6.5)
    expect(speaker.outPoint).toBe(6.5)

    // Kiểm tra thêm với syncSubtitleNodeToProject
    const dummyNode = {
      id: 'v2-subtitle-speaker-1',
      type: 'audio_lipsync' as const,
      title: 'Vietsub',
      enabled: true,
      position: { x: 0, y: 0 },
      preset: 'auto_dialogue_lipsync',
      aiAgentRole: 'AudioLipSyncAgent' as const,
      aiDirective: ''
    }
    syncSubtitleNodeToProject(project, dummyNode, {
      targetLayerIds: [speaker.id],
      subtitleText: 'Câu thoại kéo dài tới giây thứ 8!',
      timeStart: 2.0,
      timeEnd: 8.0,
      syncHoldTargetLayer: true
    })
    expect(speaker.outPoint).toBe(8.0)
  })

  it('normalizes character scales consistently and generates progressive oppression & thought vision tracks', () => {
    const comp = { width: 1920, height: 1080 }
    const s1 = computeNormalizedCharacterScale({
      assetHeight: 614,
      z: 110,
      comp,
      bodyClass: 'petite_chibi',
      framing: 'MS'
    })
    const s2 = computeNormalizedCharacterScale({
      assetHeight: 538,
      z: 110,
      comp,
      bodyClass: 'petite_chibi',
      framing: 'MS'
    })
    // Hai tấm ảnh khác kích thước pixel của cùng Tiểu Khô Lâu sau khi nhân scale sẽ cho đúng cùng chiều cao hiển thị!
    expect(Math.abs(614 * s1 - 538 * s2)).toBeLessThan(3)

    // Kiểm tra hiệu ứng suy nghĩ hiện hình từ mờ sang đậm -> mờ dần (thought_vision_manifest)
    const thoughtTracks = generatePresetSpatialTracks(
      'thought_vision_manifest',
      { position: [150, 90, 195], rotation: [0, 0, 0], scale: [0.8, 0.8, 1], opacity: 0.9 },
      { time: 3.0, duration: 3.0, fadeOpacity: true }
    )
    expect(thoughtTracks.opacity[0].value).toBe(0)
    expect(thoughtTracks.opacity[1].value).toBeCloseTo(0.9, 2)
    expect(thoughtTracks.opacity[thoughtTracks.opacity.length - 1].value).toBe(0)

    // Kiểm tra cặp Áp bức: 4 thầy trò dâng cao to dần (oppressive_tower_grow) vs Khô Lâu nhỏ dần (oppressed_shrink_tremble)
    const tower = generatePresetSpatialTracks(
      'oppressive_tower_grow',
      { position: [0, -45, 185], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1 },
      { time: 9.0, duration: 3.5, deltaY: 74, endScaleMultiplier: 1.28 }
    )
    expect(tower.scale[tower.scale.length - 1].value[0]).toBeGreaterThan(tower.scale[0].value[0])
    expect(tower.position[tower.position.length - 1].value[1]).toBeGreaterThan(tower.position[0].value[1])

    const shrink = generatePresetSpatialTracks(
      'oppressed_shrink_tremble',
      { position: [0, -275, 35], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1 },
      { time: 9.0, duration: 3.5, deltaY: -48, endScaleMultiplier: 0.74 }
    )
    expect(shrink.scale[shrink.scale.length - 1].value[0]).toBeLessThan(shrink.scale[0].value[0])
  })

  it('builds Demo #6 (story_west_drama_v2) with 10 beats, per-character Vietsub nodes, voice tracks, and zero continuity issues', () => {
    const project = createFreshStoryWestDramaV2Project()
    expect(project.shots.length).toBe(5)
    expect(project.comp.duration).toBe(32)
    const check = validateAndRepairDialogueContinuity(project, false)
    expect(check.ok).toBe(true)
    expect(check.issues.length).toBe(0)
    const subNodes = project.workflow!.nodes.filter((n) => n.params?.logicCategory === 'subtitle')
    expect(subNodes.length).toBeGreaterThanOrEqual(8)
  })
})
