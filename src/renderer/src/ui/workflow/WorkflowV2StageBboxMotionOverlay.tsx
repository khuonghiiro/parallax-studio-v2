import { resolveMotionEntities } from './workflowMotionEntities'
import { WorkflowClusterGhost } from './WorkflowClusterGhost'
import { WorkflowMotionStageTools } from './WorkflowMotionStageTools'
import { WorkflowMotionIcon } from './WorkflowMotionIcons'
import { WorkflowV2BboxGimbal } from './WorkflowV2BboxGimbal'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import { useShiftToFocus } from './workflowFocusGuard'
import { bboxStartPosition, bboxStartScale } from '../../project/workflowMotionStart'
import { bboxStepNumber } from '../../project/workflowBboxSteps'
import React, { useCallback, useMemo, useState } from 'react'
import type { ImageProps, Layer, LayerBboxTargetConfig, Project, Vec3, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { assetStore } from '../../project/assets'
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
  const shiftToFocus = useShiftToFocus()
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)
  const motionNode = resolveActiveMotionNode(workflow, node, coordRefLayer?.id, clusterInstId)
  const mp = motionNode?.params
  const hasBboxMotion = Boolean(
    motionNode &&
      resolveMotionMode(mp ?? {}) === 'bbox'
  )

  const focusMotionForEdit = (event: { shiftKey: boolean }): boolean => {
    if (!motionNode || motionNode.id === node.id) return true
    if (event.shiftKey) onSelectNode?.(motionNode.id)
    return false
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

  const ENT_ACCENTS = ['#f59e0b', '#38bdf8', '#10b981', '#ec4899', '#a855f7', '#f97316']

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
      const entTargetX =
        customTarget?.targetX ??
        (isPrimary
          ? defaultTargetX
          : Math.round(defaultTargetX + (entStartPos[0] - startPos[0])))
      const entTargetY =
        customTarget?.targetY ??
        (isPrimary
          ? defaultTargetY
          : Math.round(defaultTargetY + (entStartPos[1] - startPos[1])))
      const entTargetScalePct = customTarget?.targetScalePct ?? defaultTargetScalePct
      const entScaleRatio = Math.max(0.15, Math.min(4.0, entTargetScalePct / 100))
      const entStartZ = Math.round(entStartPos[2] ?? 0)
      const entTargetZ =
        customTarget?.targetZ ??
        (depthMode === 'depth_z'
          ? isPrimary
            ? defaultTargetZ
            : Math.round(entStartZ - (entScaleRatio - 1) * 180)
          : entStartZ)

      const entRotZ = customTarget?.targetRotZ ?? (isPrimary ? (mp?.bboxTargetRotZ ?? 0) : 0)
      const entRotY = customTarget?.targetRotY ?? (isPrimary ? (mp?.bboxTargetRotY ?? 0) : 0)
      const entRotX = customTarget?.targetRotX ?? (isPrimary ? (mp?.bboxTargetRotX ?? 0) : 0)

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
        const steps = 24
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
    const sx = e.clientX
    const sy = e.clientY
    const origX = entTargetX
    const origY = entTargetY
    const origPct = entScalePct
    const safeZoom = Math.max(0.02, zoom)

    const onMove = (pev: PointerEvent): void => {
      const dxStage = (pev.clientX - sx) / safeZoom
      const dyStage = (pev.clientY - sy) / safeZoom
      if (dragMode === 'move') {
        const nx = Math.round(origX + dxStage / entPFactorEnd)
        const ny = Math.round(origY - dyStage / entPFactorEnd)
        if (connectedEntities.length === 1) {
          patchMotionNode({ bboxTargetX: nx, bboxTargetY: ny }, 'wf-bbox2-move')
        } else {
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
          const isPrimary = ent.id === primaryEntity?.id
          patchMotionNode(
            {
              layerBboxTargets: updatedTargets,
              ...(isPrimary ? { bboxTargetX: nx, bboxTargetY: ny } : {})
            },
            'wf-bbox2-move'
          )
        }
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
        if (connectedEntities.length === 1) {
          patchMotionNode(
            {
              bboxTargetScalePct: nextPct,
              ...(autoZ !== undefined ? { bboxTargetZ: autoZ } : {})
            },
            'wf-bbox2-scale'
          )
        } else {
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
          const isPrimary = ent.id === primaryEntity?.id
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
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const patchBboxRotation = (entId: string, rotZ: number, rotY: number, rotX: number): void => {
    if (connectedEntities.length === 1) {
      patchMotionNode({
        bboxTargetRotZ: rotZ,
        bboxTargetRotY: rotY,
        bboxTargetRotX: rotX
      }, 'wf-bbox-rot')
    } else {
      const existing = mp?.layerBboxTargets ?? {}
      const cur = existing[entId]
      const isPrimary = entId === primaryEntity?.id
      patchMotionNode({
        layerBboxTargets: {
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
        },
        ...(isPrimary ? {
          bboxTargetRotZ: rotZ,
          bboxTargetRotY: rotY,
          bboxTargetRotX: rotX
        } : {})
      }, 'wf-bbox-rot')
    }
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

  const activeParamsForTools: WorkflowNodeParams = useMemo(() => ({
    ...(mp ?? {}),
    bboxPathType: focusedCustomTarget?.bboxPathType ?? (isFocusedPrimary ? (mp?.bboxPathType ?? 'shortest') : 'shortest'),
    customMotionPath: focusedCustomTarget?.customMotionPath !== undefined
      ? focusedCustomTarget.customMotionPath
      : (isFocusedPrimary ? mp?.customMotionPath : undefined)
  }), [mp, focusedCustomTarget, isFocusedPrimary])

  const patchMotionForTools = useCallback(
    (patch: Partial<WorkflowNodeParams>, mergeKey = 'wf-stage-bbox2'): void => {
      if (!motionNode) return
      if (patch.customMotionPath !== undefined || patch.bboxPathType !== undefined) {
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
          <button
            type="button"
            title="Thêm Motion BBox đích"
            aria-label="Thêm Motion BBox đích"
            onClick={handleSpawnOrEnableBbox2}
          >
            <WorkflowMotionIcon name="target" />
          </button>
        </div>
      )}

      {/* Đường nối đầu -> đích và điểm va chạm trên SVG cho từng Layer/Cụm kết nối */}
      {hasBboxMotion && (
        <svg
          className="wf-v2-direct-cam-svg"
          width={stageW}
          height={stageH}
          style={{ zIndex: 24, pointerEvents: 'none' }}
        >
          {renderedEntities.map((item) => {
            if (item.pathPts.length < 2) return null
            const isFocused = !isMultiEntity || item.ent.id === focusedEntityId
            return (
              <React.Fragment key={`svg-${item.ent.id}`}>
                <polyline
                  fill="none"
                  stroke={item.accentColor}
                  strokeOpacity={isFocused ? 0.28 : 0.08}
                  strokeWidth={isFocused ? 5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke={item.accentColor}
                  strokeWidth={isFocused ? 2 : 1}
                  strokeOpacity={isFocused ? 1 : 0.3}
                  strokeDasharray={isFocused ? '5 3' : '3 3'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                />
                <circle
                  cx={item.box1Cx}
                  cy={item.box1Cy}
                  r={isFocused ? 4.5 : 3}
                  fill="#10b981"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  opacity={isFocused ? 1 : 0.45}
                />
                <circle
                  cx={item.box2Cx}
                  cy={item.box2Cy}
                  r={isFocused ? 5 : 3.5}
                  fill={item.accentColor}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  opacity={isFocused ? 1 : 0.45}
                />
              </React.Fragment>
            )
          })}
        </svg>
      )}

      {/* Khung BBox #1 (Đầu) cho từng Layer/Cụm kết nối. CHỈ hiện title khi active (isFocused)! */}
      {hasBboxMotion &&
        displayEntities.map((item) => {
          const isFocused = !isMultiEntity || item.ent.id === focusedEntityId
          const shortName = item.ent.name.length > 11 ? `${item.ent.name.slice(0, 9)}…` : item.ent.name
          const isNearTarget = Math.hypot(item.box2Cx - item.box1Cx, item.box2Cy - item.box1Cy) < 45
          const box1Left = item.box1Cx - item.baseW / 2
          const box1Top = item.box1Cy - item.baseH / 2

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
                  ? `1.5px dashed ${item.accentColor}`
                  : `1px dashed color-mix(in srgb, ${item.accentColor} 30%, transparent)`,
                background: isFocused
                  ? `color-mix(in srgb, ${item.accentColor} 4%, transparent)`
                  : 'transparent',
                opacity: isFocused ? 0.78 : 0.35,
                zIndex: isFocused ? 28 : 18,
                cursor: isFocused ? 'default' : 'pointer',
                ['--wf-v2-accent' as string]: item.accentColor
              }}
              title={
                isFocused
                  ? `Vị trí xuất phát BBox #1 của "${item.ent.name}" (Cố định)`
                  : `Vị trí xuất phát BBox #1 của "${item.ent.name}" — Nhấp để chọn BBox này`
              }
              onPointerDown={(e) => {
                if (!isFocused && e.button === 0) {
                  e.stopPropagation()
                  setLocalFocusedId(item.ent.id)
                  patchMotionNode({ activeMotionTargetEntityId: item.ent.id }, 'wf-stage-focus-bbox')
                }
              }}
            >
              {/* CHỈ hiện title ở BBox đầu KHI active (isFocused)! Không active thì ẩn title đi cho đỡ rối */}
              {isFocused && (
                <span
                  className="wf-v2-direct-bbox-tag"
                  title={item.ent.name}
                  style={{
                    top: isNearTarget ? 'auto' : box1Top < 18 ? 2 : -17,
                    bottom: isNearTarget ? -17 : 'auto',
                    left: 0,
                    maxWidth: 125,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: `color-mix(in srgb, ${item.accentColor} 75%, #0f172a)`,
                    color: '#ffffff',
                    border: `1px solid color-mix(in srgb, ${item.accentColor} 45%, #ffffff)`
                  }}
                >
                  #{bboxStepNumber(workflow, motionNode?.id ?? node.id)} Đầu (Cố định)
                  {isMultiEntity ? ` · ${shortName}` : ''}
                </span>
              )}
              {isFocused && <span className="wf-v2-direct-bbox-crosshair" />}
            </div>
          )
        })}

      {/* Khung BBox đích cho từng Layer/Cụm kết nối. Dùng displayEntities để entity được focus luôn render sau cùng, nằm trên cùng */}
      {hasBboxMotion &&
        displayEntities.map((item) => {
          const isFocused = !isMultiEntity || item.ent.id === focusedEntityId
          const shortName = item.ent.name.length > 11 ? `${item.ent.name.slice(0, 9)}…` : item.ent.name

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
                pointerEvents: motionNode?.id === node.id || shiftToFocus ? 'auto' : 'none',
                left: item.box2Left,
                top: item.box2Top,
                width: item.box2W,
                height: item.box2H,
                border: isFocused
                  ? `2px dashed ${item.accentColor}`
                  : `1px dashed color-mix(in srgb, ${item.accentColor} 40%, transparent)`,
                background: isFocused
                  ? `color-mix(in srgb, ${item.accentColor} 10%, transparent)`
                  : `color-mix(in srgb, ${item.accentColor} 3%, transparent)`,
                boxShadow: isFocused
                  ? `0 0 0 1px rgba(15, 23, 42, 0.65), 0 0 16px color-mix(in srgb, ${item.accentColor} 40%, transparent)`
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

              {/* Tag nhãn: CHỈ hiện khi BBox ĐÍCH active (isFocused)! Không active thì ẩn title đi cho đỡ rối */}
              {isFocused && (
                <span
                  className="wf-v2-direct-bbox-tag"
                  title={item.ent.name}
                  style={{
                    top: item.box2Top < 18 ? 2 : -17,
                    right: 0,
                    left: 'auto',
                    maxWidth: 125,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: `color-mix(in srgb, ${item.accentColor} 84%, #0f172a)`,
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    border: `1px solid color-mix(in srgb, ${item.accentColor} 50%, #ffffff)`
                  }}
                >
                  #{bboxStepNumber(workflow, motionNode?.id ?? node.id) + 1} Đích
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
                    onPointerDown={(e) =>
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
                    }
                  />
                ))}
            </div>
          )
        })}

      {/* Vòng xoay Gimbal 3D trực quan khi bật chế độ bboxRotateGimbal */}
      {hasBboxMotion &&
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
