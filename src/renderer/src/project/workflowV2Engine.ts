import type {
  Layer,
  LayerMotionType,
  LayerPhysicsMaterial,
  Project,
  Shot,
  VirtualLightKind,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode
} from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import {
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  recomputeSharedLogicTargets,
  validateWorkflowV2Connection
} from './workflowV2PhysicsAndValidation'
import {
  attachLogicNodeToLayerV2,
  reconcileWorkflowV2WithProject,
  syncWorkflowV2NodeToProject
} from './workflowV2Mutations'

export {
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  recomputeSharedLogicTargets,
  validateWorkflowV2Connection,
  attachLogicNodeToLayerV2,
  syncWorkflowV2NodeToProject,
  reconcileWorkflowV2WithProject
}

export const WF_V2_COL_X = {
  ROOT: 40,
  GROUP: 432,
  LAYER: 824,
  LOGIC: 1216
} as const

export const WF_V2_NODE_W = 236

export type WorkflowV2LogicCategory =
  | 'action'
  | 'material'
  | 'collision'
  | 'light'
  | 'cave'
  | 'fx'
  | 'audio'
  | 'camera'

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
  const minIn = Math.max(0, Math.min(...shotLayers.map((l) => (Number.isFinite(l.inPoint) ? l.inPoint : 0))))
  const maxOut = Math.min(compDur, Math.max(...shotLayers.map((l) => (Number.isFinite(l.outPoint) ? l.outPoint : compDur))))
  return {
    start: Number(minIn.toFixed(2)),
    end: Number(Math.max(minIn + 0.5, maxOut).toFixed(2))
  }
}

/** Phân loại một Layer vào đúng Group Layer ('group_3d' | 'group_25d' | 'group_env') */
export function classifyLayerGroupKind(layer: Layer): 'group_3d' | 'group_25d' | 'group_env' {
  if (layer.model3d || layer.composite) return 'group_3d'
  const z = getLayerZ(layer)
  if (layer.type === 'particles' || layer.type === 'solid' || z >= 2500) return 'group_env'
  return 'group_25d'
}

/** Suy luận nhãn vật liệu vật lý phù hợp cho một Layer dựa trên cấu hình vật lý sẵn có hoặc tên Layer */
function inferLayerMaterialTag(layer: Layer, displayTitle: string): LayerPhysicsMaterial | null {
  if (layer.physics?.material && layer.physics.material !== 'none') return layer.physics.material
  const lower = displayTitle.toLowerCase()
  if (lower.includes('dây leo') || lower.includes('lá') || lower.includes('bụi') || lower.includes('cỏ')) {
    return 'foliage_bush'
  }
  if (lower.includes('cây') || lower.includes('gỗ') || lower.includes('thân')) {
    return 'wood_tree'
  }
  if (lower.includes('đá') || lower.includes('di tích') || lower.includes('tường') || lower.includes('đảo')) {
    return 'stone_wall'
  }
  if (lower.includes('slime') || lower.includes('thạch') || lower.includes('nấm')) {
    return 'jelly_slime'
  }
  if (layer.composite || layer.model3d) {
    return 'flesh_body'
  }
  return null
}

/** Gom các layer mảnh con của cùng một Composite/Model3D thành đại diện duy nhất để cây gọn sạch */
export function collectRepresentativeLayers(layers: Layer[]): {
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
 * Xây dựng Cây Workflow V2 chuẩn 4 tầng từ dữ liệu thật của Project,
 * hỗ trợ tái sử dụng Node Logic dùng chung (Shared Logic Nodes), Node Nhãn Vật liệu và Node Va chạm 2 Layer:
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

  // 1. TẦNG 0: ROOT CẢNH TỔNG HỢP + ĐẠO DIỄN CAMERA
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

  // 2. TẦNG 1: PHÂN NHÓM GROUP LAYER
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

    const sharedActionNodes = new Map<string, WorkflowNode>()
    const sharedMaterialNodes = new Map<LayerPhysicsMaterial, WorkflowNode>()
    const createdLayerNodeIds: string[] = []

    // 3. TẦNG 2: CÁC NODE LAYER THUỘC GROUP
    grp.items.forEach((item, layerIdx) => {
      const l = item.layer
      const layerNodeId = `v2-layer-${l.id}`
      createdLayerNodeIds.push(layerNodeId)
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
        const existingSharedAction = sharedActionNodes.get(actOpt.id)
        if (existingSharedAction) {
          edges.push({
            id: `e-${layerNodeId}-${existingSharedAction.id}`,
            fromNode: layerNodeId,
            fromPort: 'layers_tree',
            toNode: existingSharedAction.id,
            toPort: 'layers_tree'
          })
        } else {
          const mStart = Number((l.motion?.startTime ?? lStart).toFixed(2))
          const mEnd = Number(
            (l.motion?.duration && l.motion.duration > 0
              ? Math.min(shotEnd, mStart + l.motion.duration)
              : lEnd
            ).toFixed(2)
          )
          const actionNodeId = `v2-action-${l.id}`
          const actionNode: WorkflowNode = {
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
              targetLayerIds: [...item.memberIds],
              sharedLayerNodeIds: [layerNodeId],
              requireLayerConnection: true,
              intensity: Number((l.motion?.amount ?? actOpt.defaultAmount).toFixed(2)),
              timeStart: mStart,
              timeEnd: mEnd,
              hierarchyParentNodeId: layerNodeId
            }
          }
          nodes.push(actionNode)
          sharedActionNodes.set(actOpt.id, actionNode)
          edges.push({
            id: `e-${layerNodeId}-${actionNodeId}`,
            fromNode: layerNodeId,
            fromPort: 'layers_tree',
            toNode: actionNodeId,
            toPort: 'layers_tree'
          })
        }
      }

      // 4b. Node Nhãn Vật liệu (Material Tag)
      const matTag = inferLayerMaterialTag(l, displayTitle)
      if (matTag && grp.kind !== 'group_env') {
        const existingMatNode = sharedMaterialNodes.get(matTag)
        if (existingMatNode) {
          edges.push({
            id: `e-${layerNodeId}-${existingMatNode.id}`,
            fromNode: layerNodeId,
            fromPort: 'layers_tree',
            toNode: existingMatNode.id,
            toPort: 'layers_tree'
          })
        } else {
          const matOpt =
            WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === matTag) ?? WORKFLOW_V2_MATERIAL_OPTIONS[0]
          const matNodeId = `v2-material-${l.id}`
          const matNode: WorkflowNode = {
            id: matNodeId,
            type: 'physics_fx',
            title: `Vật liệu: ${matOpt.label}`,
            enabled: true,
            position: { x: WF_V2_COL_X.LOGIC, y: 130 },
            preset: 'rim_glow_particles',
            aiAgentRole: 'PhysicsLightFxAgent',
            aiDirective: `Gắn nhãn vật liệu "${matOpt.label}" (${matOpt.deformDesc}) cho "${displayTitle}".`,
            params: {
              shotId: activeShot?.id,
              logicCategory: 'material',
              materialTag: matOpt.id,
              materialStiffness: l.physics?.stiffness ?? matOpt.defaultStiffness,
              materialBounciness: l.physics?.bounciness ?? matOpt.defaultBounciness,
              materialGravity: l.physics?.gravity ?? matOpt.defaultGravity,
              targetMode: 'custom',
              targetLayerIds: [...item.memberIds],
              sharedLayerNodeIds: [layerNodeId],
              requireLayerConnection: true,
              intensity: l.physics?.bounciness ?? matOpt.defaultBounciness,
              timeStart: lStart,
              timeEnd: lEnd,
              hierarchyParentNodeId: layerNodeId
            }
          }
          nodes.push(matNode)
          sharedMaterialNodes.set(matTag, matNode)
          edges.push({
            id: `e-${layerNodeId}-${matNodeId}`,
            fromNode: layerNodeId,
            fromPort: 'layers_tree',
            toNode: matNodeId,
            toPort: 'layers_tree'
          })
        }
      }

      // 4c. Node Hang động / Vùng độ sâu (Cave Depth Portal)
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
          position: { x: WF_V2_COL_X.LOGIC, y: 160 },
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
            sharedLayerNodeIds: [layerNodeId],
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

      // 4d. Node Ánh sáng (Light Node)
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
          position: { x: WF_V2_COL_X.LOGIC, y: 190 },
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
            sharedLayerNodeIds: [layerNodeId],
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
          position: { x: WF_V2_COL_X.LOGIC, y: 240 },
          preset: 'auto_dialogue_lipsync',
          aiAgentRole: 'AudioLipSyncAgent',
          aiDirective: `Phát âm thanh cho "${displayTitle}" từ ${aStart}s đến ${aEnd}s.`,
          params: {
            shotId: activeShot?.id,
            logicCategory: 'audio',
            targetMode: 'custom',
            targetLayerIds: item.memberIds,
            sharedLayerNodeIds: [layerNodeId],
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

    // 4f. Nếu Group 2.5D có từ 2 Layer trở lên, tạo sẵn 1 Node Va chạm Vật lý liên kết 2 Layer đầu tiên
    if (grp.kind === 'group_25d' && grp.items.length >= 2) {
      const itemA = grp.items[0]
      const itemB = grp.items[1]
      const layerNodeA = createdLayerNodeIds[0]
      const layerNodeB = createdLayerNodeIds[1]
      const colOpt = WORKFLOW_V2_COLLISION_OPTIONS[0]
      const colNodeId = `v2-collision-${grp.id}`
      const colStart = Number(
        Math.max(shotStart, Number((shotStart + (shotEnd - shotStart) * 0.2).toFixed(2))).toFixed(2)
      )
      const colEnd = Number(
        Math.min(shotEnd, Number((shotStart + (shotEnd - shotStart) * 0.85).toFixed(2))).toFixed(2)
      )
      nodes.push({
        id: colNodeId,
        type: 'physics_fx',
        title: `Va chạm: ${colOpt.label}`,
        enabled: true,
        position: { x: WF_V2_COL_X.LOGIC, y: 220 },
        preset: 'rim_glow_particles',
        aiAgentRole: 'PhysicsLightFxAgent',
        aiDirective: `Va chạm vật lý "${colOpt.label}" giữa "${getLayerDisplayName(itemA.layer)}" và "${getLayerDisplayName(itemB.layer)}".`,
        params: {
          shotId: activeShot?.id,
          logicCategory: 'collision',
          collisionMode: colOpt.id,
          collisionForce: colOpt.defaultForce,
          deformIntensity: colOpt.defaultDeform,
          strikerLayerId: itemA.layer.id,
          targetColliderLayerId: itemB.layer.id,
          targetMode: 'custom',
          targetLayerIds: [...itemA.memberIds, ...itemB.memberIds],
          sharedLayerNodeIds: [layerNodeA, layerNodeB],
          requireLayerConnection: true,
          intensity: colOpt.defaultForce,
          timeStart: colStart,
          timeEnd: colEnd,
          hierarchyParentNodeId: layerNodeA
        }
      })
      edges.push(
        {
          id: `e-${layerNodeA}-${colNodeId}`,
          fromNode: layerNodeA,
          fromPort: 'layers_tree',
          toNode: colNodeId,
          toPort: 'layers_tree'
        },
        {
          id: `e-${layerNodeB}-${colNodeId}`,
          fromNode: layerNodeB,
          fromPort: 'layers_tree',
          toNode: colNodeId,
          toPort: 'layers_tree'
        }
      )
    }
  }

  const syncedNodes = recomputeSharedLogicTargets(nodes, edges)
  const laidOutNodes = layoutWorkflowV2Tree(syncedNodes, edges)
  return {
    version: 1,
    id: `wf-v2-${activeShot?.id ?? 'project'}`,
    name: `Workflow V2 — ${sceneTitle}`,
    presetId: 'v2_scene_hierarchy',
    description:
      'Sơ đồ cây phân cấp thời gian: Cảnh Root ➔ Group Layer ➔ Node Layer ➔ Node Logic (Hành động / Vật liệu / Va chạm / Ánh sáng)',
    targetShotId: activeShot?.id,
    nodes: laidOutNodes,
    edges
  }
}

/** Chiều cao chuẩn gọn gàng của từng loại thẻ trong Workflow V2 */
export function estimateV2NodeHeight(node: WorkflowNode): number {
  if (node.type === 'scene_shot') return 68
  if (node.params?.groupKind) return 66
  return 68
}

/**
 * Thuật toán xếp cây 4 cột (Root -> Group -> Layer -> Logic) chuẩn ELK / Dagre / React Flow,
 * hỗ trợ Node Logic dùng chung (nhiều Layer kết nối vào 1 Node Logic hoặc 1 Node Va chạm) không bao giờ đè nhau.
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
  const GAP_Y = 34
  const GROUP_GAP_Y = 46
  let layerCursorY = 44
  let groupColBottomY = 44

  for (const grp of groupNodes) {
    const layerChildren = (childrenMap.get(grp.id) ?? []).filter((c) => c.type === 'layer_assembly')
    const grpH = estimateV2NodeHeight(grp)
    if (grp.params?.collapsedGroup || layerChildren.length === 0) {
      const yPos = groupColBottomY
      grp.position = { x: WF_V2_COL_X.GROUP, y: yPos }
      layerChildren.forEach((ln, idx) => {
        ln.position = { x: WF_V2_COL_X.LAYER, y: yPos + idx * 102 }
      })
      groupColBottomY = yPos + grpH + 34
      continue
    }
    const groupStartY = Math.max(layerCursorY, groupColBottomY)
    layerCursorY = groupStartY
    for (const layerNode of layerChildren) {
      const layerH = estimateV2NodeHeight(layerNode)
      const attachedLogics = edges
        .filter((e) => e.fromNode === layerNode.id)
        .map((e) => byId.get(e.toNode))
        .filter(
          (c): c is WorkflowNode =>
            Boolean(c && c.type !== 'layer_assembly' && c.type !== 'scene_shot')
        )
      const slotSpan =
        attachedLogics.length > 1
          ? attachedLogics.length * 68 + (attachedLogics.length - 1) * 18
          : layerH
      layerNode.position = {
        x: WF_V2_COL_X.LAYER,
        y: layerCursorY + Math.round((slotSpan - layerH) / 2)
      }
      layerCursorY += slotSpan + GAP_Y
    }
    const firstLayerY = layerChildren[0].position.y
    const anchorIdx = Math.min(layerChildren.length - 1, 2)
    const anchorLayer = layerChildren[anchorIdx]
    const anchorBottom = anchorLayer.position.y + estimateV2NodeHeight(anchorLayer)
    const centeredY = Math.max(groupStartY, Math.round((firstLayerY + anchorBottom - grpH) / 2))
    grp.position = { x: WF_V2_COL_X.GROUP, y: centeredY }
    groupColBottomY = centeredY + grpH + 34
    layerCursorY += GROUP_GAP_Y - GAP_Y
  }

  // Xếp vị trí Cột 4 (Các Node Logic) thẳng hàng tại WF_V2_COL_X.LOGIC
  const logicNodes = cloned.filter(
    (n) => n.type !== 'scene_shot' && n.type !== 'camera_director' && n.type !== 'layer_assembly'
  )
  const desiredYMap = new Map<string, number>()
  const byParentSig = new Map<string, WorkflowNode[]>()
  for (const ln of logicNodes) {
    const parentLayers = edges
      .filter((e) => e.toNode === ln.id)
      .map((e) => byId.get(e.fromNode))
      .filter((p): p is WorkflowNode => Boolean(p && p.type === 'layer_assembly' && !p.params?.groupKind))
    const avgY =
      parentLayers.length > 0
        ? Math.round(parentLayers.reduce((s, p) => s + p.position.y, 0) / parentLayers.length)
        : ln.position.y || 100
    desiredYMap.set(ln.id, avgY)
    const sig = parentLayers.map((p) => p.id).sort().join('|') || ln.id
    const list = byParentSig.get(sig) ?? []
    list.push(ln)
    byParentSig.set(sig, list)
  }

  for (const [, siblingLogics] of byParentSig.entries()) {
    if (siblingLogics.length <= 1) continue
    const center = desiredYMap.get(siblingLogics[0].id) ?? 100
    const totalSpan = siblingLogics.length * 68 + (siblingLogics.length - 1) * 16
    const startY = Math.max(40, Math.round(center + 34 - totalSpan / 2))
    siblingLogics.forEach((ln, idx) => {
      desiredYMap.set(ln.id, startY + idx * (68 + 16))
    })
  }

  const sortedLogics = [...logicNodes].sort(
    (a, b) => (desiredYMap.get(a.id) ?? 0) - (desiredYMap.get(b.id) ?? 0)
  )
  let logicCursorY = 40
  for (const ln of sortedLogics) {
    const wantY = desiredYMap.get(ln.id) ?? logicCursorY
    const finalY = Math.max(logicCursorY, wantY)
    ln.position = { x: WF_V2_COL_X.LOGIC, y: finalY }
    logicCursorY = finalY + estimateV2NodeHeight(ln) + 18
  }

  if (rootNode) {
    const firstGrpY = groupNodes[0]?.position.y ?? 44
    rootNode.position = { x: WF_V2_COL_X.ROOT, y: firstGrpY }
    const camNodes = cloned.filter((n) => n.type === 'camera_director')
    camNodes.forEach((cam, idx) => {
      cam.position = {
        x: WF_V2_COL_X.ROOT,
        y: rootNode.position.y + estimateV2NodeHeight(rootNode) + 34 + idx * 102
      }
    })
  }
  return cloned
}
