import React, { useEffect, useRef, useState } from 'react'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopFrameBox } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

interface FrameThumbProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
  sourceVersion: number
  frame: LoopFrameBox
}

const FrameThumbCanvas = React.memo(function FrameThumbCanvas({
  sourceCanvasRef,
  sourceVersion,
  frame
}: FrameThumbProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const src = sourceCanvasRef.current
    if (!canvas || !src || src.width <= 0 || src.height <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)
    if (frame.width <= 0 || frame.height <= 0) return

    const scale = Math.min((cw - 6) / frame.width, (ch - 6) / frame.height)
    const dw = Math.max(1, Math.round(frame.width * scale))
    const dh = Math.max(1, Math.round(frame.height * scale))
    const dx = Math.round((cw - dw) * 0.5 + frame.offsetX * scale)
    const dy = Math.round((ch - dh) * 0.5 + frame.offsetY * scale)

    ctx.drawImage(src, frame.x, frame.y, frame.width, frame.height, dx, dy, dw, dh)
  }, [
    sourceCanvasRef,
    sourceVersion,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    frame.offsetX,
    frame.offsetY
  ])

  return <canvas ref={canvasRef} width={76} height={68} className="loop-frame-thumb-canvas" />
})

export function LoopAnimatorFrameStrip({ sourceCanvasRef }: Props): React.ReactElement {
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const isPlaying = useLoopAnimator((s) => s.playback.isPlaying)
  const sourceVersion = useLoopAnimator((s) => s.sourceVersion)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const toggleFrameEnabled = useLoopAnimator((s) => s.toggleFrameEnabled)
  const reorderFrame = useLoopAnimator((s) => s.reorderFrame)
  const reverseFrames = useLoopAnimator((s) => s.reverseFrames)
  const duplicateFrame = useLoopAnimator((s) => s.duplicateFrame)
  const deleteFrame = useLoopAnimator((s) => s.deleteFrame)
  const addManualFrame = useLoopAnimator((s) => s.addManualFrame)
  const updateFrame = useLoopAnimator((s) => s.updateFrame)
  const autoCenterFrames = useLoopAnimator((s) => s.autoCenterFrames)

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const activeCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (activeCardRef.current && !isPlaying) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [selectedFrameIndex, isPlaying])

  const selectedFrame = frames[selectedFrameIndex]
  const enabledCount = frames.filter((f) => f.enabled).length

  return (
    <div className="loop-frame-strip" data-mcp-region="loop_animator_frames">
      <div className="loop-strip-header">
        <div className="loop-strip-title">
          <span className="loop-strip-badge">🎞 Dải Khung Hình (Frame Strip)</span>
          <span className="loop-strip-count">
            Đang bật <strong>{enabledCount}</strong> / {frames.length} frames
          </span>
        </div>

        {selectedFrame && (
          <div className="loop-strip-frame-inspector">
            <span className="loop-strip-inspector-tag">Frame #{selectedFrameIndex + 1}</span>
            <label title="Tọa độ cắt X trên ảnh gốc">
              <span>X</span>
              <input
                type="number"
                value={selectedFrame.x}
                onChange={(e) => updateFrame(selectedFrameIndex, { x: Number(e.target.value) || 0 })}
              />
            </label>
            <label title="Tọa độ cắt Y trên ảnh gốc">
              <span>Y</span>
              <input
                type="number"
                value={selectedFrame.y}
                onChange={(e) => updateFrame(selectedFrameIndex, { y: Number(e.target.value) || 0 })}
              />
            </label>
            <label title="Chiều rộng khung cắt">
              <span>W</span>
              <input
                type="number"
                min={1}
                value={selectedFrame.width}
                onChange={(e) => updateFrame(selectedFrameIndex, { width: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label title="Chiều cao khung cắt">
              <span>H</span>
              <input
                type="number"
                min={1}
                value={selectedFrame.height}
                onChange={(e) => updateFrame(selectedFrameIndex, { height: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label title="Độ lệch tâm ngang (chống giật)">
              <span>Lệch X</span>
              <input
                type="number"
                value={selectedFrame.offsetX}
                onChange={(e) => updateFrame(selectedFrameIndex, { offsetX: Number(e.target.value) || 0 })}
              />
            </label>
            <label title="Độ lệch tâm dọc (chống giật)">
              <span>Lệch Y</span>
              <input
                type="number"
                value={selectedFrame.offsetY}
                onChange={(e) => updateFrame(selectedFrameIndex, { offsetY: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
        )}

        <div className="loop-strip-actions">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => autoCenterFrames(sourceCanvasRef.current)}
            title="Tự động căn tâm tất cả frame theo vùng ảnh để khử rung giật"
          >
            🎯 Căn tâm tự động
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={reverseFrames}
            title="Đảo ngược thứ tự toàn bộ các frame"
          >
            ⇄ Đảo thứ tự
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => duplicateFrame(selectedFrameIndex)}
            title="Nhân bản frame đang chọn"
          >
            ⧉ Nhân bản
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={addManualFrame}
            title="Thêm 1 khung cắt thủ công mới"
          >
            + Thêm Frame
          </button>
          <button
            type="button"
            className="btn ghost sm danger"
            onClick={() => deleteFrame(selectedFrameIndex)}
            disabled={frames.length <= 1}
            title="Xóa frame đang chọn"
          >
            🗑 Xóa
          </button>
        </div>
      </div>

      <div className="loop-strip-cards">
        {frames.map((frame: LoopFrameBox, idx: number) => {
          const isSelected = idx === selectedFrameIndex
          const isPlayingNow = isPlaying && idx === playingFrameIndex
          const isDragOver = idx === dragOver

          return (
            <div
              key={frame.id}
              ref={isSelected ? activeCardRef : undefined}
              className={`loop-frame-card ${isSelected ? 'selected' : ''} ${isPlayingNow ? 'playing-now' : ''} ${!frame.enabled ? 'disabled' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable
              onClick={() => selectFrame(idx)}
              onDragStart={() => setDragFrom(idx)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(idx)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== idx) {
                  reorderFrame(dragFrom, idx)
                }
                setDragFrom(null)
                setDragOver(null)
              }}
            >
              <div className="loop-frame-card-top">
                <span className="loop-frame-number">#{idx + 1}</span>
                <button
                  type="button"
                  className={`loop-frame-toggle ${frame.enabled ? 'on' : 'off'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFrameEnabled(idx)
                  }}
                  title={frame.enabled ? 'Bỏ qua frame này khi phát' : 'Bật lại frame này'}
                >
                  {frame.enabled ? '✓' : '✕'}
                </button>
              </div>
              <div className="loop-frame-thumb-wrap">
                <FrameThumbCanvas
                  sourceCanvasRef={sourceCanvasRef}
                  sourceVersion={sourceVersion}
                  frame={frame}
                />
              </div>
              <div className="loop-frame-card-meta">
                <span>
                  {frame.width}×{frame.height}
                </span>
                {(frame.offsetX !== 0 || frame.offsetY !== 0) && (
                  <span className="loop-frame-offset-tag">
                    {frame.offsetX >= 0 ? `+${frame.offsetX}` : frame.offsetX},
                    {frame.offsetY >= 0 ? `+${frame.offsetY}` : frame.offsetY}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
