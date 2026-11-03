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
import type { LoopSequenceGroup, LoopTriggerMode } from './types'
import { IconPause, IconPlay, IconX } from '../icons'

const MASTER_STAGE = 300
const COL_STAGE = 220

const BG_OPTIONS = [
  { id: 'checker', label: 'Trong suốt (caro)' },
  { id: 'dark', label: 'Đen' },
  { id: 'light', label: 'Trắng' },
  { id: 'green', label: 'Xanh lá' }
] as const

const TRIGGER_OPTIONS: Array<{ id: LoopTriggerMode; label: string; hint: string }> = [
  { id: 'sequential', label: '⏭ Nối tiếp', hint: 'Chạy sau khi nhóm trước kết thúc (+ thời gian chờ)' },
  { id: 'on_frame', label: '⚡ Tại Frame #', hint: 'Bắt đầu ngay tại frame chỉ định của nhóm trước (VD: sét chạm đất → nổ)' },
  { id: 'parallel', label: '⇉ Song song', hint: 'Chạy cùng thời điểm với nhóm trước (+ độ trễ nếu có)' }
]

const HOLD_PRESETS = [
  { label: '1 vòng', value: 0 },
  { label: '1.5s', value: 1.5 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '8s', value: 8 }
]

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
  const [canvasMap, setCanvasMap] = useState<Record<string, HTMLCanvasElement>>({})
  const [colFrameIdxMap, setColFrameIdxMap] = useState<Record<string, number>>({})

  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const colCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
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
    (stageSize: number): number => {
      let maxW = 1
      let maxH = 1
      for (const g of groups) {
        for (const f of g.frames) {
          if (f.width > maxW) maxW = f.width
          if (f.height > maxH) maxH = f.height
        }
      }
      return Math.min((stageSize - 32) / maxW, (stageSize - 32) / maxH)
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

      const scale = getCommonScale(MASTER_STAGE)
      const anchor = playback.anchor ?? 'bottom'

      // Vẽ đường tâm toạ độ mảnh để đối chiếu vị trí
      ctx.save()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(MASTER_STAGE / 2, 0)
      ctx.lineTo(MASTER_STAGE / 2, MASTER_STAGE)
      const baseLineY = anchor === 'center' ? MASTER_STAGE / 2 : MASTER_STAGE - 18
      ctx.moveTo(0, baseLineY)
      ctx.lineTo(MASTER_STAGE, baseLineY)
      ctx.stroke()
      ctx.restore()

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
      }
    },
    [schedule, canvasMap, getCommonScale, playback.anchor]
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
      const baseLineY = anchor === 'center' ? COL_STAGE / 2 : COL_STAGE - 18

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

        <div className="loop-align-studio-body">
          {/* CỘT 1: PREVIEW GỐC (TỔ HỢP CHẠY THỰC TẾ) */}
          <aside className="loop-align-master-col">
            <div className="loop-align-col-head master">
              <span className="loop-align-col-tag">🎬 CỘT PREVIEW GỐC</span>
              <span className="loop-align-col-sub">Tổng {totalDuration.toFixed(2)}s · {groups.length} nhóm</span>
            </div>

            <div className={`loop-align-master-stage bg-${playback.previewBg}`}>
              <canvas ref={masterCanvasRef} className="loop-align-master-canvas" />
              <span className="loop-player-hud-badge">
                ⏱ {scrubTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
              </span>
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
                return (
                  <div
                    key={item.group.id}
                    className={`loop-align-lane-row${isActiveAtScrub ? ' is-running' : ''}`}
                    onClick={() => {
                      selectGroup(item.groupIndex)
                      setMasterPlaying(false)
                      setScrubTime(item.startTime)
                      drawMasterAtTime(item.startTime)
                    }}
                    title="Bấm để nhảy con trỏ thời gian tới thời điểm nhóm này bắt đầu"
                  >
                    <span className="loop-align-lane-name">
                      #{item.groupIndex + 1} {item.group.name}
                    </span>
                    <div className="loop-align-lane-track">
                      <div
                        className="loop-align-lane-bar"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="loop-align-lane-time">
                      {item.startTime.toFixed(1)}s→{item.endTime.toFixed(1)}s
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
              const prevEnabledCount = prevGroup ? prevGroup.frames.filter((f) => f.enabled).length : 0
              const enabledFrames = g.frames.filter((f) => f.enabled)
              const curLocalFrame = Math.max(0, Math.min(enabledFrames.length - 1, colFrameIdxMap[g.id] ?? 0))
              const schedItem = schedule.items[idx]

              return (
                <div
                  key={g.id}
                  className={`loop-align-col-card${isSelected ? ' active' : ''}`}
                  onClick={() => selectGroup(idx)}
                >
                  <div className="loop-align-col-head">
                    <div className="loop-align-col-head-left">
                      <span className="loop-align-col-num">Nhóm #{idx + 1}</span>
                      <input
                        type="text"
                        className="la-input loop-align-name-input"
                        value={g.name}
                        onChange={(e) => updateGroupByIndex(idx, { name: e.target.value })}
                        title="Tên nhóm hiệu ứng"
                      />
                    </div>
                    <label
                      className="loop-align-sync-chk"
                      onClick={(e) => e.stopPropagation()}
                      title="Tích để nhóm này ăn theo thông số Tách nền chung"
                    >
                      <input
                        type="checkbox"
                        checked={g.syncChromaKey !== false}
                        onChange={() => toggleGroupSyncChroma(idx)}
                      />
                      <span>Đồng bộ nền</span>
                    </label>
                  </div>

                  {/* Sân khấu kéo thả căn chỉnh vị trí trực tiếp của cột #idx */}
                  <div
                    className={`loop-align-col-stage bg-${playback.previewBg}`}
                    title="Kéo chuột trực tiếp trên khung này để căn vị trí (X, Y) của nhóm khớp với điểm chạm"
                    onMouseDown={(e) => {
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
                    onMouseMove={(e) => {
                      const d = dragStateRef.current
                      if (!d || d.groupIdx !== idx) return
                      const dx = Math.round((e.clientX - d.startX) / d.scale)
                      const dy = Math.round((e.clientY - d.startY) / d.scale)
                      updateGroupByIndex(idx, {
                        offsetX: d.origX + dx,
                        offsetY: d.origY + dy
                      })
                    }}
                    onMouseUp={() => {
                      dragStateRef.current = null
                    }}
                    onMouseLeave={() => {
                      dragStateRef.current = null
                    }}
                  >
                    <canvas
                      ref={(el) => {
                        colCanvasRefs.current[g.id] = el
                      }}
                      className="loop-align-col-canvas"
                    />
                    <span className="loop-player-hud-badge">
                      Frame #{curLocalFrame + 1}/{Math.max(1, enabledFrames.length)}
                    </span>
                    <span className="loop-player-hud-pos-badge">
                      X:{g.offsetX >= 0 ? `+${g.offsetX}` : g.offsetX} · Y:{g.offsetY >= 0 ? `+${g.offsetY}` : g.offsetY} · {Math.round((g.scale || 1) * 100)}%
                    </span>
                  </div>

                  {/* Thanh chọn Frame để soi & nút căn tâm nhanh */}
                  <div className="loop-align-col-stage-bar">
                    <div className="loop-align-frame-stepper">
                      <button
                        type="button"
                        className="la-btn la-btn--xs"
                        onClick={() =>
                          setColFrameIdxMap((m) => ({
                            ...m,
                            [g.id]: (curLocalFrame - 1 + Math.max(1, enabledFrames.length)) % Math.max(1, enabledFrames.length)
                          }))
                        }
                        title="Xem frame trước của nhóm này"
                      >
                        ◀
                      </button>
                      <span>Soi F#{curLocalFrame + 1}</span>
                      <button
                        type="button"
                        className="la-btn la-btn--xs"
                        onClick={() =>
                          setColFrameIdxMap((m) => ({
                            ...m,
                            [g.id]: (curLocalFrame + 1) % Math.max(1, enabledFrames.length)
                          }))
                        }
                        title="Xem frame tiếp theo của nhóm này"
                      >
                        ▶
                      </button>
                    </div>

                    <div className="loop-align-quick-pos">
                      <button
                        type="button"
                        className="la-btn la-btn--xs"
                        onClick={() => updateGroupByIndex(idx, { offsetX: 0, offsetY: 0, scale: 1 })}
                        title="Đưa nhóm về tâm gốc (0, 0)"
                      >
                        🎯 Tâm 0,0
                      </button>
                      {prevGroup && (
                        <button
                          type="button"
                          className="la-btn la-btn--xs"
                          onClick={() =>
                            updateGroupByIndex(idx, {
                              offsetX: prevGroup.offsetX || 0,
                              offsetY: prevGroup.offsetY || 0
                            })
                          }
                          title={`Khớp toạ độ X, Y bằng với Nhóm #${idx}`}
                        >
                          ⊕ Khớp N#{idx}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toạ độ X / Y / Tỉ lệ */}
                  <div className="loop-align-coords-grid">
                    <label className="loop-align-num-field">
                      <span>Vị trí X (px)</span>
                      <input
                        type="number"
                        className="la-input la-input--xs"
                        step={2}
                        value={Math.round(g.offsetX || 0)}
                        onChange={(e) => updateGroupByIndex(idx, { offsetX: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="loop-align-num-field">
                      <span>Vị trí Y (px)</span>
                      <input
                        type="number"
                        className="la-input la-input--xs"
                        step={2}
                        value={Math.round(g.offsetY || 0)}
                        onChange={(e) => updateGroupByIndex(idx, { offsetY: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="loop-align-num-field">
                      <span>Tỉ lệ (%)</span>
                      <input
                        type="number"
                        className="la-input la-input--xs"
                        min={10}
                        max={400}
                        step={5}
                        value={Math.round((g.scale || 1) * 100)}
                        onChange={(e) =>
                          updateGroupByIndex(idx, {
                            scale: Math.max(0.1, Math.min(4, (Number(e.target.value) || 100) / 100))
                          })
                        }
                      />
                    </label>
                  </div>

                  {/* Logic Kích Hoạt & Thời Lượng */}
                  <div className="loop-align-logic-box">
                    {idx === 0 ? (
                      <div className="loop-align-first-badge">
                        🎬 Nhóm mở đầu chuỗi (Bắt đầu tại 0.00s · tự nhiên {schedItem?.cycleDuration.toFixed(2)}s)
                      </div>
                    ) : (
                      <>
                        <div className="loop-align-logic-label">
                          Khi nào Nhóm #{idx + 1} bắt đầu chạy (so với Nhóm #{idx})?
                        </div>
                        <div className="la-seg loop-align-trigger-seg">
                          {TRIGGER_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className={`la-seg-btn${g.triggerMode === opt.id ? ' active' : ''}`}
                              onClick={() => updateGroupByIndex(idx, { triggerMode: opt.id })}
                              title={opt.hint}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {g.triggerMode === 'on_frame' && prevEnabledCount > 0 && (
                          <div className="loop-align-frame-picker">
                            <span className="loop-align-picker-lbl">
                              Chọn Frame của Nhóm #{idx} kích hoạt Nhóm #{idx + 1}:
                            </span>
                            <div className="loop-align-frame-pills">
                              {Array.from({ length: Math.min(24, prevEnabledCount) }, (_, fIdx) => {
                                const fNum = fIdx + 1
                                const isTrig = (g.triggerFrameIndex || 1) === fNum
                                return (
                                  <button
                                    key={fNum}
                                    type="button"
                                    className={`loop-align-f-pill${isTrig ? ' active' : ''}`}
                                    onClick={() => updateGroupByIndex(idx, { triggerFrameIndex: fNum })}
                                  >
                                    #{fNum}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="loop-align-timing-row">
                      {idx > 0 && (
                        <label className="loop-align-num-field">
                          <span>Chờ thêm (s)</span>
                          <input
                            type="number"
                            className="la-input la-input--xs"
                            min={0}
                            max={60}
                            step={0.1}
                            value={g.delaySec}
                            onChange={(e) =>
                              updateGroupByIndex(idx, {
                                delaySec: Math.max(0, Number(e.target.value) || 0)
                              })
                            }
                          />
                        </label>
                      )}
                      <label className="loop-align-num-field">
                        <span>Giữ chạy (s)</span>
                        <input
                          type="number"
                          className="la-input la-input--xs"
                          min={0}
                          max={300}
                          step={0.2}
                          value={g.holdDurationSec}
                          onChange={(e) =>
                            updateGroupByIndex(idx, {
                              holdDurationSec: Math.max(0, Number(e.target.value) || 0)
                            })
                          }
                          title="0 = chạy đúng 1 vòng tự nhiên; >0 = giữ lặp lại trong số giây chỉ định"
                        />
                      </label>
                      <div className="loop-align-hold-pills">
                        {HOLD_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            className={`loop-align-f-pill${Math.abs((g.holdDurationSec || 0) - p.value) < 0.05 ? ' active' : ''}`}
                            onClick={() => updateGroupByIndex(idx, { holdDurationSec: p.value })}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
