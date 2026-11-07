import React, { useCallback, useEffect, useRef, useState } from 'react'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import { IconFilm, IconPause, IconPlay, IconStepBack, IconStepFwd } from '../icons'
import { LoopPlayerBottomTabs } from './LoopPlayerBottomTabs'
import {
  applyChromaKeyToImageData,
  clearGridBorderPadding
} from './loopFrameExtractor'
import {
  computeLoopGroupsSchedule,
  resolveGroupFrameAtLocalTime
} from './loopGroupManager'
import { useLoopAnimator } from './loopAnimatorState'
import {
  getLoopSourceLogicalSize,
  getRegisteredMemoryCanvas,
  scaleGridConfigForWorkCanvas,
  setLoopSourceCanvasMeta
} from './loopSourceProxy'
import { resolveLoopAssetUrl } from './sampleLoops'
import type { LoopFrameBox, LoopPlaybackConfig, LoopSequenceGroup } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

const STAGE = 440
const STAGE_W = 520
const STAGE_H = 360

export function drawFrameOnStage(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  f: LoopFrameBox,
  scale: number,
  anchor: 'bottom' | 'center' | 'top' | 'left' | 'right',
  groupOffsetX = 0,
  groupOffsetY = 0,
  groupScale = 1,
  stageDim = STAGE,
  stageHeight?: number,
  refBoxW?: number,
  refBoxH?: number
): void {
  const { sx, sy } = getLoopSourceLogicalSize(src)
  const effScale = scale * Math.max(0.1, groupScale || 1)
  const w = Math.round(f.width * effScale)
  const h = Math.round(f.height * effScale)
  const sw = stageDim
  const sh = stageHeight ?? stageDim
  const boxW = refBoxW ? Math.round(refBoxW * effScale) : sw - 16
  const boxH = refBoxH ? Math.round(refBoxH * effScale) : sh - 16
  const boxLeft = Math.round((sw - boxW) * 0.5)
  const boxTop = Math.round((sh - boxH) * 0.5)

  const x =
    anchor === 'left'
      ? Math.round(boxLeft + (f.offsetX + groupOffsetX) * scale)
      : anchor === 'right'
        ? Math.round(boxLeft + boxW - w + (f.offsetX + groupOffsetX) * scale)
        : Math.round((sw - w) * 0.5 + (f.offsetX + groupOffsetX) * scale)
  const y =
    anchor === 'bottom'
      ? Math.round(boxTop + boxH - h + (f.offsetY + groupOffsetY) * scale)
      : anchor === 'top'
        ? Math.round(boxTop + (f.offsetY + groupOffsetY) * scale)
        : Math.round((sh - h) * 0.5 + (f.offsetY + groupOffsetY) * scale)

  ctx.drawImage(
    src,
    f.x * sx,
    f.y * sy,
    Math.max(1, f.width * sx),
    Math.max(1, f.height * sy),
    x,
    y,
    w,
    h
  )
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  f: LoopFrameBox,
  scale: number,
  anchor: 'bottom' | 'center' | 'top' | 'left' | 'right',
  groupOffsetX = 0,
  groupOffsetY = 0,
  groupScale = 1,
  refBoxW?: number,
  refBoxH?: number
): void {
  drawFrameOnStage(
    ctx,
    src,
    f,
    scale,
    anchor,
    groupOffsetX,
    groupOffsetY,
    groupScale,
    STAGE_W,
    STAGE_H,
    refBoxW,
    refBoxH
  )
}

function prevEnabledIndex(frames: LoopFrameBox[], from: number): number {
  for (let step = 1; step < frames.length; step++) {
    const i = (from - step + frames.length) % frames.length
    if (frames[i]?.enabled) return i
  }
  return -1
}

function advanceCursor(
  mode: LoopPlaybackConfig['loopMode'],
  pos: number,
  total: number,
  dir: React.MutableRefObject<1 | -1>
): number {
  if (mode === 'random') {
    let c = Math.floor(Math.random() * total)
    if (c === pos && total > 1) c = (c + 1) % total
    return c
  }
  if (mode === 'ping-pong') {
    let n = pos + dir.current
    if (n >= total) {
      dir.current = -1
      n = Math.max(0, total - 2)
    } else if (n < 0) {
      dir.current = 1
      n = Math.min(total - 1, 1)
    }
    return n
  }
  if (mode === 'once') return pos + 1 < total ? pos + 1 : -1
  return (pos + 1) % total
}

const _groupCanvasCache = new Map<string, HTMLCanvasElement>()

function getGroupCacheKey(g: LoopSequenceGroup): string {
  const c = g.chromaKey
  const pad = g.gridConfig.borderPadding ?? 0
  return `${g.id}:${g.sourceImageUrl.slice(0, 80)}:${pad}:${c.enabled}:${c.keyColor}:${c.similarity}:${c.smoothness}:${c.spill}:${c.shadowMode ?? 'off'}:${c.shadowType ?? 'auto'}:${c.shadowRetention ?? 68}:${c.shadowSolidThreshold ?? 30}:${c.isolationMode ?? 'all'}`
}

export async function ensureGroupProcessedCanvas(g: LoopSequenceGroup): Promise<HTMLCanvasElement | null> {
  const key = getGroupCacheKey(g)
  const cached = _groupCanvasCache.get(key)
  if (cached) return cached

  const mem = getRegisteredMemoryCanvas(g.sourceImageUrl)
  const resolvedUrl = mem ? null : (await resolveLoopAssetUrl(g.sourceImageUrl)) || g.sourceImageUrl
  const srcEl: HTMLImageElement | HTMLCanvasElement | null = mem
    ? mem
    : await new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = resolvedUrl || g.sourceImageUrl
      })
  if (!srcEl) return null

  const logicalW = 'naturalWidth' in srcEl ? srcEl.naturalWidth || srcEl.width || 1024 : srcEl.width || 1024
  const logicalH = 'naturalHeight' in srcEl ? srcEl.naturalHeight || srcEl.height || 1024 : srcEl.height || 1024
  const workScale = Math.min(1, 768 / Math.max(1, logicalW, logicalH))
  const workW = Math.max(1, Math.round(logicalW * workScale))
  const workH = Math.max(1, Math.round(logicalH * workScale))
  const canvas = document.createElement('canvas')
  canvas.width = workW
  canvas.height = workH
  setLoopSourceCanvasMeta(canvas, {
    logicalWidth: logicalW,
    logicalHeight: logicalH,
    workScaleX: workW / Math.max(1, logicalW),
    workScaleY: workH / Math.max(1, logicalH),
    rawImage: srcEl,
    chromaKey: g.chromaKey,
    gridConfig: g.gridConfig
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(srcEl, 0, 0, workW, workH)
  const pad = g.gridConfig.borderPadding ?? 0
  if (pad > 0 || g.chromaKey.enabled) {
    const imgData = ctx.getImageData(0, 0, workW, workH)
    if (pad > 0) {
      clearGridBorderPadding(imgData, scaleGridConfigForWorkCanvas(g.gridConfig, workScale, workScale))
    }
    if (g.chromaKey.enabled) {
      applyChromaKeyToImageData(imgData, g.chromaKey)
    }
    ctx.putImageData(imgData, 0, 0)
  }
  _groupCanvasCache.set(key, canvas)
  return canvas
}

export function LoopAnimatorPlayer({ sourceCanvasRef }: Props): React.ReactElement {
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const sourceVersion = useLoopAnimator((s) => s.sourceVersion)
  const playback = useLoopAnimator((s) => s.playback)
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const comboPreviewMode = useLoopAnimator((s) => s.comboPreviewMode)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const setPlayingFrame = useLoopAnimator((s) => s.setPlayingFrame)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const togglePlaying = useLoopAnimator((s) => s.togglePlaying)
  const updateActiveGroupMeta = useLoopAnimator((s) => s.updateActiveGroupMeta)
  const setComboPreviewMode = useLoopAnimator((s) => s.setComboPreviewMode)

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pingPongDirRef = useRef<1 | -1>(1)
  const cursorRef = useRef(0)
  const stageDragRef = useRef<{
    startX: number
    startY: number
    origOffsetX: number
    origOffsetY: number
    scale: number
  } | null>(null)
  const [groupCanvasReadyRev, setGroupCanvasReadyRev] = useState(0)

  const activeGroup = groups[activeGroupIndex] ?? groups[0]
  const activeFrameIndex = playback.isPlaying ? playingFrameIndex : selectedFrameIndex
  const hasFrames = frames.length > 0
  const showPause = playback.isPlaying && hasFrames
  const isComboActive = groups.length > 1 && comboPreviewMode

  useEffect(() => {
    if (groups.length <= 1) return
    let cancelled = false
    void Promise.all(
      groups.map((g, idx) => (idx === activeGroupIndex ? Promise.resolve(null) : ensureGroupProcessedCanvas(g)))
    ).then(() => {
      if (!cancelled) setGroupCanvasReadyRev((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [groups, activeGroupIndex])

  const getCommonStageBounds = useCallback((): { scale: number; maxW: number; maxH: number } => {
    if (isComboActive && groups.length > 1) {
      let maxW = 1
      let maxH = 1
      for (const g of groups) {
        for (const f of g.frames) {
          if (f.width > maxW) maxW = f.width
          if (f.height > maxH) maxH = f.height
        }
      }
      return {
        scale: Math.min((STAGE_W - 12) / maxW, (STAGE_H - 12) / maxH),
        maxW,
        maxH
      }
    }
    const targetFrames = activeGroup?.frames?.length ? activeGroup.frames : frames
    const maxW = Math.max(1, ...targetFrames.map((f) => f.width))
    const maxH = Math.max(1, ...targetFrames.map((f) => f.height))
    return {
      scale: Math.min((STAGE_W - 12) / maxW, (STAGE_H - 12) / maxH),
      maxW,
      maxH
    }
  }, [isComboActive, groups, activeGroup, frames])

  const drawSingleOrAlignedPreview = useCallback(
    (frameIndex: number, nowSec = 0) => {
      const canvas = previewCanvasRef.current
      const src = sourceCanvasRef.current
      if (!canvas) return
      if (canvas.width !== STAGE_W || canvas.height !== STAGE_H) {
        canvas.width = STAGE_W
        canvas.height = STAGE_H
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, STAGE_W, STAGE_H)
      const current = frames[frameIndex] ?? frames[0]
      if (!src || src.width === 0 || !current) return

      const { scale, maxW, maxH } = getCommonStageBounds()
      const anchor = playback.anchor ?? 'bottom'
      const gOffX = activeGroup?.offsetX ?? 0
      const gOffY = activeGroup?.offsetY ?? 0
      const gScale = activeGroup?.scale ?? 1

      if (activeGroupIndex > 0 && groups[activeGroupIndex - 1]) {
        const prevG = groups[activeGroupIndex - 1]
        const prevCanvas = _groupCanvasCache.get(getGroupCacheKey(prevG))
        const prevEnabled = prevG.frames.filter((f) => f.enabled)
        if (prevCanvas && prevEnabled.length > 0) {
          const refIdx =
            activeGroup?.triggerMode === 'on_frame'
              ? Math.max(0, Math.min(prevEnabled.length - 1, (activeGroup.triggerFrameIndex || 1) - 1))
              : prevEnabled.length - 1
          const refFrame = prevEnabled[refIdx] ?? prevEnabled[0]
          ctx.save()
          ctx.globalAlpha = 0.42
          drawFrame(ctx, prevCanvas, refFrame, scale, anchor, prevG.offsetX, prevG.offsetY, prevG.scale, maxW, maxH)
          ctx.restore()
        }
      }

      const prevIdx = playback.onionSkin ? prevEnabledIndex(frames, frameIndex) : -1
      if (prevIdx >= 0 && prevIdx !== frameIndex) {
        ctx.save()
        ctx.globalAlpha = playback.onionSkinOpacity
        drawFrame(ctx, src, frames[prevIdx], scale, anchor, gOffX, gOffY, gScale, maxW, maxH)
        ctx.restore()
      }

      const r = playback.rhythm
      const fx =
        playback.isPlaying && r.rhythmMode !== 'none'
          ? evaluateLoopLayerRhythm(
              {
                loopRhythmMode: r.rhythmMode,
                loopRhythmRateHz: r.rhythmRateHz,
                loopRhythmIntensity: r.rhythmIntensity,
                loopMinOpacity: r.minOpacity,
                loopScaleBeatPct: r.scaleBeatPct,
                speed: playback.speed
              },
              nowSec,
              0
            )
          : { opacityMultiplier: 1, scaleMultiplier: 1 }
      ctx.save()
      ctx.globalAlpha = fx.opacityMultiplier
      drawFrame(ctx, src, current, scale * fx.scaleMultiplier, anchor, gOffX, gOffY, gScale, maxW, maxH)
      ctx.restore()
    },
    [
      frames,
      activeGroup,
      activeGroupIndex,
      groups,
      getCommonStageBounds,
      playback.onionSkin,
      playback.onionSkinOpacity,
      playback.isPlaying,
      playback.rhythm,
      playback.speed,
      playback.anchor,
      sourceCanvasRef,
      groupCanvasReadyRev
    ]
  )

  const drawComboPreviewAtTime = useCallback(
    (comboTimeSec: number) => {
      const canvas = previewCanvasRef.current
      if (!canvas) return
      if (canvas.width !== STAGE_W || canvas.height !== STAGE_H) {
        canvas.width = STAGE_W
        canvas.height = STAGE_H
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, STAGE_W, STAGE_H)

      const schedule = computeLoopGroupsSchedule(groups)
      const { scale, maxW, maxH } = getCommonStageBounds()
      const anchor = playback.anchor ?? 'bottom'

      for (const item of schedule.items) {
        if (comboTimeSec < item.startTime || comboTimeSec > item.endTime + 1e-3) continue
        const localTime = Math.max(0, comboTimeSec - item.startTime)
        const frame = resolveGroupFrameAtLocalTime(item, localTime)
        if (!frame) continue
        const gCanvas =
          item.groupIndex === activeGroupIndex && sourceCanvasRef.current
            ? sourceCanvasRef.current
            : _groupCanvasCache.get(getGroupCacheKey(item.group))
        if (!gCanvas || gCanvas.width === 0) continue

        ctx.save()
        drawFrame(
          ctx,
          gCanvas,
          frame,
          scale,
          anchor,
          item.group.offsetX,
          item.group.offsetY,
          item.group.scale,
          maxW,
          maxH
        )
        ctx.restore()
      }
    },
    [groups, activeGroupIndex, getCommonStageBounds, playback.anchor, sourceCanvasRef, groupCanvasReadyRev]
  )

  useEffect(() => {
    if (!playback.isPlaying || !isComboActive) {
      drawSingleOrAlignedPreview(activeFrameIndex, performance.now() / 1000)
    }
  }, [activeFrameIndex, sourceVersion, playback.isPlaying, isComboActive, drawSingleOrAlignedPreview])

  useEffect(() => {
    if (!playback.isPlaying) return
    if (isComboActive) {
      const schedule = computeLoopGroupsSchedule(groups)
      const totalDur = Math.max(0.1, schedule.totalDuration)
      let rafId = 0
      const startPerf = performance.now()
      const tickCombo = (now: number): void => {
        const elapsed = ((now - startPerf) / 1000) % totalDur
        drawComboPreviewAtTime(elapsed)
        rafId = requestAnimationFrame(tickCombo)
      }
      rafId = requestAnimationFrame(tickCombo)
      return () => cancelAnimationFrame(rafId)
    }

    const enabled = frames.map((f, i) => (f.enabled ? i : -1)).filter((i) => i >= 0)
    if (enabled.length <= 1) return
    let rafId = 0
    let last = performance.now()
    cursorRef.current = Math.max(0, enabled.indexOf(playingFrameIndex))

    const tick = (now: number): void => {
      const idx = enabled[cursorRef.current] ?? enabled[0]
      const interval =
        (1000 / Math.max(1, playback.fps * (playback.speed || 1))) * (frames[idx]?.durationRatio ?? 1)
      if (now - last >= interval) {
        last = now
        const next = advanceCursor(playback.loopMode, cursorRef.current, enabled.length, pingPongDirRef)
        if (next < 0) {
          setPlayback({ isPlaying: false })
          return
        }
        cursorRef.current = next
        setPlayingFrame(enabled[next] ?? 0)
        drawSingleOrAlignedPreview(enabled[next] ?? 0, now / 1000)
      } else if (playback.rhythm.rhythmMode !== 'none') {
        drawSingleOrAlignedPreview(idx, now / 1000)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [
    playback.isPlaying,
    playback.fps,
    playback.speed,
    playback.loopMode,
    playback.rhythm.rhythmMode,
    isComboActive,
    groups,
    frames,
    setPlayingFrame,
    setPlayback,
    drawSingleOrAlignedPreview,
    drawComboPreviewAtTime
  ])

  const stepFrame = (delta: -1 | 1): void => {
    if (!hasFrames) return
    setPlayback({ isPlaying: false })
    if (isComboActive) setComboPreviewMode(false)
    selectFrame((selectedFrameIndex + delta + frames.length) % frames.length)
  }

  return (
    <div className="loop-player-pane" data-mcp-region="loop_animator_player" style={{ position: 'relative' }}>
      <div
        className={`loop-player-stage bg-${playback.previewBg}`}
        data-mcp-region="loop_animator_stage"
        title="Kéo chuột trực tiếp trên sân khấu để dịch chuyển vị trí chạy (X, Y) của nhóm đang chọn"
        onMouseDown={(e) => {
          if (!hasFrames || !activeGroup) return
          const rect = e.currentTarget.getBoundingClientRect()
          const cssScale = rect.width > 0 ? STAGE_W / rect.width : 1
          stageDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origOffsetX: activeGroup.offsetX || 0,
            origOffsetY: activeGroup.offsetY || 0,
            scale: Math.max(0.05, getCommonStageBounds().scale / cssScale)
          }
        }}
        onMouseMove={(e) => {
          const drag = stageDragRef.current
          if (!drag) return
          const dx = Math.round((e.clientX - drag.startX) / drag.scale)
          const dy = Math.round((e.clientY - drag.startY) / drag.scale)
          updateActiveGroupMeta({
            offsetX: drag.origOffsetX + dx,
            offsetY: drag.origOffsetY + dy
          })
        }}
        onMouseUp={() => {
          stageDragRef.current = null
        }}
        onMouseLeave={() => {
          stageDragRef.current = null
        }}
        style={{ cursor: hasFrames ? 'grab' : 'default' }}
      >
        <canvas ref={previewCanvasRef} className="loop-player-canvas" />
        {hasFrames ? (
          <>
            <span className="loop-player-hud-badge">
              {isComboActive
                ? `🔗 Tổ hợp ${groups.length} nhóm`
                : `#${activeFrameIndex + 1} / ${frames.length}`}
            </span>
            {activeGroup && (activeGroup.offsetX !== 0 || activeGroup.offsetY !== 0 || groups.length > 1) && (
              <span
                className="loop-player-hud-pos-badge"
                title="Toạ độ lệch của nhóm đang chọn (kéo trên sân khấu để căn vị trí chạm)"
              >
                N#{activeGroupIndex + 1}: X{activeGroup.offsetX >= 0 ? `+${activeGroup.offsetX}` : activeGroup.offsetX} · Y
                {activeGroup.offsetY >= 0 ? `+${activeGroup.offsetY}` : activeGroup.offsetY}
              </span>
            )}
          </>
        ) : (
          <div className="loop-player-empty">
            <IconFilm width={22} height={22} />
            <span>Chưa có khung hình</span>
          </div>
        )}
      </div>

      <div className="loop-transport-bar">
        <button
          type="button"
          className="la-icon-btn la-icon-btn--bordered"
          disabled={!hasFrames}
          onClick={() => stepFrame(-1)}
          title="Lùi 1 frame"
          aria-label="Lùi 1 frame"
        >
          <IconStepBack width={14} height={14} />
        </button>
        <button
          type="button"
          className={`la-btn ${showPause ? 'la-btn--danger' : 'la-btn--primary'} loop-play-btn`}
          disabled={!hasFrames}
          onClick={togglePlaying}
        >
          {showPause ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
          <span>{showPause ? 'Tạm dừng' : 'Phát loop'}</span>
        </button>
        <button
          type="button"
          className="la-icon-btn la-icon-btn--bordered"
          disabled={!hasFrames}
          onClick={() => stepFrame(1)}
          title="Tiến 1 frame"
          aria-label="Tiến 1 frame"
        >
          <IconStepFwd width={14} height={14} />
        </button>
        <span className="loop-transport-info">
          {playback.fps} FPS × {playback.speed}
        </span>
      </div>

      <LoopPlayerBottomTabs />
    </div>
  )
}
