import React, { useCallback, useEffect, useRef } from 'react'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import { IconFilm, IconPause, IconPlay, IconStepBack, IconStepFwd } from '../icons'
import { LoopPlayerSettings } from './LoopPlayerSettings'
import { useLoopAnimator } from './loopAnimatorState'
import { getLoopSourceLogicalSize } from './loopSourceProxy'
import type { LoopFrameBox, LoopPlaybackConfig } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

const STAGE = 360
const BG_OPTIONS: { id: LoopPlaybackConfig['previewBg']; label: string }[] = [
  { id: 'checker', label: 'Ô caro trong suốt' },
  { id: 'dark', label: 'Nền tối' },
  { id: 'light', label: 'Nền sáng' },
  { id: 'green', label: 'Nền xanh lá' }
]

function drawFrame(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  f: LoopFrameBox,
  scale: number,
  anchor: 'bottom' | 'center'
): void {
  const { sx, sy } = getLoopSourceLogicalSize(src)
  const w = Math.round(f.width * scale)
  const h = Math.round(f.height * scale)
  const x = Math.round((STAGE - w) * 0.5 + f.offsetX * scale)
  const y = anchor === 'bottom' ? Math.round(STAGE - 24 - h + f.offsetY * scale) : Math.round((STAGE - h) * 0.5 + f.offsetY * scale)
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

function prevEnabledIndex(frames: LoopFrameBox[], from: number): number {
  for (let step = 1; step < frames.length; step++) {
    const i = (from - step + frames.length) % frames.length
    if (frames[i]?.enabled) return i
  }
  return -1
}

/** Vị trí kế tiếp trong danh sách frame đang bật theo kiểu lặp; -1 = dừng (chế độ 1 lần) */
function advanceCursor(mode: LoopPlaybackConfig['loopMode'], pos: number, total: number, dir: React.MutableRefObject<1 | -1>): number {
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

export function LoopAnimatorPlayer({ sourceCanvasRef }: Props): React.ReactElement {
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const sourceVersion = useLoopAnimator((s) => s.sourceVersion)
  const playback = useLoopAnimator((s) => s.playback)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const setPlayingFrame = useLoopAnimator((s) => s.setPlayingFrame)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const togglePlaying = useLoopAnimator((s) => s.togglePlaying)

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pingPongDirRef = useRef<1 | -1>(1)
  const cursorRef = useRef(0)
  const activeFrameIndex = playback.isPlaying ? playingFrameIndex : selectedFrameIndex
  const hasFrames = frames.length > 0
  const showPause = playback.isPlaying && hasFrames

  const drawPreviewFrame = useCallback(
    (frameIndex: number, nowSec = 0) => {
      const canvas = previewCanvasRef.current
      const src = sourceCanvasRef.current
      if (!canvas) return
      if (canvas.width !== STAGE) canvas.width = canvas.height = STAGE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, STAGE, STAGE)
      const current = frames[frameIndex] ?? frames[0]
      if (!src || src.width === 0 || !current) return

      // Tỉ lệ chung cho mọi frame để hoạt ảnh không bị co giãn nhịp
      const maxW = Math.max(1, ...frames.map((f) => f.width))
      const maxH = Math.max(1, ...frames.map((f) => f.height))
      const scale = Math.min((STAGE - 36) / maxW, (STAGE - 36) / maxH)
      const anchor = playback.anchor ?? 'bottom'

      const prevIdx = playback.onionSkin ? prevEnabledIndex(frames, frameIndex) : -1
      if (prevIdx >= 0 && prevIdx !== frameIndex) {
        ctx.save()
        ctx.globalAlpha = playback.onionSkinOpacity
        drawFrame(ctx, src, frames[prevIdx], scale, anchor)
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
      drawFrame(ctx, src, current, scale * fx.scaleMultiplier, anchor)
      ctx.restore()
    },
    [frames, playback.onionSkin, playback.onionSkinOpacity, playback.isPlaying, playback.rhythm, playback.speed, playback.anchor, sourceCanvasRef]
  )

  useEffect(() => {
    drawPreviewFrame(activeFrameIndex, performance.now() / 1000)
  }, [activeFrameIndex, sourceVersion, drawPreviewFrame])

  // Vòng RAF mượt 60fps, chỉ đổi frame khi đủ thời lượng (FPS × tốc độ × hệ số giữ frame)
  useEffect(() => {
    if (!playback.isPlaying) return
    const enabled = frames.map((f, i) => (f.enabled ? i : -1)).filter((i) => i >= 0)
    if (enabled.length <= 1) return
    let rafId = 0
    let last = performance.now()
    cursorRef.current = Math.max(0, enabled.indexOf(playingFrameIndex))

    const tick = (now: number): void => {
      const idx = enabled[cursorRef.current] ?? enabled[0]
      const interval = (1000 / Math.max(1, playback.fps * (playback.speed || 1))) * (frames[idx]?.durationRatio ?? 1)
      if (now - last >= interval) {
        last = now
        const next = advanceCursor(playback.loopMode, cursorRef.current, enabled.length, pingPongDirRef)
        if (next < 0) {
          setPlayback({ isPlaying: false })
          return
        }
        cursorRef.current = next
        setPlayingFrame(enabled[next] ?? 0)
        drawPreviewFrame(enabled[next] ?? 0, now / 1000)
      } else if (playback.rhythm.rhythmMode !== 'none') {
        drawPreviewFrame(idx, now / 1000)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [playback.isPlaying, playback.fps, playback.speed, playback.loopMode, playback.rhythm.rhythmMode, frames, setPlayingFrame, setPlayback, drawPreviewFrame])

  const stepFrame = (delta: -1 | 1): void => {
    if (!hasFrames) return
    setPlayback({ isPlaying: false })
    selectFrame((selectedFrameIndex + delta + frames.length) % frames.length)
  }

  return (
    <div className="loop-player-pane" data-mcp-region="loop_animator_player">
      <div className="loop-pane-toolbar">
        <div className="loop-pane-heading">
          <span className="loop-step">2</span>
          <span>Xem trước</span>
        </div>
        <div className="la-seg" title="Điểm neo khi phát">
          <button type="button" className={`la-seg-btn${playback.anchor !== 'center' ? ' active' : ''}`} onClick={() => setPlayback({ anchor: 'bottom' })} title="Giữ đáy frame cố định trên mặt sàn">
            Chân
          </button>
          <button type="button" className={`la-seg-btn${playback.anchor === 'center' ? ' active' : ''}`} onClick={() => setPlayback({ anchor: 'center' })} title="Căn giữa sân khấu">
            Tâm
          </button>
        </div>
        <div className="loop-bg-pills" role="radiogroup" aria-label="Nền sân khấu">
          {BG_OPTIONS.map((bg) => (
            <button key={bg.id} type="button" role="radio" aria-checked={playback.previewBg === bg.id} className={`loop-bg-pill bg-${bg.id}${playback.previewBg === bg.id ? ' active' : ''}`} onClick={() => setPlayback({ previewBg: bg.id })} title={bg.label} aria-label={bg.label} />
          ))}
        </div>
      </div>

      <div className={`loop-player-stage bg-${playback.previewBg}`} data-mcp-region="loop_animator_stage">
        <canvas ref={previewCanvasRef} className="loop-player-canvas" />
        {hasFrames ? (
          <span className="loop-player-hud-badge">
            #{activeFrameIndex + 1} / {frames.length}
          </span>
        ) : (
          <div className="loop-player-empty">
            <IconFilm width={22} height={22} />
            <span>Chưa có khung hình</span>
          </div>
        )}
      </div>

      <div className="loop-transport-bar">
        <button type="button" className="la-icon-btn la-icon-btn--bordered" disabled={!hasFrames} onClick={() => stepFrame(-1)} title="Lùi 1 frame" aria-label="Lùi 1 frame">
          <IconStepBack width={14} height={14} />
        </button>
        <button type="button" className={`la-btn ${showPause ? 'la-btn--outline' : 'la-btn--primary'} loop-play-btn`} disabled={!hasFrames} onClick={togglePlaying}>
          {showPause ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
          <span>{showPause ? 'Tạm dừng' : 'Phát loop'}</span>
        </button>
        <button type="button" className="la-icon-btn la-icon-btn--bordered" disabled={!hasFrames} onClick={() => stepFrame(1)} title="Tiến 1 frame" aria-label="Tiến 1 frame">
          <IconStepFwd width={14} height={14} />
        </button>
        <span className="loop-transport-info">
          {playback.fps} FPS × {playback.speed}
        </span>
      </div>

      <LoopPlayerSettings />
    </div>
  )
}
