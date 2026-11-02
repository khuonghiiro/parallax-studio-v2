import React, { useCallback, useEffect, useRef } from 'react'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationMode, LoopFrameBox, LoopRhythmMode } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
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
  const setRhythm = useLoopAnimator((s) => s.setRhythm)
  const togglePlaying = useLoopAnimator((s) => s.togglePlaying)
  const setFps = useLoopAnimator((s) => s.setFps)
  const setSpeed = useLoopAnimator((s) => s.setSpeed)
  const setLoopMode = useLoopAnimator((s) => s.setLoopMode)

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pingPongDirRef = useRef<1 | -1>(1)
  const cursorRef = useRef<number>(0)

  const activeFrameIndex = playback.isPlaying ? playingFrameIndex : selectedFrameIndex

  const drawPreviewFrame = useCallback(
    (frameIndex: number, nowSec = 0) => {
      const pCanvas = previewCanvasRef.current
      const srcCanvas = sourceCanvasRef.current
      if (!pCanvas || !srcCanvas || srcCanvas.width === 0) return

      const ctx = pCanvas.getContext('2d')
      if (!ctx) return

      const currentFrame: LoopFrameBox | undefined = frames[frameIndex] ?? frames[0]
      if (!currentFrame) return

      const stageW = 360
      const stageH = 360
      if (pCanvas.width !== stageW || pCanvas.height !== stageH) {
        pCanvas.width = stageW
        pCanvas.height = stageH
      }

      ctx.clearRect(0, 0, stageW, stageH)

      // Onion skin previous enabled frame when paused or editing
      if (playback.onionSkin && frames.length > 1) {
        let prevIdx = frameIndex - 1
        while (prevIdx >= 0 && !frames[prevIdx]?.enabled) prevIdx--
        if (prevIdx < 0) {
          for (let i = frames.length - 1; i > frameIndex; i--) {
            if (frames[i]?.enabled) {
              prevIdx = i
              break
            }
          }
        }
        const prevFrame = frames[prevIdx]
        if (prevFrame && prevIdx !== frameIndex) {
          ctx.save()
          ctx.globalAlpha = playback.onionSkinOpacity
          drawCenteredFrame(ctx, srcCanvas, prevFrame, stageW, stageH, 1)
          ctx.restore()
        }
      }

      // Evaluate rhythm modulation (opacity flicker & scale pulse)
      const rhythmEval =
        playback.isPlaying && playback.rhythm.rhythmMode !== 'none'
          ? evaluateLoopLayerRhythm(
              {
                loopRhythmMode: playback.rhythm.rhythmMode,
                loopRhythmRateHz: playback.rhythm.rhythmRateHz,
                loopRhythmIntensity: playback.rhythm.rhythmIntensity,
                loopMinOpacity: playback.rhythm.minOpacity,
                loopScaleBeatPct: playback.rhythm.scaleBeatPct,
                speed: playback.speed
              },
              nowSec,
              0
            )
          : { opacityMultiplier: 1, scaleMultiplier: 1 }

      ctx.save()
      ctx.globalAlpha = rhythmEval.opacityMultiplier
      drawCenteredFrame(ctx, srcCanvas, currentFrame, stageW, stageH, rhythmEval.scaleMultiplier)
      ctx.restore()
    },
    [frames, playback.onionSkin, playback.onionSkinOpacity, playback.isPlaying, playback.rhythm, playback.speed, sourceCanvasRef]
  )

  function drawCenteredFrame(
    ctx: CanvasRenderingContext2D,
    srcCanvas: HTMLCanvasElement,
    frame: LoopFrameBox,
    stageW: number,
    stageH: number,
    rhythmScale = 1
  ): void {
    const scale = Math.min((stageW - 36) / Math.max(1, frame.width), (stageH - 36) / Math.max(1, frame.height)) * rhythmScale
    const drawW = Math.round(frame.width * scale)
    const drawH = Math.round(frame.height * scale)
    const drawX = Math.round((stageW - drawW) * 0.5 + frame.offsetX * scale)
    const drawY = Math.round((stageH - drawH) * 0.5 + frame.offsetY * scale)

    ctx.drawImage(
      srcCanvas,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      drawX,
      drawY,
      drawW,
      drawH
    )
  }

  // Redraw when paused or when source/frame changes
  useEffect(() => {
    drawPreviewFrame(activeFrameIndex, performance.now() / 1000)
  }, [activeFrameIndex, sourceVersion, drawPreviewFrame])

  // Smooth RAF loop for live playback without tearing down on every frame
  useEffect(() => {
    if (!playback.isPlaying) return
    const enabledIndices = frames.map((f, idx) => (f.enabled ? idx : -1)).filter((idx) => idx >= 0)
    if (enabledIndices.length <= 1) return

    let rafId = 0
    let lastSwitchTime = performance.now()
    cursorRef.current = Math.max(0, enabledIndices.indexOf(playingFrameIndex))

    const tick = (now: number): void => {
      const currentGlobalIdx = enabledIndices[cursorRef.current] ?? enabledIndices[0]
      const currentFrame = frames[currentGlobalIdx]
      const ratio = currentFrame?.durationRatio ?? 1
      const effectiveFps = Math.max(1, playback.fps * (playback.speed || 1))
      const intervalMs = (1000 / effectiveFps) * ratio

      if (now - lastSwitchTime >= intervalMs) {
        lastSwitchTime = now
        let nextPos = cursorRef.current

        if (playback.loopMode === 'random') {
          if (enabledIndices.length > 1) {
            let candidate = Math.floor(Math.random() * enabledIndices.length)
            if (candidate === nextPos) candidate = (candidate + 1) % enabledIndices.length
            nextPos = candidate
          }
        } else if (playback.loopMode === 'ping-pong') {
          nextPos += pingPongDirRef.current
          if (nextPos >= enabledIndices.length) {
            pingPongDirRef.current = -1
            nextPos = Math.max(0, enabledIndices.length - 2)
          } else if (nextPos < 0) {
            pingPongDirRef.current = 1
            nextPos = Math.min(enabledIndices.length - 1, 1)
          }
        } else if (playback.loopMode === 'once') {
          if (nextPos + 1 < enabledIndices.length) {
            nextPos += 1
          } else {
            setPlayback({ isPlaying: false })
            return
          }
        } else {
          nextPos = (nextPos + 1) % enabledIndices.length
        }

        cursorRef.current = nextPos
        const nextFrameIdx = enabledIndices[nextPos] ?? 0
        setPlayingFrame(nextFrameIdx)
        drawPreviewFrame(nextFrameIdx, now / 1000)
      } else if (playback.rhythm.rhythmMode !== 'none') {
        drawPreviewFrame(currentGlobalIdx, now / 1000)
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
    frames,
    setPlayingFrame,
    setPlayback,
    drawPreviewFrame
  ])

  const stepFrame = (delta: -1 | 1): void => {
    setPlayback({ isPlaying: false })
    const next = (selectedFrameIndex + delta + frames.length) % Math.max(1, frames.length)
    selectFrame(next)
  }

  const LOOP_MODES: { id: LoopAnimationMode; label: string }[] = [
    { id: 'loop', label: '🔁 Lặp vòng' },
    { id: 'ping-pong', label: '↔ Đảo chiều' },
    { id: 'once', label: '1️⃣ 1 Lần' },
    { id: 'random', label: '🎲 Ngẫu nhiên' }
  ]

  const RHYTHM_MODES: { id: LoopRhythmMode; label: string }[] = [
    { id: 'none', label: 'Tắt' },
    { id: 'flicker_opacity', label: '✨ Nháy mờ' },
    { id: 'pulse_scale', label: '💓 Nhịp Scale' },
    { id: 'sync_both', label: '🔥 Nhịp + Nháy' },
    { id: 'strobe_beat', label: '⚡ Chớp Beat' }
  ]

  const SPEEDS = [0.5, 1, 1.5, 2]

  return (
    <div className="loop-player-pane" data-mcp-region="loop_animator_player">
      <div className="loop-pane-toolbar">
        <span className="loop-pane-title">▶ Sân Khấu Xem Trước &amp; Logic Loop</span>
        <div className="loop-bg-pills" title="Màu nền sân khấu xem trước">
          {(['checker', 'dark', 'light', 'green'] as const).map((bg) => (
            <button
              key={bg}
              type="button"
              className={`loop-bg-pill bg-${bg} ${playback.previewBg === bg ? 'active' : ''}`}
              onClick={() => setPlayback({ previewBg: bg })}
              title={`Nền: ${bg}`}
            />
          ))}
        </div>
      </div>

      <div className={`loop-player-stage bg-${playback.previewBg}`}>
        <canvas ref={previewCanvasRef} className="loop-player-canvas" />
        <div className="loop-player-hud-badge">
          Frame #{activeFrameIndex + 1} / {frames.length} • {playback.fps} FPS × {playback.speed}x
        </div>
        <button
          type="button"
          className={`loop-stage-floating-play ${playback.isPlaying ? 'playing' : 'paused'}`}
          onClick={togglePlaying}
          title={playback.isPlaying ? 'Tạm dừng hoạt ảnh' : 'Chạy hoạt ảnh'}
        >
          {playback.isPlaying ? '⏸ Tạm dừng' : '▶ Chạy thử'}
        </button>
      </div>

      {/* Transport Bar */}
      <div className="loop-transport-bar">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => stepFrame(-1)}
          title="Lùi 1 frame"
        >
          ⏮
        </button>
        <button
          type="button"
          className={`btn ${playback.isPlaying ? 'secondary' : 'primary'} sm loop-play-btn`}
          onClick={togglePlaying}
        >
          {playback.isPlaying ? '⏸ Tạm dừng' : '▶ Phát Loop'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => stepFrame(1)}
          title="Tiến 1 frame"
        >
          ⏭
        </button>

        <div className="loop-fps-control">
          <span>FPS: <strong>{playback.fps}</strong></span>
          <input
            type="range"
            min={2}
            max={30}
            value={playback.fps}
            onChange={(e) => setFps(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Loop Mode & Speed Pills */}
      <div className="loop-player-options">
        <div className="loop-opt-row">
          <span className="loop-opt-label">Chế độ lặp:</span>
          <div className="loop-mode-pills">
            {LOOP_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`loop-mode-pill ${playback.loopMode === m.id ? 'active' : ''}`}
                onClick={() => setLoopMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="loop-opt-row">
          <span className="loop-opt-label">Tốc độ chạy:</span>
          <div className="loop-mode-pills">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                type="button"
                className={`loop-mode-pill ${Math.abs(playback.speed - spd) < 0.05 ? 'active' : ''}`}
                onClick={() => setSpeed(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>
          <label className="loop-onion-check" title="Hiển thị bóng mờ của frame liền trước để căn tâm">
            <input
              type="checkbox"
              checked={playback.onionSkin}
              onChange={(e) => setPlayback({ onionSkin: e.target.checked })}
            />
            <span>🧅 Onion</span>
          </label>
        </div>

        {/* Loop Rhythm & Flicker Logic Config */}
        <div className="loop-rhythm-box">
          <div className="loop-rhythm-header">
            <span className="loop-opt-label">⚡ Logic Nhịp &amp; Nháy (Rhythm FX):</span>
          </div>
          <div className="loop-mode-pills">
            {RHYTHM_MODES.map((rm) => (
              <button
                key={rm.id}
                type="button"
                className={`loop-mode-pill ${playback.rhythm.rhythmMode === rm.id ? 'active' : ''}`}
                onClick={() => setRhythm({ rhythmMode: rm.id })}
              >
                {rm.label}
              </button>
            ))}
          </div>

          {playback.rhythm.rhythmMode !== 'none' && (
            <div className="loop-rhythm-sliders">
              <div className="loop-slider-inline">
                <span>Tần số ({playback.rhythm.rhythmRateHz.toFixed(1)} Hz)</span>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.2}
                  value={playback.rhythm.rhythmRateHz}
                  onChange={(e) => setRhythm({ rhythmRateHz: Number(e.target.value) })}
                />
              </div>
              <div className="loop-slider-inline">
                <span>Cường độ ({Math.round(playback.rhythm.rhythmIntensity * 100)}%)</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={playback.rhythm.rhythmIntensity}
                  onChange={(e) => setRhythm({ rhythmIntensity: Number(e.target.value) })}
                />
              </div>
              {(playback.rhythm.rhythmMode === 'flicker_opacity' ||
                playback.rhythm.rhythmMode === 'sync_both' ||
                playback.rhythm.rhythmMode === 'strobe_beat') && (
                <div className="loop-slider-inline">
                  <span>Độ mờ đáy ({Math.round(playback.rhythm.minOpacity * 100)}%)</span>
                  <input
                    type="range"
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    value={playback.rhythm.minOpacity}
                    onChange={(e) => setRhythm({ minOpacity: Number(e.target.value) })}
                  />
                </div>
              )}
              {(playback.rhythm.rhythmMode === 'pulse_scale' ||
                playback.rhythm.rhythmMode === 'sync_both' ||
                playback.rhythm.rhythmMode === 'strobe_beat') && (
                <div className="loop-slider-inline">
                  <span>Biên độ nhịp (+{playback.rhythm.scaleBeatPct}%)</span>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    step={1}
                    value={playback.rhythm.scaleBeatPct}
                    onChange={(e) => setRhythm({ scaleBeatPct: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
