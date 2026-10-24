import type {
  Layer,
  LayerMotionType,
  Project,
  Shot,
  VirtualLightKind,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
export const WF_V2_COL_X = {
  ROOT: 28,
  GROUP: 356,
  LAYER: 696,
  LOGIC: 1044
} as const
export const WF_V2_NODE_W = 280
export type WorkflowV2LogicCategory = 'action' | 'light' | 'cave' | 'fx' | 'audio' | 'camera'
export interface WorkflowV2ActionOption {
  id: string
  label: string
  motionType: LayerMotionType
  defaultSpeed: number
  defaultAmount: number
}
export const WORKFLOW_V2_ACTION_OPTIONS: WorkflowV2ActionOption[] = [
  { id: 'float', label: 'Bay lơ lửng', motionType: 'float', defaultSpeed: 1.0, defaultAmount: 0.65 },
  { id: 'sway', label: 'Đung đưa gió', motionType: 'sway', defaultSpeed: 1.1, defaultAmount: 0.6 },
  { id: 'wind', label: 'Gió thổi lá', motionType: 'wind', defaultSpeed: 1.2, defaultAmount: 0.7 },
  { id: 'drift', label: 'Trượt ngang', motionType: 'drift', defaultSpeed: 1.0, defaultAmount: 0.75 },
  { id: 'pulse', label: 'Nhịp thở / Pulse', motionType: 'pulse', defaultSpeed: 1.1, defaultAmount: 0.55 },
  { id: 'wiggle', label: 'Rung tự nhiên', motionType: 'wiggle', defaultSpeed: 1.5, defaultAmount: 0.5 },
  { id: 'spin', label: 'Xoay vòng', motionType: 'spin', defaultSpeed: 0.8, defaultAmount: 0.6 }
]
export interface WorkflowV2LightOption {
  id: 'rim' | 'point' | 'spot' | 'candle' | 'glow' | 'cave_crystal'
  label: string
  virtualKind: VirtualLightKind
  defaultColor: string
  defaultIntensity: number
}
export const WORKFLOW_V2_LIGHT_OPTIONS: WorkflowV2LightOption[] = [
  { id: 'rim', label: 'Đèn viền (Rim)', virtualKind: 'bulb', defaultColor: '#38bdf8', defaultIntensity: 1.3 },
  { id: 'point', label: 'Đèn điểm (Bulb)', virtualKind: 'bulb', defaultColor: '#fbbf24', defaultIntensity: 1.4 },
  { id: 'candle', label: 'Ngọn nến (Gió)', virtualKind: 'candle', defaultColor: '#f97316', defaultIntensity: 1.35 },
  { id: 'spot', label: 'Đèn pin (Chùm nón)', virtualKind: 'flashlight', defaultColor: '#fef08a', defaultIntensity: 1.6 },
  { id: 'cave_crystal', label: 'Tinh thể Hang động', virtualKind: 'cave_crystal', defaultColor: '#22d3ee', defaultIntensity: 1.5 },
  { id: 'glow', label: 'Hào quang (Glow)', virtualKind: 'magic_orb', defaultColor: '#34d399', defaultIntensity: 1.2 }
]
export interface WorkflowV2CaveOption {
  id: 'arch' | 'ellipse' | 'circle'
  label: string
  defaultDarkness: number
  defaultMinScale: number
}
export const WORKFLOW_V2_CAVE_OPTIONS: WorkflowV2CaveOption[] = [
  { id: 'arch', label: 'Vòm hang đá tự nhiên', defaultDarkness: 0.82, defaultMinScale: 0.38 },
  { id: 'ellipse', label: 'Cửa hầm Elip sâu', defaultDarkness: 0.86, defaultMinScale: 0.34 },
  { id: 'circle', label: 'Cổng xoáy chiều sâu', defaultDarkness: 0.78, defaultMinScale: 0.42 }
]
export interface WorkflowV2FxOption {
  id: 'wind_physics' | 'bloom' | 'blur' | 'chromatic' | 'vignette' | 'particles'
  label: string
  defaultIntensity: number
}
export const WORKFLOW_V2_FX_OPTIONS: WorkflowV2FxOption[] = [
  { id: 'wind_physics', label: 'Vật lý Đàn hồi Mesh', defaultIntensity: 1.0 },
  { id: 'bloom', label: 'Phát sáng (Bloom)', defaultIntensity: 0.85 },
  { id: 'blur', label: 'Làm mờ chiều sâu', defaultIntensity: 0.6 },
  { id: 'chromatic', label: 'Tán sắc (RGB)', defaultIntensity: 0.5 },
  { id: 'vignette', label: 'Tối góc điện ảnh', defaultIntensity: 0.7 },
  { id: 'particles', label: 'Hạt đom đóm / Sương', defaultIntensity: 1.1 }
]
export interface WorkflowV2CameraOption {
  id: string
  label: string
}
export const WORKFLOW_V2_CAMERA_OPTIONS: WorkflowV2CameraOption[] = [
  { id: 'dollyIn', label: 'Đẩy cận (Dolly In)' },
  { id: 'fly', label: 'Bay xuyên cảnh 3D' },
  { id: 'orbitRight', label: 'Xoay quỹ đạo' },
  { id: 'truckRight', label: 'Lia máy ngang' }
]
export function getLayerZ(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[2]) ? Math.round(pos[2]) : 0
}
export function getLayerX(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[0]) ? Math.round(pos[0]) : 0
}
export function getLayerY(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[1]) ? Math.round(pos[1]) : 0
}
export function getLayerDisplayName(layer: Layer): string {
  return layer.composite?.compositeName || layer.model3d?.modelName || layer.name || 'Layer'
}
/** Tính khoảng mốc thời gian [start, end] của một Shot dựa trên các Layer thuộc Shot đó */
export function getShotTimeRange(project: Project, shot?: Shot): { start: number; end: number } {
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))
  if (!shot) return { start: 0, end: compDur }
  const shotLayers = project.layers.filter((l) => l.shotId === shot.id)
  if (shotLayers.length === 0) return { start: 0, end: compDur }
  const minIn = Math.max(0, Math.min(...shotLayers.map((l) => Number.isFinite(l.inPoint) ? l.inPoint : 0)))
  const maxOut = Math.min(compDur, Math.max(...shotLayers.map((l) => Number.isFinite(l.outPoint) ? l.outPoint : compDur)))
  return {
    start: Number(minIn.toFixed(2)),
    end: Number(Math.max(minIn + 0.5, maxOut).toFixed(2))
  }
}
/** Phân loại một Layer vào đúng Group Layer ('group_3d' | 'group_25d' | 'group_env') */
export function classifyLayerGroupKind(layer: Layer): 'group_3d' | 'group_25d' | 'group_env' {
  if (layer.model3d || layer.composite) {
    return 'group_3d'
  }
  const z = getLayerZ(layer)
  if (layer.type === 'particles' || layer.type === 'solid' || z >= 2500) {
    return 'group_env'
  }
  return 'group_25d'
}
/** Gom các layer mảnh con của cùng một Composite/Model3D thành đại diện duy nhất để cây gọn sạch */
function collectRepresentativeLayers(layers: Layer[]): {
  layer: Layer
  memberIds: string[]
  isCluster: boolean
}[] {
  const seenInstances = new Map<string, { layer: Layer; memberIds: string[]; isCluster: boolean }>()
  const out: { layer: Layer; memberIds: string[]; isCluster: boolean }[] = []
  for (const l of layers) {
    const instId = l.composite?.instanceId || l.model3d?.instanceId
    if (instId) {
      const existing = seenInstances.get(instId)
      if (existing) {
        existing.memberIds.push(l.id)
        if (l.composite?.isRoot) existing.layer = l
      } else {
        const entry = { layer: l, memberIds: [l.id], isCluster: true }
        seenInstances.set(instId, entry)
        out.push(entry)
      }
    } else {
      out.push({ layer: l, memberIds: [l.id], isCluster: false })
    }
  }
  return out
}
/**
 * Xây dựng Cây Workflow V2 chuẩn 4 tầng từ dữ liệu thật của Project:
 * Tầng 0 (Root): Cảnh (Scene Root) + Đạo diễn Camera
 * Tầng 1 (Group): Group Layer 3D & Lắp ráp | Group Layer 2.5D | Group Không gian & Bầu trời
 * Tầng 2 (Layer): Các Node Layer thuộc từng Group
 * Tầng 3 (Logic): Node Hành động, Node Ánh sáng, Node Hang động, Node Hiệu ứng, Node Âm thanh
 */
export function buildWorkflowV2SceneTree(project: Project, shotScope?: string): WorkflowGraph {
  const activeShot: Shot | undefined =
    shotScope && shotScope !== '__all__'
      ? project.shots.find((s) => s.id === shotScope) ?? project.shots[0]
      : project.shots[0]
  const { start: shotStart, end: shotEnd } = getShotTimeRange(project, activeShot)
  const scopedLayers =
    activeShot && shotScope !== '__all__'
      ? project.layers.filter((l) => !l.shotId || l.shotId === activeShot.id)
      : project.layers
  const repItems = collectRepresentativeLayers(scopedLayers)
  const audioTracks = getProjectAudioTracks(project)
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  // 1. TẦNG 0: ROOT CẢNH TỔNG HỢP
  const rootId = 'v2-root-scene'
  const sceneTitle = activeShot ? `Cảnh: ${activeShot.name}` : `Dự án (${project.shots.length} cảnh)`
  nodes.push({
    id: rootId,
    type: 'scene_shot',
    title: sceneTitle,
    enabled: true,
    position: { x: WF_V2_COL_X.ROOT, y: 120 },
    preset: 'deep_parallax_stage',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: `Root tổng hợp cảnh "${sceneTitle}" [${shotStart}s – ${shotEnd}s] điều phối các Group Layer và Camera.`,
    params: {
      shotId: activeShot?.id,
      timeStart: shotStart,
      timeEnd: shotEnd,
      intensity: 1.0,
      autoArrangeZ: true
    }
  })
  // Node Đạo diễn Camera 3D gắn trực tiếp dưới Root Cảnh
  const camNodeId = 'v2-logic-camera'
  nodes.push({
    id: camNodeId,
    type: 'camera_director',
    title: 'Đạo diễn Camera 3D',
    enabled: true,
    position: { x: WF_V2_COL_X.ROOT, y: 310 },
    preset: 'cinematic_fly_push',
    aiAgentRole: 'CameraDirectorAgent',
    aiDirective: `Điều khiển đường bay Camera 3D trong khoảng [${shotStart}s – ${shotEnd}s].`,
    params: {
      shotId: activeShot?.id,
      logicCategory: 'camera',
      camPreset: 'dollyIn',
      timeStart: shotStart,
      timeEnd: shotEnd,
      intensity: 1.0,
      enableDof: Boolean(project.camera?.dofEnabled),
      camShakeAmount: project.camera?.shakeAmount ?? 0,
      hierarchyParentNodeId: rootId
    }
  })
  edges.push({
    id: `e-${rootId}-${camNodeId}`,
    fromNode: rootId,
    fromPort: 'scene_ctx',
    toNode: camNodeId,
    toPort: 'scene_ctx'
  })
  // 2. TẦNG 1: PHÂN NHÓM GROUP LAYER (2.5D / 3D / MÔI TRƯỜNG)
  const groupDefs: {
    id: string
    kind: 'group_3d' | 'group_25d' | 'group_env'
    title: string
    items: typeof repItems
  }[] = [
    {
      id: 'v2-group-3d',
      kind: 'group_3d',
      title: 'Group Layer 3D & Lắp Ráp',
      items: repItems.filter((it) => classifyLayerGroupKind(it.layer) === 'group_3d')
    },
    {
      id: 'v2-group-25d',
      kind: 'group_25d',
      title: 'Group Layer 2.5D',
      items: repItems
        .filter((it) => classifyLayerGroupKind(it.layer) === 'group_25d')
        .sort((a, b) => getLayerZ(a.layer) - getLayerZ(b.layer))
    },
    {
      id: 'v2-group-env',
      kind: 'group_env',
      title: 'Group Không Gian & Bầu Trời',
      items: repItems
        .filter((it) => classifyLayerGroupKind(it.layer) === 'group_env')
        .sort((a, b) => getLayerZ(b.layer) - getLayerZ(a.layer))
    }
  ]
  const activeGroups = groupDefs.filter((g) => g.items.length > 0 || g.kind === 'group_25d')
  for (const grp of activeGroups) {
    const groupMemberIds = grp.items.flatMap((it) => it.memberIds)
    const grpStart =
      grp.items.length > 0
        ? Math.max(shotStart, Math.min(...grp.items.map((it) => Number((it.layer.inPoint ?? shotStart).toFixed(2)))))
        : shotStart
    const grpEnd =
      grp.items.length > 0
        ? Math.min(shotEnd, Math.max(...grp.items.map((it) => Number((it.layer.outPoint ?? shotEnd).toFixed(2)))))
        : shotEnd
    nodes.push({
      id: grp.id,
      type: 'layer_assembly',
      title: grp.title,
      enabled: true,
      position: { x: WF_V2_COL_X.GROUP, y: 100 },
      preset: 'character_prop_cluster',
      aiAgentRole: 'AssemblyRigAgent',
      aiDirective: `${grp.title} gồm ${grp.items.length} đối tượng trong khoảng [${grpStart}s – ${grpEnd}s].`,
      params: {
        shotId: activeShot?.id,
        groupKind: grp.kind,
        collapsedGroup: scopedLayers.length > 4 && grp.kind === 'group_env',
        isAssemblyRoot: true,
        childLayerCount: grp.items.length,
        targetMode: 'custom',
        targetLayerIds: groupMemberIds,
        timeStart: grpStart,
        timeEnd: grpEnd,
        hierarchyParentNodeId: rootId
      }
    })
    edges.push({
      id: `e-${rootId}-${grp.id}`,
      fromNode: rootId,
      fromPort: 'scene_ctx',
      toNode: grp.id,
      toPort: 'scene_ctx'
    })
    // 3. TẦNG 2: CÁC NODE LAYER THUỘC GROUP
    grp.items.forEach((item, layerIdx) => {
      const l = item.layer
      const layerNodeId = `v2-layer-${l.id}`
      const lStart = Number(Math.max(shotStart, Number.isFinite(l.inPoint) ? l.inPoint : shotStart).toFixed(2))
      const lEnd = Number(Math.min(shotEnd, Number.isFinite(l.outPoint) ? l.outPoint : shotEnd).toFixed(2))
      const displayTitle = getLayerDisplayName(l)
      const zVal = getLayerZ(l)
      nodes.push({
        id: layerNodeId,
        type: 'layer_assembly',
        title: displayTitle,
        enabled: l.visible !== false,
        position: { x: WF_V2_COL_X.LAYER, y: 100 },
        preset: 'character_prop_cluster',
        aiAgentRole: 'AssemblyRigAgent',
        aiDirective: `Layer "${displayTitle}" (Z=${zVal}) hoạt động từ ${lStart}s đến ${lEnd}s.`,
        params: {
          shotId: activeShot?.id,
          targetMode: 'custom',
          targetLayerIds: item.memberIds,
          requireLayerConnection: true,
          assemblyKind: l.model3d ? 'model3d' : l.composite ? 'composite' : undefined,
          childLayerCount: item.memberIds.length,
          transformX: getLayerX(l),
          transformY: getLayerY(l),
          transformZ: zVal,
          timeStart: lStart,
          timeEnd: lEnd,
          hierarchyParentNodeId: grp.id
        }
      })
      edges.push({
        id: `e-${grp.id}-${layerNodeId}`,
        fromNode: grp.id,
        fromPort: 'layers_tree',
        toNode: layerNodeId,
        toPort: 'layers_tree'
      })
      // 4. TẦNG 3: CÁC NODE LOGIC CỦA LAYER (HÀNH ĐỘNG, ÁNH SÁNG, HANG ĐỘNG, HIỆU ỨNG, ÂM THANH)
      const lowerName = displayTitle.toLowerCase()
      const hasExplicitCave = Boolean(
        l.physics?.depthPortal?.enabled || l.physics?.colliderZone === 'cave_portal'
      )
      const isCaveOrPortalLayer =
        hasExplicitCave ||
        lowerName.includes('hang') ||
        lowerName.includes('cổng') ||
        lowerName.includes('di tích') ||
        lowerName.includes('hầm')
      // 4a. Node Hành động (Motion / Action)
      const hasExplicitMotion = Boolean(l.motion && l.motion.type !== 'none' && l.motion.enabled !== false)
      const shouldCreateAction =
        hasExplicitMotion ||
        (!isCaveOrPortalLayer &&
          (Boolean(l.composite || l.model3d) ||
            lowerName.includes('dây leo') ||
            lowerName.includes('đảo') ||
            (grp.kind === 'group_25d' && layerIdx === 0)))
      if (shouldCreateAction) {
        const motionType: LayerMotionType =
          l.motion && l.motion.type !== 'none'
            ? l.motion.type
            : lowerName.includes('dây leo') || lowerName.includes('cây')
              ? 'sway'
              : lowerName.includes('đảo') || lowerName.includes('mây')
                ? 'float'
                : 'pulse'
        const actOpt =
          WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.motionType === motionType) ?? WORKFLOW_V2_ACTION_OPTIONS[0]
        const mStart = Number((l.motion?.startTime ?? lStart).toFixed(2))
        const mEnd = Number(
          (l.motion?.duration && l.motion.duration > 0
            ? Math.min(shotEnd, mStart + l.motion.duration)
            : lEnd
          ).toFixed(2)
        )
        const actionNodeId = `v2-action-${l.id}`
        nodes.push({
          id: actionNodeId,
          type: 'motion_choreography',
          title: `Hành động: ${actOpt.label}`,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC, y: 100 },
          preset: 'organic_wind_breathe',
          aiAgentRole: 'MotionChoreographyAgent',
          aiDirective: `Thực thi hành động "${actOpt.label}" cho "${displayTitle}" trong [${mStart}s – ${mEnd}s].`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'action',
            actionPreset: actOpt.id,
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            requireLayerConnection: true,
            intensity: Number((l.motion?.amount ?? actOpt.defaultAmount).toFixed(2)),
            timeStart: mStart,
            timeEnd: mEnd,
            hierarchyParentNodeId: layerNodeId
          }
        })
        edges.push({
          id: `e-${layerNodeId}-${actionNodeId}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: actionNodeId,
          toPort: 'layers_tree'
        })
      }
      // 4b. Node Hang động / Vùng độ sâu (Cave Depth Portal)
      if (isCaveOrPortalLayer) {
        const caveNodeId = `v2-cave-${l.id}`
        const archShape = l.physics?.depthPortal?.archShape ?? 'arch'
        const caveOpt =
          WORKFLOW_V2_CAVE_OPTIONS.find((o) => o.id === archShape) ?? WORKFLOW_V2_CAVE_OPTIONS[0]
        nodes.push({
          id: caveNodeId,
          type: 'physics_fx',
          title: `Hang động: ${caveOpt.label}`,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC, y: 140 },
          preset: 'rim_glow_particles',
          aiAgentRole: 'PhysicsLightFxAgent',
          aiDirective: `Vùng độ sâu / Cửa hang "${caveOpt.label}" trên "${displayTitle}" [${lStart}s – ${lEnd}s].`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'cave',
            caveArchShape: caveOpt.id,
            caveDarkness: l.physics?.depthPortal?.darkness ?? caveOpt.defaultDarkness,
            caveMinScale: l.physics?.depthPortal?.minScale ?? caveOpt.defaultMinScale,
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            requireLayerConnection: true,
            intensity: l.physics?.depthPortal?.darkness ?? caveOpt.defaultDarkness,
            timeStart: lStart,
            timeEnd: lEnd,
            hierarchyParentNodeId: layerNodeId
          }
        })
        edges.push({
          id: `e-${layerNodeId}-${caveNodeId}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: caveNodeId,
          toPort: 'layers_tree'
        })
      }
      // 4c. Node Ánh sáng (Light Node)
      const hasExplicitLight = Boolean(l.virtualLight?.enabled || l.glow?.enabled)
      const isGlowingEntity =
        hasExplicitLight ||
        lowerName.includes('đom đóm') ||
        lowerName.includes('đèn') ||
        lowerName.includes('bầu trời') ||
        lowerName.includes('sáng')
      if (isGlowingEntity) {
        const lightNodeId = `v2-light-${l.id}`
        const lightMode: WorkflowV2LightOption['id'] = l.virtualLight?.enabled
          ? l.virtualLight.kind === 'flashlight'
            ? 'spot'
            : l.virtualLight.kind === 'candle'
              ? 'candle'
              : l.virtualLight.kind === 'cave_crystal'
                ? 'cave_crystal'
                : 'point'
          : l.glow?.enabled
            ? 'glow'
            : 'rim'
        const lightOpt =
          WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === lightMode) ?? WORKFLOW_V2_LIGHT_OPTIONS[0]
        nodes.push({
          id: lightNodeId,
          type: 'physics_fx',
          title: `Ánh sáng: ${lightOpt.label}`,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC, y: 180 },
          preset: 'rim_glow_particles',
          aiAgentRole: 'PhysicsLightFxAgent',
          aiDirective: `Chiếu sáng "${lightOpt.label}" cho "${displayTitle}" từ ${lStart}s đến ${lEnd}s.`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'light',
            lightMode: lightOpt.id,
            lightColor: l.virtualLight?.color || l.glow?.color || lightOpt.defaultColor,
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            requireLayerConnection: true,
            intensity: l.virtualLight?.intensity ?? lightOpt.defaultIntensity,
            timeStart: lStart,
            timeEnd: lEnd,
            hierarchyParentNodeId: layerNodeId
          }
        })
        edges.push({
          id: `e-${layerNodeId}-${lightNodeId}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: lightNodeId,
          toPort: 'layers_tree'
        })
      }
      // 4d. Node Hiệu ứng & Vật lý (FX Node)
      const hasExplicitFx = Boolean(
        l.physics?.enabled ||
          (l.appliedEffects && l.appliedEffects.some((ef) => ef.enabled)) ||
          l.type === 'particles'
      )
      if (hasExplicitFx) {
        const fxNodeId = `v2-fx-${l.id}`
        const fxKind: WorkflowV2FxOption['id'] =
          l.type === 'particles'
            ? 'particles'
            : l.physics?.enabled
              ? 'wind_physics'
              : 'bloom'
        const fxOpt = WORKFLOW_V2_FX_OPTIONS.find((o) => o.id === fxKind) ?? WORKFLOW_V2_FX_OPTIONS[0]
        nodes.push({
          id: fxNodeId,
          type: 'physics_fx',
          title: `Hiệu ứng: ${fxOpt.label}`,
          enabled: true,
          position: { x: WF_V2_COL_X.LOGIC, y: 220 },
          preset: 'rim_glow_particles',
          aiAgentRole: 'PhysicsLightFxAgent',
          aiDirective: `Áp dụng hiệu ứng "${fxOpt.label}" cho "${displayTitle}" trong [${lStart}s – ${lEnd}s].`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'fx',
            fxKind: fxOpt.id,
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            requireLayerConnection: true,
            intensity: fxOpt.defaultIntensity,
            timeStart: lStart,
            timeEnd: lEnd,
            hierarchyParentNodeId: layerNodeId
          }
        })
        edges.push({
          id: `e-${layerNodeId}-${fxNodeId}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: fxNodeId,
          toPort: 'layers_tree'
        })
      }
      // 4e. Node Âm thanh / Thoại (Audio Node)
      const attachedTrack = audioTracks.find(
        (tr) =>
          tr.targetId &&
          (item.memberIds.includes(tr.targetId) ||
            tr.targetId === l.composite?.instanceId ||
            tr.targetId === l.model3d?.instanceId)
      )
      if (attachedTrack) {
        const audioNodeId = `v2-audio-${l.id}`
        const aStart = Number((attachedTrack.offset ?? lStart).toFixed(2))
        const aEnd = Number(
          (attachedTrack.duration ? Math.min(shotEnd, aStart + attachedTrack.duration) : lEnd).toFixed(2)
        )
        nodes.push({
          id: audioNodeId,
          type: 'audio_lipsync',
          title: `Âm thanh: ${attachedTrack.name || displayTitle}`,
          enabled: !attachedTrack.muted,
          position: { x: WF_V2_COL_X.LOGIC, y: 260 },
          preset: 'auto_dialogue_lipsync',
          aiAgentRole: 'AudioLipSyncAgent',
          aiDirective: `Phát âm thanh cho "${displayTitle}" từ ${aStart}s đến ${aEnd}s.`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'audio',
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            requireLayerConnection: true,
            intensity: attachedTrack.volume ?? 1.0,
            autoLipSync: Boolean(attachedTrack.lipSyncEnabled),
            timeStart: aStart,
            timeEnd: aEnd,
            hierarchyParentNodeId: layerNodeId
          }
        })
        edges.push({
          id: `e-${layerNodeId}-${audioNodeId}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: audioNodeId,
          toPort: 'layers_tree'
        })
      }
    })
  }
  const laidOutNodes = layoutWorkflowV2Tree(nodes, edges)
  return {
    version: 1,
    id: `wf-v2-${activeShot?.id ?? 'project'}`,
    name: `Workflow V2 — ${sceneTitle}`,
    presetId: 'v2_scene_hierarchy',
    description:
      'Sơ đồ cây phân cấp thời gian: Cảnh Root ➔ Group Layer (2.5D/3D) ➔ Node Layer ➔ Node Hành động / Ánh sáng / Hang động / Hiệu ứng',
    targetShotId: activeShot?.id,
    nodes: laidOutNodes,
    edges
  }
}
/** Chiều cao chuẩn gọn gàng của từng loại thẻ trong Workflow V2 */
export function estimateV2NodeHeight(node: WorkflowNode): number {
  if (node.type === 'scene_shot') return 90
  if (node.params?.groupKind) return 86
  if (node.type === 'layer_assembly') return 120
  return 112
}

/**
 * Thuật toán xếp cây 4 cột (Root -> Group -> Layer -> Logic) phẳng tuyệt đối,
 * canh hàng đỉnh (Top-Aligned) cho cả 4 cột để nhìn vào thấy ngay Cảnh Root -> Group -> Layer -> Logic!
 */
export function layoutWorkflowV2Tree(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const cloned = nodes.map((n) => ({ ...n, position: { ...n.position } }))
  const byId = new Map(cloned.map((n) => [n.id, n]))
  const childrenMap = new Map<string, WorkflowNode[]>()
  for (const e of edges) {
    const child = byId.get(e.toNode)
    if (!child) continue
    const list = childrenMap.get(e.fromNode) ?? []
    if (!list.some((c) => c.id === child.id)) {
      list.push(child)
      childrenMap.set(e.fromNode, list)
    }
  }
  const rootNode = cloned.find((n) => n.type === 'scene_shot')
  const groupNodes = cloned.filter((n) => Boolean(n.params?.groupKind))
  const GAP_Y = 14
  const GROUP_GAP_Y = 18
  let layerCursorY = 38
  let groupColBottomY = 38
  for (const grp of groupNodes) {
    const layerChildren = (childrenMap.get(grp.id) ?? []).filter((c) => c.type === 'layer_assembly')
    const grpH = estimateV2NodeHeight(grp)
    if (grp.params?.collapsedGroup || layerChildren.length === 0) {
      grp.position = { x: WF_V2_COL_X.GROUP, y: groupColBottomY }
      layerChildren.forEach((ln, idx) => {
        ln.position = { x: WF_V2_COL_X.LAYER, y: groupColBottomY + idx * 128 }
        const lKids = (childrenMap.get(ln.id) ?? []).filter(
          (c) => c.type !== 'layer_assembly' && c.type !== 'scene_shot'
        )
        lKids.forEach((lk, kIdx) => {
          lk.position = { x: WF_V2_COL_X.LOGIC + kIdx * 304, y: ln.position.y }
        })
      })
      groupColBottomY += grpH + 16
      continue
    }
    const groupStartY = Math.max(layerCursorY, groupColBottomY)
    layerCursorY = groupStartY
    grp.position = { x: WF_V2_COL_X.GROUP, y: groupStartY }
    groupColBottomY = groupStartY + grpH + 16
    for (const layerNode of layerChildren) {
      const logicChildren = (childrenMap.get(layerNode.id) ?? []).filter(
        (c) => c.type !== 'layer_assembly' && c.type !== 'scene_shot'
      )
      const layerH = estimateV2NodeHeight(layerNode)
      layerNode.position = { x: WF_V2_COL_X.LAYER, y: layerCursorY }
      logicChildren.forEach((logicNode, idx) => {
        logicNode.position = {
          x: WF_V2_COL_X.LOGIC + idx * 304,
          y: layerCursorY
        }
      })
      layerCursorY += layerH + GAP_Y
    }
    layerCursorY += GROUP_GAP_Y - GAP_Y
  }
  if (rootNode) {
    rootNode.position = { x: WF_V2_COL_X.ROOT, y: 38 }
    const camNodes = cloned.filter((n) => n.type === 'camera_director')
    camNodes.forEach((cam, idx) => {
      cam.position = {
        x: WF_V2_COL_X.ROOT,
        y: rootNode.position.y + estimateV2NodeHeight(rootNode) + 16 + idx * 116
      }
    })
  }
  return cloned
}
/**
 * Gắn thêm một Node Logic mới (Hành động, Ánh sáng, Hang động, Hiệu ứng, Âm thanh) vào một Node Layer
 */
export function attachLogicNodeToLayerV2(
  workflow: WorkflowGraph,
  layerNodeId: string,
  category: 'action' | 'light' | 'cave' | 'fx' | 'audio'
): { workflow: WorkflowGraph; createdNodeId: string } {
  const layerNode = workflow.nodes.find((n) => n.id === layerNodeId)
  const targetLayerIds = layerNode?.params?.targetLayerIds ?? []
  const tStart = layerNode?.params?.timeStart ?? 0
  const tEnd = layerNode?.params?.timeEnd ?? 5
  const shotId = layerNode?.params?.shotId ?? workflow.targetShotId
  const layerName = layerNode?.title ?? 'Layer'
  const suffix = `${Date.now().toString(36).slice(-4)}`
  const createdNodeId = `v2-${category}-${suffix}`
  let newNode: WorkflowNode
  if (category === 'action') {
    const opt = WORKFLOW_V2_ACTION_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'motion_choreography',
      title: `Hành động: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: (layerNode?.position.y ?? 120) + 10 },
      preset: 'organic_wind_breathe',
      aiAgentRole: 'MotionChoreographyAgent',
      aiDirective: `Thực thi hành động "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'action',
        actionPreset: opt.id,
        targetMode: 'custom',
        targetLayerIds,
        requireLayerConnection: true,
        intensity: opt.defaultAmount,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'light') {
    const opt = WORKFLOW_V2_LIGHT_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Ánh sáng: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: (layerNode?.position.y ?? 120) + 20 },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Chiếu sáng "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'light',
        lightMode: opt.id,
        lightColor: opt.defaultColor,
        targetMode: 'custom',
        targetLayerIds,
        requireLayerConnection: true,
        intensity: opt.defaultIntensity,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'cave') {
    const opt = WORKFLOW_V2_CAVE_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Hang động: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: (layerNode?.position.y ?? 120) + 25 },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Tạo vùng độ sâu cửa hang "${opt.label}" trên "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'cave',
        caveArchShape: opt.id,
        caveDarkness: opt.defaultDarkness,
        caveMinScale: opt.defaultMinScale,
        targetMode: 'custom',
        targetLayerIds,
        requireLayerConnection: true,
        intensity: opt.defaultDarkness,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'fx') {
    const opt = WORKFLOW_V2_FX_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Hiệu ứng: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: (layerNode?.position.y ?? 120) + 30 },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Áp dụng hiệu ứng "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'fx',
        fxKind: opt.id,
        targetMode: 'custom',
        targetLayerIds,
        requireLayerConnection: true,
        intensity: opt.defaultIntensity,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else {
    newNode = {
      id: createdNodeId,
      type: 'audio_lipsync',
      title: `Âm thanh: ${layerName}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: (layerNode?.position.y ?? 120) + 40 },
      preset: 'auto_dialogue_lipsync',
      aiAgentRole: 'AudioLipSyncAgent',
      aiDirective: `Phát âm thanh / nhép môi cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'audio',
        targetMode: 'custom',
        targetLayerIds,
        requireLayerConnection: true,
        intensity: 1.0,
        autoLipSync: true,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  }
  const nextEdges: WorkflowEdge[] = [
    ...workflow.edges,
    {
      id: `e-${layerNodeId}-${createdNodeId}`,
      fromNode: layerNodeId,
      fromPort: 'layers_tree',
      toNode: createdNodeId,
      toPort: 'layers_tree'
    }
  ]
  const nextNodes = layoutWorkflowV2Tree([...workflow.nodes, newNode], nextEdges)
  return {
    workflow: {
      ...workflow,
      nodes: nextNodes,
      edges: nextEdges
    },
    createdNodeId
  }
}
/**
 * Đồng bộ trực tiếp thay đổi trên một Node V2 (khoảng mốc thời gian, Z, hành động, ánh sáng, hang động, hiệu ứng, camera)
 * xuống dữ liệu Project thực tế để Viewport 3D và Timeline phản hồi tức thì.
 */
export function syncWorkflowV2NodeToProject(
  project: Project,
  node: WorkflowNode,
  patch?: Partial<WorkflowNodeParams>
): void {
  const params: WorkflowNodeParams = { ...(node.params ?? {}), ...(patch ?? {}) }
  const targetIds = new Set(params.targetLayerIds ?? [])
  const tStart = params.timeStart
  const tEnd = params.timeEnd
  // 1. Node Layer hoặc Group Layer
  if (node.type === 'layer_assembly') {
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      l.visible = node.enabled
      if (typeof tStart === 'number' && Number.isFinite(tStart)) l.inPoint = Math.max(0, tStart)
      if (typeof tEnd === 'number' && Number.isFinite(tEnd) && tEnd > (l.inPoint ?? 0)) l.outPoint = tEnd
      if (!params.groupKind && l.transform?.position?.value) {
        const curPos = l.transform.position.value
        const nx = typeof params.transformX === 'number' ? params.transformX : curPos[0]
        const ny = typeof params.transformY === 'number' ? params.transformY : curPos[1]
        const nz = typeof params.transformZ === 'number' ? params.transformZ : curPos[2]
        l.transform.position.value = [nx, ny, nz]
      }
    }
    return
  }
  // 2. Node Hành động (Motion / Action)
  if (node.type === 'motion_choreography' || params.logicCategory === 'action') {
    const actOpt =
      WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === params.actionPreset) ?? WORKFLOW_V2_ACTION_OPTIONS[0]
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      if (!node.enabled) {
        l.motion = { enabled: false, type: 'none', speed: 1, amount: 0 }
      } else {
        const startSec = tStart ?? l.inPoint ?? 0
        const endSec = tEnd ?? l.outPoint ?? project.comp.duration
        l.motion = {
          enabled: true,
          type: actOpt.motionType,
          speed: actOpt.defaultSpeed,
          amount: Math.max(0.1, Math.min(2.0, params.intensity ?? actOpt.defaultAmount)),
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
    }
    return
  }
  // 3. Node Hang động / Vùng độ sâu (Cave Depth Portal)
  if (params.logicCategory === 'cave') {
    const archShape = params.caveArchShape ?? 'arch'
    const darkness = Math.max(0.1, Math.min(1.0, params.caveDarkness ?? params.intensity ?? 0.82))
    const minScale = params.caveMinScale ?? 0.38
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      l.physics = {
        ...(l.physics ?? { enabled: true, material: 'stone_wall' }),
        enabled: node.enabled,
        colliderZone: 'cave_portal',
        depthPortal: {
          enabled: node.enabled,
          centerUV: [0.5, 0.45],
          radiusUV: [0.35, 0.35],
          minScale,
          darkness,
          shadowTint: '#060812',
          depthPullZ: 140,
          archShape,
          feather: 0.55
        }
      }
    }
    return
  }
  // 4. Node Ánh sáng (Light)
  if (params.logicCategory === 'light') {
    const color = params.lightColor || '#38bdf8'
    const intensity = params.intensity ?? 1.3
    const mode = params.lightMode || 'rim'
    const lightOpt =
      WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === mode) ?? WORKFLOW_V2_LIGHT_OPTIONS[0]
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      if (mode === 'glow' || mode === 'rim') {
        l.glow = {
          enabled: node.enabled,
          color,
          intensity: Math.min(3, intensity),
          thickness: 12,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
      l.virtualLight = {
        enabled: node.enabled,
        kind: lightOpt.virtualKind,
        color,
        intensity,
        radius: 460,
        originUV: [0.5, 0.5],
        zReach: 320
      }
    }
    return
  }
  // 5. Node Hiệu ứng & Vật lý (FX)
  if (params.logicCategory === 'fx') {
    const fxKind = params.fxKind || 'wind_physics'
    const intensity = params.intensity ?? 1.0
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      if (fxKind === 'wind_physics') {
        l.physics = {
          ...(l.physics ?? { material: 'foliage_bush' }),
          enabled: node.enabled,
          material: 'foliage_bush',
          stiffness: 0.8 * intensity,
          damping: 0.35,
          bounciness: 0.9 * intensity
        }
      } else {
        const startSec = tStart ?? l.inPoint ?? 0
        const endSec = tEnd ?? l.outPoint ?? project.comp.duration
        l.glow = {
          enabled: node.enabled,
          color: fxKind === 'chromatic' ? '#a855f7' : '#38bdf8',
          intensity: Math.min(3, intensity * 1.4),
          thickness: 10,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
    }
    return
  }
  // 6. Node Camera 3D
  if (node.type === 'camera_director' || params.logicCategory === 'camera') {
    if (project.camera && typeof params.enableDof === 'boolean') {
      project.camera.dofEnabled = params.enableDof
    }
  }
}
