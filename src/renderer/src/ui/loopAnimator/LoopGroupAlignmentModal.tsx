import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLoopAnimator } from './loopAnimatorState'
import {
  computeLoopGroupsSchedule,
  resolveGroupFrameAtLocalTime
} from './loopGroupManager'
import {
  drawFrameOnStage,
  ensureGroupProcessedCanvas
} from './LoopAnimatorPlayer'
import { appendLoopImageFilesAsGroups, LOOP_IMAGE_ACCEPT } from './loopAnimatorLauncher'
import { LoopGroupColumnCard } from './LoopGroupColumnCard'
import type { LoopSequenceGroup } from './types'
import { IconPause, IconPlay, IconX } from '../icons'

const MASTER_STAGE = 600
const COL_STAGE = 260

const BG_OPTIONS = [
  { id: 'checker', label: 'Trong suốt (caro)' },
  { id: 'dark', label: 'Đen' },
  { id: 'light', label: 'Trắng' },
  { id: 'green', label: 'Xanh lá' }
] as const

export function LoopGroupAlignmentModal(): React.ReactElement | null {
  const alignModalOpen = useLoopAnimator((s) => s.alignModalOpen)
  const setAlignModalOpen = useLoopAnimator((s) => s.setAlignModalOpen)
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const playback = useLoopAnimator((s) => s.playback)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const selectGroup = useLoopAnimator((s) => s.selectGroup)
  const updateGroupByIndex = useLoopAnimator((s) => s.updateGroupByIndex)
  const toggleGroupSyncChroma = useLoopAnimator((s) => s.toggleGroupSyncChroma)
  const appendImageAsGroup = useLoopAnimator((s) => s.appendImageAsGroup)

  const [masterPlaying, setMasterPlaying] = useState(true)
  const [scrubTime, setScrubTime] = useState(0)
  const [showRefOnion, setShowRefOnion] = useState(true)
  const [masterZoom, setMasterZoom] = useState(1.0)
  const [masterPan, setMasterPan] = useState({ x: 0, y: 0 })
  const [layoutMode, setLayoutMode] = useState<'balanced' | 'focus_master'>('balanced')
  const [canvasMap, setCanvasMap] = useState<Record<string, HTMLCanvasElement>>({})
  const [colFrameIdxMap, setColFrameIdxMap] = useState<Record<string, number>>({})

  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const colCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const masterDragRef = useRef<{
    startX: number
    startY: number
    origOffsetX: number
    origOffsetY: number
    origPanX: number
    origPanY: number
    isPan: boolean
  } | null>(null)
  const dragStateRef = useRef<{
    groupIdx: number
    startX: number
    startY: number
    origX: number
    origY: number
    scale: number
  } | null>(null)
  const appendInputRef = useRef<HTMLInputElement | null>(null)

  const schedule = useMemo(() => computeLoopGroupsSchedule(groups), [groups])
  const totalDuration = Math.max(0.1, schedule.totalDuration)

  // Giải mã toàn bộ canvas đã tách nền của các nhóm để vẽ tức thì
  useEffect(() => {
    if (!alignModalOpen) return
    let cancelled = false
    void Promise.all(
      groups.map(async (g) => {
        const c = await ensureGroupProcessedCanvas(g)
        return [g.id, c] as const
      })
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, HTMLCanvasElement> = {}
      for (const [id, c] of entries) {
        if (c) next[id] = c
      }
      setCanvasMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [alignModalOpen, groups])

  const getCommonScale = useCallback(
    (stageSize: number, zoom = 1.0): number => {
      let maxW = 1
      let maxH = 1
      for (const g of groups) {
        for (const f of g.frames) {
          if (f.width > maxW) maxW = f.width
          if (f.height > maxH) maxH = f.height
        }
      }
      return Math.min((stageSize - 40) / maxW, (stageSize - 40) / maxH) * zoom
    },
    [groups]
  )

  const drawMasterAtTime = useCallback(
    (tSec: number) => {
      const canvas = masterCanvasRef.current
      if (!canvas) return
      if (canvas.width !== MASTER_STAGE) canvas.width = canvas.height = MASTER_STAGE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, MASTER_STAGE, MASTER_STAGE)

      const scale = getCommonScale(MASTER_STAGE, masterZoom)
      const anchor = playback.anchor ?? 'bottom'
      const baseLineY = anchor === 'center' ? MASTER_STAGE / 2 : MASTER_STAGE - 24

      ctx.save()
      ctx.translate(masterPan.x, masterPan.y)

      // 1. Đường tâm toạ độ và lưới đối chiếu vị trí (Crosshair + Grid ticks)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(MASTER_STAGE / 2, 0)
      ctx.lineTo(MASTER_STAGE / 2, MASTER_STAGE)
      ctx.moveTo(0, baseLineY)
      ctx.lineTo(MASTER_STAGE, baseLineY)
      ctx.stroke()

      // Thước pixel mờ mờ (+60, +120, +180...)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
      ctx.setLineDash([2, 4])
      for (let offset = 60; offset <= 240; offset += 60) {
        const step = offset * scale
        ctx.beginPath()
        ctx.moveTo(MASTER_STAGE / 2 + step, 0)
        ctx.lineTo(MASTER_STAGE / 2 + step, MASTER_STAGE)
        ctx.moveTo(MASTER_STAGE / 2 - step, 0)
        ctx.lineTo(MASTER_STAGE / 2 - step, MASTER_STAGE)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // 2. Bóng điểm chạm tham chiếu của Nhóm trước nếu có
      if (showRefOnion && activeGroupIndex > 0 && groups[activeGroupIndex - 1]) {
        const prevG = groups[activeGroupIndex - 1]
        const prevCenterX = MASTER_STAGE / 2 + (prevG.offsetX || 0) * scale
        const prevCenterY = baseLineY + (prevG.offsetY || 0) * scale
        ctx.save()
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(prevCenterX, prevCenterY, 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // 3. Vẽ các frame tại thời điểm tSec
      for (const item of schedule.items) {
        if (tSec < item.startTime || tSec > item.endTime + 1e-3) continue
        const localTime = Math.max(0, tSec - item.startTime)
        const frame = resolveGroupFrameAtLocalTime(item, localTime)
        const gCanvas = canvasMap[item.group.id]
        if (!frame || !gCanvas) continue

        ctx.save()
        drawFrameOnStage(
          ctx,
          gCanvas,
          frame,
          scale,
          anchor,
          item.group.offsetX,
          item.group.offsetY,
          item.group.scale,
          MASTER_STAGE
        )
        ctx.restore()

        // Khung viền nhận diện nhóm đang chọn (activeGroupIndex)
        if (item.groupIndex === activeGroupIndex) {
          const effScale = scale * Math.max(0.1, item.group.scale || 1)
          const w = Math.round(frame.width * effScale)
          const h = Math.round(frame.height * effScale)
          const fx = Math.round((MASTER_STAGE - w) * 0.5 + (frame.offsetX + item.group.offsetX) * scale)
          const fy =
            anchor === 'bottom'
              ? Math.round(MASTER_STAGE - 24 - h + (frame.offsetY + item.group.offsetY) * scale)
              : Math.round((MASTER_STAGE - h) * 0.5 + (frame.offsetY + item.group.offsetY) * scale)

          ctx.save()
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'
          ctx.lineWidth = 1.5
          ctx.setLineDash([3, 3])
          ctx.strokeRect(fx - 2, fy - 2, w + 4, h + 4)

          // Dấu tâm của nhóm đang chọn
          const cx = MASTER_STAGE / 2 + (item.group.offsetX || 0) * scale
          const cy = baseLineY + (item.group.offsetY || 0) * scale
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.5
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.arc(cx, cy, 5, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      ctx.restore()
    },
    [schedule, canvasMap, getCommonScale, playback.anchor, masterZoom, masterPan, activeGroupIndex, showRefOnion, groups]
  )

  // Vẽ từng cột căn chỉnh nhóm
  const drawGroupColumn = useCallback(
    (g: LoopSequenceGroup, idx: number) => {
      const canvas = colCanvasRefs.current[g.id]
      if (!canvas) return
      if (canvas.width !== COL_STAGE) canvas.width = canvas.height = COL_STAGE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, COL_STAGE, COL_STAGE)

      const scale = getCommonScale(COL_STAGE)
      const anchor = playback.anchor ?? 'bottom'
      const baseLineY = anchor === 'center' ? COL_STAGE / 2 : COL_STAGE - 24

      // Lưới tâm chuẩn
      ctx.save()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(COL_STAGE / 2, 0)
      ctx.lineTo(COL_STAGE / 2, COL_STAGE)
      ctx.moveTo(0, baseLineY)
      ctx.lineTo(COL_STAGE, baseLineY)
      ctx.stroke()
      ctx.restore()

      // Bóng mờ tham chiếu của Nhóm #(idx-1) tại đúng frame kích hoạt
      if (showRefOnion && idx > 0 && groups[idx - 1]) {
        const prevG = groups[idx - 1]
        const prevCanvas = canvasMap[prevG.id]
        const prevEnabled = prevG.frames.filter((f) => f.enabled)
        if (prevCanvas && prevEnabled.length > 0) {
          const refIdx =
            g.triggerMode === 'on_frame'
              ? Math.max(0, Math.min(prevEnabled.length - 1, (g.triggerFrameIndex || 1) - 1))
              : prevEnabled.length - 1
          const refFrame = prevEnabled[refIdx] ?? prevEnabled[0]
          ctx.save()
          ctx.globalAlpha = 0.42
          drawFrameOnStage(
            ctx,
            prevCanvas,
            refFrame,
            scale,
            anchor,
            prevG.offsetX,
            prevG.offsetY,
            prevG.scale,
            COL_STAGE
          )
          ctx.restore()

          // Vẽ dấu tâm điểm chạm của Nhóm trước
          const prevCenterX = COL_STAGE / 2 + (prevG.offsetX || 0) * scale
          const prevCenterY = baseLineY + (prevG.offsetY || 0) * scale
          ctx.save()
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(prevCenterX, prevCenterY, 6, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      const gCanvas = canvasMap[g.id]
      const enabledFrames = g.frames.filter((f) => f.enabled)
      if (!gCanvas || enabledFrames.length === 0) return

      const localIdx = Math.max(0, Math.min(enabledFrames.length - 1, colFrameIdxMap[g.id] ?? 0))
      const frame = enabledFrames[localIdx] ?? enabledFrames[0]

      ctx.save()
      drawFrameOnStage(ctx, gCanvas, frame, scale, anchor, g.offsetX, g.offsetY, g.scale, COL_STAGE)
      ctx.restore()

      // Vẽ tâm hiện tại của Nhóm #idx
      const curCenterX = COL_STAGE / 2 + (g.offsetX || 0) * scale
      const curCenterY = baseLineY + (g.offsetY || 0) * scale
      ctx.save()
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(curCenterX - 7, curCenterY)
      ctx.lineTo(curCenterX + 7, curCenterY)
      ctx.moveTo(curCenterX, curCenterY - 7)
      ctx.lineTo(curCenterX, curCenterY + 7)
      ctx.stroke()
      ctx.restore()
    },
    [groups, canvasMap, colFrameIdxMap, showRefOnion, getCommonScale, playback.anchor]
  )

  useEffect(() => {
    if (!alignModalOpen) return
    groups.forEach((g, idx) => drawGroupColumn(g, idx))
  }, [alignModalOpen, groups, drawGroupColumn])

  useEffect(() => {
    if (!alignModalOpen) return
    if (!masterPlaying) {
      drawMasterAtTime(scrubTime)
      return
    }
    let rafId = 0
    const startPerf = performance.now() - scrubTime * 1000
    const tick = (now: number): void => {
      const elapsed = ((now - startPerf) / 1000) % totalDuration
      setScrubTime(elapsed)
      drawMasterAtTime(elapsed)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [alignModalOpen, masterPlaying, totalDuration, drawMasterAtTime])

  if (!alignModalOpen) return null

  return (
    <div
      className="loop-align-studio-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setAlignModalOpen(false)
      }}
    >
      <div
        className="loop-align-studio-modal"
        data-mcp-region="loop_animator_align_studio"
        data-mcp-dialog="loop_animator_align_studio"
        role="dialog"
        aria-modal="true"
        aria-label="Khung So Sánh Đa Cột và Căn Chỉnh Vị Trí Chạy"
      >
        <header className="loop-align-studio-header">
          <div className="loop-align-studio-title">
            <span className="loop-align-badge">📐 STUDIO SO SÁNH & CĂN VỊ TRÍ</span>
            <div>
              <h3>So Sánh Đa Cột & Căn Chỉnh Chuỗi Hoạt Ảnh ({groups.length} nhóm)</h3>
              <p>
                Cột trái chạy Preview Gốc tổ hợp thực tế · Các cột phải hiển thị từng nhóm kèm bóng điểm chạm để kéo khớp toạ độ X/Y và chọn Frame kích hoạt
              </p>
            </div>
          </div>

          <div className="loop-align-header-actions">
            <label className="loop-align-onion-toggle" title="Hiện bóng mờ của nhóm trước tại frame kích hoạt để căn khớp điểm chạm">
              <input
                type="checkbox"
                checked={showRefOnion}
                onChange={(e) => setShowRefOnion(e.target.checked)}
              />
              <span>👁 Bóng điểm chạm nhóm trước</span>
            </label>

            <div className="la-seg" title="Điểm neo sân khấu">
              <button
                type="button"
                className={`la-seg-btn${playback.anchor !== 'center' ? ' active' : ''}`}
                onClick={() => setPlayback({ anchor: 'bottom' })}
              >
                Chân
              </button>
              <button
                type="button"
                className={`la-seg-btn${playback.anchor === 'center' ? ' active' : ''}`}
                onClick={() => setPlayback({ anchor: 'center' })}
              >
                Tâm
              </button>
            </div>

            <div className="la-seg" title="Bố cục màn hình: Cân đối 2 bên hoặc Phóng to cột Preview Gốc để soi chi tiết">
              <button
                type="button"
                className={`la-seg-btn${layoutMode === 'balanced' ? ' active' : ''}`}
                onClick={() => setLayoutMode('balanced')}
              >
                ⚖ Cân đối
              </button>
              <button
                type="button"
                className={`la-seg-btn${layoutMode === 'focus_master' ? ' active' : ''}`}
                onClick={() => setLayoutMode('focus_master')}
              >
                🔍 Soi lớn
              </button>
            </div>

            <div className="loop-bg-pills">
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`loop-bg-pill bg-${bg.id}${playback.previewBg === bg.id ? ' active' : ''}`}
                  onClick={() => setPlayback({ previewBg: bg.id })}
                  title={bg.label}
                />
              ))}
            </div>

            <input
              ref={appendInputRef}
              type="file"
              accept={LOOP_IMAGE_ACCEPT}
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                const list = e.target.files ? Array.from(e.target.files) : []
                if (list.length > 0) void appendLoopImageFilesAsGroups(list)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="la-btn la-btn--xs la-btn--danger"
              onClick={() => appendInputRef.current?.click()}
              title="Tải thêm ảnh hiệu ứng nối tiếp vào cột so sánh"
            >
              + Thêm cột ảnh nối tiếp
            </button>

            <button
              type="button"
              className="la-btn la-btn--xs"
              onClick={() => setAlignModalOpen(false)}
              title="Đóng khung căn chỉnh (Quay lại xưởng chính)"
            >
              <IconX width={13} height={13} />
              <span>Đóng</span>
            </button>
          </div>
        </header>

        <div className={`loop-align-studio-body mode-${layoutMode}`}>
          {/* CỘT 1: PREVIEW GỐC (TỔ HỢP CHẠY THỰC TẾ) */}
          <aside className="loop-align-master-col">
            <div className="loop-align-col-head master">
              <div className="loop-align-col-head-left">
                <span className="loop-align-col-tag">🎬 CỘT PREVIEW GỐC</span>
                <span className="loop-align-col-sub">Tổng {totalDuration.toFixed(2)}s · {groups.length} nhóm</span>
              </div>
              <div className="loop-align-master-head-actions">
                <button
                  type="button"
                  className={`la-btn la-btn--xs${layoutMode === 'focus_master' ? ' la-btn--primary' : ' la-btn--outline'}`}
                  onClick={() => setLayoutMode((m) => (m === 'focus_master' ? 'balanced' : 'focus_master'))}
                  title={layoutMode === 'focus_master' ? 'Thu gọn về chế độ cân đối' : 'Phóng to cột Preview Gốc cực đại để soi chi tiết'}
                >
                  {layoutMode === 'focus_master' ? '⚖ Cân đối' : '⛶ Mở rộng Preview'}
                </button>
              </div>
            </div>

            {/* Thanh công cụ Thu phóng Preview */}
            <div className="loop-align-master-zoom-bar">
              <div className="la-seg la-seg--xs" role="group" aria-label="Thu phóng Preview">
                <button
                  type="button"
                  className="la-seg-btn"
                  onClick={() => setMasterZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  title="Thu nhỏ (-25%)"
                >
                  -
                </button>
                <span className="la-seg-label">{Math.round(masterZoom * 100)}%</span>
                <button
                  type="button"
                  className="la-seg-btn"
                  onClick={() => setMasterZoom((z) => Math.min(3.0, Number((z + 0.25).toFixed(2))))}
                  title="Phóng to (+25%)"
                >
                  +
                </button>
              </div>
              <div className="la-seg la-seg--xs" role="group">
                <button
                  type="button"
                  className={`la-seg-btn${masterZoom === 1 ? ' active' : ''}`}
                  onClick={() => {
                    setMasterZoom(1)
                    setMasterPan({ x: 0, y: 0 })
                  }}
                  title="Khung nhìn gốc 100%"
                >
                  100%
                </button>
                <button
                  type="button"
                  className={`la-seg-btn${masterZoom === 1.5 ? ' active' : ''}`}
                  onClick={() => setMasterZoom(1.5)}
                  title="Phóng to 150%"
                >
                  150%
                </button>
                <button
                  type="button"
                  className={`la-seg-btn${masterZoom === 2.0 ? ' active' : ''}`}
                  onClick={() => setMasterZoom(2.0)}
                  title="Phóng to 200%"
                >
                  200%
                </button>
              </div>
              {(masterZoom !== 1 || masterPan.x !== 0 || masterPan.y !== 0) && (
                <button
                  type="button"
                  className="la-btn la-btn--xs la-btn--outline"
                  onClick={() => {
                    setMasterZoom(1)
                    setMasterPan({ x: 0, y: 0 })
                  }}
                  title="Đặt lại toạ độ xem và thu phóng về ban đầu"
                >
                  ⟲ Đặt lại view
                </button>
              )}
            </div>

            <div
              className={`loop-align-master-stage bg-${playback.previewBg}`}
              onMouseDown={(e) => {
                const isPan = e.button === 1 || e.shiftKey || e.altKey
                const curGroup = groups[activeGroupIndex] ?? groups[0]
                masterDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origOffsetX: curGroup?.offsetX || 0,
                  origOffsetY: curGroup?.offsetY || 0,
                  origPanX: masterPan.x,
                  origPanY: masterPan.y,
                  isPan
                }
              }}
              onMouseMove={(e) => {
                const d = masterDragRef.current
                if (!d) return
                if (d.isPan) {
                  setMasterPan({
                    x: Math.round(d.origPanX + (e.clientX - d.startX)),
                    y: Math.round(d.origPanY + (e.clientY - d.startY))
                  })
                } else {
                  const curGroup = groups[activeGroupIndex]
                  if (!curGroup) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const cssScale = rect.width > 0 ? MASTER_STAGE / rect.width : 1
                  const scale = getCommonScale(MASTER_STAGE, masterZoom) / cssScale
                  const dx = Math.round((e.clientX - d.startX) / Math.max(0.1, scale))
                  const dy = Math.round((e.clientY - d.startY) / Math.max(0.1, scale))
                  updateGroupByIndex(activeGroupIndex, {
                    offsetX: d.origOffsetX + dx,
                    offsetY: d.origOffsetY + dy
                  })
                }
              }}
              onMouseUp={() => {
                masterDragRef.current = null
              }}
              onMouseLeave={() => {
                masterDragRef.current = null
              }}
              onWheel={(e) => {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const delta = e.deltaY < 0 ? 0.15 : -0.15
                const curZoom = masterZoom
                const nextZoom = Math.max(0.5, Math.min(3.0, Number((curZoom + delta).toFixed(2))))
                if (nextZoom === curZoom) return
                const ux = e.clientX - (rect.left + rect.width / 2)
                const uy = e.clientY - (rect.top + rect.height / 2)
                const dx = ux * (1 / nextZoom - 1 / curZoom)
                const dy = uy * (1 / nextZoom - 1 / curZoom)
                setMasterPan((p) => ({
                  x: Math.round(p.x + dx),
                  y: Math.round(p.y + dy)
                }))
                setMasterZoom(nextZoom)
              }}
              title="Kéo chuột trực tiếp để căn chỉnh toạ độ X/Y của nhóm đang chọn · Lăn chuột để phóng to/thu nhỏ · Giữ Shift hoặc Alt để lia khung"
            >
              <canvas ref={masterCanvasRef} className="loop-align-master-canvas" />

              {/* HUD Badge góc trên: Nhóm đang chọn */}
              <div className="loop-align-master-hud-top">
                <span className="loop-align-master-active-pill">
                  🎯 Nhóm #{activeGroupIndex + 1}: {groups[activeGroupIndex]?.name?.replace(/^Nhóm \d+:\s*/i, '')}
                </span>
                <span className="loop-align-master-offset-pill">
                  X:{(groups[activeGroupIndex]?.offsetX || 0) >= 0 ? '+' : ''}{groups[activeGroupIndex]?.offsetX || 0} · Y:{(groups[activeGroupIndex]?.offsetY || 0) >= 0 ? '+' : ''}{groups[activeGroupIndex]?.offsetY || 0} · {Math.round((groups[activeGroupIndex]?.scale || 1) * 100)}%
                </span>
              </div>

              {/* HUD Badge góc dưới: Thời gian & Gợi ý */}
              <div className="loop-align-master-hud-bottom">
                <span className="loop-player-hud-badge">
                  ⏱ {scrubTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
                </span>
                <span className="loop-align-master-hint-pill">
                  🖱 Kéo trực tiếp để căn X/Y · Lăn chuột phóng to
                </span>
              </div>
            </div>

            <div className="loop-align-master-transport">
              <button
                type="button"
                className={`la-btn la-btn--xs ${masterPlaying ? 'la-btn--danger' : 'la-btn--primary'}`}
                onClick={() => setMasterPlaying((v) => !v)}
              >
                {masterPlaying ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
                <span>{masterPlaying ? 'Tạm dừng' : 'Phát tổ hợp'}</span>
              </button>
              <button
                type="button"
                className="la-btn la-btn--xs la-btn--outline"
                onClick={() => {
                  setMasterPlaying(false)
                  const nextT = Math.max(0, Number((scrubTime - 0.05).toFixed(2)))
                  setScrubTime(nextT)
                  drawMasterAtTime(nextT)
                }}
                title="Lùi 1 frame (0.05s)"
              >
                ⏮
              </button>
              <button
                type="button"
                className="la-btn la-btn--xs la-btn--outline"
                onClick={() => {
                  setMasterPlaying(false)
                  const nextT = Math.min(totalDuration, Number((scrubTime + 0.05).toFixed(2)))
                  setScrubTime(nextT)
                  drawMasterAtTime(nextT)
                }}
                title="Tiến 1 frame (0.05s)"
              >
                ⏭
              </button>
              <input
                type="range"
                className="la-range"
                min={0}
                max={totalDuration}
                step={0.01}
                value={Math.min(totalDuration, scrubTime)}
                onChange={(e) => {
                  const t = Number(e.target.value)
                  setMasterPlaying(false)
                  setScrubTime(t)
                  drawMasterAtTime(t)
                }}
                title="Kéo thanh thời gian để soi chính xác thời điểm chuyển giao giữa các nhóm"
              />
            </div>

            {/* Sơ đồ tiến trình chạy của các nhóm */}
            <div className="loop-align-timeline-lanes">
              <div className="loop-align-lanes-title">Tiến trình chạy chuỗi nhóm ({totalDuration.toFixed(2)}s)</div>
              {schedule.items.map((item) => {
                const leftPct = Math.min(100, (item.startTime / totalDuration) * 100)
                const widthPct = Math.max(6, Math.min(100 - leftPct, (item.activeDuration / totalDuration) * 100))
                const isActiveAtScrub = scrubTime >= item.startTime && scrubTime <= item.endTime
                const isSelected = item.groupIndex === activeGroupIndex
                return (
                  <div
                    key={item.group.id}
                    className={`loop-align-lane-row${isActiveAtScrub ? ' is-running' : ''}${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      selectGroup(item.groupIndex)
                      setMasterPlaying(false)
                      setScrubTime(item.startTime)
                      drawMasterAtTime(item.startTime)
                    }}
                    title="Bấm để chọn nhóm này và nhảy con trỏ thời gian tới thời điểm bắt đầu"
                  >
                    <span className="loop-align-lane-name">
                      #{item.groupIndex + 1} {item.group.name?.replace(/^Nhóm \d+:\s*/i, '')}
                    </span>
                    <div className="loop-align-lane-track">
                      <div
                        className="loop-align-lane-bar"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="loop-align-lane-time">
                      {item.startTime.toFixed(2)}s→{item.endTime.toFixed(2)}s
                    </span>
                  </div>
                )
              })}
            </div>
          </aside>

          {/* CÁC CỘT SO SÁNH & CĂN CHỈNH TỪNG NHÓM */}
          <section className="loop-align-columns-grid">
            {groups.map((g, idx) => {
              const isSelected = idx === activeGroupIndex
              const prevGroup = idx > 0 ? groups[idx - 1] : null
              const enabledFrames = g.frames.filter((f) => f.enabled)
              const curLocalFrame = Math.max(0, Math.min(enabledFrames.length - 1, colFrameIdxMap[g.id] ?? 0))
              const schedItem = schedule.items[idx]

              return (
                <LoopGroupColumnCard
                  key={g.id}
                  group={g}
                  index={idx}
                  isSelected={isSelected}
                  prevGroup={prevGroup}
                  curLocalFrame={curLocalFrame}
                  cycleDuration={schedItem?.cycleDuration ?? 1.0}
                  previewBg={playback.previewBg}
                  colStageDim={COL_STAGE}
                  commonScale={getCommonScale(COL_STAGE)}
                  onSelect={() => selectGroup(idx)}
                  onUpdate={(patch) => updateGroupByIndex(idx, patch)}
                  onToggleSyncChroma={() => toggleGroupSyncChroma(idx)}
                  onSetFrameIndex={(fIdx) => setColFrameIdxMap((m) => ({ ...m, [g.id]: fIdx }))}
                  onRegisterCanvas={(el) => {
                    colCanvasRefs.current[g.id] = el
                  }}
                  onDragStartStage={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const cssScale = rect.width > 0 ? COL_STAGE / rect.width : 1
                    dragStateRef.current = {
                      groupIdx: idx,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: g.offsetX || 0,
                      origY: g.offsetY || 0,
                      scale: Math.max(0.05, getCommonScale(COL_STAGE) / cssScale)
                    }
                  }}
                  onDragMoveStage={(e) => {
                    const d = dragStateRef.current
                    if (!d || d.groupIdx !== idx) return
                    const dx = Math.round((e.clientX - d.startX) / d.scale)
                    const dy = Math.round((e.clientY - d.startY) / d.scale)
                    updateGroupByIndex(idx, {
                      offsetX: d.origX + dx,
                      offsetY: d.origY + dy
                    })
                  }}
                  onDragEndStage={() => {
                    dragStateRef.current = null
                  }}
                />
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
