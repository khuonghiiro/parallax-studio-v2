import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import type { Project, WorkflowGraph } from '@shared/types'
import { addKeyframe, evaluate } from '../animation/keyframes'
import { createImageLayer, createProject, createShot } from './factory'
import { addTimelineLogic, getLayerTimelineLogicBadges, removeTimelineLogicNode } from './timelineLogic'
import { buildThreeSceneWorkflowV2Project, type DemoSceneAssetInput } from './threeSceneDemoBuilder'
import {
  WF_V2_NODE_H,
  WF_V2_NODE_W,
  attachExternalLayerToClusterV2,
  attachLogicNodeToLayerV2,
  buildMainWorkflowJson,
  buildModularWorkflowBundle,
  buildShotWorkflowJson,
  extractClusterDynamicActions,
  extractCompositeDynamicParts,
  getCompatibleLogicCatalogForNode,
  findFreeV2Spot,
  isCameraChainEdge,
  isCameraWaypointNode,
  resolveHiddenV2NodeIds,
  saveClusterCustomAction,
  spawnTimedFollowupNodeV2,
  spawnWorkflowV2CameraWaypoint,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  updateClusterMemberOffsetV2,
  v2CameraId,
  v2CameraWaypointId,
  v2LayerNodeId,
  v2RootId,
  validateWorkflowV2Connection
} from './workflowV2Engine'
import { detachWorkflowV2NodeFromProject, relayoutWorkflowV2 } from './workflowV2Rebuild'
import { isCollisionGeneratedKey } from './workflowV2CollisionKeys'

function sampleProject() {
  const proj = createProject()
  proj.comp.duration = 12
  const shotA = createShot('Cảnh rừng')
  const shotB = createShot('Cảnh hang')
  proj.shots.push(shotA, shotB)
  const mk = (id: string, name: string, z: number, shotId?: string) =>
    createImageLayer({ id: `a-${id}`, name, kind: 'image', mime: 'image/png', width: 640, height: 480 }, proj.comp, z, shotId)
  const vine = mk('vine', 'Dây leo', 180, shotA.id)
  const rock = mk('rock', 'Tảng đá', 300, shotA.id)
  const cave = mk('cave', 'Cửa hang', 400, shotB.id)
  const fog = mk('fog', 'Sương chung', 200)
  fog.shotId = null
  vine.inPoint = 0
  vine.outPoint = 12
  rock.inPoint = 2
  rock.outPoint = 9
  proj.layers.push(vine, rock, cave, fog)
  return { proj, shotA, shotB, vine, rock, cave, fog }
}

/** Giống hiệu ứng ghi của Timeline: đồng bộ đồ thị sau mỗi thay đổi Project */
function synced(proj: Project): Project {
  return produce(proj, (d) => {
    d.workflow = syncWorkflowV2Graph(d as Project, d.workflow as WorkflowGraph | undefined)
  })
}

describe('Workflow V2 — một không gian chung cho mọi cảnh', () => {
  it('mỗi cảnh là một cụm Root → Camera / Nhóm → Layer, Camera các cảnh nối nhau bằng dây chuyển cảnh', () => {
    const { proj, shotA, shotB, vine, cave, fog } = sampleProject()
    const wf = syncWorkflowV2Graph(proj, undefined)
    expect(wf.nodes.some((n) => n.id === v2RootId(shotA.id))).toBe(true)
    expect(wf.nodes.some((n) => n.id === v2RootId(shotB.id))).toBe(true)
    expect(wf.nodes.some((n) => n.id === v2RootId('shared'))).toBe(true)
    const chain = wf.edges.filter(isCameraChainEdge)
    expect(chain).toHaveLength(1)
    expect([chain[0].fromNode, chain[0].toNode]).toEqual([v2CameraId(shotA.id), v2CameraId(shotB.id)])
    expect(wf.nodes.find((n) => n.id === v2LayerNodeId(vine.id))?.params?.shotId).toBe(shotA.id)
    expect(wf.nodes.find((n) => n.id === v2LayerNodeId(cave.id))?.params?.shotId).toBe(shotB.id)
    expect(wf.nodes.find((n) => n.id === v2LayerNodeId(fog.id))?.params?.shotId).toBeUndefined()
    expect(syncWorkflowV2Graph(proj, wf)).toBe(wf)
  })

  it('đồ thị chỉ phản ánh dữ liệu thật: không tự bịa Node logic từ tên Layer', () => {
    const { proj } = sampleProject()
    const wf = syncWorkflowV2Graph(proj, undefined)
    expect(wf.nodes.filter((n) => n.params?.logicCategory && n.params.logicCategory !== 'camera')).toHaveLength(0)
  })
})

describe('Workflow V2 — MỘT LOGIC CHUNG với Timeline / Inspector', () => {
  it('chuyển động thêm ở Inspector hiện thành Node; sửa / tắt ở Inspector cập nhật Node; xoá Node gỡ chuyển động', () => {
    let { proj, vine } = sampleProject()
    proj = synced(proj)
    proj = synced(produce(proj, (d) => {
      d.layers.find((l) => l.id === vine.id)!.motion = { enabled: true, type: 'sway', speed: 1, amount: 0.8 }
    }))
    const node = proj.workflow!.nodes.find((n) => n.id === `v2-action-${vine.id}`)!
    expect(node.params?.actionPreset).toBe('sway')
    expect(node.params?.intensity).toBe(0.8)
    expect(proj.workflow!.edges.some((e) => e.fromNode === v2LayerNodeId(vine.id) && e.toNode === node.id)).toBe(true)

    proj = synced(produce(proj, (d) => {
      d.layers.find((l) => l.id === vine.id)!.motion!.enabled = false
    }))
    expect(proj.workflow!.nodes.find((n) => n.id === node.id)!.enabled).toBe(false)

    proj = synced(produce(proj, (d) => {
      detachWorkflowV2NodeFromProject(d as Project, node)
      d.workflow = { ...(d.workflow as WorkflowGraph), nodes: d.workflow!.nodes.filter((n) => n.id !== node.id) }
    }))
    expect(proj.layers.find((l) => l.id === vine.id)!.motion?.type).toBe('none')
    expect(proj.workflow!.nodes.some((n) => n.id === node.id)).toBe(false)
  })

  it('Timeline gắn logic bằng mẫu chung (mã cũ được ánh xạ) và bắt buộc chọn Layer', () => {
    let { proj, rock } = sampleProject()
    proj = synced(proj)
    let nodeId = ''
    proj = synced(produce(proj, (d) => {
      nodeId = addTimelineLogic(d as Project, 'logic-fx-candle', rock.id)
    }))
    const node = proj.workflow!.nodes.find((n) => n.id === nodeId)!
    expect(node.params?.lightMode).toBe('candle')
    expect(proj.layers.find((l) => l.id === rock.id)!.virtualLight?.kind).toBe('candle')
    const badges = getLayerTimelineLogicBadges(proj.layers.find((l) => l.id === rock.id)!, proj, proj.workflow!)
    expect(badges.some((b) => b.kind === 'workflow_node' && b.nodeId === nodeId)).toBe(true)
    expect(() => produce(proj, (d) => void addTimelineLogic(d as Project, 'v2:action:float'))).toThrow()

    proj = synced(produce(proj, (d) => removeTimelineLogicNode(d as Project, nodeId)))
    expect(proj.workflow!.nodes.some((n) => n.id === nodeId)).toBe(false)
    expect(proj.layers.find((l) => l.id === rock.id)!.virtualLight?.enabled).toBe(false)
  })

  it('âm thanh gắn Layer hiện thành Node; chỉnh Node ghi xuống track; xoá Node bỏ gắn track', () => {
    let { proj, vine } = sampleProject()
    proj.audioTracks = [{ id: 'tr1', assetId: 'au', offset: 1, volume: 1, duration: 3, targetId: vine.id, targetType: 'layer' as never }]
    proj = synced(proj)
    const node = proj.workflow!.nodes.find((n) => n.params?.logicCategory === 'audio')!
    expect([node.params?.timeStart, node.params?.timeEnd]).toEqual([1, 4])
    proj = produce(proj, (d) => syncWorkflowV2NodeToProject(d as Project, node, { intensity: 0.4 }))
    expect(proj.audioTracks![0].volume).toBe(0.4)
    proj = synced(produce(proj, (d) => {
      detachWorkflowV2NodeFromProject(d as Project, node)
      d.workflow = { ...(d.workflow as WorkflowGraph), nodes: d.workflow!.nodes.filter((n) => n.id !== node.id) }
    }))
    expect(proj.audioTracks![0].targetId).toBeUndefined()
    expect(proj.workflow!.nodes.some((n) => n.params?.logicCategory === 'audio')).toBe(false)
  })

  it('hoạt ảnh FX (anim_fx) gắn vào Layer sinh appliedEffects + keyframe, đồng bộ 2 chiều và gỡ sạch khi xoá Node', () => {
    let { proj, vine } = sampleProject()
    proj = synced(proj)
    const attached = attachLogicNodeToLayerV2(proj.workflow!, v2LayerNodeId(vine.id), 'anim_fx', 'v2:anim_fx:shake')
    expect(attached.createdNodeId).toBe(`v2-anim_fx-${vine.id}`)
    proj = synced(produce(proj, (d) => {
      d.workflow = attached.workflow
      const n = d.workflow.nodes.find((x) => x.id === attached.createdNodeId)!
      syncWorkflowV2NodeToProject(d as Project, n, { animFxCount: 6, intensity: 24, timeStart: 1, timeEnd: 2 })
    }))
    const vineLayer = proj.layers.find((l) => l.id === vine.id)!
    expect(vineLayer.appliedEffects?.some((f) => f.presetId === 'shake' && f.count === 6)).toBe(true)
    expect(vineLayer.transform.position.keyframes.length).toBeGreaterThan(2)

    const animNode = proj.workflow!.nodes.find((n) => n.id === attached.createdNodeId)!
    expect(animNode.params?.animFxPreset).toBe('shake')
    expect(animNode.params?.animFxCount).toBe(6)

    proj = synced(produce(proj, (d) => {
      detachWorkflowV2NodeFromProject(d as Project, animNode)
      d.workflow = { ...(d.workflow as WorkflowGraph), nodes: d.workflow!.nodes.filter((n) => n.id !== animNode.id) }
    }))
    expect(proj.layers.find((l) => l.id === vine.id)!.appliedEffects?.filter((f) => f.category !== 'motion') ?? []).toHaveLength(0)
    expect(proj.workflow!.nodes.some((n) => n.id === animNode.id)).toBe(false)
  })
})

describe('Workflow V2 — kết nối chuẩn logic', () => {
  it('Va chạm chỉ có hiệu lực khi đủ Layer A và B; keyframe va chạm đồng bộ idempotent', () => {
    let { proj, vine, rock } = sampleProject()
    proj = synced(proj)
    const res = attachLogicNodeToLayerV2(proj.workflow!, v2LayerNodeId(vine.id), 'collision')
    let wf = res.workflow
    let col = wf.nodes.find((n) => n.id === res.createdNodeId)!
    expect(col.params?.sharedLayerNodeIds).toHaveLength(1)
    proj = produce(proj, (d) => syncWorkflowV2NodeToProject(d as Project, col))
    expect(proj.layers.every((l) => !l.physics?.impacts?.length)).toBe(true)

    const pair = attachLogicNodeToLayerV2(wf, v2LayerNodeId(rock.id), 'collision')
    expect(pair.createdNodeId).toBe(col.id)
    wf = pair.workflow
    col = wf.nodes.find((n) => n.id === col.id)!
    expect(col.params?.targetColliderLayerId).toBe(rock.id)
    proj = produce(proj, (d) => void addKeyframe(d.layers[0].transform.position, 0.5, [1, 2, 180], 'linear'))
    for (const [s, e] of [[1, 3], [2, 5], [4, 8]]) {
      proj = produce(proj, (d) => {
        d.workflow = wf
        syncWorkflowV2NodeToProject(d as Project, col, { timeStart: s, timeEnd: e })
      })
    }
    const vineKeys = proj.layers.find((l) => l.id === vine.id)!.transform.position.keyframes
    expect(vineKeys.filter((k) => isCollisionGeneratedKey(k.id)).every((k) => k.t >= 4)).toBe(true)
    expect(vineKeys.some((k) => k.t === 0.5)).toBe(true)
    expect(proj.layers.find((l) => l.id === rock.id)!.physics?.impacts?.length).toBeGreaterThan(0)
  })

  it('Va chạm & Vật liệu được khôi phục từ dữ liệu vật lý thật khi cây bị dựng lại (không mất logic)', () => {
    let { proj, vine, rock } = sampleProject()
    proj = synced(proj)
    let wf = attachLogicNodeToLayerV2(proj.workflow!, v2LayerNodeId(vine.id), 'collision').workflow
    const paired = attachLogicNodeToLayerV2(wf, v2LayerNodeId(rock.id), 'collision')
    wf = paired.workflow
    const col = wf.nodes.find((n) => n.id === paired.createdNodeId)!
    proj = produce(proj, (d) => {
      d.workflow = wf
      syncWorkflowV2NodeToProject(d as Project, col, { collisionMode: 'heavy_punch', collisionForce: 1.5, timeStart: 2, timeEnd: 6 })
    })
    const rebuilt = syncWorkflowV2Graph(proj, undefined)
    const recovered = rebuilt.nodes.find((n) => n.id === col.id)!
    expect(recovered.params?.collisionMode).toBe('heavy_punch')
    expect(recovered.params?.strikerLayerId).toBe(vine.id)
    expect(recovered.params?.targetColliderLayerId).toBe(rock.id)
    expect(rebuilt.nodes.some((n) => n.params?.logicCategory === 'material' && n.params.targetLayerIds?.includes(rock.id))).toBe(true)
    expect(syncWorkflowV2Graph(proj, rebuilt)).toBe(rebuilt)
  })

  it('chặn nối khác cảnh và chặn nối tay dây Camera chuyển cảnh', () => {
    let { proj, shotA, vine, cave } = sampleProject()
    proj = synced(proj)
    const res = attachLogicNodeToLayerV2(proj.workflow!, v2LayerNodeId(vine.id), 'collision')
    const cross = validateWorkflowV2Connection(res.workflow, v2LayerNodeId(cave.id), res.createdNodeId)
    expect(cross.valid).toBe(false)
    const cam = validateWorkflowV2Connection(res.workflow, v2RootId(shotA.id), v2CameraId('khac'))
    expect(cam.valid).toBe(false)
    expect(validateWorkflowV2Connection(res.workflow, v2LayerNodeId(vine.id), v2LayerNodeId(cave.id)).valid).toBe(false)
  })

  it('bật/tắt Nhóm chỉ ẩn/hiện Layer, không san phẳng inPoint/outPoint', () => {
    let { proj, vine, rock } = sampleProject()
    proj = synced(proj)
    const group = proj.workflow!.nodes.find((n) => n.params?.groupKind && n.params.targetLayerIds?.includes(vine.id))!
    proj = produce(proj, (d) => syncWorkflowV2NodeToProject(d as Project, { ...group, enabled: false }))
    const v = proj.layers.find((l) => l.id === vine.id)!
    const r = proj.layers.find((l) => l.id === rock.id)!
    expect(v.visible).toBe(false)
    expect([v.inPoint, v.outPoint, r.inPoint, r.outPoint]).toEqual([0, 12, 2, 9])
  })
})

describe('Workflow V2 — bố cục không đè thẻ', () => {
  const overlap = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
    a.x < b.x + WF_V2_NODE_W && b.x < a.x + WF_V2_NODE_W && a.y < b.y + WF_V2_NODE_H && b.y < a.y + WF_V2_NODE_H

  function assertNoOverlap(wf: WorkflowGraph): void {
    const hidden = resolveHiddenV2NodeIds(wf.nodes, wf.edges)
    const visible = wf.nodes.filter((n) => !hidden.has(n.id))
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++)
        expect(overlap(visible[i].position, visible[j].position), `${visible[i].id} ↔ ${visible[j].id}`).toBe(false)
  }

  it('mọi cụm cảnh trong cùng không gian không chồng lên nhau, kể cả sau khi gắn thêm logic', async () => {
    const { buildDemoProject } = await import('./demo')
    let proj = synced(await buildDemoProject())
    assertNoOverlap(proj.workflow!)
    const layerNode = proj.workflow!.nodes.find((n) => n.type === 'layer_assembly' && !n.params?.groupKind)!
    for (const cat of ['action', 'light', 'cave', 'fx'] as const) {
      const res = attachLogicNodeToLayerV2(proj.workflow!, layerNode.id, cat)
      proj = synced(produce(proj, (d) => {
        d.workflow = res.workflow
        syncWorkflowV2NodeToProject(d as Project, res.workflow.nodes.find((n) => n.id === res.createdNodeId)!)
      }))
    }
    assertNoOverlap(proj.workflow!)
    expect(syncWorkflowV2Graph(proj, proj.workflow)).toBe(proj.workflow)
  })

  it('thẻ kéo tay được ghim, né chỗ trống và giữ nguyên khi tự xếp lại (trừ khi bỏ ghim)', () => {
    let { proj, vine } = sampleProject()
    proj = synced(proj)
    const wf = proj.workflow!
    const target = wf.nodes.find((n) => n.id === v2LayerNodeId(vine.id))!
    const other = wf.nodes.find((n) => n.type === 'scene_shot')!
    const spot = findFreeV2Spot(wf.nodes, wf.edges, target.id, other.position)
    expect(overlap(spot, other.position)).toBe(false)
    proj = produce(proj, (d) => {
      d.workflow!.nodes.find((n) => n.id === target.id)!.position = { x: 2000, y: 40 }
      d.workflow!.nodes.find((n) => n.id === target.id)!.params!.pinned = true
    })
    const kept = syncWorkflowV2Graph(proj, proj.workflow, { relayout: true })
    expect(kept.nodes.find((n) => n.id === target.id)!.position).toEqual({ x: 2000, y: 40 })
    assertNoOverlap(kept)
    const reset = relayoutWorkflowV2({ ...proj, workflow: kept }, true)
    expect(reset.nodes.find((n) => n.id === target.id)!.position.x).not.toBe(2000)
  })

  it('mỗi Node Camera cảnh sinh các Node con lộ trình quay (#1, #2, #2.1...), đồng bộ 2 chiều với project.camera và hỗ trợ thu gọn', () => {
    let { proj, shotA } = sampleProject()
    proj = synced(proj)
    const camNodeA = proj.workflow!.nodes.find((n) => n.id === v2CameraId(shotA.id))!
    const wpNodesInitial = proj.workflow!.nodes.filter((n) => isCameraWaypointNode(n) && n.params?.shotId === shotA.id)
    expect(wpNodesInitial.length).toBeGreaterThanOrEqual(1)
    expect(camNodeA.params?.childLayerCount).toBe(wpNodesInitial.length)
    expect(wpNodesInitial[0].id).toBe(v2CameraWaypointId(shotA.id, 0))
    expect(proj.workflow!.edges.some((e) => e.fromNode === camNodeA.id && e.toNode === wpNodesInitial[0].id)).toBe(true)

    // Thêm 1 cảnh con / mốc lộ trình quay Đẩy cận cho Cảnh A
    proj = synced(produce(proj, (d) => {
      spawnWorkflowV2CameraWaypoint(d as Project, shotA.id, 'zoom-in')
    }))
    const wpNodesAfterSpawn = proj.workflow!.nodes.filter((n) => isCameraWaypointNode(n) && n.params?.shotId === shotA.id)
    expect(wpNodesAfterSpawn.length).toBe(wpNodesInitial.length + 1)
    const secondWp = wpNodesAfterSpawn[1]!
    expect(proj.workflow!.edges.some((e) => e.fromNode === wpNodesAfterSpawn[0].id && e.toNode === secondWp.id)).toBe(true)
    assertNoOverlap(proj.workflow!)

    // Chỉnh thông số zoom & góc xoay trên Node con lộ trình quay -> đồng bộ xuống project.camera
    proj = synced(produce(proj, (d) => {
      syncWorkflowV2NodeToProject(d as Project, secondWp, { camZoomPct: 160, camYaw: 14 })
    }))
    const updatedWp = proj.workflow!.nodes.find((n) => n.id === secondWp.id)!
    expect(updatedWp.params?.camZoomPct).toBeCloseTo(160, -1)
    expect(updatedWp.params?.camYaw).toBeCloseTo(14, 0)

    // Thu gọn Node Camera cha -> ẩn toàn bộ các Node con lộ trình quay của cảnh đó
    const collapsedWf = produce(proj.workflow!, (d) => {
      d.nodes.find((n) => n.id === camNodeA.id)!.params!.collapsedGroup = true
    })
    const hidden = resolveHiddenV2NodeIds(collapsedWf.nodes, collapsedWf.edges)
    for (const wp of wpNodesAfterSpawn) {
      expect(hidden.has(wp.id)).toBe(true)
    }

    // Xoá Node con lộ trình quay vừa thêm -> gỡ keyframe khỏi project.camera
    proj = synced(produce(proj, (d) => {
      detachWorkflowV2NodeFromProject(d as Project, updatedWp)
    }))
    const wpNodesAfterDelete = proj.workflow!.nodes.filter((n) => isCameraWaypointNode(n) && n.params?.shotId === shotA.id)
    expect(wpNodesAfterDelete.length).toBe(wpNodesInitial.length)
  })

  it('bung đầy đủ các mảnh con của Cụm 2.5D & Layer 3D, nối vào Node Khoá Cụm, hỗ trợ chỉnh riêng mảnh hoặc chỉnh cả cụm + Rig Xương + Thay Biểu Cảm', () => {
    let { proj, shotA } = sampleProject()
    const instId = 'comp-anime-test'
    const torso = createImageLayer({ id: 'a-torso', name: '[Nhân Vật Anime] Thân áo & cổ', kind: 'image', mime: 'image/png', width: 300, height: 400 }, proj.comp, 120, shotA.id)
    torso.composite = {
      instanceId: instId,
      compositeId: 'tpl-anime-student-parts',
      compositeName: 'Nhân Vật Anime',
      isRoot: true,
      lockedGroup: true,
      rootOffset: [0, 0, 0],
      sourceLayerId: 'torso'
    }
    const faceNormal = createImageLayer({ id: 'a-face1', name: '[Nhân Vật Anime] Biểu cảm 1: Bình thường', kind: 'image', mime: 'image/png', width: 200, height: 200 }, proj.comp, 118, shotA.id)
    faceNormal.transform.position.value = [0, 140, 118]
    faceNormal.composite = {
      instanceId: instId,
      compositeId: 'tpl-anime-student-parts',
      compositeName: 'Nhân Vật Anime',
      isRoot: false,
      lockedGroup: true,
      rootOffset: [0, 140, -2],
      sourceLayerId: 'face-normal',
      slot: 'face'
    }
    const faceHappy = createImageLayer({ id: 'a-face2', name: '[Nhân Vật Anime] Biểu cảm 2: Tươi cười', kind: 'image', mime: 'image/png', width: 200, height: 200 }, proj.comp, 118, shotA.id)
    faceHappy.visible = false
    faceHappy.transform.position.value = [0, 140, 118]
    faceHappy.composite = {
      instanceId: instId,
      compositeId: 'tpl-anime-student-parts',
      compositeName: 'Nhân Vật Anime',
      isRoot: false,
      lockedGroup: true,
      rootOffset: [0, 140, -2],
      sourceLayerId: 'face-happy',
      slot: 'face'
    }
    proj.layers.push(torso, faceNormal, faceHappy)
    proj = synced(proj)

    // 1. Kiểm tra cả 3 mảnh con đều được bung ra thành Node Layer riêng và nối dây vào Node Khoá Cụm
    const clusterLockNode = proj.workflow!.nodes.find((n) => n.id === `v2-cluster-${instId}`)!
    expect(clusterLockNode).toBeDefined()
    expect(clusterLockNode.params?.logicCategory).toBe('cluster_lock')
    expect(clusterLockNode.params?.targetLayerIds).toEqual([torso.id, faceNormal.id, faceHappy.id])
    for (const part of [torso, faceNormal, faceHappy]) {
      const lNode = proj.workflow!.nodes.find((n) => n.id === v2LayerNodeId(part.id))!
      expect(lNode).toBeDefined()
      expect(lNode.params?.targetLayerIds).toEqual([part.id])
      expect(proj.workflow!.edges.some((e) => e.fromNode === lNode.id && e.toNode === clusterLockNode.id)).toBe(true)
    }

    // 2. Chỉnh riêng 1 mảnh con (faceNormal) chỉ di chuyển mảnh đó và cập nhật rootOffset, không ảnh hưởng mảnh gốc torso
    const faceNode = proj.workflow!.nodes.find((n) => n.id === v2LayerNodeId(faceNormal.id))!
    proj = synced(produce(proj, (d) => {
      syncWorkflowV2NodeToProject(d as Project, faceNode, { transformX: 25, transformY: 155 })
    }))
    expect(proj.layers.find((l) => l.id === torso.id)!.transform.position.value[0]).toBe(0)
    expect(proj.layers.find((l) => l.id === faceNormal.id)!.transform.position.value[0]).toBe(25)
    expect(proj.layers.find((l) => l.id === faceNormal.id)!.composite?.rootOffset?.[0]).toBe(25)

    // 3. Chỉnh vị trí trên Node Khoá Cụm -> di chuyển đồng bộ toàn bộ cả cụm
    proj = synced(produce(proj, (d) => {
      syncWorkflowV2NodeToProject(d as Project, clusterLockNode, { transformX: 100, rigActionPreset: 'wave' })
    }))
    expect(proj.layers.find((l) => l.id === torso.id)!.transform.position.value[0]).toBe(100)

    // 4. Gắn Node Bộ phận chính (part_swap / isPartHub) vào Node Khoá Cụm -> tự động sinh các Node con Bộ phận (isPartChild)
    const swapRes = attachLogicNodeToLayerV2(proj.workflow!, clusterLockNode.id, 'part_swap', 'v2:part_swap:expr_happy')
    expect(swapRes.createdNodeId).toBeTruthy()
    proj = synced(produce(proj, (d) => {
      d.workflow = swapRes.workflow
    }))
    const partHubNode = proj.workflow!.nodes.find((n) => n.id === swapRes.createdNodeId)!
    expect(partHubNode).toBeDefined()
    expect(partHubNode.params?.isPartHub).toBe(true)
    const partChildNodes = proj.workflow!.nodes.filter(
      (n) => n.params?.isPartChild && n.params?.hierarchyParentNodeId === partHubNode.id
    )
    // Chỉ hiện Node con Bộ phận khi bộ phận có >= 2 item (face có 2 item, torso chỉ có 1 item nên không hiện)
    expect(partChildNodes.length).toBe(1)
    expect(partChildNodes[0].params?.partGroupId).toBe('slot:face')
    assertNoOverlap(proj.workflow!)

    // Chỉnh Node con Bộ phận Khuôn mặt -> đổi biểu cảm sang Tươi cười & ghi Keyframe tư thế theo mốc giây
    const faceChild = partChildNodes.find((n) => n.params?.partGroupId === 'face') ?? partChildNodes[0]
    proj = synced(produce(proj, (d) => {
      const c = d.workflow!.nodes.find((n) => n.id === faceChild.id)!
      syncWorkflowV2NodeToProject(d as Project, c, {
        swapMode: 'expression',
        swapVariant: faceHappy.id,
        partRotDeg: 18,
        timeStart: 3,
        timeEnd: 6
      })
    }))
    expect(proj.layers.find((l) => l.id === faceNormal.id)!.visible).toBe(true)
    expect(proj.layers.find((l) => l.id === faceHappy.id)!.visible).toBe(true)
    expect(evaluate(proj.layers.find((l) => l.id === faceNormal.id)!.transform.opacity, 1.0)).toBe(1)
    expect(evaluate(proj.layers.find((l) => l.id === faceHappy.id)!.transform.opacity, 1.0)).toBe(0)
    expect(evaluate(proj.layers.find((l) => l.id === faceNormal.id)!.transform.opacity, 4.5)).toBe(0)
    expect(evaluate(proj.layers.find((l) => l.id === faceHappy.id)!.transform.opacity, 4.5)).toBe(1)
    expect(
      proj.layers
        .find((l) => l.id === faceHappy.id)!
        .transform.rotation.keyframes.some((k) => k.id.includes('-partpose-'))
    ).toBe(true)

    // Nối tiếp 1 chặng Node con Bộ phận (+3s: 6s -> 9s) mà không xoá keyframe chặng 3s -> 6s
    const followRes = spawnTimedFollowupNodeV2(proj.workflow!, faceChild.id, 3)
    expect(followRes?.createdNodeId).toBeTruthy()
    proj = synced(produce(proj, (d) => {
      if (followRes) d.workflow = followRes.workflow
    }))
    expect(proj.workflow!.nodes.find((n) => n.id === followRes!.createdNodeId)?.params?.timeStart).toBe(6)
    expect(proj.workflow!.nodes.find((n) => n.id === followRes!.createdNodeId)?.params?.timeEnd).toBe(9)

    // 5. Khi 1 layer ngắt kết nối khỏi Node Khoá Cụm (lockedGroup = false) -> không còn line nối vào Khoá Cụm và không bị di chuyển theo cụm
    proj = synced(produce(proj, (d) => {
      d.layers.find((l) => l.id === faceHappy.id)!.composite!.lockedGroup = false
    }))
    const updatedClusterLock = proj.workflow!.nodes.find((n) => n.id === `v2-cluster-${instId}`)!
    expect(proj.workflow!.edges.some((e) => e.fromNode === v2LayerNodeId(faceHappy.id) && e.toNode === updatedClusterLock.id)).toBe(false)
    expect(updatedClusterLock.params?.targetLayerIds).toEqual([torso.id, faceNormal.id])

    // 6. Trích xuất động Bộ phận theo Tab Bộ phận Xưởng 2.5D và tạo nhiều Node Bộ phận tách biệt + Node Gắn xương + Node Motion vẽ quỹ đạo
    const dynParts = extractCompositeDynamicParts(proj, instId, torso)
    expect(dynParts.length).toBeGreaterThan(0)
    const compat = getCompatibleLogicCatalogForNode(updatedClusterLock, proj)
    expect(compat.parentKind).toBe('composite_25d')
    // Ẩn Node Gắn xương khỏi danh mục Workflow (vì gắn xương thực hiện trong Xưởng 2.5D chuẩn hơn)
    expect(compat.categories.some((c) => c.id === 'rig_bone')).toBe(false)

    // 7. Động tác Tên Động trên Node Animation (nhép miệng, nháy mắt, tên tuỳ chỉnh)
    const dynActions = extractClusterDynamicActions(proj, instId, torso)
    expect(dynActions.some((a) => /nhép miệng/i.test(a.name))).toBe(true)
    proj = produce(proj, (d) => {
      saveClusterCustomAction(
        d as Project,
        instId,
        {
          id: 'act-custom-talk',
          name: 'Nhép miệng nói nhanh',
          icon: '👄',
          kind: 'sprite_cycle',
          layerIds: [faceNormal.id, faceHappy.id],
          speedHz: 5.0,
          duration: 3.0,
          loop: true
        },
        d.layers.find((l) => l.id === torso.id)
      )
    })
    const animRes = attachLogicNodeToLayerV2(proj.workflow!, updatedClusterLock.id, 'anim_fx', 'v2:anim_fx:rig_idle')
    proj = synced(produce(proj, (d) => {
      d.workflow = animRes.workflow
      const aNode = d.workflow.nodes.find((n) => n.id === animRes.createdNodeId)!
      syncWorkflowV2NodeToProject(d as Project, aNode, {
        animMode: 'rig_clip',
        customActionId: 'act-custom-talk',
        customActionName: 'Nhép miệng nói nhanh',
        customActionSpeedHz: 5.0,
        timeStart: 1,
        timeEnd: 3
      })
    }))
    expect(
      proj.layers
        .find((l) => l.id === faceNormal.id)!
        .transform.opacity.keyframes.some((k) => k.id.includes('-dynact-'))
    ).toBe(true)

    // 8. Node Motion vẽ line chuyển động với chế độ Lặp lại (customMotionLoop + customMotionCycleSec)
    const motionRes = attachLogicNodeToLayerV2(proj.workflow!, updatedClusterLock.id, 'action', 'v2:action:custom_draw')
    expect(motionRes.createdNodeId).toBeTruthy()
    proj = synced(produce(proj, (d) => {
      d.workflow = motionRes.workflow
      const mNode = d.workflow.nodes.find((n) => n.id === motionRes.createdNodeId)!
      syncWorkflowV2NodeToProject(d as Project, mNode, {
        actionPreset: 'custom_draw',
        customMotionPath: [[-0.5, 0], [0, -0.4], [0.5, 0]],
        customMotionLoop: true,
        customMotionCycleSec: 1.0,
        timeStart: 0,
        timeEnd: 3
      })
    }))
    expect(proj.layers.find((l) => l.id === torso.id)!.transform.position.keyframes.length).toBeGreaterThanOrEqual(6)

    // 9. Kết nối 1 Layer công cụ rời mới vào Cụm 2.5D -> tự động khoá vào cụm và cấu hình vị trí tương đối
    const swordProp = createImageLayer({ id: 'a-sword', name: 'Thanh Kiếm Ánh Sáng', kind: 'image', mime: 'image/png', width: 120, height: 120 }, proj.comp, 115, shotA.id)
    swordProp.transform.position.value = [150, 40, 115]
    proj = synced(produce(proj, (d) => {
      d.layers.push(swordProp)
    }))
    const swordLayerNodeId = v2LayerNodeId(swordProp.id)
    expect(validateWorkflowV2Connection(proj.workflow!, swordLayerNodeId, updatedClusterLock.id).valid).toBe(true)
    proj = synced(produce(proj, (d) => {
      const cNode = d.workflow!.nodes.find((n) => n.id === updatedClusterLock.id)!
      attachExternalLayerToClusterV2(d as Project, [swordProp.id], cNode)
      updateClusterMemberOffsetV2(d as Project, instId, swordProp.id, { offsetX: 75, offsetY: -15, scalePct: 120, rotDeg: 30 })
    }))
    const attachedSword = proj.layers.find((l) => l.id === swordProp.id)!
    expect(attachedSword.composite?.instanceId).toBe(instId)
    expect(attachedSword.composite?.lockedGroup).toBe(true)
    expect(attachedSword.composite?.rootOffset?.[0]).toBe(75)
    expect(attachedSword.composite?.rootOffset?.[1]).toBe(-15)
    expect(attachedSword.transform.rotation.value[2]).toBe(30)

    // 10. Đặt BBox Đích (#1 -> #2): phóng to/thu nhỏ dần theo BBox #2, đi theo chiều sâu Z vượt trước/sau cây và va chạm trên đường đi
    const treeLayer = createImageLayer(
      { id: 'a-tree', name: 'Cây Cổ Thụ', kind: 'image', mime: 'image/png', width: 260, height: 320 },
      proj.comp,
      140,
      shotA.id
    )
    treeLayer.transform.position.value = [160, 0, 140]
    proj = synced(
      produce(proj, (d) => {
        d.layers.push(treeLayer)
      })
    )

    proj = synced(
      produce(proj, (d) => {
        const mNode = d.workflow!.nodes.find((n) => n.id === motionRes.createdNodeId)!
        syncWorkflowV2NodeToProject(d as Project, mNode, {
          motionMode: 'bbox',
          actionPreset: 'bbox_target',
          bboxPathType: 'shortest',
          bboxTargetX: 320,
          bboxTargetY: 0,
          bboxTargetScalePct: 160,
          depthMode: 'depth_z',
          depthRefLayerId: treeLayer.id,
          depthRelation: 'in_front',
          collisionOnPathEnabled: true,
          collisionTargetLayerId: treeLayer.id,
          collisionResponse: 'push',
          timeStart: 0,
          timeEnd: 3
        })
      })
    )
    const movedTorso = proj.layers.find((l) => l.id === torso.id)!
    const bboxPosKeys = movedTorso.transform.position.keyframes.filter((k) => k.id.includes('-bboxmot-'))
    const bboxScaleKeys = movedTorso.transform.scale.keyframes.filter((k) => k.id.includes('-bboxmot-'))
    expect(bboxPosKeys.length).toBeGreaterThanOrEqual(2)
    expect(bboxScaleKeys.length).toBeGreaterThanOrEqual(2)
    // Tại điểm đích #2 (t=3s), depthZ phải nhỏ hơn depthZ của cây (140) -> Z-Index lớn hơn cây -> hiển thị đè lên trước cây
    const lastPosKey = bboxPosKeys[bboxPosKeys.length - 1]
    expect(lastPosKey.value[0]).toBe(320)
    expect(lastPosKey.value[2]).toBeLessThan(140)
    // Kích thước tại đích #2 phóng to lên 160% so với ban đầu
    const firstScaleKey = bboxScaleKeys[0]
    const lastScaleKey = bboxScaleKeys[bboxScaleKeys.length - 1]
    expect(lastScaleKey.value[0]).toBeGreaterThan(firstScaleKey.value[0] * 1.45)
    // Cây vật cản nhận xung lực va chạm và bị đẩy lùi khi cụm đi cắt qua trên đường BBox #1 -> #2
    const impactedTree = proj.layers.find((l) => l.id === treeLayer.id)!
    expect(impactedTree.physics?.impacts?.some((imp) => imp.id.startsWith('wf-bboxcol-'))).toBe(true)
  })

  it('xây dựng dự án mẫu 3 cảnh chuẩn JSON (Cánh Đồng, Trong Nhà, Ngoài Đường) với đầy đủ các Node Logic mượt mà', () => {
    const assetSpecs: DemoSceneAssetInput[] = [
      { id: 'asset-s1-sky', file: 's1-sky-field.svg', name: 'Bầu Trời Hoàng Hôn Cánh Đồng', width: 1920, height: 1080 },
      { id: 'asset-s1-hills', file: 's1-hills-windmill.svg', name: 'Đồi Xa & Cối Xay Gió', width: 1920, height: 680 },
      { id: 'asset-s1-field', file: 's1-golden-field.svg', name: 'Cánh Đồng Lúa Vàng & Đường Đất', width: 1920, height: 520 },
      { id: 'asset-s1-oaktree', file: 's1-oak-tree.svg', name: 'Cây Sồi Cổ Thụ (Vật Cản Z-Index)', width: 460, height: 560 },
      { id: 'asset-s1-boy-body', file: 's1-boy-body.svg', name: 'Cậu Bé Du Hành — Thân & Áo Choàng', width: 240, height: 340 },
      { id: 'asset-s1-boy-face-smile', file: 's1-boy-face-smile.svg', name: 'Khuôn Mặt — Tươi Cười', width: 160, height: 160 },
      { id: 'asset-s1-boy-face-wow', file: 's1-boy-face-wow.svg', name: 'Khuôn Mặt — Hào Hứng (Wow)', width: 160, height: 160 },
      { id: 'asset-s1-boy-arm-wave', file: 's1-boy-arm-wave.svg', name: 'Tay Phải — Vẫy Chào', width: 150, height: 180 },
      { id: 'asset-s1-boy-arm-point', file: 's1-boy-arm-point.svg', name: 'Tay Phải — Cầm Chong Chóng Tre', width: 150, height: 180 },
      { id: 'asset-s1-fg-flowers', file: 's1-fg-flowers.svg', name: 'Hoa Bồ Công Anh Tiền Cảnh', width: 1920, height: 320 },
      { id: 'asset-s2-room-wall', file: 's2-room-wall-window.svg', name: 'Tường Gỗ & Cửa Sổ Đêm Trăng', width: 1920, height: 1080 },
      { id: 'asset-s2-bookshelf', file: 's2-bookshelf-sofa.svg', name: 'Kệ Sách Gỗ & Ghế Sofa', width: 1700, height: 700 },
      { id: 'asset-s2-lamp-table', file: 's2-tea-table-lamp.svg', name: 'Bàn Trà & Đèn Bàn Toả Sáng', width: 520, height: 460 },
      { id: 'asset-s2-robo-body', file: 's2-robo-body.svg', name: 'Mèo Máy Quản Gia — Thân Máy', width: 240, height: 320 },
      { id: 'asset-s2-robo-face-happy', file: 's2-robo-face-happy.svg', name: 'Màn Hình Mặt — Mắt Cười', width: 160, height: 150 },
      { id: 'asset-s2-robo-face-talk', file: 's2-robo-face-talk.svg', name: 'Màn Hình Mặt — Đang Nói', width: 160, height: 150 },
      { id: 'asset-s2-tea-tray', file: 's2-tea-tray-prop.svg', name: 'Khay Trà Nóng (Đạo Cụ Gắn Cụm)', width: 160, height: 120 },
      { id: 'asset-s3-city-sky', file: 's3-city-night-sky.svg', name: 'Bầu Trời Phố Đêm & Tòa Nhà Xa', width: 1920, height: 1080 },
      { id: 'asset-s3-street-road', file: 's3-street-road.svg', name: 'Mặt Đường Nhựa & Vỉa Hè Phố Đêm', width: 1920, height: 540 },
      { id: 'asset-s3-lamp-tree', file: 's3-street-lamp-tree.svg', name: 'Cột Đèn Đường Neon & Cây Vỉa Hè', width: 420, height: 620 },
      { id: 'asset-s3-crate', file: 's3-street-crate.svg', name: 'Thùng Hàng & Biển Báo Vỉa Hè (Mục Tiêu Va Chạm)', width: 240, height: 220 },
      { id: 'asset-s3-scooter', file: 's3-scooter-rider.svg', name: 'Tay Đua Scooter Điện', width: 300, height: 320 }
    ]

    const rootDir = path.resolve(__dirname, '../../../..')
    for (const item of assetSpecs) {
      const svgFile = path.join(rootDir, 'assets', 'scenes-v2', item.file)
      if (fs.existsSync(svgFile)) {
        const rawSvg = fs.readFileSync(svgFile, 'utf8')
        item.dataUrl = `data:image/svg+xml;base64,${Buffer.from(rawSvg, 'utf8').toString('base64')}`
      }
    }

    const proj = buildThreeSceneWorkflowV2Project(assetSpecs)
    expect(proj.shots.map((s) => s.name)).toEqual([
      'Cánh Đồng Gió Mùa',
      'Phòng Khách Ấm Áp',
      'Phố Đêm Đèn Đường'
    ])
    expect(proj.layers.length).toBe(22)
    assertNoOverlap(proj.workflow!)
    expect(syncWorkflowV2Graph(proj, proj.workflow)).toBe(proj.workflow)

    // Kiểm tra Cảnh 1: Cụm Cậu Bé Du Hành đi theo BBox #1 -> #2 mượt (chỉ 2 keyframe đầu-cuối cho đường thẳng ngắn nhất)
    const boyBody = proj.layers.find((l) => l.id === 'layer-s1-boy-body')!
    const boyMotKeys = boyBody.transform.position.keyframes.filter((k) => k.id.includes('-bboxmot-'))
    expect(boyMotKeys.length).toBe(3) // 1 key pre + 2 key (tStart=0.2s, tEnd=4.6s) với easeInOut mượt tuyệt đối!
    expect(boyMotKeys[boyMotKeys.length - 1].value[2]).toBe(180) // Z=180 < Z=240 của Cây Sồi -> đi qua trước cây!

    // Kiểm tra Cảnh 2: Đạo cụ Khay Trà Nóng đã được khoá vào Cụm Mèo Máy Quản Gia và đi theo đường cong custom_curve
    const teaTray = proj.layers.find((l) => l.id === 'layer-s2-tea-tray')!
    expect(teaTray.composite?.instanceId).toBe('cluster-robo-s2')
    expect(teaTray.transform.position.keyframes.filter((k) => k.id.includes('-bboxmot-')).length).toBeGreaterThanOrEqual(10)

    // Kiểm tra Cảnh 3: Tay Đua Scooter Điện đi theo BBox #1 -> #2 và va chạm đẩy lùi Thùng Hàng Vỉa Hè
    const crate = proj.layers.find((l) => l.id === 'layer-s3-crate')!
    expect(crate.physics?.impacts?.length).toBeGreaterThanOrEqual(1)

    // Ghi ra các file JSON chuẩn tại projects/ để app load trực tiếp và dễ chỉnh sửa
    const projDir = path.join(rootDir, 'projects')
    const bundleDir = path.join(projDir, 'workflow-v2-bundle')
    const shotsDir = path.join(bundleDir, 'shots')
    fs.mkdirSync(shotsDir, { recursive: true })

    fs.writeFileSync(
      path.join(projDir, 'ba-canh-mau-workflow-v2.json'),
      JSON.stringify(proj, null, 2),
      'utf8'
    )
    const mainJson = buildMainWorkflowJson(proj, proj.workflow!)
    const bundleJson = {
      ...buildModularWorkflowBundle(proj, proj.workflow!),
      assets: proj.assets
    }
    fs.writeFileSync(path.join(bundleDir, 'main.json'), JSON.stringify(mainJson, null, 2), 'utf8')
    fs.writeFileSync(path.join(bundleDir, 'workflow-bundle.json'), JSON.stringify(bundleJson, null, 2), 'utf8')
    for (let i = 0; i < proj.shots.length; i++) {
      const sJson = buildShotWorkflowJson(proj, proj.shots[i].id, proj.workflow!)
      fs.writeFileSync(path.join(shotsDir, `shot-${i + 1}.json`), JSON.stringify(sJson, null, 2), 'utf8')
    }
  })
})
