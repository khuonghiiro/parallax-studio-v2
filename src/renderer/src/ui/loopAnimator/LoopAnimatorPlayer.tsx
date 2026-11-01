import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  IconPlay,
  IconPause,
  IconStepBack,
  IconStepFwd,
  IconSkipStart,
  IconOnionSkin
} from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopMode, CanvasBgType } from './types'

export interface LoopAnimatorPlayerProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

const FPS_PRESETS = [6, 8, 12, 16, 24, 30]

export function LoopAnimatorPlayer({ sourceCanvasRef }: LoopAnimatorPlayerProps) {
  const frames = useLoopAnimator((s) => s.frames)
  const playback = useLoopAnimator((s) => s.playback)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(performance.now())
  const accumulatedTimeRef = useRef<number>(0)
  const pingPongDirRef = useRef<number>(1) // 1 = forward, -1 = backward

  const enabledFrames = frames.filter((f) => f.enabled)
  const [zoom, setZoom] = useState<number>(1)

  // Đổi frame kế tiếp theo loopMode
  const advanceFrame = useCallback(
    (currentIdx: number, forward = true): number => {
      if (enabledFrames.length <= 1) return 0
      const currentPos = enabledFrames.findIndex((f) => f.index === currentIdx)
      const validPos = currentPos >= 0 ? currentPos : 0

      if (playback.loopMode === 'ping-pong') {
        let nextPos = validPos + (forward ? pingPongDirRef.current : -pingPongDirRef.current)
        if (nextPos >= enabledFrames.length) {
          pingPongDirRef.current = -1
          nextPos = Math.max(0, enabledFrames.length - 2)
        } else if (nextPos < 0) {
          pingPongDirRef.current = 1
          nextPos = Math.min(enabledFrames.length - 1, 1)
        }
        return enabledFrames[nextPos]?.index ?? 0
      } else if (playback.loopMode === 'once') {
        const nextPos = Math.min(enabledFrames.length - 1, validPos + (forward ? 1 : -1))
        if (nextPos >= enabledFrames.length - 1 && forward) {
          setPlayback({ isPlaying: false })
        }
        return enabledFrames[Math.max(0, nextPos)]?.index ?? 0
      } else {
        // 'loop'
        const nextPos = (validPos + (forward ? 1 : -1) + enabledFrames.length) % enabledFrames.length
        return enabledFrames[nextPos]?.index ?? 0
      }
    },
    [enabledFrames, playback.loopMode, setPlayback]
  )

  // Vẽ frame lên Canvas xem trước
  const renderPlayer = useCallback(() => {
    const canvas = canvasRef.current
    const sourceCanvas = sourceCanvasRef.current
    if (!canvas || !sourceCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const curFrame = frames[selectedFrameIndex] || frames[0]
    if (!curFrame) return

    const w = curFrame.width || 256
    const h = curFrame.height || 256

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    ctx.clearRect(0, 0, w, h)

    // 1. Onion Skinning (Bóng mờ khung hình trước)
    if (playback.onionSkin && enabledFrames.length > 1) {
      const prevIdx = (selectedFrameIndex - 1 + frames.length) % frames.length
      const prevFrame = frames[prevIdx]
      if (prevFrame && prevFrame.enabled) {
        ctx.save()
        ctx.globalAlpha = playback.onionSkinOpacity || 0.35
        ctx.drawImage(
          sourceCanvas,
          prevFrame.x,
          prevFrame.y,
          prevFrame.width,
          prevFrame.height,
          prevFrame.offsetX || 0,
          prevFrame.offsetY || 0,
          w,
          h
        )
        ctx.restore()
      }
    }

    // 2. Khung hình chính hiện tại
    ctx.save()
    ctx.drawImage(
      sourceCanvas,
      curFrame.x,
      curFrame.y,
      curFrame.width,
      curFrame.height,
      curFrame.offsetX || 0,
      curFrame.offsetY || 0,
      w,
      h
    )
    ctx.restore()
  }, [frames, selectedFrameIndex, playback.onionSkin, playback.onionSkinOpacity, sourceCanvasRef, enabledFrames.length])

  // Vòng lặp Animation Loop 60fps
  useEffect(() => {
    let active = true

    const loop = (now: number) => {
      if (!active) return

      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      if (playback.isPlaying && enabledFrames.length > 0) {
        accumulatedTimeRef.current += dt
        const curFrame = frames[selectedFrameIndex] || frames[0]
        const mult = curFrame?.durationMultiplier || 1
        const frameInterval = (1 / Math.max(1, playback.fps)) * mult

        if (accumulatedTimeRef.current >= frameInterval) {
          accumulatedTimeRef.current -= frameInterval
          if (accumulatedTimeRef.current > frameInterval * 2) {
            accumulatedTimeRef.current = 0
          }
          const nextIndex = advanceFrame(selectedFrameIndex, true)
          selectFrame(nextIndex)
        }
      }

      renderPlayer()
      animFrameRef.current = requestAnimationFrame(loop)
    }

    lastTimeRef.current = performance.now()
    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      active = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [playback.isPlaying, playback.fps, enabledFrames.length, frames, selectedFrameIndex, advanceFrame, selectFrame, renderPlayer])

  const togglePlay = () => {
    setPlayback({ isPlaying: !playback.isPlaying })
  }

  const handleStep = (forward: boolean) => {
    setPlayback({ isPlaying: false })
    const next = advanceFrame(selectedFrameIndex, forward)
    selectFrame(next)
  }

  const handleReset = () => {
    setPlayback({ isPlaying: false })
    const first = enabledFrames[0]?.index ?? 0
    selectFrame(first)
  }

  return (
    <div className="loop-player-card" data-mcp-region="loop_animator_stage">
      {/* Header trình phát */}
      <div className="loop-player-header">
        <span className="loop-player-title">
          🎬 Xem Trước Hoạt Ảnh Lặp ({frames.length} frames)
        </span>
        <div className="loop-player-bg-picker">
          {(['checker-dark', 'checker-light', 'black', 'white'] as CanvasBgType[]).map((bg) => (
            <button
              key={bg}
              type="button"
              className={`loop-bg-dot ${bg}${playback.canvasBg === bg ? ' active' : ''}`}
              title={`Nền: ${bg}`}
              onClick={() => setPlayback({ canvasBg: bg })}
            />
          ))}
        </div>
      </div>

      {/* Stage Canvas */}
      <div className={`loop-player-stage bg-${playback.canvasBg}`}>
        <div
          className="loop-player-viewport"
          style={{ transform: `scale(${zoom})` }}
        >
          <canvas ref={canvasRef} className="loop-player-canvas" />
        </div>

        {/* Badge thông số góc dưới */}
        <div className="loop-player-hud">
          <span className="loop-hud-badge">
            Frame {selectedFrameIndex + 1}/{frames.length}
          </span>
          <span className="loop-hud-badge">
            {((1 / Math.max(1, playback.fps)) * (frames[selectedFrameIndex]?.durationMultiplier || 1)).toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Thanh điều khiển Playback Transport */}
      <div className="loop-player-controls">
        <div className="loop-transport-buttons">
          <button
            type="button"
            className="btn icon sm ghost"
            title="Về frame đầu tiên"
            onClick={handleReset}
          >
            <IconSkipStart width={14} height={14} />
          </button>
          <button
            type="button"
            className="btn icon sm ghost"
            title="Lùi 1 frame"
            onClick={() => handleStep(false)}
          >
            <IconStepBack width={14} height={14} />
          </button>
          <button
            type="button"
            className={`btn icon md ${playback.isPlaying ? 'primary' : 'accent'}`}
            title={playback.isPlaying ? 'Tạm dừng (Space)' : 'Phát lặp (Space)'}
            onClick={togglePlay}
          >
            {playback.isPlaying ? (
              <IconPause width={16} height={16} />
            ) : (
              <IconPlay width={16} height={16} />
            )}
          </button>
          <button
            type="button"
            className="btn icon sm ghost"
            title="Tiến 1 frame"
            onClick={() => handleStep(true)}
          >
            <IconStepFwd width={14} height={14} />
          </button>
        </div>

        {/* Thanh trượt Playhead Scrubber */}
        <div className="loop-scrubber-wrap">
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={selectedFrameIndex}
            onChange={(e) => {
              setPlayback({ isPlaying: false })
              selectFrame(Number(e.target.value))
            }}
            className="loop-scrubber-slider"
          />
        </div>

        {/* Nút bật Onion Skinning */}
        <button
          type="button"
          className={`btn sm ghost${playback.onionSkin ? ' active' : ''}`}
          title="Bật/Tắt bóng mờ khung hình trước (Onion Skin)"
          onClick={() => setPlayback({ onionSkin: !playback.onionSkin })}
        >
          <IconOnionSkin width={14} height={14} />
          <span>Bóng mờ</span>
        </button>
      </div>

      {/* Cấu hình Tốc độ & Chế độ Lặp */}
      <div className="loop-tuning-row">
        {/* Tốc độ FPS */}
        <div className="loop-tuning-group">
          <span className="loop-tuning-label">Tốc độ (FPS):</span>
          <div className="loop-fps-presets">
            {FPS_PRESETS.map((f) => (
              <button
                key={f}
                type="button"
                className={`loop-fps-pill${playback.fps === f ? ' active' : ''}`}
                onClick={() => setPlayback({ fps: f })}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={playback.fps}
            onChange={(e) => setPlayback({ fps: Number(e.target.value) })}
            className="loop-fps-slider"
          />
          <span className="loop-fps-val">{playback.fps} FPS</span>
        </div>

        {/* Kiểu lặp */}
        <div className="loop-tuning-group">
          <span className="loop-tuning-label">Kiểu lặp:</span>
          <div className="loop-mode-segmented">
            {(
              [
                { id: 'loop', label: 'Lặp vô tận' },
                { id: 'ping-pong', label: 'Đảo chiều' },
                { id: 'once', label: '1 lần' }
              ] as { id: LoopMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`loop-mode-btn${playback.loopMode === m.id ? ' active' : ''}`}
                onClick={() => setPlayback({ loopMode: m.id })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom */}
        <div className="loop-tuning-group zoom-group">
          <span className="loop-tuning-label">Thu phóng:</span>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
          >
            -
          </button>
          <span className="loop-zoom-val">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
          >
            +
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => setZoom(1)}
          >
            100%
          </button>
        </div>
      </div>
    </div>
  )
}
