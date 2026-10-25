import type { AudioTrackItem, Layer, Project, WorkflowEdge, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import { WF_V2_COL_X } from './workflowV2Layout'
import { resolveLayerNodeTimeRange } from './workflowV2Scope'

/**
 * MỘT LOGIC CHUNG cho Timeline và Workflow:
 * dữ liệu thật trên Layer (chuyển động, hoạt ảnh FX, ánh sáng, hang động, âm thanh gắn layer) là nguồn sự thật;
 * mỗi hiệu ứng đang có trên Layer luôn được thể hiện bằng đúng 1 Node Logic trong cây và ngược lại.
 * - Hiệu ứng có trên Layer mà chưa có Node → tự tạo Node (thêm từ Inspector / Timeline / MCP đều hiện ra Workflow).
 * - Node có mà hiệu ứng không còn trên Layer → Node chuyển sang trạng thái tắt (không mất cấu hình).
 * - Thông số đổi ở Inspector / Timeline → cập nhật ngược vào Node.
 * Vật liệu / Va chạm / Hiệu ứng / Camera là logic do Node sở hữu (chỉ tạo qua Node) nên không suy diễn ngược.
 */
export type DerivedCategory = 'action' | 'anim_fx' | 'light' | 'cave' | 'audio'

interface Derived {
  present: boolean
  enabled: boolean
  params: Partial<WorkflowNodeParams>
  title: string
}

const r2 = (v: number): number => Number(v.toFixed(2))

function deriveAction(layer: Layer, compDur: number): Derived {
  const m = layer.motion
  const present = Boolean(m && m.type && m.type !== 'none')
  const opt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.motionType === m?.type)
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const start = typeof m?.startTime === 'number' ? m.startTime : range.start
  const end = m?.duration && m.duration > 0 ? start + m.duration : range.end
  return {
    present,
    enabled: present && m?.enabled !== false,
    params: { actionPreset: opt?.id ?? m?.type, intensity: m?.amount ?? opt?.defaultAmount, timeStart: r2(start), timeEnd: r2(end) },
    title: `Hành động: ${opt?.label ?? m?.type ?? 'Chuyển động'}`
  }
}

function deriveAnimFx(layer: Layer, compDur: number): Derived {
  const fxList = (layer.appliedEffects ?? []).filter((f) => f.category !== 'motion')
  const primary = fxList[fxList.length - 1]
  const present = Boolean(primary)
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === primary?.presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const start = typeof primary?.startTime === 'number' ? primary.startTime : range.start
  const end = primary?.duration && primary.duration > 0 ? start + primary.duration : range.end
  const extraCount = fxList.length > 1 ? ` (+${fxList.length - 1})` : ''
  return {
    present,
    enabled: present && fxList.some((f) => f.enabled !== false),
    params: {
      animFxPreset: opt.id,
      animFxCount: primary?.count ?? opt.defaultCount,
      intensity: primary?.intensity ?? opt.defaultIntensity,
      animFxColor: primary?.glow?.color ?? opt.defaultColor,
      animFxThickness: primary?.glow?.thickness,
      animFxSide: primary?.glow?.side,
      animFxSpeed: primary?.glow?.speed,
      animFxMinIntensity: primary?.glow?.minIntensity,
      timeStart: r2(start),
      timeEnd: r2(end)
    },
    title: `Hoạt ảnh FX: ${opt.label}${extraCount}`
  }
}

function lightModeOf(layer: Layer, current?: string): WorkflowNodeParams['lightMode'] {
  const vl = layer.virtualLight?.enabled ? layer.virtualLight : undefined
  const currentOpt = WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === current)
  if (!vl) return 'glow'
  if (currentOpt && currentOpt.virtualKind === vl.kind) return currentOpt.id
  if (vl.kind === 'bulb') return layer.glow?.enabled ? 'rim' : 'point'
  return WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.virtualKind === vl.kind)?.id ?? 'point'
}

function deriveLight(layer: Layer, compDur: number, glowOwnedByFx: boolean, current?: WorkflowNode): Derived {
  const vlOn = Boolean(layer.virtualLight?.enabled)
  const glowOn = Boolean(layer.glow?.enabled) && !glowOwnedByFx
  const present = vlOn || glowOn
  const mode = lightModeOf(layer, current?.params?.lightMode)
  const opt = WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === mode)
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const g = layer.glow
  const start = glowOn && typeof g?.startTime === 'number' ? g.startTime : range.start
  const end = glowOn && g?.duration ? start + g.duration : range.end
  return {
    present,
    enabled: present,
    params: {
      lightMode: mode,
      lightColor: (vlOn ? layer.virtualLight?.color : g?.color) ?? opt?.defaultColor,
      intensity: vlOn ? layer.virtualLight?.intensity : g?.intensity,
      timeStart: r2(start),
      timeEnd: r2(end)
    },
    title: `Ánh sáng: ${opt?.label ?? 'Ánh sáng'}`
  }
}

function deriveCave(layer: Layer, compDur: number): Derived {
  const portal = layer.physics?.depthPortal
  const present = Boolean(portal?.enabled)
  const opt = WORKFLOW_V2_CAVE_OPTIONS.find((o) => o.id === (portal?.archShape ?? 'arch')) ?? WORKFLOW_V2_CAVE_OPTIONS[0]
  const range = resolveLayerNodeTimeRange(layer, compDur)
  return {
    present,
    enabled: present,
    params: { caveArchShape: opt.id, caveDarkness: portal?.darkness, caveMinScale: portal?.minScale, intensity: portal?.darkness, timeStart: range.start, timeEnd: range.end },
    title: `Hang động: ${opt.label}`
  }
}

function deriveAudio(track: AudioTrackItem | undefined, layer: Layer, compDur: number): Derived {
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const start = track?.offset ?? range.start
  const end = track?.duration ? start + track.duration : range.end
  return {
    present: Boolean(track),
    enabled: Boolean(track) && !track?.muted,
    params: { intensity: track?.volume ?? 1, autoLipSync: Boolean(track?.lipSyncEnabled), timeStart: r2(start), timeEnd: r2(end) },
    title: `Âm thanh: ${track?.name || layer.name}`
  }
}

/** Giữ nguyên giá trị cũ khi chênh lệch số rất nhỏ (tránh dao động số thực làm đồ thị đổi liên tục) */
function mergeDerivedParams(current: WorkflowNodeParams, derived: Partial<WorkflowNodeParams>): WorkflowNodeParams {
  const next: WorkflowNodeParams = { ...current }
  for (const [k, v] of Object.entries(derived) as [keyof WorkflowNodeParams, unknown][]) {
    if (v === undefined) continue
    const cur = current[k]
    if (typeof v === 'number' && typeof cur === 'number' && Math.abs(v - cur) < 0.006) continue
    ;(next as Record<string, unknown>)[k] = v
  }
  return next
}

const NODE_META: Record<DerivedCategory, Pick<WorkflowNode, 'type' | 'preset' | 'aiAgentRole'>> = {
  action: { type: 'motion_choreography', preset: 'organic_wind_breathe', aiAgentRole: 'MotionChoreographyAgent' },
  anim_fx: { type: 'motion_choreography', preset: 'organic_wind_breathe', aiAgentRole: 'MotionChoreographyAgent' },
  light: { type: 'physics_fx', preset: 'rim_glow_particles', aiAgentRole: 'PhysicsLightFxAgent' },
  cave: { type: 'physics_fx', preset: 'rim_glow_particles', aiAgentRole: 'PhysicsLightFxAgent' },
  audio: { type: 'audio_lipsync', preset: 'auto_dialogue_lipsync', aiAgentRole: 'AudioLipSyncAgent' }
}

function createDerivedNode(id: string, cat: DerivedCategory, layerNode: WorkflowNode, d: Derived): WorkflowNode {
  return {
    id,
    ...NODE_META[cat],
    title: d.title,
    enabled: d.enabled,
    position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
    aiDirective: `${d.title} cho "${layerNode.title}".`,
    params: {
      shotId: layerNode.params?.shotId,
      logicCategory: cat,
      targetMode: 'custom',
      targetLayerIds: [...(layerNode.params?.targetLayerIds ?? [])],
      sharedLayerNodeIds: [layerNode.id],
      requireLayerConnection: true,
      hierarchyParentNodeId: layerNode.id,
      ...Object.fromEntries(Object.entries(d.params).filter(([, v]) => v !== undefined))
    }
  }
}

/** Track âm thanh đang gắn vào Layer (theo layer id hoặc instanceId của cụm composite / model 3D) */
export function findLayerAudioTrack(project: Project, layer: Layer, memberIds: string[]): AudioTrackItem | undefined {
  return getProjectAudioTracks(project).find(
    (tr) =>
      tr.targetId &&
      (memberIds.includes(tr.targetId) || tr.targetId === layer.composite?.instanceId || tr.targetId === layer.model3d?.instanceId)
  )
}

/** Suy diễn & đồng bộ các Node Logic từ dữ liệu thật của Layer (thuần, không đổi tham chiếu khi không cần) */
export function deriveLogicFromLayers(
  project: Project,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const compDur = Math.max(1, project.comp.duration || 5)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const replaced = new Map<string, WorkflowNode>()
  const added: WorkflowNode[] = []
  const addedEdges: WorkflowEdge[] = []
  const layersById = new Map(project.layers.map((l) => [l.id, l]))
  for (const layerNode of nodes) {
    if (layerNode.type !== 'layer_assembly' || layerNode.params?.groupKind) continue
    const layer = layersById.get(layerNode.id.replace(/^v2-layer-/, ''))
    if (!layer) continue
    const memberIds = layerNode.params?.targetLayerIds ?? [layer.id]
    const attached = edges.filter((e) => e.fromNode === layerNode.id).map((e) => replaced.get(e.toNode) ?? byId.get(e.toNode)).filter((n): n is WorkflowNode => Boolean(n))
    const fxGlow =
      attached.some((n) => n.params?.logicCategory === 'fx' && n.params?.fxKind !== 'wind_physics' && n.enabled) ||
      (layer.appliedEffects ?? []).some((f) => f.category === 'glow' && f.enabled !== false)
    for (const cat of ['action', 'anim_fx', 'light', 'cave', 'audio'] as DerivedCategory[]) {
      const current = attached.find((n) => n.params?.logicCategory === cat)
      const d =
        cat === 'action' ? deriveAction(layer, compDur)
          : cat === 'anim_fx' ? deriveAnimFx(layer, compDur)
            : cat === 'light' ? deriveLight(layer, compDur, fxGlow, current)
              : cat === 'cave' ? deriveCave(layer, compDur)
                : deriveAudio(findLayerAudioTrack(project, layer, memberIds), layer, compDur)
      if (!current) {
        if (!d.present) continue
        let id = `v2-${cat}-${layer.id}`
        while (byId.has(id) || added.some((n) => n.id === id)) id += '-b'
        added.push(createDerivedNode(id, cat, layerNode, d))
        addedEdges.push({ id: `e-${layerNode.id}-${id}`, fromNode: layerNode.id, fromPort: 'layers_tree', toNode: id, toPort: 'layers_tree' })
        continue
      }
      const shared = (current.params?.sharedLayerNodeIds?.length ?? 1) > 1
      const params = d.present && !shared ? mergeDerivedParams(current.params ?? {}, d.params) : current.params ?? {}
      const enabled = shared ? current.enabled : d.enabled
      const title = d.present && !shared ? d.title : current.title
      if (enabled !== current.enabled || title !== current.title || JSON.stringify(params) !== JSON.stringify(current.params ?? {})) {
        replaced.set(current.id, { ...current, enabled, title, params })
      }
    }
  }
  if (replaced.size === 0 && added.length === 0) return { nodes, edges }
  return { nodes: [...nodes.map((n) => replaced.get(n.id) ?? n), ...added], edges: [...edges, ...addedEdges] }
}
