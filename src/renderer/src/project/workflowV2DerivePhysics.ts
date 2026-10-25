import type { Layer, PhysicsImpactPulse, Project, WorkflowEdge, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { WF_V2_COL_X } from './workflowV2Layout'
import { WORKFLOW_V2_COLLISION_OPTIONS, WORKFLOW_V2_MATERIAL_OPTIONS } from './workflowV2PhysicsAndValidation'

/**
 * Suy diễn logic VẬT LÝ từ dữ liệu thật của Layer (bổ sung cho `workflowV2Derive`):
 * - Vật liệu: Layer có `physics.material` → đúng 1 Node Vật liệu (trừ khi Node Hiệu ứng "Đàn hồi" đang sở hữu vật lý).
 * - Va chạm: xung lực `wf-col-<nodeId>` trên Layer B (nguồn = Layer A) → đúng 1 Node Va chạm nối cả A và B.
 * Nhờ vậy va chạm / vật liệu tạo ở đâu (Workflow, Timeline, MCP) cũng hiện ở cả hai nơi và không bị mất khi dựng lại cây.
 */
const TARGET_PULSE = 'wf-col-'
const STRIKER_PULSE = 'wf-col-a-'

const layerNodeIdOf = (layerId: string): string => `v2-layer-${layerId}`
const r2 = (v: number): number => Number(v.toFixed(2))
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Khôi phục chế độ / lực / khoảng thời gian va chạm từ xung lực đã ghi (ngược với `applyCollisionNodeToProject`) */
export function collisionParamsFromPulse(pulse: PhysicsImpactPulse, target: Layer): Partial<WorkflowNodeParams> {
  const [vx, vy] = pulse.velocity ?? [0, 0, 0]
  const mode: WorkflowNodeParams['collisionMode'] =
    pulse.type === 'press' ? 'jelly_crush'
      : pulse.type === 'vault' ? 'wall_vault'
        : pulse.type === 'arrow' ? 'projectile_stick'
          : vy > 0 ? 'heavy_punch' : 'elastic_bounce'
  const base = mode === 'jelly_crush' ? Math.abs(vy) / 760 : Math.abs(vx) / (mode === 'heavy_punch' ? 960 : mode === 'projectile_stick' ? 680 : 640)
  const force = r2(clamp(base || 1.2, 0.2, 2.5))
  const deform = r2(clamp((target.physics?.hitSensitivity ?? force) / force, 0.2, 2.5))
  const tHit = pulse.time
  const tEnd = tHit + (pulse.duration ?? 0.9)
  const tStart = Math.max(0, (tHit - 0.45 * tEnd) / 0.55)
  return { collisionMode: mode, collisionForce: force, deformIntensity: deform, intensity: force, timeStart: r2(tStart), timeEnd: r2(tEnd) }
}

function edge(from: string, to: string): WorkflowEdge {
  return { id: `e-${from}-${to}`, fromNode: from, fromPort: 'layers_tree', toNode: to, toPort: 'layers_tree' }
}

function deriveCollisions(project: Project, nodes: WorkflowNode[], edges: WorkflowEdge[], out: { added: WorkflowNode[]; edges: WorkflowEdge[] }): void {
  const ids = new Set(nodes.map((n) => n.id))
  for (const target of project.layers) {
    for (const pulse of target.physics?.impacts ?? []) {
      if (!pulse.id.startsWith(TARGET_PULSE) || pulse.id.startsWith(STRIKER_PULSE) || !pulse.sourceLayerId) continue
      const nodeId = pulse.id.slice(TARGET_PULSE.length)
      const a = layerNodeIdOf(pulse.sourceLayerId)
      const b = layerNodeIdOf(target.id)
      if (!ids.has(a) || !ids.has(b)) continue
      if (!ids.has(nodeId)) {
        const opt = WORKFLOW_V2_COLLISION_OPTIONS.find((o) => o.id === collisionParamsFromPulse(pulse, target).collisionMode)!
        out.added.push({
          id: nodeId,
          type: 'physics_fx',
          title: `Va chạm: ${opt.label}`,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC, y: 0 },
          preset: 'rim_glow_particles',
          aiAgentRole: 'PhysicsLightFxAgent',
          aiDirective: `Va chạm "${opt.label}" khôi phục từ dữ liệu vật lý.`,
          params: {
            shotId: target.shotId ?? undefined,
            logicCategory: 'collision',
            targetMode: 'custom',
            requireLayerConnection: true,
            strikerLayerId: pulse.sourceLayerId,
            targetColliderLayerId: target.id,
            ...collisionParamsFromPulse(pulse, target)
          }
        })
        ids.add(nodeId)
      }
      for (const from of [a, b]) {
        const e = edge(from, nodeId)
        if (!edges.some((x) => x.fromNode === from && x.toNode === nodeId) && !out.edges.some((x) => x.id === e.id)) out.edges.push(e)
      }
    }
  }
}

function deriveMaterials(project: Project, nodes: WorkflowNode[], edges: WorkflowEdge[], out: { added: WorkflowNode[]; edges: WorkflowEdge[]; replaced: Map<string, WorkflowNode> }): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const layer of project.layers) {
    const layerNodeId = layerNodeIdOf(layer.id)
    const layerNode = byId.get(layerNodeId)
    if (!layerNode) continue
    const attached = edges.filter((e) => e.fromNode === layerNodeId).map((e) => byId.get(e.toNode)).filter((n): n is WorkflowNode => Boolean(n))
    const windOwned = attached.some((n) => n.params?.logicCategory === 'fx' && n.params?.fxKind === 'wind_physics')
    const tag = layer.physics?.material
    const present = Boolean(tag && tag !== 'none') && !windOwned
    const current = attached.find((n) => n.params?.logicCategory === 'material')
    const opt = WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === tag)
    if (!current) {
      if (!present || !opt) continue
      const id = `v2-material-${layer.id}`
      if (byId.has(id) || out.added.some((n) => n.id === id)) continue
      out.added.push({
        id,
        type: 'physics_fx',
        title: `Vật liệu: ${opt.label}`,
        enabled: layer.physics?.enabled !== false,
        position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
        preset: 'rim_glow_particles',
        aiAgentRole: 'PhysicsLightFxAgent',
        aiDirective: `Nhãn vật liệu "${opt.label}" của "${layerNode.title}".`,
        params: {
          shotId: layerNode.params?.shotId,
          logicCategory: 'material',
          materialTag: opt.id,
          materialStiffness: layer.physics?.stiffness ?? opt.defaultStiffness,
          materialBounciness: layer.physics?.bounciness ?? opt.defaultBounciness,
          materialGravity: layer.physics?.gravityScale ?? opt.defaultGravity,
          targetMode: 'custom',
          targetLayerIds: [...(layerNode.params?.targetLayerIds ?? [layer.id])],
          sharedLayerNodeIds: [layerNodeId],
          requireLayerConnection: true,
          timeStart: layerNode.params?.timeStart,
          timeEnd: layerNode.params?.timeEnd
        }
      })
      out.edges.push(edge(layerNodeId, id))
      continue
    }
    if ((current.params?.sharedLayerNodeIds?.length ?? 1) > 1) continue
    const enabled = present && layer.physics?.enabled !== false
    const nextTag = present && opt ? opt.id : current.params?.materialTag
    if (enabled !== current.enabled || nextTag !== current.params?.materialTag) {
      const title = present && opt ? `Vật liệu: ${opt.label}` : current.title
      out.replaced.set(current.id, { ...current, enabled, title, params: { ...current.params, materialTag: nextTag } })
    }
  }
}

/** Suy diễn & đồng bộ Node Vật liệu / Va chạm từ dữ liệu vật lý của Layer */
export function derivePhysicsLogic(project: Project, nodes: WorkflowNode[], edges: WorkflowEdge[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const out = { added: [] as WorkflowNode[], edges: [] as WorkflowEdge[], replaced: new Map<string, WorkflowNode>() }
  deriveCollisions(project, nodes, edges, out)
  deriveMaterials(project, nodes, [...edges, ...out.edges], out)
  if (!out.added.length && !out.edges.length && !out.replaced.size) return { nodes, edges }
  return { nodes: [...nodes.map((n) => out.replaced.get(n.id) ?? n), ...out.added], edges: [...edges, ...out.edges] }
}
