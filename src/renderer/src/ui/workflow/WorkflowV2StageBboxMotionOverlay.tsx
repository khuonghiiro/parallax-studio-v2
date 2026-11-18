import { resolveMotionEntities } from './workflowMotionEntities'
import { WorkflowBboxTrajectorySvg } from './WorkflowBboxTrajectorySvg'
import { WorkflowClusterGhost } from './WorkflowClusterGhost'
import { WorkflowMotionStageTools } from './WorkflowMotionStageTools'
import { WorkflowMotionIcon } from './WorkflowMotionIcons'
import { WorkflowV2BboxGimbal } from './WorkflowV2BboxGimbal'
import { StudioTooltip } from '../controls/StudioTooltip'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import { bboxStartPosition, bboxStartScale } from '../../project/workflowMotionStart'
import { bboxStepNumber } from '../../project/workflowBboxSteps'
import React, { useCallback, useMemo, useState } from 'react'
import type { ImageProps, Layer, LayerBboxTargetConfig, Project, Vec3, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { assetStore } from '../../project/assets'
import {
  computeDrawnPathWorldDelta,
  retargetDrawnPathEndpoint
} from '../../project/workflowCurveMath'
import {
  evaluateBboxTrajectoryAt
} from '../../project/workflowV2BboxMotionAndCollision'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2NodeToProject
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import type { ProjectedLayer2D } from '../viewer/animateCamera/animateCameraMath'

export interface StageBboxMotionOverlayProps {
  toolbarHost?: HTMLDivElement | null
  project: Project
  workflow: WorkflowGraph
  node: WorkflowNode
  selectedProjLayer?: ProjectedLayer2D
  coordRefLayer?: Layer
  layers2D?: ProjectedLayer2D[]
  useClusterBbox: boolean
  clusterInstId?: string
  stageW: number
  stageH: number
  shotLeft: number
  shotTop: number
  shotScreenW: number
  shotScreenH: number
  zoom: number
  sampleTime: number
  onSelectNode?: (nodeId: string) => void
}

import { HANDLES, resolveActiveMotionNode } from './WorkflowV2StageBboxHelpers'
export { resolveActiveMotionNode } from './WorkflowV2StageBboxHelpers'

export const WorkflowV2StageBboxMotionOverlay: React.FC<StageBboxMotionOverlayProps> = ({
  toolbarHost = null,
  project,
  workflow,
  node,
  selectedProjLayer,
  coordRefLayer,
  layers2D,
  useClusterBbox,
  clusterInstId,
  stageW,
  stageH,
  shotLeft,
  shotTop,
  shotScreenW,
  shotScreenH,
  zoom,
  sampleTime,
  onSelectNode
}) => {
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)
  const motionNode = resolveActiveMotionNode(workflow, node, coordRefLayer?.id, clusterInstId)
  const mp = motionNode?.params
  const activeMotionMode = resolveMotionMode(mp ?? {})
  const hasBboxMotion = Boolean(motionNode && activeMotionMode === 'bbox')
  const hasDrawnPath = Boolean(
    motionNode && activeMotionMode === 'path' && (mp?.customMotionPath?.length ?? 0) >= 2
  )
  const showTargetBbox = hasBboxMotion || hasDrawnPath

  const focusMotionForEdit = (event?: { shiftKey?: boolean }): boolean => {
    if (motionNode && motionNode.id !== node.id) {
      onSelectNode?.(motionNode.id)
    }
    return true
  }

  const patchMotionNode = useCallback(
    (patch: Partial<WorkflowNodeParams>, mergeKey = 'wf-stage-bbox2'): void => {
      if (!motionNode) return
      update((d) => {
        if (!d.workflow) return
        const target = d.workflow.nodes.find((n) => n.id === motionNode.id)
        if (!target) return
        target.params = {
          ...(target.params ?? {}),
          ...patch
        }
        if (patch.motionMode === 'path' && /bbox/i.test(target.title)) {
          target.title = 'Motion: Vẽ quỹ đạo tự do'
        } else if (patch.motionMode === 'bbox' && /tự do/i.test(target.title)) {
          target.title = 'Motion: Đặt BBox Đích (đầu → đích)'
        }
        syncWorkflowV2NodeToProject(d, target, patch)
      }, mergeKey)
    },
    [motionNode, update]
  )

  /** Khởi tạo nhanh BBox đích ngay trên cảnh nếu Layer/Cụm chưa có BBox đích */
  const handleSpawnOrEnableBbox2 = useCallback((): void => {
    if (!coordRefLayer) return
    const tStart = mp?.timeStart ?? coordRefLayer.inPoint ?? 0
    const startPos = bboxStartPosition(coordRefLayer, tStart, motionNode?.id)
    const defaultTargetX = Math.round(startPos[0] + 280)
    const defaultTargetY = Math.round(startPos[1] - 20)

    if (motionNode) {
      patchMotionNode({
        motionMode: 'bbox',
        actionPreset: 'bbox_target',
        bboxPathType: mp?.bboxPathType ?? 'shortest',
        bboxTargetX: mp?.bboxTargetX ?? defaultTargetX,
        bboxTargetY: mp?.bboxTargetY ?? defaultTargetY,
        bboxTargetScalePct: mp?.bboxTargetScalePct ?? 135,
        depthMode: mp?.depthMode ?? 'flat_2d',
        bboxStartZ: Math.round(startPos[2]),
        bboxTargetZ: Math.round(startPos[2])
      })
      onSelectNode?.(motionNode.id)
      return
    }

    // Nếu Layer/Cụm chưa có Node Motion -> tự gắn Node Motion chế độ BBox đầu -> đích
    update((d) => {
      if (!d.workflow) return
      const res = attachLogicNodeToLayerV2(
        d.workflow,
        node.id,
        'action',
        'v2:action:bbox_target',
        {
          motionMode: 'bbox',
          actionPreset: 'bbox_target',
          bboxPathType: 'shortest',
          bboxTargetX: defaultTargetX,
          bboxTargetY: defaultTargetY,
          bboxTargetScalePct: 135,
          depthMode: 'flat_2d',
          bboxStartZ: Math.round(startPos[2]),
          bboxTargetZ: Math.round(startPos[2]),
          timeStart: tStart,
          timeEnd: Number((tStart + 3).toFixed(2))
        },
        'Motion: Đặt BBox Đích (đầu → đích)'
      )
      d.workflow = res.workflow
      const created = d.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (created) {
        syncWorkflowV2NodeToProject(d, created)
        setTimeout(() => onSelectNode?.(created.id), 0)
      }
    }, 'wf-spawn-bbox2')
  }, [coordRefLayer, mp, motionNode, patchMotionNode, onSelectNode, update, node.id])

  const tStart = mp?.timeStart ?? coordRefLayer?.inPoint ?? 0
  const tEnd = mp?.timeEnd ?? Number((tStart + 3).toFixed(2))
  const startPos: Vec3 = coordRefLayer ? bboxStartPosition(coordRefLayer, tStart, motionNode?.id) : [0, 0, 0]
  const refD = 1483.64
  const pFactorStart = refD / Math.max(80, refD + (startPos[2] ?? 0))

  const defaultTargetX = mp?.bboxTargetX ?? Math.round(startPos[0] + 280)
  const defaultTargetY = mp?.bboxTargetY ?? Math.round(startPos[1])
  const defaultTargetScalePct = mp?.bboxTargetScalePct ?? 135
  const defaultScaleRatio = Math.max(0.15, Math.min(4.0, defaultTargetScalePct / 100))
  const depthMode = mp?.depthMode ?? 'flat_2d'
  const defaultStartZ = mp?.bboxStartZ ?? Math.round(startPos[2] ?? 0)
  const defaultTargetZ =
    depthMode === 'depth_z'
      ? (mp?.bboxTargetZ ?? Math.round(defaultStartZ - (defaultScaleRatio - 1) * 180))
      : defaultStartZ

  // Tìm tất cả các Layer / Cụm kết nối vào Node Motion này
  const connectedEntities = useMemo(() => resolveMotionEntities({
    project, workflow, motionNode, coordRefLayer, layers2D, selectedProjLayer
  }), [project, workflow, motionNode, coordRefLayer, layers2D, selectedProjLayer])

  const primaryEntity =
    connectedEntities.find((e) => coordRefLayer && e.rootLayer.id === coordRefLayer.id) ?? connectedEntities[0]

  const ENT_ACCENTS = ['#38bdf8', '#f59e0b', '#a855f7', '#10b981', '#ec4899', '#f97316']

  const drawnPathDelta = useMemo(
    () =>
      hasDrawnPath
        ? computeDrawnPathWorldDelta(
            mp?.customMotionPath,
            project.comp.width || 1920,
            project.comp.height || 1080,
            mp?.intensity ?? 1
          )
        : ([0, 0] as [number, number]),
    [hasDrawnPath, mp?.customMotionPath, project.comp.width, project.comp.height, mp?.intensity]
  )

  const renderedEntities = useMemo(() => {
    return connectedEntities.map((ent, idx) => {
      const isPrimary = ent.id === primaryEntity?.id
      const entStartPos: Vec3 = bboxStartPosition(ent.rootLayer, tStart, motionNode?.id)
      const entStartCleanScale: Vec3 = bboxStartScale(ent.rootLayer, tStart, motionNode?.id)
      const curScale: Vec3 = evaluate(ent.rootLayer.transform.scale, sampleTime)
      const ratioX = Math.abs(entStartCleanScale[0] || 1) / Math.max(0.05, Math.abs(curScale[0] || 1))
      const ratioY = Math.abs(entStartCleanScale[1] || 1) / Math.max(0.05, Math.abs(curScale[1] || 1))
      const pStart = refD / Math.max(80, refD + (entStartPos[2] ?? 0))

      const customTarget = mp?.layerBboxTargets?.[ent.id]
      const entTargetX = hasDrawnPath
        ? Math.round(entStartPos[0] + drawnPathDelta[0])
        : isPrimary
          ? (mp?.bboxTargetX ?? customTarget?.targetX ?? Math.round(startPos[0] + 280))
          : (customTarget?.targetX ?? Math.round(defaultTargetX + (entStartPos[0] - startPos[0])))
      const entTargetY = hasDrawnPath
        ? Math.round(entStartPos[1] + drawnPathDelta[1])
        : isPrimary
          ? (mp?.bboxTargetY ?? customTarget?.targetY ?? Math.round(startPos[1]))
          : (customTarget?.targetY ?? Math.round(defaultTargetY + (entStartPos[1] - startPos[1])))
      const entTargetScalePct = hasDrawnPath
        ? (mp?.bboxTargetScalePct ?? customTarget?.targetScalePct ?? 100)
        : isPrimary
          ? (mp?.bboxTargetScalePct ?? customTarget?.targetScalePct ?? 135)
          : (customTarget?.targetScalePct ?? defaultTargetScalePct)
      const entScaleRatio = Math.max(0.15, Math.min(4.0, entTargetScalePct / 100))
      const entStartZ = Math.round(entStartPos[2] ?? 0)
      const entTargetZ =
        isPrimary
          ? (mp?.bboxTargetZ ?? customTarget?.targetZ ?? (depthMode === 'depth_z' ? Math.round(entStartZ - (entScaleRatio - 1) * 180) : entStartZ))
          : (customTarget?.targetZ ?? (depthMode === 'depth_z' ? Math.round(entStartZ - (entScaleRatio - 1) * 180) : entStartZ))

      const entRotZ = isPrimary ? (mp?.bboxTargetRotZ ?? customTarget?.targetRotZ ?? 0) : (customTarget?.targetRotZ ?? 0)
      const entRotY = isPrimary ? (mp?.bboxTargetRotY ?? customTarget?.targetRotY ?? 0) : (customTarget?.targetRotY ?? 0)
      const entRotX = isPrimary ? (mp?.bboxTargetRotX ?? customTarget?.targetRotX ?? 0) : (customTarget?.targetRotX ?? 0)

      const pEnd = refD / Math.max(80, refD + entTargetZ)
      const currentPos = evaluate(ent.rootLayer.transform.position, sampleTime)
      const currentPerspective = refD / Math.max(80, refD + currentPos[2])
      const centerDx = ent.isCluster && ent.projLayer ? (ent.projLayer.offsetX - currentPos[0] * currentPerspective) * ratioX : 0
      const centerDy = ent.isCluster && ent.projLayer ? (ent.projLayer.offsetY + currentPos[1] * currentPerspective) * ratioY : 0
      const startOffX = entStartPos[0] * pStart + centerDx
      const startOffY = -entStartPos[1] * pStart + centerDy
      const entProjW = ent.projLayer?.width ?? (ent.rootLayer.props as ImageProps)?.width ?? 400
      const entProjH = ent.projLayer?.height ?? (ent.rootLayer.props as ImageProps)?.height ?? 300
      const baseStageW = Math.max(16, entProjW * ratioX)
      const baseStageH = Math.max(16, entProjH * ratioY)
      const baseW = Math.max(22, baseStageW * zoom)
      const baseH = Math.max(22, baseStageH * zoom)

      const box1Cx = shotLeft + shotScreenW / 2 + startOffX * zoom
      const box1Cy = shotTop + shotScreenH / 2 + startOffY * zoom
      const targetOffX = entTargetX * pEnd + centerDx * entScaleRatio * pEnd / pStart
      const targetOffY = -entTargetY * pEnd + centerDy * entScaleRatio * pEnd / pStart
      const box2W = Math.max(20, baseW * entScaleRatio * pEnd / pStart)
      const box2H = Math.max(20, baseH * entScaleRatio * pEnd / pStart)
      const box2Cx = shotLeft + shotScreenW / 2 + targetOffX * zoom
      const box2Cy = shotTop + shotScreenH / 2 + targetOffY * zoom
      const box2Left = box2Cx - box2W / 2
      const box2Top = box2Cy - box2H / 2

      const entAssetId = ent.projLayer?.assetId ?? (ent.rootLayer.props as ImageProps)?.assetId
      const rtAsset = entAssetId ? assetStore.get(entAssetId) : undefined
      const pAsset = entAssetId ? project.assets.find((a) => a.id === entAssetId) : undefined
      const ghostImg = rtAsset?.url || rtAsset?.thumbUrl || pAsset?.dataUrl || pAsset?.path

      const pathPts: [number, number][] = []
      if (hasBboxMotion) {
        const steps = 44
        const activeStroke = customTarget?.customMotionPath !== undefined
          ? customTarget.customMotionPath
          : (isPrimary ? mp?.customMotionPath : undefined)
        const pType = customTarget?.bboxPathType ?? (isPrimary ? (mp?.bboxPathType ?? 'shortest') : 'shortest')
        for (let i = 0; i <= steps; i++) {
          const u = i / steps
          const pt = evaluateBboxTrajectoryAt(
            entStartPos,
            entTargetX,
            entTargetY,
            entStartZ,
            entTargetZ,
            entScaleRatio,
            u,
            pType,
            activeStroke
          )
          const pf = refD / Math.max(80, refD + pt.z)
          pathPts.push([
            shotLeft + shotScreenW / 2 + pt.x * pf * zoom,
            shotTop + shotScreenH / 2 - pt.y * pf * zoom
          ])
        }
      }

      const accentColor = ENT_ACCENTS[idx % ENT_ACCENTS.length]

      return {
        ent,
        idx,
        isPrimary,
        accentColor,
        entStartPos,
        entTargetX,
        entTargetY,
        entTargetScalePct,
        entScaleRatio,
        entStartZ,
        entTargetZ,
        pEnd,
        baseStageW,
        baseStageH,
        baseW,
        baseH,
        box1Cx,
        box1Cy,
        box2W,
        box2H,
        box2Cx,
        box2Cy,
        box2Left,
        box2Top,
        entRotZ,
        entRotY,
        entRotX,
        ghostImg,
        pathPts
      }
    })
  }, [
    connectedEntities,
    primaryEntity,
    tStart,
    motionNode?.id,
    sampleTime,
    refD,
    mp?.layerBboxTargets,
    mp?.bboxTargetX,
    mp?.bboxTargetY,
    mp?.bboxTargetScalePct,
    mp?.bboxTargetZ,
    mp?.bboxTargetRotZ,
    mp?.bboxTargetRotY,
    mp?.bboxTargetRotX,
    defaultTargetX,
    startPos,
    defaultTargetY,
    defaultTargetScalePct,
    depthMode,
    defaultTargetZ,
    shotLeft,
    shotScreenW,
    zoom,
    shotTop,
    shotScreenH,
    project.assets,
    hasBboxMotion,
    hasDrawnPath,
    drawnPathDelta,
    mp?.customMotionPath,
    mp?.bboxPathType
  ])

  const startBbox2DragForEntity = (
    e: React.PointerEvent,
    dragMode: 'move' | 'nw' | 'ne' | 'sw' | 'se',
    ent: (typeof connectedEntities)[0],
    entTargetX: number,
    entTargetY: number,
    entScalePct: number,
    entBaseStageW: number,
    entStartZ: number,
    entPFactorEnd: number
  ): void => {
    e.stopPropagation()
    e.preventDefault()
    if (!focusMotionForEdit(e)) return
    setPlaying(false)
    useEditor.getState().setTime(tStart)
    const sx = e.clientX
    const sy = e.clientY
    const origX = entTargetX
    const origY = entTargetY
    const origPct = entScalePct
    const safeZoom = Math.max(0.02, zoom)

    const onMove = (pev: PointerEvent): void => {
      const dxStage = (pev.clientX - sx) / safeZoom
      const dyStage = (pev.clientY - sy) / safeZoom
      const isPrimary = !primaryEntity || ent.id === primaryEntity.id
      if (dragMode === 'move') {
        const nx = Math.round(origX + dxStage / entPFactorEnd)
        const ny = Math.round(origY - dyStage / entPFactorEnd)
        if (hasDrawnPath && mp?.customMotionPath && mp.customMotionPath.length >= 2) {
          const entOrigin = bboxStartPosition(ent.rootLayer, tStart, motionNode?.id)
          const nextPath = retargetDrawnPathEndpoint(
            mp.customMotionPath,
            [nx - entOrigin[0], ny - entOrigin[1]],
            project.comp.width || 1920,
            project.comp.height || 1080,
            mp.intensity ?? 1
          )
          patchMotionNode(
            {
              customMotionPath: nextPath,
              bboxTargetX: Math.round(nx - entOrigin[0]),
              bboxTargetY: Math.round(ny - entOrigin[1])
            },
            'wf-path-target-move'
          )
          return
        }
        const existing = mp?.layerBboxTargets ?? {}
        const cur = existing[ent.id]
        const updatedTargets = {
          ...existing,
          [ent.id]: {
            ...(cur ?? {}),
            targetX: nx,
            targetY: ny,
            targetScalePct: cur?.targetScalePct ?? origPct,
            targetZ: cur?.targetZ ?? entStartZ
          }
        }
        patchMotionNode(
          {
            layerBboxTargets: updatedTargets,
            ...(isPrimary ? { bboxTargetX: nx, bboxTargetY: ny } : {})
          },
          'wf-bbox2-move'
        )
      } else {
        const signX = dragMode === 'ne' || dragMode === 'se' ? 1 : -1
        const signY = dragMode === 'sw' || dragMode === 'se' ? 1 : -1
        const delta = (dxStage * signX + dyStage * signY) * 0.5
        const ratio = Math.max(
          0.2,
          Math.min(3.5, (entBaseStageW * (origPct / 100) + delta * 2) / Math.max(16, entBaseStageW))
        )
        const nextPct = Math.round(ratio * 100)
        const autoZ =
          depthMode === 'depth_z' && !mp?.depthRefLayerId
            ? Math.round(entStartZ - (ratio - 1) * 180)
            : mp?.bboxTargetZ
        const existing = mp?.layerBboxTargets ?? {}
        const cur = existing[ent.id]
        const updatedTargets = {
          ...existing,
          [ent.id]: {
            ...(cur ?? {}),
            targetX: cur?.targetX ?? entTargetX,
            targetY: cur?.targetY ?? entTargetY,
            targetScalePct: nextPct,
            targetZ: autoZ ?? cur?.targetZ ?? entStartZ
          }
        }
        patchMotionNode(
          {
            layerBboxTargets: updatedTargets,
            ...(isPrimary
              ? { bboxTargetScalePct: nextPct, ...(autoZ !== undefined ? { bboxTargetZ: autoZ } : {}) }
              : {})
          },
          'wf-bbox2-scale'
        )
      }
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const patchBboxRotation = (entId: string, rotZ: number, rotY: number, rotX: number): void => {
    const isPrimary = !primaryEntity || entId === primaryEntity?.id
    const existing = mp?.layerBboxTargets ?? {}
    const cur = existing[entId]
    const updatedTargets = {
      ...existing,
      [entId]: {
        ...(cur ?? {}),
        targetX: cur?.targetX ?? defaultTargetX,
        targetY: cur?.targetY ?? defaultTargetY,
        targetScalePct: cur?.targetScalePct ?? defaultTargetScalePct,
        targetZ: cur?.targetZ ?? defaultStartZ,
        targetRotZ: rotZ,
        targetRotY: rotY,
        targetRotX: rotX
      }
    }
    patchMotionNode({
      layerBboxTargets: updatedTargets,
      ...(isPrimary ? {
        bboxTargetRotZ: rotZ,
        bboxTargetRotY: rotY,
        bboxTargetRotX: rotX
      } : {})
    }, 'wf-bbox-rot')
  }

  const primaryItem = renderedEntities.find((i) => i.isPrimary) ?? renderedEntities[0]
  const isMultiEntity = renderedEntities.length > 1
  const [localFocusedId, setLocalFocusedId] = useState<string | null>(null)
  const focusedEntityId = useMemo(() => {
    if (!isMultiEntity) return renderedEntities[0]?.ent.id
    if (localFocusedId && renderedEntities.some((r) => r.ent.id === localFocusedId)) {
      return localFocusedId
    }
    const paramTarget = mp?.activeMotionTargetEntityId
    if (paramTarget && paramTarget !== 'all' && renderedEntities.some((r) => r.ent.id === paramTarget)) {
      return paramTarget
    }
    return primaryEntity?.id ?? renderedEntities[0]?.ent.id
  }, [isMultiEntity, localFocusedId, mp?.activeMotionTargetEntityId, primaryEntity?.id, renderedEntities])

  // Đảm bảo entity đang focus luôn được render sau cùng trong DOM để nằm trên cùng, không bị layer to hơn che khuất
  const displayEntities = useMemo(() => {
    if (!isMultiEntity) return renderedEntities
    return [...renderedEntities].sort((a, b) => {
      if (a.ent.id === focusedEntityId) return 1
      if (b.ent.id === focusedEntityId) return -1
      return 0
    })
  }, [renderedEntities, isMultiEntity, focusedEntityId])

  const focusedItem = renderedEntities.find((i) => i.ent.id === focusedEntityId) ?? primaryItem ?? renderedEntities[0]
  const focusedCustomTarget = focusedEntityId ? mp?.layerBboxTargets?.[focusedEntityId] : undefined
  const isFocusedPrimary = !focusedEntityId || focusedEntityId === primaryEntity?.id

  const activeParamsForTools: WorkflowNodeParams = useMemo(() => {
    if (!hasBboxMotion) {
      return {
        ...(mp ?? {}),
        customMotionPath: mp?.customMotionPath
      }
    }
    return {
      ...(mp ?? {}),
      bboxPathType:
        focusedCustomTarget?.bboxPathType ?? (isFocusedPrimary ? (mp?.bboxPathType ?? 'shortest') : 'shortest'),
      customMotionPath:
        focusedCustomTarget?.customMotionPath !== undefined
          ? focusedCustomTarget.customMotionPath
          : isFocusedPrimary
            ? mp?.customMotionPath
            : undefined
    }
  }, [hasBboxMotion, mp, focusedCustomTarget, isFocusedPrimary])

  const patchMotionForTools = useCallback(
    (patch: Partial<WorkflowNodeParams>, mergeKey = 'wf-stage-bbox2'): void => {
      if (!motionNode) return
      const effMode = patch.motionMode ?? resolveMotionMode(mp ?? {})
      if (patch.motionMode === 'bbox' && mp?.motionMode !== 'bbox') {
        patchMotionNode(
          {
            ...patch,
            bboxTargetX: patch.bboxTargetX ?? mp?.bboxTargetX ?? defaultTargetX,
            bboxTargetY: patch.bboxTargetY ?? mp?.bboxTargetY ?? defaultTargetY,
            bboxTargetScalePct: patch.bboxTargetScalePct ?? mp?.bboxTargetScalePct ?? defaultTargetScalePct,
            bboxStartZ: patch.bboxStartZ ?? mp?.bboxStartZ ?? defaultStartZ,
            bboxTargetZ: patch.bboxTargetZ ?? mp?.bboxTargetZ ?? defaultStartZ
          },
          mergeKey
        )
        return
      }
      if (effMode === 'bbox' && (patch.customMotionPath !== undefined || patch.bboxPathType !== undefined)) {
        const existing = mp?.layerBboxTargets ?? {}
        const curFocusedId = focusedEntityId ?? primaryEntity?.id
        const curTarget: Partial<LayerBboxTargetConfig> = (curFocusedId ? existing[curFocusedId] : undefined) ?? {}
        const nextPathType = patch.bboxPathType ?? curTarget.bboxPathType ?? mp?.bboxPathType ?? 'shortest'
        const nextCustomPath = patch.customMotionPath !== undefined ? patch.customMotionPath : curTarget.customMotionPath

        if (curFocusedId) {
          const updatedTargets = {
            ...existing,
            [curFocusedId]: {
              ...curTarget,
              targetX: curTarget.targetX ?? focusedItem?.entTargetX ?? defaultTargetX,
              targetY: curTarget.targetY ?? focusedItem?.entTargetY ?? defaultTargetY,
              targetScalePct: curTarget.targetScalePct ?? focusedItem?.entTargetScalePct ?? defaultTargetScalePct,
              targetZ: curTarget.targetZ ?? focusedItem?.entTargetZ ?? defaultStartZ,
              bboxPathType: nextPathType,
              customMotionPath: nextCustomPath
            }
          }
          patchMotionNode({
            layerBboxTargets: updatedTargets,
            ...(isFocusedPrimary ? patch : {})
          }, mergeKey)
          return
        }
      }
      patchMotionNode(patch, mergeKey)
    },
    [motionNode, mp, focusedEntityId, primaryEntity?.id, isFocusedPrimary, focusedItem, defaultTargetX, defaultTargetY, defaultTargetScalePct, defaultStartZ, patchMotionNode]
  )

  if (!selectedProjLayer || !coordRefLayer) return null

  return (
    <>
      {motionNode?.id === node.id && (hasBboxMotion || resolveMotionMode(mp ?? {}) === 'path') && (
        <WorkflowMotionStageTools
          toolbarHost={toolbarHost}
          mode={hasBboxMotion ? 'bbox' : 'path'}
          nodeId={node.id}
          params={activeParamsForTools}
          width={stageW}
          height={stageH}
          zoom={zoom}
          perspective={pFactorStart}
          start={[focusedItem?.box1Cx ?? 0, focusedItem?.box1Cy ?? 0]}
          end={[focusedItem?.box2Cx ?? 0, focusedItem?.box2Cy ?? 0]}
          path={coordRefLayer.transform.position.keyframes
            .filter((k) => k.id.includes(`-motpath-p-${node.id}-`) && !k.id.endsWith('-pre'))
            .map((k) => {
              const pf = refD / Math.max(80, refD + k.value[2])
              return [
                shotLeft + shotScreenW / 2 + k.value[0] * pf * zoom,
                shotTop + shotScreenH / 2 - k.value[1] * pf * zoom
              ]
            })}
          patch={patchMotionForTools}
        />
      )}
      {!motionNode && node.type === 'layer_assembly' && !node.params?.logicCategory && (
        <div className="wf-motion-stage-tools">
          <StudioTooltip
            title="Thêm Motion BBox Đích"
            badge="BBox #1→#2"
            badgeTone="cyan"
            description="Gắn Node chuyển động kéo BBox Đầu → Đích trực tiếp trên khung"
            placement="left"
          >
            <button
              type="button"
              aria-label="Thêm Motion BBox đích"
              onClick={handleSpawnOrEnableBbox2}
            >
              <WorkflowMotionIcon name="target" />
            </button>
          </StudioTooltip>
        </div>
      )}

      {/* Đường nối đầu -> đích kèm Chốt kéo uốn đường cong trực tiếp cho từng Layer/Cụm */}
      {hasBboxMotion && (
        <WorkflowBboxTrajectorySvg
          stageW={stageW}
          stageH={stageH}
          items={renderedEntities.map((item) => {
            const customTarget = mp?.layerBboxTargets?.[item.ent.id]
            const pType =
              customTarget?.bboxPathType ?? (item.isPrimary ? (mp?.bboxPathType ?? 'shortest') : 'shortest')
            const cPath =
              customTarget?.customMotionPath !== undefined
                ? customTarget.customMotionPath
                : item.isPrimary
                  ? mp?.customMotionPath
                  : undefined
            return {
              id: item.ent.id,
              accentColor: item.accentColor,
              box1Cx: item.box1Cx,
              box1Cy: item.box1Cy,
              box2Cx: item.box2Cx,
              box2Cy: item.box2Cy,
              pathPts: item.pathPts,
              hasCustomCurve: pType === 'custom_curve' && Boolean(cPath && cPath.length >= 2)
            }
          })}
          focusedEntityId={focusedEntityId}
          isMultiEntity={isMultiEntity}
          tStart={tStart}
          onBendCurve={(nextPath) =>
            patchMotionForTools(
              { bboxPathType: 'custom_curve', customMotionPath: nextPath },
              'wf-stage-curve-handle'
            )
          }
          onResetStraight={() =>
            patchMotionForTools(
              { bboxPathType: 'shortest', customMotionPath: [] },
              'wf-stage-curve-reset'
            )
          }
        />
      )}

      {/* Khung BBox #1 (Xuất phát — màu lục bảo tham chiếu tinh gọn, không lẫn với khung Đích) */}
      {showTargetBbox &&
        displayEntities.map((item) => {
          const isFocused = !isMultiEntity || item.ent.id === focusedEntityId
          const shortName = item.ent.name.length > 11 ? `${item.ent.name.slice(0, 9)}…` : item.ent.name
          const isNearTarget = Math.hypot(item.box2Cx - item.box1Cx, item.box2Cy - item.box1Cy) < 45
          const box1Left = item.box1Cx - item.baseW / 2
          const box1Top = item.box1Cy - item.baseH / 2
          const stepNo = bboxStepNumber(workflow, motionNode?.id ?? node.id)

          return (
            <div
              key={`start-bbox-${item.ent.id}`}
              data-scene-layer-id={item.ent.rootLayer.id}
              data-scene-layer-name={item.ent.name}
              data-cluster-id={item.ent.isCluster ? item.ent.id : undefined}
              data-bbox-scope={item.ent.isCluster ? 'cluster' : 'layer'}
              data-bbox-role="motion_start"
              data-bbox-focused={isFocused ? 'true' : undefined}
              data-workflow-node-id={motionNode?.id ?? node.id}
              className={`wf-v2-direct-layer-bbox is-start-bbox${isFocused ? ' is-focused is-locked-start' : ' is-silhouette'}`}
              style={{
                pointerEvents: isFocused ? 'none' : 'auto',
                left: box1Left,
                top: box1Top,
                width: item.baseW,
                height: item.baseH,
                border: isFocused
                  ? '1.5px dashed rgba(16, 185, 129, 0.82)'
                  : '1px dashed rgba(16, 185, 129, 0.32)',
                background: isFocused ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                boxShadow: 'none',
                opacity: isFocused ? 0.9 : 0.35,
                zIndex: isFocused ? 28 : 18,
                cursor: isFocused ? 'default' : 'pointer',
                ['--wf-v2-accent' as string]: '#10b981'
              }}
              title={
                isFocused
                  ? `Vị trí xuất phát #${stepNo} của "${item.ent.name}"`
                  : `Vị trí xuất phát #${stepNo} của "${item.ent.name}" — Nhấp để chọn BBox này`
              }
              onPointerDown={(e) => {
                if (!isFocused && e.button === 0) {
                  e.stopPropagation()
                  setLocalFocusedId(item.ent.id)
                  patchMotionNode({ activeMotionTargetEntityId: item.ent.id }, 'wf-stage-focus-bbox')
                }
              }}
            >
              {isFocused && (
                <span
                  className="wf-v2-direct-bbox-tag is-origin"
                  title={item.ent.name}
                  style={{
                    top: isNearTarget ? 'auto' : box1Top < 20 ? 3 : -20,
                    bottom: isNearTarget ? -20 : 'auto',
                    left: 0,
                    maxWidth: 118,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#ecfdf5',
                    border: '1px solid rgba(16, 185, 129, 0.68)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)'
                  }}
                >
                  #{stepNo} Đầu{isMultiEntity ? ` · ${shortName}` : ''}
                </span>
              )}
            </div>
          )
        })}

      {/* Khung BBox #2 (Đích — hiện cả ở chế độ BBox lẫn ngay sau khi Vẽ quỹ đạo tự do xong để chỉnh Scale & Xoay) */}
      {showTargetBbox &&
        displayEntities.map((item) => {
          const isFocused = !isMultiEntity || item.ent.id === focusedEntityId
          const shortName = item.ent.name.length > 11 ? `${item.ent.name.slice(0, 9)}…` : item.ent.name
          const stepNo = bboxStepNumber(workflow, motionNode?.id ?? node.id)

          return (
            <div
              key={`ghost-${item.ent.id}`}
              className={`wf-v2-direct-layer-bbox is-ghost-target${isFocused ? ' is-focused' : ' is-silhouette'}`}
              data-mcp-region="workflow_motion_ghost"
              data-scene-layer-id={item.ent.rootLayer.id}
              data-scene-layer-name={item.ent.name}
              data-cluster-id={item.ent.isCluster ? item.ent.id : undefined}
              data-bbox-scope={item.ent.isCluster ? 'cluster' : 'layer'}
              data-bbox-role="motion_target"
              data-bbox-focused={isFocused ? 'true' : undefined}
              data-workflow-node-id={motionNode?.id ?? node.id}
              style={{
                pointerEvents: 'auto',
                left: item.box2Left,
                top: item.box2Top,
                width: item.box2W,
                height: item.box2H,
                border: isFocused
                  ? `1.5px solid ${item.accentColor}`
                  : `1px dashed color-mix(in srgb, ${item.accentColor} 42%, transparent)`,
                background: isFocused
                  ? `color-mix(in srgb, ${item.accentColor} 8%, transparent)`
                  : `color-mix(in srgb, ${item.accentColor} 2%, transparent)`,
                boxShadow: isFocused
                  ? `0 0 0 1px rgba(15, 23, 42, 0.55), 0 8px 22px color-mix(in srgb, ${item.accentColor} 26%, transparent)`
                  : 'none',
                zIndex: isFocused ? 35 : 25,
                cursor: isFocused ? 'move' : 'pointer',
                transform: `rotateZ(${item.entRotZ}deg) rotateY(${item.entRotY}deg) rotateX(${item.entRotX}deg)`,
                transformOrigin: '50% 50%',
                ['--wf-v2-accent' as string]: item.accentColor
              }}
              title={
                isFocused
                  ? `BBox đích đang chọn: "${item.ent.name}" (${item.entTargetScalePct}%) — Kéo để đặt vị trí, kéo 4 góc để đổi kích thước`
                  : `Bóng mờ BBox đích của "${item.ent.name}" — Nhấp để chọn và di chuyển BBox này`
              }
              onPointerDown={(e) => {
                if (e.button === 0) {
                  if (motionNode && motionNode.id !== node.id) {
                    onSelectNode?.(motionNode.id)
                  }
                  if (!isFocused) {
                    setLocalFocusedId(item.ent.id)
                    patchMotionNode({ activeMotionTargetEntityId: item.ent.id }, 'wf-stage-focus-bbox')
                  }
                  startBbox2DragForEntity(
                    e,
                    'move',
                    item.ent,
                    item.entTargetX,
                    item.entTargetY,
                    item.entTargetScalePct,
                    item.baseStageW,
                    item.entStartZ,
                    item.pEnd
                  )
                }
              }}
            >
              {item.ent.isCluster && item.ent.projLayer && item.ent.parts ? (
                <WorkflowClusterGhost parts={item.ent.parts} bounds={item.ent.projLayer} project={project} opacity={isFocused ? 0.52 : 0.28} />
              ) : item.ghostImg && (
                <img
                  src={item.ghostImg}
                  alt={`Ghost Target ${item.ent.name}`}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: isFocused ? 0.52 : 0.28,
                    filter: isFocused
                      ? `drop-shadow(0 0 8px ${item.accentColor})`
                      : `grayscale(25%) drop-shadow(0 0 3px color-mix(in srgb, ${item.accentColor} 35%, transparent))`,
                    pointerEvents: 'none'
                  }}
                />
              )}

              {/* Tag nhãn đích sắc nét kèm % tỉ lệ đích */}
              {isFocused && (
                <span
                  className="wf-v2-direct-bbox-tag is-target"
                  title={item.ent.name}
                  style={{
                    top: item.box2Top < 20 ? 3 : -20,
                    right: 0,
                    left: 'auto',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '1px 7px',
                    borderRadius: 4,
                    background: `color-mix(in srgb, ${item.accentColor} 82%, #0f172a)`,
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.42)',
                    border: `1px solid color-mix(in srgb, ${item.accentColor} 55%, #ffffff)`
                  }}
                >
                  #{stepNo + 1} Đích · {item.entTargetScalePct}%
                  {isMultiEntity ? ` · ${shortName}` : ''}
                </span>
              )}

              {/* Crosshair và 4 góc kéo kích thước CHỈ hiển thị khi BBox đang được focus */}
              {isFocused && <span className="wf-v2-direct-bbox-crosshair" />}
              {isFocused &&
                HANDLES.map((h) => (
                  <span
                    key={h.key}
                    className={`wf-v2-bbox-handle ${h.cls}`}
                    onPointerDown={(e) => {
                      if (motionNode && motionNode.id !== node.id) {
                        onSelectNode?.(motionNode.id)
                      }
                      startBbox2DragForEntity(
                        e,
                        h.key,
                        item.ent,
                        item.entTargetX,
                        item.entTargetY,
                        item.entTargetScalePct,
                        item.baseStageW,
                        item.entStartZ,
                        item.pEnd
                      )
                    }}
                  />
                ))}
            </div>
          )
        })}

      {/* Vòng xoay Gimbal 3D trực quan khi bật chế độ bboxRotateGimbal (cả ở BBox lẫn Quỹ đạo tự do) */}
      {showTargetBbox &&
        Boolean(mp?.bboxRotateGimbal) &&
        (() => {
          const focusedItem =
            renderedEntities.find((i) => !isMultiEntity || i.ent.id === focusedEntityId) ??
            primaryItem
          if (!focusedItem) return null
          return (
            <WorkflowV2BboxGimbal
              cx={focusedItem.box2Cx}
              cy={focusedItem.box2Cy}
              boxW={focusedItem.box2W}
              boxH={focusedItem.box2H}
              rotZ={focusedItem.entRotZ}
              rotY={focusedItem.entRotY}
              rotX={focusedItem.entRotX}
              zoom={zoom}
              accentColor={focusedItem.accentColor}
              onStartDrag={() => setPlaying(false)}
              onRotate={(rz, ry, rx) => {
                patchBboxRotation(focusedItem.ent.id, rz, ry, rx)
              }}
            />
          )
        })()}
    </>
  )
}
