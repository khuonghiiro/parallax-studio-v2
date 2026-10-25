import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import type { Project } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { createImageLayer, createProject, createShot } from './factory'
import {
  WF_V2_NODE_H,
  WF_V2_NODE_W,
  attachLogicNodeToLayerV2,
  buildWorkflowV2SceneTree,
  isWorkflowV2Graph,
  normalizeWorkflowV2Scope,
  reconcileWorkflowV2WithProject,
  resolveHiddenV2NodeIds,
  syncWorkflowV2NodeToProject,
  workflowV2ScopeOf
} from './workflowV2Engine'
import {
  applyWorkflowV2PhysicsNodes,
  detachWorkflowV2NodeFromProject,
  rebuildWorkflowV2PreservingLogic,
  resolveWorkflowForScope
} from './workflowV2Rebuild'
import { isCollisionGeneratedKey } from './workflowV2CollisionKeys'

function sampleProject() {
  const proj = createProject()
  proj.comp.duration = 12
  const shotA = createShot('Cảnh rừng')
  const shotB = createShot('Cảnh hang')
  proj.shots.push(shotA, shotB)
  const mk = (id: string, name: string, z: number, shotId: string) =>
    createImageLayer({ id: `a-${id}`, name, kind: 'image', mime: 'image/png', width: 640, height: 480 }, proj.comp, z, shotId)
  const vine = mk('vine', 'Dây leo tiền cảnh', 180, shotA.id)
  const rock = mk('rock', 'Tảng đá', 300, shotA.id)
  const hero = mk('hero', 'Nhân vật', 120, shotA.id)
  const cave = mk('cave', 'Cửa hang', 400, shotB.id)
  vine.inPoint = 0
  vine.outPoint = 12
  rock.inPoint = 2
  rock.outPoint = 9
  proj.layers.push(vine, rock, hero, cave)
  return { proj, shotA, shotB, vine, rock, hero, cave }
}

describe('Workflow V2 — đồng bộ chính xác, không phá dữ liệu', () => {
  it('Node Va chạm đồng bộ idempotent: đổi khoảng mốc nhiều lần không tích tụ keyframe, tắt thì gỡ sạch', () => {
    const { proj, shotA, vine, rock } = sampleProject()
    addKeyframe(vine.transform.position, 0.5, [1, 2, 180], 'linear') // keyframe người dùng tự đặt
    let wf = buildWorkflowV2SceneTree(proj, shotA.id, { autoCollision: false })
    const res = attachLogicNodeToLayerV2(wf, `v2-layer-${vine.id}`, 'collision')
    wf = res.workflow
    proj.workflow = wf
    const col = wf.nodes.find((n) => n.id === res.createdNodeId)!
    const base = { strikerLayerId: vine.id, targetColliderLayerId: rock.id }
    syncWorkflowV2NodeToProject(proj, col, { ...base, timeStart: 1, timeEnd: 3 })
    const firstCount = vine.transform.position.keyframes.length
    for (const [s, e] of [[1.5, 3.5], [2, 5], [4, 8]]) {
      syncWorkflowV2NodeToProject(proj, col, { ...base, timeStart: s, timeEnd: e })
    }
    expect(vine.transform.position.keyframes.length).toBe(firstCount)
    expect(vine.transform.position.keyframes.some((k) => k.t === 4)).toBe(true)
    expect(vine.transform.position.keyframes.some((k) => k.t === 1)).toBe(false)

    syncWorkflowV2NodeToProject(proj, { ...col, enabled: false })
    const remaining = vine.transform.position.keyframes
    expect(remaining.some((k) => isCollisionGeneratedKey(k.id))).toBe(false)
    expect(remaining.some((k) => k.t === 0.5)).toBe(true)
    expect(rock.transform.scale.keyframes.some((k) => isCollisionGeneratedKey(k.id))).toBe(false)
  })

  it('Bật/tắt Node Group chỉ ẩn/hiện Layer, không san phẳng inPoint/outPoint của Layer con', () => {
    const { proj, shotA, vine, rock } = sampleProject()
    const wf = buildWorkflowV2SceneTree(proj, shotA.id)
    const group = wf.nodes.find((n) => n.params?.groupKind === 'group_25d')!
    syncWorkflowV2NodeToProject(proj, { ...group, enabled: false })
    expect(vine.visible).toBe(false)
    expect([vine.inPoint, vine.outPoint]).toEqual([0, 12])
    expect([rock.inPoint, rock.outPoint]).toEqual([2, 9])

    // Thu hẹp khoảng mốc Group → chỉ cắt Layer con vào trong khoảng
    syncWorkflowV2NodeToProject(proj, group, { timeStart: 3, timeEnd: 8 })
    expect([vine.inPoint, vine.outPoint]).toEqual([3, 8])
    expect([rock.inPoint, rock.outPoint]).toEqual([3, 8])
  })

  it('Node Layer mang khoảng thời gian thật của Layer; reconcile trả về đúng tham chiếu khi không đổi', () => {
    const { proj, shotA, vine } = sampleProject()
    const wf = buildWorkflowV2SceneTree(proj, shotA.id)
    const vineNode = wf.nodes.find((n) => n.id === `v2-layer-${vine.id}`)!
    expect([vineNode.params?.timeStart, vineNode.params?.timeEnd]).toEqual([0, 12])
    expect(reconcileWorkflowV2WithProject(proj, wf, shotA.id)).toBe(wf)
  })

  it('Phạm vi "Toàn dự án" phủ trọn thời lượng và gồm Layer của mọi cảnh', () => {
    const { proj, cave } = sampleProject()
    const wf = buildWorkflowV2SceneTree(proj, '__all__')
    const root = wf.nodes.find((n) => n.id === 'v2-root-scene')!
    expect(root.title).toContain('Toàn dự án')
    expect([root.params?.timeStart, root.params?.timeEnd]).toEqual([0, 12])
    expect(wf.targetShotId).toBeUndefined()
    expect(wf.nodes.some((n) => n.id === `v2-layer-${cave.id}`)).toBe(true)
  })

  it('Dựng lại cây giữ cấu hình Node Logic của người dùng và không hồi sinh Node Va chạm đã xoá', () => {
    const { proj, shotA, vine } = sampleProject()
    let wf = buildWorkflowV2SceneTree(proj, shotA.id)
    const autoCol = wf.nodes.find((n) => n.params?.logicCategory === 'collision')!
    expect(autoCol).toBeDefined()
    wf = { ...wf, nodes: wf.nodes.filter((n) => n.id !== autoCol.id), edges: wf.edges.filter((e) => e.toNode !== autoCol.id) }
    const action = wf.nodes.find(
      (n) => n.params?.logicCategory === 'action' && n.params.targetLayerIds?.includes(vine.id)
    )!
    wf = {
      ...wf,
      nodes: wf.nodes.map((n) => (n.id === action.id ? { ...n, params: { ...n.params, actionPreset: 'spin', intensity: 1.4 } } : n))
    }

    const rebuilt = rebuildWorkflowV2PreservingLogic(proj, shotA.id, wf)
    expect(rebuilt.nodes.some((n) => n.params?.logicCategory === 'collision')).toBe(false)
    const keptAction = rebuilt.nodes.find((n) => n.id === action.id)!
    expect(keptAction.params?.actionPreset).toBe('spin')
    expect(keptAction.params?.intensity).toBe(1.4)
    const vineActions = rebuilt.edges.filter(
      (e) => e.fromNode === `v2-layer-${vine.id}` && rebuilt.nodes.find((n) => n.id === e.toNode)?.params?.logicCategory === 'action'
    )
    expect(vineActions.length).toBe(1)
  })

  it('Xoá Node Hành động khỏi cây gỡ luôn chuyển động khỏi Layer', () => {
    const { proj, shotA, hero } = sampleProject()
    const wf = buildWorkflowV2SceneTree(proj, shotA.id)
    const res = attachLogicNodeToLayerV2(wf, `v2-layer-${hero.id}`, 'action')
    const node = res.workflow.nodes.find((n) => n.id === res.createdNodeId)!
    syncWorkflowV2NodeToProject(proj, node)
    expect(hero.motion?.enabled).toBe(true)
    detachWorkflowV2NodeFromProject(proj, node)
    expect(hero.motion?.enabled).toBe(false)
  })

  it('Đồ thị dẫn xuất theo phạm vi cảnh hội tụ sau 1 lần ghi (không vòng lặp cập nhật vô hạn)', async () => {
    const { buildDemoProject } = await import('./demo')
    const demo = await buildDemoProject()
    for (const rawScope of ['__all__', ...demo.shots.map((s) => s.id)]) {
      const scope = normalizeWorkflowV2Scope(demo, rawScope)
      let project: Project = demo
      let writes = 0
      for (let i = 0; i < 6; i++) {
        const wf = resolveWorkflowForScope(project, scope)
        if (wf === project.workflow) break
        writes++
        const needsInit = !isWorkflowV2Graph(project.workflow) || workflowV2ScopeOf(project.workflow) !== scope
        project = produce(project, (d) => {
          d.workflow = wf
          if (needsInit) applyWorkflowV2PhysicsNodes(d as Project, wf)
        })
      }
      expect(writes, `scope ${rawScope}`).toBeLessThanOrEqual(1)
    }
  })

  it('Bố cục cây: các thẻ đang hiển thị không bao giờ chồng lên nhau', () => {
    const { proj } = sampleProject()
    const wf = buildWorkflowV2SceneTree(proj, '__all__')
    const hidden = resolveHiddenV2NodeIds(wf.nodes, wf.edges)
    const visible = wf.nodes.filter((n) => !hidden.has(n.id))
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i].position
        const b = visible[j].position
        const overlap =
          a.x < b.x + WF_V2_NODE_W && b.x < a.x + WF_V2_NODE_W && a.y < b.y + WF_V2_NODE_H && b.y < a.y + WF_V2_NODE_H
        expect(overlap, `${visible[i].id} ↔ ${visible[j].id}`).toBe(false)
      }
    }
  })
})
