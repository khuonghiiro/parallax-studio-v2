import type { Layer, Project, WorkflowNode } from '@shared/types'
import { findClusterRootLayer, isLayerClusterLocked, useEditor } from '../../store/editor'
import {
  getClusterDisplayName,
  getClusterMemberLayers,
  getClusterPartShortName,
  v2ClusterLockId,
  v2LayerNodeId
} from '../../project/workflowV2Engine'
import {
  cleanV2NodeTitle,
  resolveV2LogicCategory,
  resolveV2NodeLevel
} from '../workflow/workflowV2Theme'
import { summarizeV2Node } from '../workflow/WorkflowNodeCardV2'
import type { ScannedSceneCanvasHit } from '../viewer/viewerSceneInspectorBridge'

export interface ScannedSceneEntityInfo {
  entityKind: 'cluster_25d' | 'model_3d' | 'scene_layer' | 'camera_waypoint'
  displayName: string
  layerId: string
  layerName: string
  layerType: string
  shotName: string
  isFocused: boolean
  bboxScope: 'cluster' | 'layer'
  bboxRoleLabel: string
  coordsSummary: string
  clusterSummary?: {
    instanceId: string
    clusterName: string
    memberCount: number
    rootLayerId: string
    lockedGroup: boolean
    partShortName: string
  } | null
  workflowNodeId?: string | null
  connectedLogicSummaries?: string[]
  relatedFiles: string[]
}

export interface ScannedWorkflowNodeInfo {
  nodeId: string
  title: string
  levelLabel: string
  logicCategory: string
  summaryText: string
  timeRange: string
  isEnabled: boolean
  isSelected: boolean
  targetSummary: string
  inspectorSourceFile: string
  engineSourceFile: string
}

const BBOX_ROLE_LABELS: Record<string, string> = {
  motion_start: 'Khung BBox #1 Xuất phát (Đầu — trong Khung chỉnh BBox)',
  motion_target: 'Khung BBox #2 Đích (Ghost Target — trong Khung chỉnh BBox)',
  cluster_bbox: 'Khung BBox Toàn bộ Cụm 2.5D (trong Khung chỉnh BBox)',
  layer_bbox: 'Khung BBox Riêng Mảnh / Layer (trong Khung chỉnh BBox)',
  viewer_cluster_bbox: 'Khung BBox Cụm 2.5D trên Khung nhìn 3D / Camera',
  viewer_layer_bbox: 'Khung BBox Layer trên Khung nhìn 3D / Camera',
  stage2d_layer_bbox: 'Khung BBox Layer trên Sân khấu Camera 2D',
  camera_waypoint_bbox: 'Khung BBox Mốc Lộ trình Camera (#1 → #2)',
  canvas_3d_pick: 'Layer / Cụm 2.5D trong Khung nhìn 3D / Camera'
}

const LOGIC_CATEGORY_FILES: Record<string, { inspector: string; engine: string }> = {
  cluster_lock: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2ClusterAndPartParams.tsx',
    engine: 'src/renderer/src/project/workflowV2ClusterAndParts.ts'
  },
  part_swap: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2ClusterAndPartParams.tsx',
    engine: 'src/renderer/src/engine/workflowPartTimeline.ts'
  },
  rig_bone: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2ClusterAndPartParams.tsx',
    engine: 'src/renderer/src/project/workflowV2ClusterAndParts.ts'
  },
  action: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2BboxMotionSection.tsx',
    engine: 'src/renderer/src/project/workflowV2BboxMotionAndCollision.ts'
  },
  collision: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2CollisionSection.tsx',
    engine: 'src/renderer/src/project/workflowV2BboxMotionAndCollision.ts'
  },
  material: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2NodeParams.tsx',
    engine: 'src/renderer/src/engine/layerPhysics.ts'
  },
  anim_fx: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2NodeParams.tsx',
    engine: 'src/renderer/src/project/gifHelper.ts'
  },
  fx: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2NodeParams.tsx',
    engine: 'src/renderer/src/animation/motionEffects.ts'
  },
  light: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2LightAndCaveSection.tsx',
    engine: 'src/renderer/src/engine/virtualLight.ts'
  },
  cave: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2LightAndCaveSection.tsx',
    engine: 'src/renderer/src/engine/virtualLight.ts'
  },
  camera: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2CameraAndShotParams.tsx',
    engine: 'src/renderer/src/ui/viewer/animateCamera/animateCameraRouteLogic.ts'
  },
  time: {
    inspector: 'src/renderer/src/ui/workflow/WorkflowV2Inspector.tsx',
    engine: 'src/renderer/src/project/workflowTiming.ts'
  }
}

function collectLayerConnectedLogic(project: Project, layer: Layer): string[] {
  const wf = project.workflow
  if (!wf) return []
  const layerNodeId = v2LayerNodeId(layer.id)
  const instId = layer.composite?.instanceId || layer.model3d?.instanceId
  const clusterNodeId = instId ? v2ClusterLockId(instId) : null
  const list: string[] = []
  for (const e of wf.edges) {
    if (e.disabled) continue
    if (
      e.fromNode === layerNodeId ||
      e.toNode === layerNodeId ||
      (clusterNodeId && (e.fromNode === clusterNodeId || e.toNode === clusterNodeId))
    ) {
      const otherId =
        e.fromNode === layerNodeId || e.fromNode === clusterNodeId ? e.toNode : e.fromNode
      const other = wf.nodes.find((n) => n.id === otherId)
      if (other && other.params?.logicCategory) {
        list.push(`${cleanV2NodeTitle(other.title || other.id)} (${other.id})`)
      }
    }
  }
  return Array.from(new Set(list)).slice(0, 6)
}

export function buildSceneEntityFromLayer(
  project: Project,
  layer: Layer,
  opts: {
    isFocused: boolean
    bboxScope: 'cluster' | 'layer'
    bboxRole?: string | null
    workflowNodeId?: string | null
    relatedFiles?: string[]
  }
): ScannedSceneEntityInfo {
  const instId = layer.composite?.instanceId || layer.model3d?.instanceId || null
  let clusterSummary: ScannedSceneEntityInfo['clusterSummary'] = null
  if (instId) {
    const members = getClusterMemberLayers(project, instId, layer)
    const root = findClusterRootLayer(project, layer) ?? members[0] ?? layer
    clusterSummary = {
      instanceId: instId,
      clusterName: getClusterDisplayName(root),
      memberCount: members.length,
      rootLayerId: root.id,
      lockedGroup: isLayerClusterLocked(layer),
      partShortName: getClusterPartShortName(layer)
    }
  }

  const pos = layer.transform.position.value ?? [0, 0, 0]
  const scl = layer.transform.scale.value ?? [1, 1, 1]
  const rot = layer.transform.rotation.value ?? [0, 0, 0]
  const opa = layer.transform.opacity.value ?? 1

  const coordsSummary = `X: ${Math.round(pos[0])}, Y: ${Math.round(pos[1])}, Z: ${Math.round(pos[2])} · Cỡ: ${Math.round(Math.abs(scl[0] || 1) * 100)}% · Xoay Z: ${Math.round(rot[2] || 0)}° · Độ mờ: ${Math.round(opa * 100)}%`
  const shotObj = layer.shotId ? project.shots.find((s) => s.id === layer.shotId) : project.shots[0]

  const entityKind: ScannedSceneEntityInfo['entityKind'] =
    opts.bboxScope === 'cluster' && clusterSummary
      ? layer.model3d
        ? 'model_3d'
        : 'cluster_25d'
      : 'scene_layer'

  const displayName =
    opts.bboxScope === 'cluster' && clusterSummary
      ? `Cụm 2.5D "${clusterSummary.clusterName}" (${clusterSummary.memberCount} mảnh)`
      : clusterSummary
        ? `Mảnh "${clusterSummary.partShortName}" — thuộc Cụm "${clusterSummary.clusterName}"`
        : `Layer "${layer.name}"`

  const wfNodeId =
    opts.workflowNodeId ||
    (opts.bboxScope === 'cluster' && instId ? v2ClusterLockId(instId) : v2LayerNodeId(layer.id))

  return {
    entityKind,
    displayName,
    layerId: layer.id,
    layerName: layer.name,
    layerType: layer.type,
    shotName: shotObj?.name || 'Cảnh 1',
    isFocused: opts.isFocused,
    bboxScope: opts.bboxScope,
    bboxRoleLabel:
      (opts.bboxRole && BBOX_ROLE_LABELS[opts.bboxRole]) ||
      (opts.bboxScope === 'cluster' ? 'Cụm Layer 2.5D trên Cảnh' : 'Layer trên Cảnh'),
    coordsSummary,
    clusterSummary,
    workflowNodeId: wfNodeId,
    connectedLogicSummaries: collectLayerConnectedLogic(project, layer),
    relatedFiles: opts.relatedFiles || [
      'src/renderer/src/ui/Viewer.tsx',
      'src/renderer/src/ui/viewer/LayerGizmo.tsx',
      'src/renderer/src/ui/workflow/WorkflowV2DirectStagePreview.tsx'
    ]
  }
}

export function buildSceneEntityFromCanvasHit(
  project: Project,
  hit: ScannedSceneCanvasHit
): ScannedSceneEntityInfo | null {
  const layer = project.layers.find((l) => l.id === hit.layerId)
  if (!layer) return null
  return buildSceneEntityFromLayer(project, layer, {
    isFocused: hit.isFocused,
    bboxScope: hit.selectionScope,
    bboxRole: hit.isFocused
      ? hit.selectionScope === 'cluster'
        ? 'viewer_cluster_bbox'
        : 'viewer_layer_bbox'
      : 'canvas_3d_pick',
    workflowNodeId: hit.workflowNodeId,
    relatedFiles: [
      'src/renderer/src/ui/Viewer.tsx',
      'src/renderer/src/ui/viewer/LayerGizmo.tsx',
      'src/renderer/src/engine/SceneRenderer.ts'
    ]
  })
}

export function extractDomSceneEntityInfo(el: Element): ScannedSceneEntityInfo | null {
  const st = useEditor.getState()
  const project = st.project

  const sceneEl =
    el.hasAttribute?.('data-scene-layer-id') || el.hasAttribute?.('data-waypoint-node-id')
      ? el
      : el.closest?.('[data-scene-layer-id], [data-waypoint-node-id]')
  if (!sceneEl) return null

  const wpNodeId = sceneEl.getAttribute?.('data-waypoint-node-id')
  if (wpNodeId) {
    const isFocused = sceneEl.getAttribute?.('data-bbox-focused') === 'true'
    const titleAttr = sceneEl.getAttribute?.('title') || wpNodeId
    return {
      entityKind: 'camera_waypoint',
      displayName: `BBox Lộ trình Camera (${titleAttr.split('—')[0].trim()})`,
      layerId: wpNodeId,
      layerName: titleAttr,
      layerType: 'camera_waypoint',
      shotName:
        project.shots.find((s) => s.id === st.selectedShotId)?.name ||
        project.shots[0]?.name ||
        'Cảnh 1',
      isFocused,
      bboxScope: 'layer',
      bboxRoleLabel: BBOX_ROLE_LABELS.camera_waypoint_bbox,
      coordsSummary: titleAttr,
      clusterSummary: null,
      workflowNodeId: wpNodeId,
      connectedLogicSummaries: [],
      relatedFiles: [
        'src/renderer/src/ui/workflow/WorkflowV2DirectStagePreview.tsx',
        'src/renderer/src/ui/viewer/animateCamera/AnimateCameraStage.tsx'
      ]
    }
  }

  const layerId = sceneEl.getAttribute?.('data-scene-layer-id')
  if (!layerId) return null
  const layer = project.layers.find((l) => l.id === layerId)
  if (!layer) return null

  const bboxScopeAttr = sceneEl.getAttribute?.('data-bbox-scope')
  const bboxRoleAttr = sceneEl.getAttribute?.('data-bbox-role')
  const isFocusedAttr = sceneEl.getAttribute?.('data-bbox-focused') === 'true'
  const wfNodeIdAttr =
    sceneEl.getAttribute?.('data-workflow-node-id') ||
    sceneEl.closest?.('[data-focus-node]')?.getAttribute?.('data-focus-node') ||
    null

  const isInWorkflowPreview = Boolean(sceneEl.closest?.('[data-mcp-region="workflow_preview"]'))
  const isInStage2D = Boolean(sceneEl.closest?.('[data-mcp-region="viewer_stage2d"]'))

  const relatedFiles = isInWorkflowPreview
    ? [
        'src/renderer/src/ui/workflow/WorkflowV2DirectStagePreview.tsx',
        'src/renderer/src/ui/workflow/WorkflowV2StageBboxMotionOverlay.tsx',
        'src/renderer/src/project/workflowV2BboxMotionAndCollision.ts'
      ]
    : isInStage2D
      ? [
          'src/renderer/src/ui/viewer/animateCamera/AnimateShotPlane2D.tsx',
          'src/renderer/src/ui/viewer/animateCamera/AnimateCameraStage.tsx'
        ]
      : [
          'src/renderer/src/ui/viewer/LayerGizmo.tsx',
          'src/renderer/src/ui/Viewer.tsx'
        ]

  return buildSceneEntityFromLayer(project, layer, {
    isFocused: isFocusedAttr || st.selectedLayerId === layer.id,
    bboxScope: bboxScopeAttr === 'cluster' ? 'cluster' : 'layer',
    bboxRole: bboxRoleAttr,
    workflowNodeId: wfNodeIdAttr,
    relatedFiles
  })
}

export function buildWorkflowNodeInfo(
  project: Project,
  node: WorkflowNode,
  isSelected: boolean
): ScannedWorkflowNodeInfo {
  const wf = project.workflow
  const childCount = wf
    ? wf.edges.filter((e) => !e.disabled && e.fromNode === node.id).length
    : 0
  const level = resolveV2NodeLevel(node)
  const cat = resolveV2LogicCategory(node)
  const levelLabel =
    level === 'root'
      ? 'Node Cảnh Gốc (Root Shot)'
      : level === 'group'
        ? 'Node Nhóm Layer (Group)'
        : level === 'layer'
          ? 'Node Layer 2.5D / 3D'
          : `Node Logic (${cat || 'general'})`

  const tStart = Number((node.params?.timeStart ?? 0).toFixed(2))
  const tEnd = Number((node.params?.timeEnd ?? project.comp.duration ?? 5).toFixed(2))

  let targetSummary = 'Chưa gắn layer mục tiêu'
  const instId = node.params?.instanceId
  const targetLayerIds = node.params?.targetLayerIds ?? []
  if (instId) {
    const members = getClusterMemberLayers(project, instId)
    const root = members[0]
    const cName = root ? getClusterDisplayName(root) : instId
    targetSummary = `Cụm 2.5D "${cName}" (${members.length} mảnh · Instance: ${instId})`
  } else if (targetLayerIds.length > 0) {
    const targetLayers = targetLayerIds
      .map((id) => project.layers.find((l) => l.id === id))
      .filter((l): l is Layer => Boolean(l))
    if (targetLayers.length === 1) {
      const l = targetLayers[0]
      targetSummary = `Layer "${l.name}" (${l.id})`
    } else if (targetLayers.length > 1) {
      targetSummary = `${targetLayers.length} layers: ${targetLayers
        .slice(0, 3)
        .map((l) => `"${getClusterPartShortName(l)}"`)
        .join(', ')}${targetLayers.length > 3 ? ` (+${targetLayers.length - 3})` : ''}`
    }
  } else if (node.params?.shotId) {
    const s = project.shots.find((sh) => sh.id === node.params?.shotId)
    if (s) targetSummary = `Phân cảnh "${s.name}" (${s.id})`
  }

  const catFiles = (cat && LOGIC_CATEGORY_FILES[cat]) || {
    inspector:
      level === 'layer'
        ? 'src/renderer/src/ui/workflow/WorkflowV2DirectStagePreview.tsx'
        : 'src/renderer/src/ui/workflow/WorkflowV2Inspector.tsx',
    engine: 'src/renderer/src/project/workflowV2Engine.ts'
  }

  return {
    nodeId: node.id,
    title: cleanV2NodeTitle(node.title || node.id),
    levelLabel,
    logicCategory: cat || level,
    summaryText: summarizeV2Node(node, childCount),
    timeRange: `${tStart}s → ${tEnd}s`,
    isEnabled: node.enabled !== false,
    isSelected,
    targetSummary,
    inspectorSourceFile: catFiles.inspector,
    engineSourceFile: catFiles.engine
  }
}

export function extractDomWorkflowNodeInfo(el: Element): ScannedWorkflowNodeInfo | null {
  const st = useEditor.getState()
  const project = st.project
  const wf = project.workflow
  if (!wf?.nodes?.length) return null

  const nodeCardEl =
    el.hasAttribute?.('data-node-id') || el.hasAttribute?.('data-workflow-node-id')
      ? el
      : el.closest?.('[data-node-id], [data-workflow-node-id], [data-focus-node]')

  let nodeId =
    nodeCardEl?.getAttribute?.('data-node-id') ||
    nodeCardEl?.getAttribute?.('data-workflow-node-id') ||
    nodeCardEl?.getAttribute?.('data-focus-node') ||
    null

  // Nếu quét bên trong cột Thuộc tính Node (workflow_inspector / workflow_preview / inspector_bottom_tabs)
  if (
    !nodeId &&
    st.selectedWorkflowNodeId &&
    el.closest?.(
      '[data-mcp-region="workflow_inspector"], [data-mcp-region="workflow_preview"], [data-mcp-region="inspector"], [data-mcp-region="inspector_bottom_tabs"]'
    )
  ) {
    nodeId = st.selectedWorkflowNodeId
  }

  if (!nodeId) return null
  const node = wf.nodes.find((n) => n.id === nodeId)
  if (!node) return null

  return buildWorkflowNodeInfo(project, node, st.selectedWorkflowNodeId === node.id)
}

export function enrichScannedWithViewerSceneHits<
  T extends {
    element: Element
    tagName: string
    kindLabel: string
    id: string
    classes: string[]
    text: string
    title: string | null
    primaryFile: string | null
    primaryHandler: string | null
    componentChain: Array<{ componentName: string; fileInfo: string | null; handlers: string[] }>
    mcpRegion: string | null
    mcpDialog: string | null
    bounds: { left: number; top: number; width: number; height: number }
    sceneEntity?: ScannedSceneEntityInfo | null
    ownerComponentName?: string | null
    isPrimaryFocus?: boolean
  }
>(
  project: Project,
  box: { left: number; top: number; width: number; height: number },
  scanned: T[],
  hasActiveModal: boolean
): T[] {
  if (hasActiveModal || typeof document === 'undefined') return scanned
  const viewerCanvas = document.getElementById('viewer-canvas')
  const querySceneFn = (viewerCanvas as unknown as {
    __pxsQuerySceneLayersInBox?: (b: typeof box) => ScannedSceneCanvasHit[]
  } | null)?.__pxsQuerySceneLayersInBox

  if (!viewerCanvas || typeof querySceneFn !== 'function') return scanned
  const canvasRect = viewerCanvas.getBoundingClientRect()
  if (
    canvasRect.width <= 0 ||
    canvasRect.height <= 0 ||
    canvasRect.right < box.left ||
    canvasRect.left > box.left + box.width ||
    canvasRect.bottom < box.top ||
    canvasRect.top > box.top + box.height
  ) {
    return scanned
  }

  const hits = querySceneFn(box) || []
  const existingSceneKeys = new Set(
    scanned
      .map((s) =>
        s.sceneEntity?.bboxScope === 'cluster' && s.sceneEntity?.clusterSummary?.instanceId
          ? `cluster:${s.sceneEntity.clusterSummary.instanceId}`
          : s.sceneEntity?.layerId
            ? `layer:${s.sceneEntity.layerId}`
            : null
      )
      .filter(Boolean)
  )
  const syntheticSceneItems: T[] = []

  for (const hit of hits) {
    const sceneEntity = buildSceneEntityFromCanvasHit(project, hit)
    if (!sceneEntity) continue
    const sceneKey =
      sceneEntity.bboxScope === 'cluster' && sceneEntity.clusterSummary?.instanceId
        ? `cluster:${sceneEntity.clusterSummary.instanceId}`
        : `layer:${sceneEntity.layerId}`
    if (existingSceneKeys.has(sceneKey)) continue
    existingSceneKeys.add(sceneKey)

    syntheticSceneItems.push({
      element: viewerCanvas,
      tagName:
        sceneEntity.entityKind === 'cluster_25d'
          ? 'cluster-25d'
          : sceneEntity.entityKind === 'model_3d'
            ? 'model-3d'
            : 'scene-layer',
      kindLabel: sceneEntity.bboxRoleLabel,
      id: sceneEntity.layerId,
      classes: sceneEntity.isFocused
        ? ['viewer-scene-target', 'is-focused-bbox']
        : ['viewer-scene-target'],
      text: sceneEntity.displayName,
      title: `${sceneEntity.bboxRoleLabel} · ${sceneEntity.coordsSummary}`,
      primaryFile: sceneEntity.isFocused
        ? 'src/renderer/src/ui/viewer/LayerGizmo.tsx'
        : 'src/renderer/src/ui/Viewer.tsx',
      primaryHandler: sceneEntity.isFocused
        ? 'onPointerDown (Kéo dịch chuyển / Co dãn Khung BBox Layer & Cụm 2.5D)'
        : 'onPointerDown={onPointerDown} (Click chọn & Kéo Layer / Cụm 2.5D trên Cảnh 3D)',
      componentChain: [
        {
          componentName: 'LayerGizmo',
          fileInfo: 'src/renderer/src/ui/viewer/LayerGizmo.tsx',
          handlers: []
        },
        {
          componentName: 'Viewer',
          fileInfo: 'src/renderer/src/ui/Viewer.tsx',
          handlers: ['onPointerDown={onPointerDown}']
        }
      ],
      mcpRegion: 'viewer_canvas',
      mcpDialog: null,
      bounds: hit.screenBounds,
      sceneEntity,
      ownerComponentName: sceneEntity.isFocused ? 'LayerGizmo' : 'Viewer',
      isPrimaryFocus: false
    } as unknown as T)
  }

  let next = syntheticSceneItems.length > 0 ? [...syntheticSceneItems, ...scanned] : scanned
  const hasSceneEntities = next.some((s) => Boolean(s.sceneEntity))
  const boxCx = box.left + box.width * 0.5
  const boxCy = box.top + box.height * 0.5
  const centerInCanvas =
    boxCx >= canvasRect.left &&
    boxCx <= canvasRect.right &&
    boxCy >= canvasRect.top &&
    boxCy <= canvasRect.bottom

  const viewerToolsEl = document.querySelector?.('[data-mcp-region="viewer_tools"]')
  const toolsRect = viewerToolsEl?.getBoundingClientRect()
  const centerInTools = Boolean(
    toolsRect &&
      boxCx >= toolsRect.left &&
      boxCx <= toolsRect.right &&
      boxCy >= toolsRect.top &&
      boxCy <= toolsRect.bottom
  )

  if (hasSceneEntities && centerInCanvas && !centerInTools) {
    const seenViewerSceneKeys = new Set<string>()
    const sceneFocusedList = next.filter((s) => {
      if (s.tagName === 'canvas' && s.id === 'viewer-canvas') return false
      if (s.tagName === 'svg' && s.classes.includes('layer-gizmo')) return false
      if (
        box.width >= 140 &&
        box.height >= 100 &&
        s.classes.some((c) =>
          ['viewer-tool-btn', 'viewer-fit-scene-btn', 'tl-action-btn'].includes(c)
        )
      ) {
        return false
      }
      if (s.sceneEntity && (s.mcpRegion === 'viewer_canvas' || s.mcpRegion === 'viewer_layer_gizmo')) {
        const key =
          s.sceneEntity.bboxScope === 'cluster' && s.sceneEntity.clusterSummary?.instanceId
            ? `cluster:${s.sceneEntity.clusterSummary.instanceId}`
            : `layer:${s.sceneEntity.layerId}`
        if (seenViewerSceneKeys.has(key)) return false
        seenViewerSceneKeys.add(key)
      }
      return true
    })
    if (sceneFocusedList.length > 0) {
      next = sceneFocusedList
    }
  }
  return next
}
