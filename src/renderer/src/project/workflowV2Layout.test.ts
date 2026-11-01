import { describe, expect, it } from 'vitest'
import type { WorkflowEdge, WorkflowNode, WorkflowPortKind } from '@shared/types'
import {
  WF_V2_COL_STEP,
  WF_V2_COL_X,
  WF_V2_NODE_H,
  WF_V2_NODE_W,
  WF_V2_TIME_COL_X,
  layoutWorkflowV2Tree,
  resolveHiddenV2NodeIds
} from './workflowV2Layout'

const overlap = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  a.x < b.x + WF_V2_NODE_W && b.x < a.x + WF_V2_NODE_W && a.y < b.y + WF_V2_NODE_H && b.y < a.y + WF_V2_NODE_H

function assertNoOverlap(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  const hidden = resolveHiddenV2NodeIds(nodes, edges)
  const visible = nodes.filter((n) => !hidden.has(n.id))
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      expect(overlap(visible[i].position, visible[j].position), `${visible[i].id} ↔ ${visible[j].id} bị đè nhau`).toBe(false)
    }
  }
}

function makeNode(overrides: Partial<WorkflowNode> & { id: string; type: WorkflowNode['type']; title: string }): WorkflowNode {
  return {
    preset: 'default',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: '',
    enabled: true,
    position: { x: 0, y: 0 },
    ...overrides
  }
}

function makeEdge(fromNode: string, toNode: string, fromPort: WorkflowPortKind = 'layers_tree', toPort: WorkflowPortKind = 'layers_tree'): WorkflowEdge {
  return {
    id: `e-${fromNode}-${toNode}`,
    fromNode,
    fromPort,
    toNode,
    toPort
  }
}

describe('Workflow V2 Layout — Thuật toán sắp xếp thẩm mỹ & luồng kết nối', () => {
  it('chuỗi nối tiếp tuyến tính (BBox 1 → BBox 2 → BBox 3) thẳng hàng ngang trên cùng một toạ độ Y', () => {
    const root = makeNode({ id: 'v2-root-shot1', type: 'scene_shot', title: 'Cảnh 1', params: { shotId: 's1' } })
    const grp = makeNode({ id: 'v2-grp-fg-s1', type: 'layer_assembly', title: 'Tiền cảnh', params: { groupKind: 'group_25d', shotId: 's1' } })
    const layer = makeNode({ id: 'v2-layer-torso', type: 'layer_assembly', title: 'Nhân vật', params: { shotId: 's1', targetLayerIds: ['torso'] } })

    const bbox1 = makeNode({
      id: 'v2-act-bbox1',
      type: 'motion_choreography',
      title: 'BBox #1 → #2',
      params: { logicCategory: 'action', shotId: 's1', targetLayerIds: ['torso'], sharedLayerNodeIds: [layer.id], timeStart: 0, timeEnd: 3 }
    })
    const bbox2 = makeNode({
      id: 'v2-act-bbox2',
      type: 'motion_choreography',
      title: 'BBox #2 → #3',
      params: { logicCategory: 'action', shotId: 's1', targetLayerIds: ['torso'], sharedLayerNodeIds: [layer.id], timeStart: 3, timeEnd: 6 }
    })
    const bbox3 = makeNode({
      id: 'v2-act-bbox3',
      type: 'motion_choreography',
      title: 'BBox #3 → #4',
      params: { logicCategory: 'action', shotId: 's1', targetLayerIds: ['torso'], sharedLayerNodeIds: [layer.id], timeStart: 6, timeEnd: 9 }
    })

    const edges: WorkflowEdge[] = [
      makeEdge(root.id, grp.id),
      makeEdge(grp.id, layer.id),
      makeEdge(layer.id, bbox1.id, 'layers_tree', 'motion_stream'),
      makeEdge(bbox1.id, bbox2.id, 'motion_stream', 'motion_stream'),
      makeEdge(bbox2.id, bbox3.id, 'motion_stream', 'motion_stream')
    ]

    const nodes = [root, grp, layer, bbox1, bbox2, bbox3]
    const laidOut = layoutWorkflowV2Tree(nodes, edges)
    const byId = new Map(laidOut.map((n) => [n.id, n]))

    const b1 = byId.get(bbox1.id)!
    const b2 = byId.get(bbox2.id)!
    const b3 = byId.get(bbox3.id)!

    // Phân cấp cột tăng dần từ trái sang phải
    expect(b1.position.x).toBe(WF_V2_COL_X.LOGIC)
    expect(b2.position.x).toBe(WF_V2_COL_X.LOGIC + WF_V2_COL_STEP)
    expect(b3.position.x).toBe(WF_V2_COL_X.LOGIC + WF_V2_COL_STEP * 2)

    // Thẳng hàng ngang trên cùng một toạ độ Y
    expect(b1.position.y).toBe(b2.position.y)
    expect(b2.position.y).toBe(b3.position.y)

    // Layer cha cùng hàng Y với chuỗi thẳng hàng này
    const l = byId.get(layer.id)!
    expect(l.position.x).toBe(WF_V2_COL_X.LAYER)
    expect(l.position.y).toBe(b1.position.y)

    assertNoOverlap(laidOut, edges)
  })

  it('nhánh rẽ (Part Hub → 3 Part Child) căn giữa cha theo các con', () => {
    const root = makeNode({ id: 'v2-root-s1', type: 'scene_shot', title: 'Cảnh 1', params: { shotId: 's1' } })
    const grp = makeNode({ id: 'v2-grp-fg-s1', type: 'layer_assembly', title: 'Tiền cảnh', params: { groupKind: 'group_25d', shotId: 's1' } })
    const layer = makeNode({ id: 'v2-layer-cluster', type: 'layer_assembly', title: 'Cụm Nhân Vật', params: { shotId: 's1', targetLayerIds: ['torso'] } })

    const hub = makeNode({
      id: 'v2-part-hub',
      type: 'layer_assembly',
      title: 'Bộ phận Hub',
      params: { logicCategory: 'part_swap', isPartHub: true, shotId: 's1', sharedLayerNodeIds: [layer.id] }
    })
    const part1 = makeNode({
      id: 'v2-child-face',
      type: 'layer_assembly',
      title: 'Mặt',
      params: { logicCategory: 'part_swap', isPartChild: true, hierarchyParentNodeId: hub.id, shotId: 's1', sharedLayerNodeIds: [hub.id] }
    })
    const part2 = makeNode({
      id: 'v2-child-arm',
      type: 'layer_assembly',
      title: 'Tay',
      params: { logicCategory: 'part_swap', isPartChild: true, hierarchyParentNodeId: hub.id, shotId: 's1', sharedLayerNodeIds: [hub.id] }
    })
    const part3 = makeNode({
      id: 'v2-child-leg',
      type: 'layer_assembly',
      title: 'Chân',
      params: { logicCategory: 'part_swap', isPartChild: true, hierarchyParentNodeId: hub.id, shotId: 's1', sharedLayerNodeIds: [hub.id] }
    })

    const edges: WorkflowEdge[] = [
      makeEdge(root.id, grp.id),
      makeEdge(grp.id, layer.id),
      makeEdge(layer.id, hub.id),
      makeEdge(hub.id, part1.id),
      makeEdge(hub.id, part2.id),
      makeEdge(hub.id, part3.id)
    ]

    const laidOut = layoutWorkflowV2Tree([root, grp, layer, hub, part1, part2, part3], edges)
    const byId = new Map(laidOut.map((n) => [n.id, n]))

    const h = byId.get(hub.id)!
    const p1 = byId.get(part1.id)!
    const p2 = byId.get(part2.id)!
    const p3 = byId.get(part3.id)!

    // Các con ở cột tiếp theo bên phải Hub
    expect(h.position.x).toBe(WF_V2_COL_X.LOGIC)
    expect(p1.position.x).toBe(WF_V2_COL_X.LOGIC + WF_V2_COL_STEP)
    expect(p2.position.x).toBe(WF_V2_COL_X.LOGIC + WF_V2_COL_STEP)
    expect(p3.position.x).toBe(WF_V2_COL_X.LOGIC + WF_V2_COL_STEP)

    // Các con xếp dọc từ trên xuống dưới
    expect(p1.position.y).toBeLessThan(p2.position.y)
    expect(p2.position.y).toBeLessThan(p3.position.y)

    // Node cha Part Hub được căn giữa theo các con
    expect(h.position.y).toBe(p2.position.y)

    assertNoOverlap(laidOut, edges)
  })

  it('ưu tiên người dùng khi sắp xếp thủ công (pinned = true) và tự động né tránh', () => {
    const root = makeNode({ id: 'v2-root-s1', type: 'scene_shot', title: 'Cảnh 1', params: { shotId: 's1' } })
    const grp = makeNode({ id: 'v2-grp-s1', type: 'layer_assembly', title: 'Tiền cảnh', params: { groupKind: 'group_25d', shotId: 's1' } })
    const layer1 = makeNode({ id: 'v2-l1', type: 'layer_assembly', title: 'Layer 1', params: { shotId: 's1' } })
    const layer2 = makeNode({
      id: 'v2-l2',
      type: 'layer_assembly',
      title: 'Layer 2 (User kéo tay)',
      position: { x: 1500, y: 250 },
      params: { shotId: 's1', pinned: true }
    })

    const edges: WorkflowEdge[] = [
      makeEdge(root.id, grp.id),
      makeEdge(grp.id, layer1.id),
      makeEdge(grp.id, layer2.id)
    ]

    const laidOut = layoutWorkflowV2Tree([root, grp, layer1, layer2], edges)
    const byId = new Map(laidOut.map((n) => [n.id, n]))

    // Thẻ được kéo tay giữ nguyên chính xác toạ độ { x: 1500, y: 250 }
    expect(byId.get(layer2.id)!.position).toEqual({ x: 1500, y: 250 })

    assertNoOverlap(laidOut, edges)
  })

  it('node Time chung không có consumer thì rơi về cột ngoài (-340)', () => {
    const root = makeNode({ id: 'v2-root-s1', type: 'scene_shot', title: 'Cảnh 1', params: { shotId: 's1' } })
    const timeNode = makeNode({
      id: 'time-shared-a',
      type: 'motion_choreography',
      title: 'Time A · Thời gian chung',
      params: { logicCategory: 'time', timeStart: 0, timeEnd: 5 }
    })

    const laidOut = layoutWorkflowV2Tree([root, timeNode], [])
    const t = laidOut.find((n) => n.id === timeNode.id)!
    expect(t.position.x).toBe(WF_V2_TIME_COL_X)
  })

  it('node Time chung có consumer thì tự động đặt ngay bên cạnh các consumer thay vì ở xa', () => {
    const root = makeNode({ id: 'v2-root-s1', type: 'scene_shot', title: 'Cảnh 1', params: { shotId: 's1' } })
    const grp = makeNode({ id: 'v2-grp-s1', type: 'layer_assembly', title: 'Nhóm 1', params: { groupKind: 'group_25d', shotId: 's1' } })
    const layer = makeNode({ id: 'v2-layer-torso', type: 'layer_assembly', title: 'Layer', params: { shotId: 's1' } })

    const timeNode = makeNode({
      id: 'time-shared-b',
      type: 'motion_choreography',
      title: 'Time B · Thời gian chung',
      params: { logicCategory: 'time', timeStart: 0, timeEnd: 5 }
    })

    const edges: WorkflowEdge[] = [
      makeEdge(root.id, grp.id),
      makeEdge(grp.id, layer.id),
      makeEdge(timeNode.id, layer.id, 'time_range', 'time_range')
    ]

    const laidOut = layoutWorkflowV2Tree([root, grp, layer, timeNode], edges)
    const t = laidOut.find((n) => n.id === timeNode.id)!
    const l = laidOut.find((n) => n.id === layer.id)!

    // Không bị vứt ra tít -340 cách 1100px
    expect(t.position.x).toBeGreaterThan(0)
    // Nằm ở cột ngay trước consumer (khoảng cách 1 bước cột WF_V2_COL_STEP)
    expect(l.position.x - t.position.x).toBe(WF_V2_COL_STEP)
    assertNoOverlap(laidOut, edges)
  })
})
