import React, { useCallback, useState } from 'react'
import type { Layer, Project, Vec3, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { assetStore } from '../../project/assets'
import {
  depthToZIndex,
  detectPathCollisionsInScene,
  evaluateBboxTrajectoryAt,
  evaluateCleanLayerPos,
  evaluateCleanLayerScale
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
  onSelectNode?: (nodeId: string) => void
  onScrubTime: (t: number) => void
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
  if (node.params?.logicCategory === 'action' || node.type === 'motion_choreography') {
    return node
  }
  // Nếu đang chọn Node Va chạm, tìm Node Motion của Chủ thể A (strikerLayerId)
  const lookupLayerId =
    node.params?.logicCategory === 'collision'
      ? (node.params?.strikerLayerId ?? node.params?.targetLayerIds?.[0])
      : repLayerId

  return workflow.nodes.find((n) => {
    if (n.params?.logicCategory !== 'action' && n.type !== 'motion_choreography') return false
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
  onSelectNode,
  onScrubTime
}) => {
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)
  const [drawCurveOnStage, setDrawCurveOnStage] = useState(false)
  const [draftStageStroke, setDraftStageStroke] = useState<[number, number][] | null>(null)

  const motionNode = resolveActiveMotionNode(workflow, node, coordRefLayer?.id, clusterInstId)
  const mp = motionNode?.params
  const hasBboxMotion = Boolean(
    motionNode &&
      (mp?.motionMode === 'bbox' ||
        mp?.actionPreset === 'bbox_target' ||
        typeof mp?.bboxTargetX === 'number' ||
        typeof mp?.bboxTargetY === 'number')
  )

  const patchMotionNode = useCallback(
    (patch: Partial<WorkflowNodeParams>, mergeKey = 'wf-stage-bbox2'): void => {
      if (!motionNode) return
      update((d) => {
        if (!d.workflow) return
        const target = d.workflow.nodes.find((n) => n.id === motionNode.id)
        if (!target) return
        target.params = {
          ...(target.params ?? {}),
          motionMode: 'bbox',
          actionPreset: 'bbox_target',
          ...patch
        }
        syncWorkflowV2NodeToProject(d, target, patch)
      }, mergeKey)
    },
    [motionNode, update]
  )

  /** Khởi tạo nhanh BBox #2 ngay trên cảnh nếu Layer/Cụm chưa có BBox #2 */
  const handleSpawnOrEnableBbox2 = useCallback((): void => {
    if (!coordRefLayer) return
    const tStart = mp?.timeStart ?? coordRefLayer.inPoint ?? 0
    const startPos = evaluateCleanLayerPos(coordRefLayer, tStart)
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

    // Nếu Layer/Cụm chưa có Node Motion -> tự gắn Node Motion chế độ BBox #1 -> #2
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
        'Motion: Đặt BBox Đích (#1 → #2)'
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
  // Đọc vị trí gốc #1 tại tStart (bỏ qua keyframe đã bake để BBox #1 và #2 không bị nhân kép tỷ lệ khi tua tới tEnd)
  const startPos: Vec3 = evaluateCleanLayerPos(coordRefLayer, tStart)
  const startCleanScale: Vec3 = evaluateCleanLayerScale(coordRefLayer, tStart)
  const curEvalScale: Vec3 = evaluate(coordRefLayer.transform.scale, useEditor.getState().time)
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

  // Tọa độ màn hình của BBox #1 (Xuất phát)
  const startOffsetX = startPos[0] * pFactorStart
  const startOffsetY = -startPos[1] * pFactorStart
  const baseStageW = Math.max(16, selectedProjLayer.width * unbakedRatioX)
  const baseStageH = Math.max(16, selectedProjLayer.height * unbakedRatioY)
  const baseW = Math.max(22, baseStageW * zoom)
  const baseH = Math.max(22, baseStageH * zoom)
  const box1Cx = shotLeft + shotScreenW / 2 + startOffsetX * zoom
  const box1Cy = shotTop + shotScreenH / 2 + startOffsetY * zoom

  // Tọa độ màn hình của Ghost BBox #2 (Đích)
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
      onScrubTime(tEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Tính các điểm đường đi từ BBox #1 -> BBox #2 để vẽ trên SVG
  const pathPointsScreen: [number, number][] = []
  if (hasBboxMotion) {
    const steps = 24
    const activeStroke = draftStageStroke && draftStageStroke.length >= 2 ? draftStageStroke : mp?.customMotionPath
    const pType = draftStageStroke ? 'custom_curve' : (mp?.bboxPathType ?? 'shortest')
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

  const collisions =
    hasBboxMotion && mp
      ? detectPathCollisionsInScene(
          project,
          mp.targetLayerIds ?? [coordRefLayer.id],
          mp
        )
      : []

  return (
    <>
      {/* Nút bật nhanh BBox #2 hoặc chế độ vẽ đường đi nổi góc dưới phải của Stage 2D (không che nhãn BBox phía trên) */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          zIndex: 35,
          display: 'flex',
          gap: 4
        }}
      >
        {!hasBboxMotion ? (
          <button
            type="button"
            className="wf-v2-direct-btn accent"
            style={{
              height: 22,
              padding: '0 8px',
              fontSize: 10,
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleSpawnOrEnableBbox2()
            }}
            title="Thêm khung BBox Đích #2 dạng mờ để kéo vị trí đích & phóng to/thu nhỏ dần khi di chuyển"
          >
            🎯 + Đặt BBox Đích #2
          </button>
        ) : (
          <button
            type="button"
            className={`wf-v2-direct-btn${drawCurveOnStage ? ' accent' : ''}`}
            style={{
              height: 21,
              padding: '0 7px',
              fontSize: 9.5,
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
            }}
            onClick={(e) => {
              e.stopPropagation()
              const nextDraw = !drawCurveOnStage
              setDrawCurveOnStage(nextDraw)
              if (nextDraw) patchMotionNode({ bboxPathType: 'custom_curve' })
            }}
            title="Vẽ trực tiếp đường cong di chuyển nối từ BBox #1 tới BBox #2 ngay trên khung cảnh 2D"
          >
            ✏️ {drawCurveOnStage ? 'Đang vẽ #1↝#2' : 'Vẽ đường #1↝#2'}
          </button>
        )}
      </div>

      {/* Đường nối #1 -> #2 và điểm va chạm trên SVG */}
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
          {/* Điểm va chạm phát hiện được trên đường đi */}
          {collisions.map((col) => {
            const pf = refD / Math.max(80, refD + col.movingZAtHit)
            const cx = shotLeft + shotScreenW / 2 + col.hitPoint[0] * pf * zoom
            const cy = shotTop + shotScreenH / 2 - col.hitPoint[1] * pf * zoom
            return (
              <g key={`col-${col.layerId}`}>
                <circle cx={cx} cy={cy} r={8} fill="rgba(244, 63, 94, 0.32)" stroke="#f43f5e" strokeWidth={1.6} />
                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  fill="#fda4af"
                  fontSize={9}
                  fontWeight={700}
                >
                  💥 {col.layerName} ({col.hitTime}s)
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* Lớp vẽ đường cong trực tiếp trên Stage khi bật `drawCurveOnStage` */}
      {hasBboxMotion && drawCurveOnStage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 32,
            cursor: 'crosshair',
            touchAction: 'none'
          }}
          title="Nhấn giữ chuột và kéo để vẽ đường đi nối từ BBox #1 sang BBox #2"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            e.preventDefault()
            setPlaying(false)
            const rect = e.currentTarget.getBoundingClientRect()
            const toNorm = (cx: number, cy: number): [number, number] => [
              Number(Math.max(0.02, Math.min(0.98, (cx - rect.left) / Math.max(1, rect.width))).toFixed(4)),
              Number(Math.max(0.02, Math.min(0.98, (cy - rect.top) / Math.max(1, rect.height))).toFixed(4))
            ]
            const pts: [number, number][] = [toNorm(e.clientX, e.clientY)]
            setDraftStageStroke(pts)

            const onMove = (pev: PointerEvent): void => {
              const next = toNorm(pev.clientX, pev.clientY)
              const prev = pts[pts.length - 1]
              if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) >= 0.012) {
                pts.push(next)
                setDraftStageStroke([...pts])
              }
            }
            const onUp = (): void => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              setDraftStageStroke(null)
              setDrawCurveOnStage(false)
              if (pts.length >= 2) {
                patchMotionNode({ bboxPathType: 'custom_curve', customMotionPath: pts }, 'wf-stage-curve')
              }
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        />
      )}

      {/* Khung BBox Đích #2 dạng mờ (Ghost Target BBox) */}
      {hasBboxMotion && (
        <div
          className="wf-v2-direct-layer-bbox is-ghost-target"
          style={{
            left: box2Left,
            top: box2Top,
            width: box2W,
            height: box2H,
            border: '1.5px dashed #f59e0b',
            background: 'rgba(245, 158, 11, 0.08)',
            boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.55), 0 0 14px rgba(245, 158, 11, 0.25)',
            zIndex: 28,
            ['--wf-v2-accent' as string]: '#f59e0b'
          }}
          title={`BBox Đích #2 (${targetScalePct}%) — Kéo để đặt vị trí kết thúc, kéo 4 góc để phóng to/thu nhỏ dần khi di chuyển tới đích`}
          onPointerDown={(e) => {
            if (e.button === 0) startBbox2Drag(e, 'move')
          }}
        >
          {ghostImgUrl && (
            <img
              src={ghostImgUrl}
              alt="Ghost Target #2"
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
            #2 Đích · {targetScalePct}%{depthMode === 'depth_z' ? ` · Z-Idx:${depthToZIndex(targetZ)}` : ''}
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
