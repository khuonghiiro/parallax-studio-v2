import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ImageProps, Vec3 } from '@shared/types'
import { assetStore } from '../../project/assets'
import {
  bakeCustomMotionPathToScene,
  getClusterMemberLayers,
  getClusterRootLayer
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import {
  getCachedAlphaTrim,
  getCheckerboardPalette,
  useAlphaTrimmedUrls,
  usePreviewCheckerTheme,
  type AlphaTrimmedInfo
} from './alphaTrimmedPreview'
import { ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

export const PRESET_PATHS: { id: string; label: string; points: [number, number][] }[] = [
  { id: 'move_right', label: '→ Đi sang phải', points: [[-0.78, 0.08], [-0.26, -0.04], [0.26, 0.04], [0.78, -0.02]] },
  { id: 'move_left', label: '← Đi sang trái', points: [[0.78, 0.08], [0.26, -0.04], [-0.26, 0.04], [-0.78, -0.02]] },
  { id: 'arc_jump', label: '↷ Nhảy vòm', points: [[-0.75, 0.45], [-0.35, -0.48], [0, -0.62], [0.35, -0.48], [0.75, 0.45]] },
  { id: 'wave', label: '〰 Sóng lượn', points: [[-0.75, 0], [-0.5, -0.42], [-0.25, 0], [0, 0.42], [0.25, 0], [0.5, -0.42], [0.75, 0]] },
  { id: 'circle', label: '◯ Vòng tròn', points: [[0, -0.55], [0.4, -0.4], [0.55, 0], [0.4, 0.4], [0, 0.55], [-0.4, 0.4], [-0.55, 0], [-0.4, -0.4], [0, -0.55]] },
  { id: 'fig8', label: '∞ Số 8', points: [[0, 0], [0.38, -0.42], [0.65, 0], [0.38, 0.42], [0, 0], [-0.38, -0.42], [-0.65, 0], [-0.38, 0.42], [0, 0]] }
]

export function resolveActionTargetLayerIds(props: WorkflowV2NodeParamsProps): string[] {
  const { node, project, workflow } = props
  const p = node.params ?? {}
  if (p.targetLayerIds && p.targetLayerIds.length > 0) {
    const set = new Set(p.targetLayerIds)
    const clusterInstId = p.instanceId ?? project.layers.find((l) => set.has(l.id))?.composite?.instanceId
    if (clusterInstId) {
      const members = getClusterMemberLayers(project, clusterInstId)
      if (members.length > 0) return members.map((m) => m.id)
    }
    return p.targetLayerIds
  }
  if (workflow) {
    const inEdges = workflow.edges.filter((e) => e.toNode === node.id && !e.disabled)
    const fromNodes = inEdges.map((e) => workflow.nodes.find((n) => n.id === e.fromNode)).filter(Boolean)
    const ids: string[] = []
    for (const fn of fromNodes) {
      if (fn?.params?.targetLayerIds?.length) ids.push(...fn.params.targetLayerIds)
      if (fn?.params?.instanceId) {
        const members = getClusterMemberLayers(project, fn.params.instanceId)
        ids.push(...members.map((m) => m.id))
      }
    }
    if (ids.length > 0) return Array.from(new Set(ids))
  }
  if (p.instanceId) {
    const members = getClusterMemberLayers(project, p.instanceId)
    if (members.length > 0) return members.map((m) => m.id)
  }
  const selId = useEditor.getState().selectedLayerId
  const first = project.layers.find((l) => l.id === selId) ?? project.layers[0]
  return first ? [first.id] : []
}

function collectTargetLayerImageUrls(props: WorkflowV2NodeParamsProps): string[] {
  const { node, project } = props
  const ids = resolveActionTargetLayerIds(props)
  const targetLayers = project.layers.filter((l) => ids.includes(l.id))
  const first = targetLayers[0]
  const members = getClusterMemberLayers(project, node.params?.instanceId, first)
  const list = (members.length > 0 ? members : targetLayers).filter((m) => m.visible !== false)
  const urls: string[] = []
  for (const m of list) {
    if (m.type !== 'image') continue
    const assetId = (m.props as ImageProps).assetId
    const rt = assetStore.get(assetId)
    const pa = project.assets.find((a) => a.id === assetId)
    const url = rt?.url || rt?.thumbUrl || pa?.dataUrl || pa?.path
    if (url) urls.push(url)
  }
  return urls
}

export function resolveSpriteBoxes(
  props: WorkflowV2NodeParamsProps,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  trimmedMap?: Record<string, AlphaTrimmedInfo>
): Array<{ id: string; url: string; x: number; y: number; w: number; h: number }> {
  const { node, project } = props
  const ids = resolveActionTargetLayerIds(props)
  const targetLayers = project.layers.filter((l) => ids.includes(l.id))
  const first = targetLayers[0]
  const members = getClusterMemberLayers(project, node.params?.instanceId, first)
  const list = (members.length > 0 ? members : targetLayers).filter((m) => m.visible !== false)
  const raw: { id: string; url: string; cx: number; cy: number; w: number; h: number; z: number }[] = []

  for (const m of list) {
    if (m.type !== 'image') continue
    const assetId = (m.props as ImageProps).assetId
    const rt = assetStore.get(assetId)
    const pa = project.assets.find((a) => a.id === assetId)
    const url = rt?.url || rt?.thumbUrl || pa?.dataUrl || pa?.path
    if (!url) continue
    const pos = m.transform?.position?.value ?? [0, 0, 0]
    const scl = m.transform?.scale?.value ?? [1, 1, 1]
    const sx = Math.abs(scl[0] ?? 1) >= 0.08 ? Math.abs(scl[0] ?? 1) : 1
    const sy = Math.abs(scl[1] ?? 1) >= 0.08 ? Math.abs(scl[1] ?? 1) : 1
    const rawW = rt?.meta?.width || pa?.width || 300
    const rawH = rt?.meta?.height || pa?.height || 300
    const trim = trimmedMap?.[url] ?? getCachedAlphaTrim(url)
    const displayUrl = trim ? trim.croppedUrl : url
    const effW = Math.max(8, (trim ? trim.trimW : rawW) * sx)
    const effH = Math.max(8, (trim ? trim.trimH : rawH) * sy)
    const cx =
      list.length === 1
        ? 0
        : (pos[0] ?? 0) + (trim ? trim.offsetRx * rawW * sx : 0)
    const cy =
      list.length === 1
        ? 0
        : -(pos[1] ?? 0) + (trim ? trim.offsetRy * rawH * sy : 0)
    raw.push({ id: m.id, url: displayUrl, cx, cy, w: effW, h: effH, z: pos[2] ?? 0 })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => a.z - b.z)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const r of raw) {
    minX = Math.min(minX, r.cx - r.w / 2)
    maxX = Math.max(maxX, r.cx + r.w / 2)
    minY = Math.min(minY, r.cy - r.h / 2)
    maxY = Math.max(maxY, r.cy + r.h / 2)
  }
  const uW = Math.max(12, maxX - minX)
  const uH = Math.max(12, maxY - minY)
  const fit = Math.min(frameW / uW, frameH / uH)
  const ox = frameX + (frameW - uW * fit) / 2
  const oy = frameY + (frameH - uH * fit) / 2

  return raw.map((r) => ({
    id: r.id,
    url: r.url,
    x: ox + (r.cx - r.w / 2 - minX) * fit,
    y: oy + (r.cy - r.h / 2 - minY) * fit,
    w: r.w * fit,
    h: r.h * fit
  }))
}

function getSpeedTier(dur: number): { label: string; icon: string; desc: string } {
  if (dur <= 0.8) return { label: '⚡ Siêu nhanh', icon: '⚡', desc: 'Vút qua chớp mắt' }
  if (dur <= 1.8) return { label: '🏃 Nhanh', icon: '🏃', desc: 'Chạy dứt khoát' }
  if (dur <= 3.8) return { label: '🚶 Vừa phải', icon: '🚶', desc: 'Chuyển động tự nhiên' }
  if (dur <= 6.5) return { label: '🐢 Chậm rãi', icon: '🐢', desc: 'Di chuyển êm đềm' }
  return { label: '🍃 Rất chậm', icon: '🍃', desc: 'Trôi lững lờ cực êm' }
}

/**
 * Khung vẽ & thiết kế quỹ đạo A → B nét liền mượt mà, hỗ trợ cấu hình mốc bắt đầu và thời gian hoàn thành.
 */
export const InlineMotionDesignerPad: React.FC<{
  props: WorkflowV2NodeParamsProps
  mode?: 'path' | 'curve'
  motionSpeed: number
  motionAmount: number
  onChangeMotionSpeed: (spd: number) => void
  onChangeMotionAmount: (amt: number) => void
  onSpawnFollowupNode?: (delaySec: number) => void
}> = ({
  props,
  mode,
  motionSpeed,
  motionAmount,
  onChangeMotionSpeed,
  onChangeMotionAmount,
  onSpawnFollowupNode
}) => {
  const { node, project, onUpdate } = props
  const p = node.params ?? {}
  const activeMode = mode ?? (p.motionMode === 'cycle' ? 'curve' : 'path')
  const [draftPoints, setDraftPoints] = useState<[number, number][] | null>(null)
  const [liveCursor, setLiveCursor] = useState<[number, number] | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [checkerTheme, toggleCheckerTheme] = usePreviewCheckerTheme()
  const palette = getCheckerboardPalette(checkerTheme)
  const padRef = useRef<SVGSVGElement | null>(null)

  const targetIds = useMemo(() => resolveActionTargetLayerIds(props), [props])
  const layerUrls = useMemo(() => collectTargetLayerImageUrls(props), [props])
  const trimmedMap = useAlphaTrimmedUrls(layerUrls)

  const activePath = useMemo<[number, number][]>(
    () =>
      (draftPoints ?? p.customMotionPath ?? []).filter(
        (pt): pt is [number, number] =>
          Array.isArray(pt) &&
          pt.length >= 2 &&
          typeof pt[0] === 'number' &&
          typeof pt[1] === 'number' &&
          Number.isFinite(pt[0]) &&
          Number.isFinite(pt[1])
      ),
    [draftPoints, p.customMotionPath]
  )

  const loopPath = Boolean(p.customMotionLoop)
  const compDuration = Math.max(1, project?.comp?.duration || 30)
  const timeStart = Math.max(0, p.timeStart ?? 0)
  const duration = Math.max(
    0.3,
    Number((p.duration ?? (p.timeEnd !== undefined ? p.timeEnd - timeStart : 3.0)).toFixed(1))
  )
  const timeEnd = Number((timeStart + duration).toFixed(3))
  const speedTier = getSpeedTier(duration)

  // Vòng lặp Xem thử (Preview) đồng bộ thời gian thực với Scene Viewer
  useEffect(() => {
    if (!isPreviewing) return
    if (activePath.length < 2) {
      setIsPreviewing(false)
      return
    }
    let t0: number | null = null
    const totalMs = Math.max(300, duration * 1000)
    let raf = 0
    const tick = (now: number): void => {
      if (t0 === null) t0 = now
      const elapsed = Math.max(0, now - t0)
      if (!loopPath && elapsed >= totalMs) {
        setPreviewProgress(1)
        setIsPreviewing(false)
        useEditor.getState().setTime(timeStart)
        return
      }
      const ratio = Math.max(0, Math.min(1, (elapsed % totalMs) / totalMs))
      setPreviewProgress(ratio)
      const currentT = Number((timeStart + ratio * duration).toFixed(3))
      useEditor.getState().setTime(currentT)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [isPreviewing, activePath.length, loopPath, duration, timeStart])

  const previewPoint = useMemo((): [number, number] | null => {
    if (!isPreviewing || activePath.length < 2) return null
    const prog = Number.isFinite(previewProgress) ? Math.max(0, Math.min(1, previewProgress)) : 0
    const scaled = prog * (activePath.length - 1)
    const idx = Math.max(0, Math.min(activePath.length - 2, Math.floor(scaled)))
    const frac = Math.max(0, Math.min(1, scaled - idx))
    const a = activePath[idx]
    const b = activePath[idx + 1]
    if (!a || !b) return null
    return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
  }, [isPreviewing, activePath, previewProgress])

  const startPt = activePath[0]
  const endPt = activePath[activePath.length - 1]
  const anchorPt = previewPoint ?? startPt
  const spriteBoxSize = anchorPt ? 92 : 108
  const spriteBoxes = useMemo(
    () =>
      resolveSpriteBoxes(
        props,
        anchorPt ? (anchorPt[0] + 1) * 120 - spriteBoxSize / 2 : 120 - spriteBoxSize / 2,
        anchorPt ? (anchorPt[1] + 1) * 74 - spriteBoxSize / 2 : 74 - spriteBoxSize / 2,
        spriteBoxSize,
        spriteBoxSize,
        trimmedMap
      ),
    [props, anchorPt, spriteBoxSize, trimmedMap]
  )

  const commitPath = (
    points: [number, number][],
    label?: string,
    overrideTiming?: { start?: number; dur?: number; loop?: boolean }
  ): void => {
    setDraftPoints(null)
    setLiveCursor(null)
    setIsDrawing(false)
    if (points.length < 2) return
    const curStart = overrideTiming?.start ?? timeStart
    const curDur = overrideTiming?.dur ?? duration
    const curEnd = Number((curStart + curDur).toFixed(3))
    const curLoop = overrideTiming?.loop ?? loopPath

    onUpdate(
      {
        motionMode: 'path',
        actionPreset: 'custom_draw',
        customMotionPath: points,
        customMotionLoop: curLoop,
        customMotionCycleSec: curDur,
        timeStart: curStart,
        timeEnd: curEnd,
        duration: curDur,
        targetLayerIds: targetIds
      },
      label ?? `Quỹ đạo Motion (${points.length} mốc)`
    )

    useEditor.getState().update((d) => {
      bakeCustomMotionPathToScene(d, targetIds, points, {
        nodeId: node.id,
        timeStart: curStart,
        timeEnd: curEnd,
        intensity: p.intensity ?? motionAmount,
        loop: curLoop,
        cycleDuration: curDur
      })
    }, 'wf-motion-draw-path')
  }

  // Bắt đầu vẽ nét liền mượt mà bằng con trỏ chuột
  const handlePadPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const svg = padRef.current
    if (!svg) return
    try {
      svg.setPointerCapture(e.pointerId)
    } catch {
      /* Bỏ qua nếu môi trường không hỗ trợ capture */
    }

    const rect = svg.getBoundingClientRect()
    const toNorm = (cx: number, cy: number): [number, number] => {
      const nx = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const ny = ((cy - rect.top) / Math.max(1, rect.height)) * 2 - 1
      return [
        Number(Math.max(-0.95, Math.min(0.95, nx)).toFixed(3)),
        Number(Math.max(-0.95, Math.min(0.95, ny)).toFixed(3))
      ]
    }

    const firstPt = toNorm(e.clientX, e.clientY)
    const pts: [number, number][] = [firstPt]
    setDraftPoints(pts)
    setLiveCursor(firstPt)
    setIsDrawing(true)

    const onMove = (ev: PointerEvent): void => {
      const next = toNorm(ev.clientX, ev.clientY)
      setLiveCursor(next)
      const prev = pts[pts.length - 1]
      // Lấy mẫu mịn bước nhỏ (~1.5px) để tạo đường nét liền mềm mại, tối đa 160 điểm
      if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) >= 0.012 && pts.length < 160) {
        pts.push(next)
        setDraftPoints([...pts])
      }
    }

    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        svg.releasePointerCapture(ev.pointerId)
      } catch {
        /* Bỏ qua */
      }
      setIsDrawing(false)
      setLiveCursor(null)

      if (pts.length >= 2) {
        commitPath(pts)
      } else {
        setDraftPoints(null)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Tọa độ chuỗi SVG polyline nối nét liền hoàn toàn
  const polyPoints = useMemo(() => {
    const list = [...activePath]
    if (isDrawing && liveCursor && list.length > 0) {
      const last = list[list.length - 1]
      if (Math.hypot(liveCursor[0] - last[0], liveCursor[1] - last[1]) > 0.008) {
        list.push(liveCursor)
      }
    }
    return list.map(([nx, ny]) => `${Math.round((nx + 1) * 120)},${Math.round((ny + 1) * 74)}`).join(' ')
  }, [activePath, isDrawing, liveCursor])

  // Cập nhật mốc bắt đầu
  const updateTimeStart = (newStart: number): void => {
    const s = Math.max(0, Math.min(compDuration - 0.2, Number(newStart.toFixed(1))))
    const e = Number((s + duration).toFixed(3))
    onUpdate({ timeStart: s, timeEnd: e })
    if (activePath.length >= 2) {
      useEditor.getState().update((d) => {
        bakeCustomMotionPathToScene(d, targetIds, activePath, {
          nodeId: node.id,
          timeStart: s,
          timeEnd: e,
          intensity: p.intensity ?? motionAmount,
          loop: loopPath,
          cycleDuration: duration
        })
      }, 'wf-motion-time-start')
    }
  }

  // Cập nhật thời gian hoàn thành (duration)
  const updateDuration = (newDur: number): void => {
    const dur = Math.max(0.3, Math.min(15.0, Number(newDur.toFixed(1))))
    const e = Number((timeStart + dur).toFixed(3))
    onUpdate({ duration: dur, timeEnd: e, customMotionCycleSec: dur })
    if (activePath.length >= 2) {
      useEditor.getState().update((d) => {
        bakeCustomMotionPathToScene(d, targetIds, activePath, {
          nodeId: node.id,
          timeStart,
          timeEnd: e,
          intensity: p.intensity ?? motionAmount,
          loop: loopPath,
          cycleDuration: dur
        })
      }, 'wf-motion-duration')
    }
  }

  return (
    <div className="wf-v2-inline-editor-frame" style={{ marginBottom: 6 }}>
      {activeMode === 'path' ? (
        <>
          <div className="wf-v2-inline-editor-head">
            <span>✏️ Vẽ line chuyển động (Nét liền 60fps)</span>
            <div className="wf-v2-inline-tabs">
              <button
                type="button"
                className="wf-v2-mini-btn"
                title={
                  checkerTheme === 'light'
                    ? 'Đang dùng nền Caro Sáng — bấm để đổi sang Caro Tối (tránh trùng màu pixel sáng)'
                    : 'Đang dùng nền Caro Tối — bấm để đổi sang Caro Sáng (tránh trùng màu pixel tối)'
                }
                onClick={toggleCheckerTheme}
              >
                {checkerTheme === 'light' ? '☀️ Caro Trắng' : '🌙 Caro Đen'}
              </button>
              <button
                type="button"
                className={`wf-v2-mini-btn${isPreviewing ? ' active' : ''}`}
                title="Xem thử (Preview) chuyển động của Layer theo đường vẽ"
                onClick={() => {
                  if (!isPreviewing) {
                    const path = activePath.length >= 2 ? activePath : PRESET_PATHS[0].points
                    if (activePath.length < 2) {
                      commitPath(path, 'Quỹ đạo: Đi sang phải')
                    }
                    setIsPreviewing(true)
                    setPreviewProgress(0)
                    useEditor.getState().setTime(timeStart)
                  } else {
                    setIsPreviewing(false)
                    setPreviewProgress(0)
                    useEditor.getState().setTime(timeStart)
                  }
                }}
              >
                {isPreviewing ? '⏸ Dừng' : '▶ Preview'}
              </button>
              {activePath.length > 0 && (
                <button
                  type="button"
                  className="wf-v2-mini-btn"
                  title="Xoá đường vẽ hiện tại để vẽ nét mới"
                  onClick={() => {
                    setIsPreviewing(false)
                    useEditor.getState().setTime(timeStart)
                    onUpdate({ customMotionPath: [] })
                    useEditor.getState().update((d) => {
                      bakeCustomMotionPathToScene(d, targetIds, [], { nodeId: node.id })
                    }, 'wf-motion-clear-path')
                  }}
                >
                  🗑 Xoá
                </button>
              )}
            </div>
          </div>

          <svg
            ref={padRef}
            className="wf-v2-inline-motion-svg"
            viewBox="0 0 240 148"
            style={{ touchAction: 'none', cursor: isDrawing ? 'crosshair' : 'default' }}
            onPointerDown={handlePadPointerDown}
          >
            <defs>
              <pattern id={`wf-mot-checker-${node.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
                <rect width="16" height="16" fill={palette.tileA} />
                <rect width="8" height="8" fill={palette.tileB} />
                <rect x="8" y="8" width="8" height="8" fill={palette.tileB} />
              </pattern>
              <marker
                id={`wf-mot-arrow-${node.id}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
              </marker>
            </defs>
            <rect
              x="0"
              y="0"
              width="240"
              height="148"
              fill={`url(#wf-mot-checker-${node.id})`}
              stroke={palette.borderStroke}
              strokeWidth="1"
              rx="6"
            />
            <line x1="120" y1="0" x2="120" y2="148" stroke={palette.gridLine} strokeDasharray="3 3" />
            <line x1="0" y1="74" x2="240" y2="74" stroke={palette.gridLine} strokeDasharray="3 3" />

            {/* Ảnh xem trước của Layer di chuyển dọc theo quỹ đạo */}
            {spriteBoxes.map((sp) => (
              <image
                key={sp.id}
                href={sp.url}
                x={sp.x}
                y={sp.y}
                width={sp.w}
                height={sp.h}
                preserveAspectRatio="xMidYMid meet"
                opacity={isPreviewing ? '0.96' : '0.88'}
              />
            ))}

            {/* NÉT LIỀN MƯỢT MÀ KHÔNG BỊ NGẮT QUÃNG — KHÔNG HIỆN CÁC CHẤM DOTS LẮT NHẮT */}
            {(activePath.length >= 2 || (isDrawing && activePath.length >= 1)) && (
              <>
                {/* Viền hào quang nền */}
                <polyline
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.35)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polyPoints}
                />
                {/* Nét liền chính giữa */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polyPoints}
                  markerEnd={`url(#wf-mot-arrow-${node.id})`}
                />

                {/* Điểm xuất phát A (Màu vàng cam nổi bật) */}
                {startPt && (
                  <g transform={`translate(${(startPt[0] + 1) * 120} ${(startPt[1] + 1) * 74})`}>
                    <circle r="6" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.6" />
                    <circle r="9" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
                    <text
                      y="-10"
                      textAnchor="middle"
                      fill="#f59e0b"
                      stroke={palette.labelStroke}
                      strokeWidth="2.5"
                      paintOrder="stroke"
                      fontSize="9"
                      fontWeight="700"
                    >
                      A ({timeStart.toFixed(1)}s)
                    </text>
                  </g>
                )}

                {/* Điểm đích B (Màu Cyan nổi bật) */}
                {endPt && activePath.length >= 2 && !isDrawing && (
                  <g transform={`translate(${(endPt[0] + 1) * 120} ${(endPt[1] + 1) * 74})`}>
                    <circle r="6" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.6" />
                    <circle r="9" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
                    <text
                      y="-10"
                      textAnchor="middle"
                      fill="#38bdf8"
                      stroke={palette.labelStroke}
                      strokeWidth="2.5"
                      paintOrder="stroke"
                      fontSize="9"
                      fontWeight="700"
                    >
                      B ({timeEnd.toFixed(1)}s)
                    </text>
                  </g>
                )}

                {/* Bút vẽ thời gian thực khi đang rê chuột */}
                {isDrawing && liveCursor && (
                  <circle
                    cx={(liveCursor[0] + 1) * 120}
                    cy={(liveCursor[1] + 1) * 74}
                    r="4.5"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}

                {/* Con trỏ Preview di chuyển 60fps */}
                {previewPoint && (
                  <circle
                    cx={(previewPoint[0] + 1) * 120}
                    cy={(previewPoint[1] + 1) * 74}
                    r="7.5"
                    fill="#facc15"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                )}
              </>
            )}

            {activePath.length === 0 && !isDrawing && (
              <text
                x="120"
                y="138"
                textAnchor="middle"
                fill={palette.hintText}
                stroke={palette.labelStroke}
                strokeWidth="2.5"
                paintOrder="stroke"
                fontSize="8.5"
                fontWeight="600"
              >
                Nhấn giữ chuột vẽ nét liền A → B hoặc chọn mẫu bên dưới
              </text>
            )}
          </svg>

          {/* Dải nút mẫu quỹ đạo nhanh */}
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 5 }}>
            {PRESET_PATHS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="vl-pill-btn"
                onClick={() => commitPath(preset.points, `Quỹ đạo: ${preset.label.replace(/^[^\w\p{L}]+\s*/u, '')}`)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Cài đặt Quỹ đạo, Thời gian & Biên độ (Gộp chung trong 1 Card liền mạch, bố cục Stacked chống tràn chữ) */}
          <div className="vl-subcard" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span className="vl-title" style={{ fontSize: 11, fontWeight: 700 }}>
                ⏱ Quỹ đạo &amp; Thời gian di chuyển
              </span>
              <button
                type="button"
                className="wf-v2-mini-btn"
                style={{ fontSize: 10, padding: '2px 8px' }}
                title="Gán mốc bắt đầu đúng theo thời điểm con trỏ đọc Timeline hiện tại"
                onClick={() => updateTimeStart(useEditor.getState().time)}
              >
                ⏱ Lấy giờ ({useEditor.getState().time.toFixed(1)}s)
              </button>
            </div>

            {/* Slider 1: Biên độ quãng đường */}
            <ParamSlider
              layout="stacked"
              label="Biên độ di chuyển"
              min={0.2}
              max={3.0}
              step={0.05}
              value={p.intensity ?? 1.0}
              format={(v) => `${Math.round(v * 100)}% (~${Math.round(v * 540)}px)`}
              onChange={(v) => {
                onUpdate({ intensity: v })
                if (activePath.length >= 2) {
                  useEditor.getState().update((d) => {
                    bakeCustomMotionPathToScene(d, targetIds, activePath, {
                      nodeId: node.id,
                      timeStart,
                      timeEnd,
                      intensity: v,
                      loop: loopPath,
                      cycleDuration: duration
                    })
                  }, 'wf-motion-intensity')
                }
              }}
            />

            {/* Slider 2: Mốc thời gian bắt đầu chạy */}
            <ParamSlider
              layout="stacked"
              label="Bắt đầu chạy lúc"
              min={0}
              max={Math.max(1, compDuration - 0.5)}
              step={0.1}
              value={timeStart}
              format={(v) => `${v.toFixed(1)}s trên Timeline`}
              onChange={updateTimeStart}
            />

            {/* Slider 3: Thời gian chạy xong line */}
            <ParamSlider
              layout="stacked"
              label="Thời gian hoàn thành"
              min={0.3}
              max={12.0}
              step={0.1}
              value={duration}
              format={(v) => `${v.toFixed(1)}s · ${speedTier.label}`}
              onChange={updateDuration}
            />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -2, fontStyle: 'italic' }}>
              💡 {speedTier.desc} — Giây càng ngắn tốc độ càng nhanh, giây càng dài càng êm đềm.
            </div>

            {/* Tuỳ chọn Lặp lại (Loop) */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                borderTop: '1px solid var(--line-soft)',
                paddingTop: 6,
                marginTop: 2
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={loopPath}
                  onChange={(e) => {
                    const nextLoop = e.target.checked
                    onUpdate({ customMotionLoop: nextLoop, customMotionCycleSec: duration })
                    if (activePath.length >= 2) {
                      useEditor.getState().update((d) => {
                        bakeCustomMotionPathToScene(d, targetIds, activePath, {
                          nodeId: node.id,
                          timeStart,
                          timeEnd,
                          intensity: p.intensity ?? motionAmount,
                          loop: nextLoop,
                          cycleDuration: duration
                        })
                      }, 'wf-motion-loop')
                    }
                  }}
                />
                🔁 Lặp lại chu kỳ khi chạy xong
              </span>
              <small style={{ color: 'var(--text-dim)', fontWeight: 500 }}>
                {loopPath ? `Lặp mỗi ${duration.toFixed(1)}s` : 'Chạy 1 lượt rồi dừng'}
              </small>
            </label>

            {/* Nút Nối chặng Di chuyển đẹp mắt */}
            {onSpawnFollowupNode && (
              <button
                type="button"
                className="wf-v2-motion-followup-btn"
                title={`Tạo tiếp 1 Node Motion nối đuôi trên Timeline (+${duration.toFixed(1)}s) để di chuyển chặng kế tiếp`}
                onClick={() => onSpawnFollowupNode(duration)}
              >
                ➕ Nối tiếp chặng Di chuyển (+{duration.toFixed(1)}s)
              </button>
            )}
          </div>

          {project && activePath.length >= 2 && (
            <div className="wf-v2-inline-editor-foot">
              <span>
                Đã ghi <strong>{activePath.length} mốc nét liền</strong> ({timeStart.toFixed(1)}s → {timeEnd.toFixed(1)}s · Xong trong {duration.toFixed(1)}s)
              </span>
              <button
                type="button"
                className="wf-v2-mini-btn active"
                onClick={() => {
                  useEditor.getState().setTime(timeStart)
                  useEditor.getState().setPlaying(true)
                }}
              >
                ▶ Phát trên Timeline
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
