import { describe, expect, it } from 'vitest'
import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { addKeyframe, evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { evaluateScene } from '../engine/evaluateScene'
import { inferWaypointActionClassification } from '../ui/viewer/animateCamera/animateCameraActionModes'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import { createImageLayer, createProject, createShot } from './factory'
import {
  analyzeWaypointBBoxTransition,
  getShotWorldCenter3D,
  placeShotRelativeToAnchor3D,
  snapCameraToEntityBBox,
  transitionCameraWaypointToTargetBBox,
  translateShotInWorld3D
} from './shotSpatial3D'
import { ensureClusterPartTimeline } from './workflowPartEditing'
import {
  projectWorldPointToMotionPct,
  resolvePartMotionTriggerWindow
} from './workflowPartMotionTrigger'
import {
  attachLogicNodeToLayerV2,
  recomputeSharedLogicTargets,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId,
  validateWorkflowV2Connection,
  wouldCreateWorkflowCycle
} from './workflowV2Engine'

describe('Workflow V2 Logic Upgrades (Part Swap + Motion BBox + 3D Shots + Camera Guard + DAG)', () => {
  it('moves Shots freely in 3D space (up, diagonal, depth Z) and translates owned Camera 3D keyframes synchronously', () => {
    const project = createProject()
    project.comp.duration = 10
    const shot1 = createShot('Cảnh 1')
    shot1.position.value = [0, 0, 0]
    const shot2 = createShot('Cảnh 2')
    shot2.position.value = [10560, 0, 0]
    project.shots.push(shot1, shot2)

    const refZ = referenceDistance(project.comp)
    addKeyframe(project.camera.position, 0, [0, 0, refZ])
    addKeyframe(project.camera.target, 0, [0, 0, 0])
    addKeyframe(project.camera.position, 5, [10560, 0, refZ])
    addKeyframe(project.camera.target, 5, [10560, 0, 0])

    // Đặt Cảnh 2 lên phía trên Cảnh 1 để Camera 3D lia dọc hướng lên thay vì chỉ lia ngang
    placeShotRelativeToAnchor3D(project, shot2.id, 'up')
    const newCenter = getShotWorldCenter3D(project, shot2.id)
    expect(newCenter[0]).toBe(0)
    expect(newCenter[1]).toBeGreaterThan(2000)

    const camPosAt5 = evaluate(project.camera.position, 5)
    const camTargetAt5 = evaluate(project.camera.target, 5)
    expect(Math.round(camPosAt5[0])).toBe(0)
    expect(Math.round(camPosAt5[1])).toBe(newCenter[1])
    expect(Math.round(camTargetAt5[1])).toBe(newCenter[1])

    // Kéo tự do Cảnh 2 chéo + xuyên chiều sâu Z
    translateShotInWorld3D(project, shot2.id, [4200, -3100, -1800], { syncCamera: true })
    expect(getShotWorldCenter3D(project, shot2.id)).toEqual([4200, -3100, -1800])
    expect(Math.round(evaluate(project.camera.target, 5)[0])).toBe(4200)
    expect(Math.round(evaluate(project.camera.target, 5)[1])).toBe(-3100)
    expect(Math.round(evaluate(project.camera.target, 5)[2])).toBe(-1800)
  })

  it('prevents infinite DAG cycles, self-loops, and duplicate edges while allowing Motion BBox -> Part Swap', () => {
    const mk = (id: string, cat?: string, extra?: Record<string, unknown>): WorkflowNode => ({
      id,
      type: cat ? 'motion_choreography' : 'layer_assembly',
      title: id,
      enabled: true,
      position: { x: 0, y: 0 },
      preset: 'default',
      aiAgentRole: 'MotionChoreographyAgent',
      aiDirective: '',
      params: { ...(cat ? { logicCategory: cat as any } : {}), ...(extra ?? {}) }
    })

    const edges = [
      { id: 'e1', fromNode: 'A', fromPort: 'motion_stream' as const, toNode: 'B', toPort: 'motion_stream' as const },
      { id: 'e2', fromNode: 'B', fromPort: 'motion_stream' as const, toNode: 'C', toPort: 'motion_stream' as const }
    ]
    expect(wouldCreateWorkflowCycle(edges, 'C', 'A')).toBe(true)
    expect(wouldCreateWorkflowCycle(edges, 'C', 'D')).toBe(false)

    const wf: WorkflowGraph = {
      version: 1,
      id: 'wf',
      name: 'wf',
      description: '',
      nodes: [
        mk('layer-1', undefined, { shotId: 's1', targetLayerIds: ['l1'] }),
        mk('mot-1', 'action', { shotId: 's1', targetLayerIds: ['l1'] }),
        mk('mot-2', 'action', { shotId: 's1', targetLayerIds: ['l1'] }),
        mk('part-child', 'part_swap', { shotId: 's1', isPartChild: true, targetLayerIds: ['l1'] })
      ],
      edges: [
        { id: 'e-m1-m2', fromNode: 'mot-1', fromPort: 'motion_stream', toNode: 'mot-2', toPort: 'motion_stream' }
      ]
    }

    // Chặn vòng lặp mot-2 -> mot-1
    const cycleRes = validateWorkflowV2Connection(wf, 'mot-2', 'mot-1')
    expect(cycleRes.valid).toBe(false)

    // Cho phép Motion BBox -> Bộ phận con (isPartChild)
    const okMotionToPart = validateWorkflowV2Connection(wf, 'mot-1', 'part-child')
    expect(okMotionToPart.valid).toBe(true)

    // Nếu đã có mot-1 -> part-child thì chặn nối chồng mot-2 -> part-child gây xung đột
    wf.edges.push({
      id: 'e-m1-part',
      fromNode: 'mot-1',
      fromPort: 'motion_stream',
      toNode: 'part-child',
      toPort: 'motion_stream'
    })
    const dupMotionTrigger = validateWorkflowV2Connection(wf, 'mot-2', 'part-child')
    expect(dupMotionTrigger.valid).toBe(false)
  })

  it('moves 2+ connected Layer BBoxes together via a single shared Motion BBox node (formation & convergence)', () => {
    const project = createProject()
    project.comp.duration = 6
    const shot = createShot('Cảnh Chung')
    project.shots.push(shot)

    const layerA = createImageLayer(
      { id: 'a', name: 'A', kind: 'image', mime: 'image/png', width: 100, height: 100 },
      project.comp,
      0,
      shot.id
    )
    layerA.transform.position.value = [-200, 0, 0]
    layerA.inPoint = 0
    layerA.outPoint = 6

    const layerB = createImageLayer(
      { id: 'b', name: 'B', kind: 'image', mime: 'image/png', width: 100, height: 100 },
      project.comp,
      0,
      shot.id
    )
    layerB.transform.position.value = [-200, 150, 0]
    layerB.inPoint = 0
    layerB.outPoint = 6
    project.layers.push(layerA, layerB)

    let wf = syncWorkflowV2Graph(project)
    const attached = attachLogicNodeToLayerV2(wf, v2LayerNodeId(layerA.id), 'action', 'v2:action:bbox_target')
    expect(attached.createdNodeId).toBeTruthy()
    wf = attached.workflow
    const motionNodeId = attached.createdNodeId

    // Nối thêm Layer B vào chung cùng 1 Node Motion BBox
    wf.edges.push({
      id: `e-b-${motionNodeId}`,
      fromNode: v2LayerNodeId(layerB.id),
      fromPort: 'layers_tree',
      toNode: motionNodeId,
      toPort: 'layers_tree'
    })
    wf.nodes = recomputeSharedLogicTargets(wf.nodes, wf.edges)
    project.workflow = wf

    const motionNode = wf.nodes.find((n) => n.id === motionNodeId)!
    motionNode.params = {
      ...motionNode.params,
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      timeStart: 0,
      timeEnd: 4,
      bboxTargetX: 300,
      bboxTargetY: 0,
      bboxTargetScalePct: 100,
      bboxMultiMode: 'group_offset'
    }
    syncWorkflowV2NodeToProject(project, motionNode)

    // Chế độ giữ đội hình (group_offset): cả A (+500px X) và B (+500px X, vẫn giữ lệch Y = +150) cùng tới đích
    expect(Math.round(evaluate(layerA.transform.position, 4)[0])).toBe(300)
    expect(Math.round(evaluate(layerB.transform.position, 4)[0])).toBe(300)
    expect(Math.round(evaluate(layerB.transform.position, 4)[1])).toBe(150)

    // Chế độ cùng hội tụ về Đích (converge_target): cả A và B cùng hội tụ về (300, 0)
    motionNode.params.bboxMultiMode = 'converge_target'
    syncWorkflowV2NodeToProject(project, motionNode)
    expect(Math.round(evaluate(layerB.transform.position, 4)[0])).toBe(300)
    expect(Math.round(evaluate(layerB.transform.position, 4)[1])).toBe(0)

    // Mỗi tag BBox có logic riêng biệt: BBox B có thể vẽ line cong riêng (custom_curve) trong khi BBox A đi thẳng (shortest)
    motionNode.params.layerBboxTargets = {
      [layerB.id]: {
        targetX: 300,
        targetY: 0,
        bboxPathType: 'custom_curve',
        customMotionPath: [
          [0.1, 0.2],
          [0.5, 0.8],
          [0.9, 0.2]
        ]
      }
    }
    syncWorkflowV2NodeToProject(project, motionNode)
    // Layer A đi thẳng ngắn nhất: tại t = 2s (50%), X của A là điểm giữa (50)
    expect(Math.round(evaluate(layerA.transform.position, 2)[0])).toBe(50)
    // Layer B đi theo đường cong riêng biệt
    expect(evaluate(layerB.transform.position, 2)[0]).not.toBeNaN()
  })

  it('triggers Part Swap automatically at the exact spatial % / (X, Y) along a moving Motion BBox', () => {
    const project = createProject()
    project.comp.duration = 6
    const shot = createShot('Cảnh Nhân Vật')
    project.shots.push(shot)

    const body = createImageLayer(
      { id: 'body-asset', name: 'Thân', kind: 'image', mime: 'image/png', width: 120, height: 200 },
      project.comp,
      0,
      shot.id
    )
    body.transform.position.value = [-400, 0, 0]
    body.inPoint = 0
    body.outPoint = 6
    body.composite = {
      instanceId: 'hero-1',
      compositeId: 'tpl-hero',
      compositeName: 'Cậu Bé',
      isRoot: true,
      lockedGroup: true
    }

    const faceNormal = createImageLayer(
      { id: 'face-normal-asset', name: 'Khuôn mặt — Bình thường', kind: 'image', mime: 'image/png', width: 80, height: 80 },
      project.comp,
      0,
      shot.id
    )
    faceNormal.inPoint = 0
    faceNormal.outPoint = 6
    faceNormal.visible = true
    faceNormal.composite = {
      instanceId: 'hero-1',
      compositeId: 'tpl-hero',
      compositeName: 'Cậu Bé',
      isRoot: false,
      lockedGroup: true,
      partGroupId: 'face'
    }

    const faceHappy = createImageLayer(
      { id: 'face-happy-asset', name: 'Khuôn mặt — Vui vẻ', kind: 'image', mime: 'image/png', width: 80, height: 80 },
      project.comp,
      0,
      shot.id
    )
    faceHappy.inPoint = 0
    faceHappy.outPoint = 6
    faceHappy.visible = false
    faceHappy.composite = {
      instanceId: 'hero-1',
      compositeId: 'tpl-hero',
      compositeName: 'Cậu Bé',
      isRoot: false,
      lockedGroup: true,
      partGroupId: 'face'
    }

    project.layers.push(body, faceNormal, faceHappy)
    let wf = syncWorkflowV2Graph(project)
    const clusterNode = wf.nodes.find((n) => n.params?.logicCategory === 'cluster_lock')!
    expect(clusterNode).toBeDefined()

    // Gắn Motion BBox (từ X=-400 đi tới X=+400 trong 0s..4s)
    const motAttached = attachLogicNodeToLayerV2(wf, clusterNode.id, 'action', 'v2:action:bbox_target')
    wf = motAttached.workflow
    const motionNode = wf.nodes.find((n) => n.id === motAttached.createdNodeId)!
    motionNode.params = {
      ...motionNode.params,
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      timeStart: 0,
      timeEnd: 4,
      bboxTargetX: 400,
      bboxTargetY: 0,
      bboxTargetScalePct: 100
    }
    project.workflow = wf
    syncWorkflowV2NodeToProject(project, motionNode)

    // Gắn Cụm Bộ phận + Bộ phận con Khuôn mặt
    const partAttached = attachLogicNodeToLayerV2(wf, clusterNode.id, 'part_swap', 'v2:part_swap:expr_happy', {
      partGroupId: 'face'
    })
    wf = partAttached.workflow
    project.workflow = wf
    const facePartNode = wf.nodes.find((n) => n.params?.logicCategory === 'part_swap' && n.params?.isPartChild)!
    expect(facePartNode).toBeDefined()

    // Click chọn điểm X = 0 (50% quãng đường từ -400 tới +400) trên quỹ đạo BBox
    const projected = projectWorldPointToMotionPct(project, motionNode, 0, 0)
    expect(projected.pct).toBe(50)
    expect(projected.triggerTime).toBeCloseTo(2.0, 1)

    // Nối Motion BBox -> Bộ phận con để thay sang mặt Vui vẻ đúng lúc BBox đi tới X = 0 (50%)
    wf.edges.push({
      id: `e-${motionNode.id}-${facePartNode.id}`,
      fromNode: motionNode.id,
      fromPort: 'motion_stream',
      toNode: facePartNode.id,
      toPort: 'motion_stream'
    })
    facePartNode.params = {
      ...facePartNode.params,
      swapMode: 'expression',
      swapVariant: faceHappy.id,
      swapTargetLayerId: faceHappy.id,
      partTriggerMode: 'motion_bbox',
      linkedMotionNodeId: motionNode.id,
      motionTriggerPct: projected.pct,
      partSwapHoldAfterEnd: true
    }
    wf.nodes = recomputeSharedLogicTargets(wf.nodes, wf.edges)
    ensureClusterPartTimeline(
      project,
      wf.nodes.filter((n) => n.params?.logicCategory === 'part_swap' && n.params?.instanceId === 'hero-1')
    )

    const win = resolvePartMotionTriggerWindow(project, facePartNode, facePartNode.params)
    expect(win.triggeredByMotion).toBe(true)
    expect(win.start).toBeCloseTo(2.0, 1)

    // Trước khi tới X = 0 (t = 1.0s): Mặt bình thường đang hiện, mặt vui vẻ ẩn
    const evBefore = evaluateScene(project, 1.0)
    expect(evBefore.layers.find((l) => l.layer.id === faceNormal.id)?.active).toBe(true)
    expect(evBefore.layers.find((l) => l.layer.id === faceHappy.id)?.active).toBe(false)

    // Khi đã đi qua X = 0 (t = 2.5s): Tự động thay sang Mặt vui vẻ!
    const evAfter = evaluateScene(project, 2.5)
    expect(evAfter.layers.find((l) => l.layer.id === faceNormal.id)?.active).toBe(false)
    expect(evAfter.layers.find((l) => l.layer.id === faceHappy.id)?.active).toBe(true)
  })

  it('enforces BBox 1 -> BBox 2 Camera action geometry, cross-shot Chuyển cảnh, and 1-click BBox Camera tracking', () => {
    const project = createProject()
    project.comp.duration = 10
    const s1 = createShot('Cảnh 1')
    s1.position.value = [0, 0, 0]
    const s2 = createShot('Cảnh 2')
    s2.position.value = [10560, 0, 0]
    project.shots.push(s1, s2)

    const hero = createImageLayer(
      { id: 'h', name: 'Hero', kind: 'image', mime: 'image/png', width: 320, height: 480 },
      project.comp,
      0,
      s1.id
    )
    hero.inPoint = 0
    hero.outPoint = 5
    project.layers.push(hero)

    // 1-Click khớp Camera lia bám BBox #1 -> #2 (từ cỡ 100% phóng to/đẩy cận)
    const tracked = snapCameraToEntityBBox(project, {
      shotId: s1.id,
      layerIds: [hero.id],
      atTime: 0,
      mode: 'follow_bbox_motion',
      endTime: 3,
      startXY: [-200, 0],
      targetXY: [250, 0],
      targetScalePct: 60
    })
    expect(tracked).toEqual({ startTime: 0, endTime: 3 })

    // Chuyển cảnh sang BBox Cảnh 2 tại t = 5s
    const transitioned = transitionCameraWaypointToTargetBBox(project, 5, {
      shotId: s2.id,
      style: 'fly'
    })
    expect(transitioned).toBe(true)

    const layout = computeShotStageLayout(project, 0)
    const frames = extractCameraFrames2D(project, layout)
    expect(frames.length).toBeGreaterThanOrEqual(3)

    // Kiểm tra hình học BBox 1 > BBox 2: không cho phép chọn 'pull-out' (Kéo rộng)
    const guard12 = analyzeWaypointBBoxTransition(frames[0], frames[1])
    if (guard12.relation === 'smaller') {
      expect(guard12.isContradictoryWithCurrentBBox('pull-out')).toBe(true)
      expect(guard12.isContradictoryWithCurrentBBox('push-in')).toBe(false)
    }

    // Mốc chuyển từ Cảnh 1 sang Cảnh 2 phải phân loại là 'Chuyển cảnh', không bị gắn nhầm 'Kéo rộng'
    const crossIdx = frames.findIndex((f, i) => i > 0 && f.shotId !== frames[i - 1].shotId)
    expect(crossIdx).toBeGreaterThan(0)
    const curFrame = frames[crossIdx]
    const prevFrame = frames[crossIdx - 1]
    const cls = inferWaypointActionClassification(
      curFrame,
      crossIdx,
      prevFrame,
      curFrame.time - prevFrame.time,
      Math.round(100 / Math.max(0.1, curFrame.scale))
    )
    expect(cls.tagLabel).toContain('Chuyển cảnh')
  })
})
