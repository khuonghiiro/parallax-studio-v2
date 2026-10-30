import { WorkflowMotionStageTools } from './WorkflowMotionStageTools'
import { WorkflowMotionIcon } from './WorkflowMotionIcons'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import { useShiftToFocus } from './workflowFocusGuard'
import { bboxStartPosition, bboxStartScale } from '../../project/workflowMotionStart'
import { bboxStepNumber } from '../../project/workflowBboxSteps'
import React, { useCallback } from 'react'
import type { Layer, Project, Vec3, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
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
  project: Project
  workflow: WorkflowGraph
  node: WorkflowNode
  selectedProjLayer?: ProjectedLayer2D
  coordRefLayer?: Layer
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
  project,
  workflow,
  node,
  selectedProjLayer,
  coordRefLayer,
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
  // Đọc vị trí gốc đầu tại tStart (bỏ qua keyframe đã bake để BBox đầu và đích không bị nhân kép tỷ lệ khi tua tới tEnd)
  const startPos: Vec3 = bboxStartPosition(coordRefLayer, tStart, motionNode?.id)
  const startCleanScale: Vec3 = bboxStartScale(coordRefLayer, tStart, motionNode?.id)
  const curEvalScale: Vec3 = evaluate(coordRefLayer.transform.scale, sampleTime)
  const unbakedRatioX = Math.abs(startCleanScale[0] || 1) / Math.max(0.05, Math.abs(curEvalScale[0] || 1))
  const unbakedRatioY = Math.abs(startCleanScale[1] || 1) / Math.max(0.05, Math.abs(curEvalScale[1] || 1))
  const refD = 1483.64
  const pFactorStart = refD / Math.max(80, refD + (startPos[2] ?? 0))

  const targetX = mp?.bboxTargetX ?? Math.round(startPos[0] + 280)
  const targetY = mp?.bboxTargetY ?? Math.round(startPos[1])
  const targetScalePct = mp?.bboxTargetScalePct ?? 135
  const scaleRatio = Math.max(0.15, Math.min(4.0, targetScalePct / 100))
  const depthMode = mp?.depthMode ?? 'flat_2d'
  const startZ = mp?.bboxStartZ ?? Math.round(startPos[2] ?? 0)
  const targetZ =
    depthMode === 'depth_z'
      ? (mp?.bboxTargetZ ?? Math.round(startZ - (scaleRatio - 1) * 180))
      : startZ

  // Tọa độ màn hình của BBox đầu (Xuất phát)
  const startOffsetX = startPos[0] * pFactorStart
  const startOffsetY = -startPos[1] * pFactorStart
  const baseStageW = Math.max(16, selectedProjLayer.width * unbakedRatioX)
  const baseStageH = Math.max(16, selectedProjLayer.height * unbakedRatioY)
  const baseW = Math.max(22, baseStageW * zoom)
  const baseH = Math.max(22, baseStageH * zoom)
  const box1Cx = shotLeft + shotScreenW / 2 + startOffsetX * zoom
  const box1Cy = shotTop + shotScreenH / 2 + startOffsetY * zoom

  // Tọa độ màn hình của Ghost BBox đích (Đích)
  const pFactorEnd = refD / Math.max(80, refD + targetZ)
  const targetOffsetX = targetX * pFactorEnd
  const targetOffsetY = -targetY * pFactorEnd
  const box2W = Math.max(20, baseW * scaleRatio)
  const box2H = Math.max(20, baseH * scaleRatio)
  const box2Cx = shotLeft + shotScreenW / 2 + targetOffsetX * zoom
  const box2Cy = shotTop + shotScreenH / 2 + targetOffsetY * zoom
  const box2Left = box2Cx - box2W / 2
  const box2Top = box2Cy - box2H / 2

  const runtimeAsset = selectedProjLayer.assetId ? assetStore.get(selectedProjLayer.assetId) : undefined
  const projAsset = selectedProjLayer.assetId
    ? project.assets.find((a) => a.id === selectedProjLayer.assetId)
    : undefined
  const ghostImgUrl =
    runtimeAsset?.url || runtimeAsset?.thumbUrl || projAsset?.dataUrl || projAsset?.path

  const startBbox2Drag = (
    e: React.PointerEvent,
    dragMode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ): void => {
    e.stopPropagation()
    e.preventDefault()
    if (!focusMotionForEdit(e)) return
    setPlaying(false)
    const sx = e.clientX
    const sy = e.clientY
    const origX = targetX
    const origY = targetY
    const origPct = targetScalePct
    const safeZoom = Math.max(0.02, zoom)

    const onMove = (pev: PointerEvent): void => {
      const dxStage = (pev.clientX - sx) / safeZoom
      const dyStage = (pev.clientY - sy) / safeZoom
      if (dragMode === 'move') {
        const nx = Math.round(origX + dxStage / pFactorEnd)
        const ny = Math.round(origY - dyStage / pFactorEnd)
        patchMotionNode({ bboxTargetX: nx, bboxTargetY: ny }, 'wf-bbox2-move')
      } else {
        const signX = dragMode === 'ne' || dragMode === 'se' ? 1 : -1
        const signY = dragMode === 'sw' || dragMode === 'se' ? 1 : -1
        const delta = (dxStage * signX + dyStage * signY) * 0.5
        const ratio = Math.max(0.2, Math.min(3.5, (baseStageW * (origPct / 100) + delta * 2) / Math.max(16, baseStageW)))
        const nextPct = Math.round(ratio * 100)
        const autoZ =
          depthMode === 'depth_z' && !mp?.depthRefLayerId
            ? Math.round(startZ - (ratio - 1) * 180)
            : mp?.bboxTargetZ
        patchMotionNode(
          {
            bboxTargetScalePct: nextPct,
            ...(autoZ !== undefined ? { bboxTargetZ: autoZ } : {})
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

  // Tính các điểm đường đi từ BBox đầu -> BBox đích để vẽ trên SVG
  const pathPointsScreen: [number, number][] = []
  if (hasBboxMotion) {
    const steps = 24
    const activeStroke = mp?.customMotionPath
    const pType = mp?.bboxPathType ?? 'shortest'
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const pt = evaluateBboxTrajectoryAt(
        startPos,
        targetX,
        targetY,
        startZ,
        targetZ,
        scaleRatio,
        u,
        pType,
        activeStroke
      )
      const pf = refD / Math.max(80, refD + pt.z)
      const sx = shotLeft + shotScreenW / 2 + pt.x * pf * zoom
      const sy = shotTop + shotScreenH / 2 - pt.y * pf * zoom
      pathPointsScreen.push([sx, sy])
    }
  }

  return (
    <>
      {motionNode?.id === node.id && (hasBboxMotion || resolveMotionMode(mp ?? {}) === 'path') && (
        <WorkflowMotionStageTools mode={hasBboxMotion ? 'bbox' : 'path'} nodeId={node.id} params={mp ?? {}}
          width={stageW} height={stageH} zoom={zoom} perspective={pFactorStart} start={[box1Cx, box1Cy]}
          path={coordRefLayer.transform.position.keyframes.filter(k => k.id.includes(`-motpath-p-${node.id}-`) && !k.id.endsWith('-pre')).map(k => {
            const pf = refD / Math.max(80, refD + k.value[2])
            return [shotLeft + shotScreenW / 2 + k.value[0] * pf * zoom, shotTop + shotScreenH / 2 - k.value[1] * pf * zoom]
          })}
          patch={patchMotionNode}
        />
      )}
      {!motionNode && node.type === 'layer_assembly' && !node.params?.logicCategory && (
        <div className="wf-motion-stage-tools">
          <button type="button" title="Thêm Motion BBox đích" aria-label="Thêm Motion BBox đích" onClick={handleSpawnOrEnableBbox2}><WorkflowMotionIcon name="target"/></button>
        </div>
      )}

      {/* Đường nối đầu -> đích và điểm va chạm trên SVG */}
      {hasBboxMotion && pathPointsScreen.length >= 2 && (
        <svg
          className="wf-v2-direct-cam-svg"
          width={stageW}
          height={stageH}
          style={{ zIndex: 24, pointerEvents: 'none' }}
        >
          <polyline
            fill="none"
            stroke="rgba(16, 185, 129, 0.28)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pathPointsScreen.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          />
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pathPointsScreen.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          />
          {/* Các bóng khung trung gian thể hiện to/nhỏ dần dọc đường đi */}
          {[0.33, 0.66].map((uStep) => {
            const idx = Math.min(pathPointsScreen.length - 1, Math.round(uStep * (pathPointsScreen.length - 1)))
            const [mx, my] = pathPointsScreen[idx]
            const stepRatio = 1 + (scaleRatio - 1) * uStep
            const sw = Math.max(12, baseW * stepRatio)
            const sh = Math.max(12, baseH * stepRatio)
            return (
              <rect
                key={`step-${uStep}`}
                x={mx - sw / 2}
                y={my - sh / 2}
                width={sw}
                height={sh}
                rx={3}
                fill="none"
                stroke="rgba(56, 189, 248, 0.32)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )
          })}
          <circle cx={box1Cx} cy={box1Cy} r={4.5} fill="#10b981" stroke="#0f172a" strokeWidth={1.5} />
          <circle cx={box2Cx} cy={box2Cy} r={5} fill="#f59e0b" stroke="#0f172a" strokeWidth={1.5} />

        </svg>
      )}

      {/* Khung BBox đích dạng mờ (Ghost Target BBox) */}
      {hasBboxMotion && (
        <div
          className="wf-v2-direct-layer-bbox is-ghost-target"
          data-mcp-region="workflow_motion_ghost"
          style={{
            pointerEvents: motionNode?.id === node.id || shiftToFocus ? 'auto' : 'none',
            left: box2Left,
            top: box2Top,
            width: box2W,
            height: box2H,
            border: '1.5px dashed var(--key)',
            background: 'color-mix(in srgb, var(--key) 8%, transparent)',
            boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.55), 0 0 14px rgba(245, 158, 11, 0.25)',
            zIndex: 28,
            ['--wf-v2-accent' as string]: '#f59e0b'
          }}
          title={`BBox đích (${targetScalePct}%) — Kéo để đặt vị trí kết thúc, kéo 4 góc để phóng to/thu nhỏ dần khi di chuyển tới đích`}
          onPointerDown={(e) => {
            if (e.button === 0) startBbox2Drag(e, 'move')
          }}
        >
          {ghostImgUrl && (
            <img
              src={ghostImgUrl}
              alt="Ghost Target đích"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: 0.44,
                filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.65))',
                pointerEvents: 'none'
              }}
            />
          )}
          <span
            className="wf-v2-direct-bbox-tag"
            style={{
              top: box2Top < 18 ? 2 : -16,
              right: 0,
              left: 'auto',
              background: 'color-mix(in srgb, #f59e0b 82%, #0f172a)',
              color: '#ffffff'
            }}
          >
            #{bboxStepNumber(workflow, motionNode?.id ?? node.id) + 1} Đích
          </span>
          <span className="wf-v2-direct-bbox-crosshair" />
          {HANDLES.map((h) => (
            <span
              key={h.key}
              className={`wf-v2-bbox-handle ${h.cls}`}
              onPointerDown={(e) => startBbox2Drag(e, h.key)}
            />
          ))}
        </div>
      )}
    </>
  )
}
