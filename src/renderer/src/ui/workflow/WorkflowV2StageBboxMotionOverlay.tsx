import { WorkflowMotionStageTools } from './WorkflowMotionStageTools'
import { WorkflowMotionIcon } from './WorkflowMotionIcons'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import { useShiftToFocus } from './workflowFocusGuard'
import { bboxStartPosition, bboxStartScale } from '../../project/workflowMotionStart'
import { bboxStepNumber } from '../../project/workflowBboxSteps'
import React, { useCallback, useMemo } from 'react'
import type { ImageProps, Layer, Project, Vec3, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { assetStore } from '../../project/assets'
import {
  evaluateBboxTrajectoryAt
} from '../../project/workflowV2BboxMotionAndCollision'
import {
  attachLogicNodeToLayerV2,
  getClusterMemberLayers,
  getClusterRootLayer,
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

const HANDLES: { key: 'nw' | 'ne' | 'sw' | 'se'; cls: string }[] = [
  { key: 'nw', cls: 'nw' },
  { key: 'ne', cls: 'ne' },
  { key: 'sw', cls: 'sw' },
  { key: 'se', cls: 'se' }
]

/**
 * Tìm Node Motion (`action`) đang gắn với Node hiện tại (hoặc chính nó nếu đang chọn Node Motion).
 */
export function resolveActiveMotionNode(
  workflow: WorkflowGraph,
  node: WorkflowNode,
  repLayerId?: string,
  clusterInstId?: string
): WorkflowNode | undefined {
  if (node.params?.logicCategory === 'action' || (!node.params?.logicCategory && node.type === 'motion_choreography')) {
    return node
  }
  // Nếu đang chọn Node Va chạm, tìm Node Motion của Chủ thể A (strikerLayerId)
  const lookupLayerId =
    node.params?.logicCategory === 'collision'
      ? (node.params?.strikerLayerId ?? node.params?.targetLayerIds?.[0])
      : repLayerId

  return workflow.nodes.find((n) => {
    if (n.params?.logicCategory !== 'action' && (n.params?.logicCategory || n.type !== 'motion_choreography')) return false
    if (clusterInstId && n.params?.instanceId === clusterInstId) return true
    if (lookupLayerId && n.params?.targetLayerIds?.includes(lookupLayerId)) return true
    return workflow.edges.some((e) => !e.disabled && e.fromNode === node.id && e.toNode === n.id)
  })
}

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

  if (!selectedProjLayer || !coordRefLayer) return null

  const tStart = mp?.timeStart ?? coordRefLayer.inPoint ?? 0
  const tEnd = mp?.timeEnd ?? Number((tStart + 3).toFixed(2))
  const startPos: Vec3 = bboxStartPosition(coordRefLayer, tStart, motionNode?.id)
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
  const multiMode = mp?.bboxMultiMode ?? 'group_offset'

  // Tìm tất cả các Layer / Cụm kết nối vào Node Motion này
  const connectedEntities = useMemo(() => {
    const ids = new Set<string>()
    if (mp?.targetLayerIds?.length) {
      for (const id of mp.targetLayerIds) ids.add(id)
    }
    if (motionNode) {
      const inEdges = workflow.edges.filter((e) => e.toNode === motionNode.id && !e.disabled)
      for (const e of inEdges) {
        const srcNode = workflow.nodes.find((n) => n.id === e.fromNode)
        if (srcNode?.params?.targetLayerIds?.length) {
          for (const id of srcNode.params.targetLayerIds) ids.add(id)
        }
        if (srcNode?.params?.instanceId) {
          const members = getClusterMemberLayers(project, srcNode.params.instanceId)
          for (const m of members) ids.add(m.id)
        }
      }
    }
    if (coordRefLayer && !ids.has(coordRefLayer.id)) {
      ids.add(coordRefLayer.id)
    }

    const entityMap = new Map<
      string,
      {
        id: string
        rootLayer: Layer
        isCluster: boolean
        name: string
        projLayer?: ProjectedLayer2D
      }
    >()

    for (const lid of Array.from(ids)) {
      const l = project.layers.find((ly) => ly.id === lid)
      if (!l) continue
      const inst = l.composite?.instanceId ?? l.model3d?.instanceId
      if (inst) {
        if (!entityMap.has(inst)) {
          const members = getClusterMemberLayers(project, inst)
          const rootL = getClusterRootLayer(members) ?? members[0] ?? l
          const memberIds = new Set(members.map((m) => m.id))
          const memberProjs = layers2D?.filter((lp) => memberIds.has(lp.id)) ?? []
          let proj: ProjectedLayer2D | undefined
          if (memberProjs.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            for (const p of memberProjs) {
              minX = Math.min(minX, p.offsetX - p.width / 2)
              maxX = Math.max(maxX, p.offsetX + p.width / 2)
              minY = Math.min(minY, p.offsetY - p.height / 2)
              maxY = Math.max(maxY, p.offsetY + p.height / 2)
            }
            const baseP = memberProjs.find((p) => p.id === rootL.id) ?? memberProjs[0]
            proj = {
              ...baseP,
              name: rootL.name.replace(/\s*\(.*?\)\s*/g, '') || 'Cụm 2.5D',
              offsetX: (minX + maxX) / 2,
              offsetY: (minY + maxY) / 2,
              width: Math.max(24, maxX - minX),
              height: Math.max(24, maxY - minY)
            }
          }
          entityMap.set(inst, {
            id: inst,
            rootLayer: rootL,
            isCluster: true,
            name: rootL.name.replace(/\s*\(.*?\)\s*/g, '') || 'Cụm 2.5D',
            projLayer: proj ?? (rootL.id === coordRefLayer?.id ? selectedProjLayer : undefined)
          })
        }
      } else {
        if (!entityMap.has(l.id)) {
          const proj =
            layers2D?.find((p) => p.id === l.id) ??
            (l.id === coordRefLayer?.id ? selectedProjLayer : undefined)
          entityMap.set(l.id, {
            id: l.id,
            rootLayer: l,
            isCluster: false,
            name: l.name,
            projLayer: proj
          })
        }
      }
    }

    if (entityMap.size === 0 && coordRefLayer) {
      entityMap.set(coordRefLayer.id, {
        id: coordRefLayer.id,
        rootLayer: coordRefLayer,
        isCluster: false,
        name: coordRefLayer.name,
        projLayer: selectedProjLayer
      })
    }

    return Array.from(entityMap.values())
  }, [mp?.targetLayerIds, motionNode, workflow, project, coordRefLayer, layers2D, selectedProjLayer])

  const primaryEntity =
    connectedEntities.find((e) => e.rootLayer.id === coordRefLayer.id) ?? connectedEntities[0]

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
        (isPrimary || multiMode === 'converge_target'
          ? defaultTargetX
          : Math.round(defaultTargetX + (entStartPos[0] - startPos[0])))
      const entTargetY =
        customTarget?.targetY ??
        (isPrimary || multiMode === 'converge_target'
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

      const pEnd = refD / Math.max(80, refD + entTargetZ)
      const startOffX = entStartPos[0] * pStart
      const startOffY = -entStartPos[1] * pStart
      const entProjW = ent.projLayer?.width ?? (ent.rootLayer.props as ImageProps)?.width ?? 400
      const entProjH = ent.projLayer?.height ?? (ent.rootLayer.props as ImageProps)?.height ?? 300
      const baseStageW = Math.max(16, entProjW * ratioX)
      const baseStageH = Math.max(16, entProjH * ratioY)
      const baseW = Math.max(22, baseStageW * zoom)
      const baseH = Math.max(22, baseStageH * zoom)

      const box1Cx = shotLeft + shotScreenW / 2 + startOffX * zoom
      const box1Cy = shotTop + shotScreenH / 2 + startOffY * zoom
      const targetOffX = entTargetX * pEnd
      const targetOffY = -entTargetY * pEnd
      const box2W = Math.max(20, baseW * entScaleRatio)
      const box2H = Math.max(20, baseH * entScaleRatio)
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
        const activeStroke = mp?.customMotionPath
        const pType = mp?.bboxPathType ?? 'shortest'
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
    multiMode,
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

  const primaryItem = renderedEntities.find((i) => i.isPrimary) ?? renderedEntities[0]

  return (
    <>
      {motionNode?.id === node.id && (hasBboxMotion || resolveMotionMode(mp ?? {}) === 'path') && (
        <WorkflowMotionStageTools
          toolbarHost={toolbarHost}
          mode={hasBboxMotion ? 'bbox' : 'path'}
          nodeId={node.id}
          params={mp ?? {}}
          width={stageW}
          height={stageH}
          zoom={zoom}
          perspective={pFactorStart}
          start={[primaryItem?.box1Cx ?? 0, primaryItem?.box1Cy ?? 0]}
          path={coordRefLayer.transform.position.keyframes
            .filter((k) => k.id.includes(`-motpath-p-${node.id}-`) && !k.id.endsWith('-pre'))
            .map((k) => {
              const pf = refD / Math.max(80, refD + k.value[2])
              return [
                shotLeft + shotScreenW / 2 + k.value[0] * pf * zoom,
                shotTop + shotScreenH / 2 - k.value[1] * pf * zoom
              ]
            })}
          patch={patchMotionNode}
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
          {renderedEntities.map(
            (item) =>
              item.pathPts.length >= 2 && (
                <React.Fragment key={`svg-${item.ent.id}`}>
                  <polyline
                    fill="none"
                    stroke={item.accentColor}
                    strokeOpacity={0.28}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke={item.accentColor}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                  />
                  {[0.33, 0.66].map((uStep) => {
                    const pIdx = Math.min(
                      item.pathPts.length - 1,
                      Math.round(uStep * (item.pathPts.length - 1))
                    )
                    const [mx, my] = item.pathPts[pIdx]
                    const stepRatio = 1 + (item.entScaleRatio - 1) * uStep
                    const sw = Math.max(12, item.baseW * stepRatio)
                    const sh = Math.max(12, item.baseH * stepRatio)
                    return (
                      <rect
                        key={`step-${item.ent.id}-${uStep}`}
                        x={mx - sw / 2}
                        y={my - sh / 2}
                        width={sw}
                        height={sh}
                        rx={3}
                        fill="none"
                        stroke={item.accentColor}
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    )
                  })}
                  <circle
                    cx={item.box1Cx}
                    cy={item.box1Cy}
                    r={4.5}
                    fill="#10b981"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={item.box2Cx}
                    cy={item.box2Cy}
                    r={5}
                    fill={item.accentColor}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                </React.Fragment>
              )
          )}
        </svg>
      )}

      {/* Khung BBox đích dạng mờ (Ghost Target BBox) cho từng Layer/Cụm kết nối */}
      {hasBboxMotion &&
        renderedEntities.map((item) => (
          <div
            key={`ghost-${item.ent.id}`}
            className="wf-v2-direct-layer-bbox is-ghost-target"
            data-mcp-region="workflow_motion_ghost"
            style={{
              pointerEvents: motionNode?.id === node.id || shiftToFocus ? 'auto' : 'none',
              left: item.box2Left,
              top: item.box2Top,
              width: item.box2W,
              height: item.box2H,
              border: `1.5px dashed ${item.accentColor}`,
              background: `color-mix(in srgb, ${item.accentColor} 8%, transparent)`,
              boxShadow: `0 0 0 1px rgba(15, 23, 42, 0.55), 0 0 14px color-mix(in srgb, ${item.accentColor} 25%, transparent)`,
              zIndex: item.isPrimary ? 28 : 27,
              ['--wf-v2-accent' as string]: item.accentColor
            }}
            title={`BBox đích của "${item.ent.name}" (${item.entTargetScalePct}%) — Kéo để đặt vị trí, kéo 4 góc để đổi kích thước`}
            onPointerDown={(e) => {
              if (e.button === 0) {
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
            {item.ghostImg && (
              <img
                src={item.ghostImg}
                alt={`Ghost Target ${item.ent.name}`}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0.44,
                  filter: `drop-shadow(0 0 6px ${item.accentColor})`,
                  pointerEvents: 'none'
                }}
              />
            )}
            <span
              className="wf-v2-direct-bbox-tag"
              style={{
                top: item.box2Top < 18 ? 2 : -16,
                right: 0,
                left: 'auto',
                background: `color-mix(in srgb, ${item.accentColor} 82%, #0f172a)`,
                color: '#ffffff'
              }}
            >
              #{bboxStepNumber(workflow, motionNode?.id ?? node.id) + 1} Đích
              {renderedEntities.length > 1 ? ` · ${item.ent.name}` : ''}
            </span>
            <span className="wf-v2-direct-bbox-crosshair" />
            {HANDLES.map((h) => (
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
        ))}
    </>
  )
}
