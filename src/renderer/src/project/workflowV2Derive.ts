import type { AudioTrackItem, Layer, Project, WorkflowEdge, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import { WORKFLOW_V2_RIG_PRESET_OPTIONS } from './workflowV2ClusterRigAndSwap'
import { extractCompositeDynamicParts } from './workflowV2CompositeParts'
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

function deriveAction(layer: Layer, compDur: number, current?: WorkflowNode): Derived {
  if (
    current &&
    (current.params?.motionMode === 'bbox' || current.params?.actionPreset === 'bbox_target')
  ) {
    const range = resolveLayerNodeTimeRange(layer, compDur)
    return {
      present: true,
      enabled: current.enabled,
      params: {
        actionPreset: 'bbox_target',
        motionMode: 'bbox',
        bboxPathType: current.params?.bboxPathType ?? 'shortest',
        bboxTargetX: current.params?.bboxTargetX,
        bboxTargetY: current.params?.bboxTargetY,
        bboxTargetScalePct: current.params?.bboxTargetScalePct ?? 135,
        depthMode: current.params?.depthMode ?? 'flat_2d',
        bboxStartZ: current.params?.bboxStartZ,
        bboxTargetZ: current.params?.bboxTargetZ,
        depthRefLayerId: current.params?.depthRefLayerId,
        depthRelation: current.params?.depthRelation,
        collisionOnPathEnabled: current.params?.collisionOnPathEnabled,
        collisionTargetLayerId: current.params?.collisionTargetLayerId,
        collisionResponse: current.params?.collisionResponse,
        customMotionPath: current.params?.customMotionPath,
        customMotionLoop: current.params?.customMotionLoop,
        customMotionCycleSec: current.params?.customMotionCycleSec,
        intensity: current.params?.intensity ?? 1,
        timeStart: r2(current.params?.timeStart ?? range.start),
        timeEnd: r2(current.params?.timeEnd ?? range.end)
      },
      title: current.title?.startsWith('Motion:') ? current.title : 'Motion: Đặt BBox Đích (#1 → #2)'
    }
  }
  if (
    current &&
    (current.params?.actionPreset === 'custom_draw' ||
      current.params?.motionMode === 'path' ||
      (current.params?.customMotionPath?.length ?? 0) >= 2)
  ) {
    const range = resolveLayerNodeTimeRange(layer, compDur)
    return {
      present: true,
      enabled: current.enabled,
      params: {
        actionPreset: 'custom_draw',
        motionMode: 'path',
        customMotionPath: current.params?.customMotionPath,
        customMotionLoop: current.params?.customMotionLoop,
        intensity: current.params?.intensity ?? 1,
        timeStart: r2(current.params?.timeStart ?? range.start),
        timeEnd: r2(current.params?.timeEnd ?? range.end)
      },
      title: current.title?.startsWith('Motion:') ? current.title : 'Motion: Vẽ quỹ đạo tự do'
    }
  }
  const m = layer.motion
  const present = Boolean(m && m.type && m.type !== 'none')
  const opt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.motionType === m?.type)
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const start = typeof m?.startTime === 'number' ? m.startTime : range.start
  const end = m?.duration && m.duration > 0 ? start + m.duration : range.end
  return {
    present,
    enabled: present && m?.enabled !== false,
    params: {
      actionPreset: opt?.id ?? m?.type,
      motionMode: 'cycle',
      intensity: m?.amount ?? opt?.defaultAmount,
      timeStart: r2(start),
      timeEnd: r2(end)
    },
    title: `Hành động: ${opt?.label ?? m?.type ?? 'Chuyển động'}`
  }
}

function deriveAnimFx(layer: Layer, compDur: number, current?: WorkflowNode): Derived {
  if (
    current &&
    (current.params?.animMode === 'rig_clip' ||
      (current.params?.rigActionPreset && current.params.rigActionPreset !== 'none'))
  ) {
    const range = resolveLayerNodeTimeRange(layer, compDur)
    const rigOpt = WORKFLOW_V2_RIG_PRESET_OPTIONS.find((r) => r.id === current.params?.rigActionPreset)
    const cleanRigName = rigOpt ? rigOpt.shortLabel.replace(/^[^\wÀ-ỹ]+\s*/, '') : 'Cử động Xương'
    return {
      present: true,
      enabled: current.enabled,
      params: {
        animMode: 'rig_clip',
        rigActionPreset: current.params?.rigActionPreset ?? 'idle',
        intensity: current.params?.intensity ?? 1,
        staggerPhase: current.params?.staggerPhase,
        timeStart: r2(current.params?.timeStart ?? range.start),
        timeEnd: r2(current.params?.timeEnd ?? range.end)
      },
      title: `Hoạt ảnh Xương: ${cleanRigName}`
    }
  }
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
      animMode: 'keyframe_fx',
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
export function findLayerAudioTrack(
  project: Project,
  layer: Layer,
  memberIds: string[],
  includeClusterInstance = true
): AudioTrackItem | undefined {
  return getProjectAudioTracks(project).find(
    (tr) =>
      tr.targetId &&
      (memberIds.includes(tr.targetId) ||
        (includeClusterInstance && (tr.targetId === layer.composite?.instanceId || tr.targetId === layer.model3d?.instanceId)))
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

  // 1. Đồng bộ các hiệu ứng cấp Cụm 2.5D / Khối 3D gắn trên Node Khoá Cụm (`cluster_lock`)
  //    để khi áp motion / ánh sáng / âm thanh cho cả cụm 13 mảnh sẽ hiện đúng 1 Node Logic trên Cụm Khoá thay vì lặp 13 lần.
  const clusterOwnedCats = new Set<string>()
  for (const clusterNode of nodes) {
    if (clusterNode.params?.logicCategory !== 'cluster_lock') continue
    const instId = clusterNode.params?.instanceId
    const memberIds = clusterNode.params?.targetLayerIds ?? []
    const memberLayers = memberIds.map((id) => layersById.get(id)).filter((l): l is Layer => Boolean(l))
    const rootLayer = (clusterNode.params?.rootLayerId ? layersById.get(clusterNode.params.rootLayerId) : undefined) ?? memberLayers[0]
    if (!instId || !rootLayer) continue

    const attachedToCluster = edges
      .filter((e) => e.fromNode === clusterNode.id)
      .map((e) => replaced.get(e.toNode) ?? byId.get(e.toNode))
      .filter((n): n is WorkflowNode => Boolean(n))
    const fxGlowCluster =
      attachedToCluster.some((n) => n.params?.logicCategory === 'fx' && n.params?.fxKind !== 'wind_physics' && n.enabled) ||
      memberLayers.some((l) => (l.appliedEffects ?? []).some((f) => f.category === 'glow' && f.enabled !== false))

    for (const cat of ['action', 'anim_fx', 'light', 'cave', 'audio'] as DerivedCategory[]) {
      const current = attachedToCluster.find((n) => n.params?.logicCategory === cat)
      const presentMembers = memberLayers.filter((ml) => {
        if (cat === 'action') return deriveAction(ml, compDur).present
        if (cat === 'anim_fx') return deriveAnimFx(ml, compDur).present
        if (cat === 'light') return deriveLight(ml, compDur, fxGlowCluster, current).present
        if (cat === 'cave') return deriveCave(ml, compDur).present
        return false
      })
      const clusterAudioTrack =
        cat === 'audio'
          ? getProjectAudioTracks(project).find((tr) => tr.targetId === instId || (tr.targetId && memberIds.includes(tr.targetId) && memberIds.length > 1 && tr.targetType === 'character'))
          : undefined

      const isClusterLevel = Boolean(current) || Boolean(clusterAudioTrack) || presentMembers.length >= 2
      if (!isClusterLevel) continue

      const refLayer = presentMembers[0] ?? rootLayer
      const d =
        cat === 'action'
          ? deriveAction(refLayer, compDur, current)
          : cat === 'anim_fx'
            ? deriveAnimFx(refLayer, compDur, current)
            : cat === 'light'
              ? deriveLight(refLayer, compDur, fxGlowCluster, current)
              : cat === 'cave'
                ? deriveCave(refLayer, compDur)
                : deriveAudio(clusterAudioTrack ?? findLayerAudioTrack(project, rootLayer, memberIds, true), rootLayer, compDur)

      clusterOwnedCats.add(`${instId}:${cat}`)
      if (!current) {
        if (!d.present) continue
        let id = `v2-${cat}-${instId}`
        while (byId.has(id) || added.some((n) => n.id === id)) id += '-b'
        added.push(createDerivedNode(id, cat, clusterNode, d))
        addedEdges.push({ id: `e-${clusterNode.id}-${id}`, fromNode: clusterNode.id, fromPort: 'layers_tree', toNode: id, toPort: 'layers_tree' })
        continue
      }
      const params = d.present ? mergeDerivedParams(current.params ?? {}, d.params) : current.params ?? {}
      const enabled = d.present ? d.enabled : current.enabled
      const title = d.present ? d.title : current.title
      if (enabled !== current.enabled || title !== current.title || JSON.stringify(params) !== JSON.stringify(current.params ?? {})) {
        replaced.set(current.id, { ...current, enabled, title, params })
      }
    }
  }

  for (const layerNode of nodes) {
    if (layerNode.type !== 'layer_assembly' || layerNode.params?.groupKind || layerNode.params?.logicCategory) continue
    const layer = layersById.get(layerNode.id.replace(/^v2-layer-/, ''))
    if (!layer) continue
    const instId = layer.composite?.instanceId || layer.model3d?.instanceId
    const memberIds = layerNode.params?.targetLayerIds ?? [layer.id]
    const attached = edges
      .filter((e) => e.fromNode === layerNode.id && byId.get(e.toNode)?.params?.logicCategory !== 'cluster_lock')
      .map((e) => replaced.get(e.toNode) ?? byId.get(e.toNode))
      .filter((n): n is WorkflowNode => Boolean(n))
    const fxGlow =
      attached.some((n) => n.params?.logicCategory === 'fx' && n.params?.fxKind !== 'wind_physics' && n.enabled) ||
      (layer.appliedEffects ?? []).some((f) => f.category === 'glow' && f.enabled !== false)
    for (const cat of ['action', 'anim_fx', 'light', 'cave', 'audio'] as DerivedCategory[]) {
      const current = attached.find((n) => n.params?.logicCategory === cat)
      if (!current && instId && clusterOwnedCats.has(`${instId}:${cat}`)) continue
      const d =
        cat === 'action' ? deriveAction(layer, compDur, current)
          : cat === 'anim_fx' ? deriveAnimFx(layer, compDur, current)
            : cat === 'light' ? deriveLight(layer, compDur, fxGlow, current)
              : cat === 'cave' ? deriveCave(layer, compDur)
                : deriveAudio(findLayerAudioTrack(project, layer, memberIds, !instId), layer, compDur)
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
  const baseNodes = replaced.size === 0 && added.length === 0 ? nodes : [...nodes.map((n) => replaced.get(n.id) ?? n), ...added]
  const baseEdges = replaced.size === 0 && added.length === 0 ? edges : [...edges, ...addedEdges]
  return syncClusterPartSubtree(project, baseNodes, baseEdges, replaced.size === 0 && added.length === 0)
}

/**
 * Đồng bộ cây con Bộ Phận Cụm (`Node Bộ phận` Hub → các `Node con Bộ phận` cho từng bộ phận trong cụm 2.5D):
 * Khi một cụm 2.5D có Node Bộ phận gắn vào `cluster_lock`, mỗi bộ phận thực tế (`Khuôn mặt`, `Tay trái`, `Tay phải`, `Chân`, `Thân`...)
 * được tách thành một `Node con Bộ phận` riêng biệt để người dùng cấu hình biến thể / cử động theo mốc giây rõ ràng.
 */
function syncClusterPartSubtree(
  project: Project,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  unchangedSoFar: boolean
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const compDur = Math.max(1, project.comp.duration || 5)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const layersById = new Map(project.layers.map((l) => [l.id, l]))
  const replaced = new Map<string, WorkflowNode>()
  const added: WorkflowNode[] = []
  const addedEdges: WorkflowEdge[] = []
  const removedIds = new Set<string>()

  for (const clusterNode of nodes) {
    if (clusterNode.params?.logicCategory !== 'cluster_lock') continue
    const instId = clusterNode.params?.instanceId
    const memberIds = clusterNode.params?.targetLayerIds ?? []
    const rootLayer = (clusterNode.params?.rootLayerId ? layersById.get(clusterNode.params.rootLayerId) : undefined) ??
      memberIds.map((id) => layersById.get(id)).find(Boolean)
    if (!instId || !rootLayer) continue

    const directPartNodes = edges
      .filter((e) => e.fromNode === clusterNode.id)
      .map((e) => byId.get(e.toNode))
      .filter((n): n is WorkflowNode => Boolean(n && n.params?.logicCategory === 'part_swap' && !n.params?.isPartChild))
    if (directPartNodes.length === 0) continue

    const hubNode = directPartNodes.find((n) => n.params?.isPartHub) ?? directPartNodes[0]
    const allParts = extractCompositeDynamicParts(project, instId, rootLayer)
    const hiddenSet = new Set(hubNode.params?.hiddenPartGroupIds ?? [])
    const swappableParts = allParts.filter((p) => p.layerIds.length >= 2 || p.variants.length >= 2)
    const activeParts = swappableParts.filter((p) => !hiddenSet.has(p.id))

    const desiredHubTitle = 'Bộ phận: Cụm 2.5D'
    const hubParams: WorkflowNodeParams = {
      ...hubNode.params,
      isPartHub: true,
      isPartChild: undefined,
      childLayerCount: activeParts.length,
      instanceId: instId,
      compositeId: clusterNode.params?.compositeId ?? rootLayer.composite?.compositeId
    }
    if (
      !hubNode.params?.isPartHub ||
      hubNode.params?.childLayerCount !== activeParts.length ||
      hubNode.title !== desiredHubTitle
    ) {
      replaced.set(hubNode.id, {
        ...hubNode,
        title: desiredHubTitle,
        aiDirective: `Điều phối ${activeParts.length} Node con Bộ phận của cụm "${clusterNode.title}".`,
        params: hubParams
      })
    }

    const existingChildren = nodes.filter(
      (n) =>
        n.params?.logicCategory === 'part_swap' &&
        n.params?.isPartChild &&
        (n.params?.hierarchyParentNodeId === hubNode.id ||
          edges.some((e) => e.fromNode === hubNode.id && e.toNode === n.id))
    )

    const activePartIds = new Set(activeParts.map((p) => p.id))
    for (const child of existingChildren) {
      if (!child.params?.partGroupId || !activePartIds.has(child.params.partGroupId)) {
        removedIds.add(child.id)
      }
    }
    for (let idx = 0; idx < activeParts.length; idx++) {
      const part = activeParts[idx]
      const primaryChild = existingChildren.find((c) => c.params?.partGroupId === part.id)
      const partLayerObjs = part.layerIds
        .map((id) => project.layers.find((l) => l.id === id))
        .filter((l): l is Layer => Boolean(l))
      const swappedLayer = partLayerObjs.find((l) =>
        l.transform.opacity.keyframes.some((k) => k.id.includes('-partswap-') && k.value === 1 && k.t > (l.inPoint ?? 0) + 0.04)
      )
      const visVariant =
        partLayerObjs.length > 1
          ? (swappedLayer ?? partLayerObjs.find((l) => l.visible !== false) ?? partLayerObjs[0])?.id
          : undefined
      const defaultTitle = `Bộ phận: ${part.title}`

      if (!primaryChild) {
        const childId = `v2-partchild-${instId}-${part.id}`
        const tStart = r2(hubNode.params?.timeStart ?? clusterNode.params?.timeStart ?? 0)
        const tEnd = r2(hubNode.params?.timeEnd ?? clusterNode.params?.timeEnd ?? compDur)
        const inheritedVariant =
          hubNode.params?.swapVariant && part.layerIds.includes(hubNode.params.swapVariant)
            ? hubNode.params.swapVariant
            : visVariant
        const newChild: WorkflowNode = {
          id: childId,
          type: 'layer_assembly',
          title: defaultTitle,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC + 356, y: hubNode.position.y + idx * 84 },
          preset: 'composite_part_swap',
          aiAgentRole: 'AssemblyRigAgent',
          aiDirective: `Điều khiển bộ phận "${part.title}" (${part.layerIds.length} mảnh) theo mốc giây.`,
          params: {
            shotId: clusterNode.params?.shotId,
            logicCategory: 'part_swap',
            isPartChild: true,
            partGroupId: part.id,
            partGroupTitle: part.title,
            partIcon: part.icon,
            instanceId: instId,
            compositeId: clusterNode.params?.compositeId ?? rootLayer.composite?.compositeId,
            targetMode: 'custom',
            targetLayerIds: [...part.layerIds],
            sharedLayerNodeIds: [hubNode.id],
            requireLayerConnection: true,
            hierarchyParentNodeId: hubNode.id,
            swapMode: part.id === 'face' ? 'expression' : 'part_variant',
            swapVariant: inheritedVariant,
            partActionMode: part.layerIds.length > 1 ? 'variant' : 'pose',
            timeStart: tStart,
            timeEnd: tEnd
          }
        }
        added.push(newChild)
        addedEdges.push({
          id: `e-${hubNode.id}-${childId}`,
          fromNode: hubNode.id,
          fromPort: 'layers_tree',
          toNode: childId,
          toPort: 'layers_tree'
        })
      } else {
        const curTargets = primaryChild.params?.targetLayerIds ?? []
        const sameTargets =
          curTargets.length === part.layerIds.length && curTargets.every((id, i) => id === part.layerIds[i])
        const keepExistingVariant =
          primaryChild.params?.swapVariant && part.layerIds.includes(primaryChild.params.swapVariant)
            ? primaryChild.params.swapVariant
            : undefined
        const nextVariant = keepExistingVariant ?? visVariant ?? primaryChild.params?.swapVariant
        const needsUpdate =
          !sameTargets ||
          primaryChild.params?.partIcon !== part.icon ||
          primaryChild.params?.partGroupTitle !== part.title ||
          (part.layerIds.length > 1 && primaryChild.params?.swapVariant !== nextVariant)
        if (needsUpdate) {
          replaced.set(primaryChild.id, {
            ...primaryChild,
            params: {
              ...primaryChild.params,
              partGroupTitle: part.title,
              partIcon: part.icon,
              targetLayerIds: [...part.layerIds],
              swapVariant: nextVariant
            }
          })
        }
        const edgeId = `e-${hubNode.id}-${primaryChild.id}`
        if (!edges.some((e) => e.fromNode === hubNode.id && e.toNode === primaryChild.id)) {
          addedEdges.push({
            id: edgeId,
            fromNode: hubNode.id,
            fromPort: 'layers_tree',
            toNode: primaryChild.id,
            toPort: 'layers_tree'
          })
        }
      }
    }
  }

  if (replaced.size === 0 && added.length === 0 && addedEdges.length === 0 && removedIds.size === 0) {
    return unchangedSoFar ? { nodes, edges } : { nodes, edges }
  }
  return {
    nodes: [...nodes.filter((n) => !removedIds.has(n.id)).map((n) => replaced.get(n.id) ?? n), ...added],
    edges: [...edges.filter((e) => !removedIds.has(e.fromNode) && !removedIds.has(e.toNode)), ...addedEdges]
  }
}
