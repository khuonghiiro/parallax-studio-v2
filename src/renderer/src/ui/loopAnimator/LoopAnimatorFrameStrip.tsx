import React, { useEffect, useRef, useState } from 'react'
import { IconAim, IconCheck, IconCopy, IconFilm, IconPlus, IconRefresh, IconTrash } from '../icons'
import { LoopNumField } from './LoopSlicerControls'
import { useLoopAnimator } from './loopAnimatorState'
import { getLoopSourceLogicalSize } from './loopSourceProxy'
import type { LoopFrameBox } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

const FrameThumbCanvas = React.memo(function FrameThumbCanvas({
  sourceCanvasRef,
  sourceVersion,
  frame
}: {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
  sourceVersion: number
  frame: LoopFrameBox
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const src = sourceCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!src || src.width <= 0 || frame.width <= 0 || frame.height <= 0) return
    const { sx, sy } = getLoopSourceLogicalSize(src)
    const scale = Math.min((canvas.width - 6) / frame.width, (canvas.height - 6) / frame.height)
    const dw = Math.max(1, Math.round(frame.width * scale))
    const dh = Math.max(1, Math.round(frame.height * scale))
    const dx = Math.round((canvas.width - dw) * 0.5 + frame.offsetX * scale)
    const dy = Math.round((canvas.height - dh) * 0.5 + frame.offsetY * scale)
    ctx.drawImage(
      src,
      frame.x * sx,
      frame.y * sy,
      Math.max(1, frame.width * sx),
      Math.max(1, frame.height * sy),
      dx,
      dy,
      dw,
      dh
    )
  }, [sourceCanvasRef, sourceVersion, frame.x, frame.y, frame.width, frame.height, frame.offsetX, frame.offsetY])
  return <canvas ref={canvasRef} width={80} height={68} className="loop-frame-thumb-canvas" />
})

function FrameInspector({ frame, index }: { frame: LoopFrameBox; index: number }): React.ReactElement {
  const updateFrame = useLoopAnimator((s) => s.updateFrame)
  const set = (patch: Partial<LoopFrameBox>): void => updateFrame(index, patch)
  return (
    <div className="loop-strip-inspector">
      <span className="loop-strip-tag">Frame #{index + 1}</span>
      <LoopNumField label="X" value={frame.x} min={0} max={16384} onChange={(v) => set({ x: v })} title="Toạ độ cắt X trên ảnh gốc" />
      <LoopNumField label="Y" value={frame.y} min={0} max={16384} onChange={(v) => set({ y: v })} title="Toạ độ cắt Y trên ảnh gốc" />
      <LoopNumField label="W" value={frame.width} min={1} max={16384} onChange={(v) => set({ width: v })} title="Chiều rộng khung cắt" />
      <LoopNumField label="H" value={frame.height} min={1} max={16384} onChange={(v) => set({ height: v })} title="Chiều cao khung cắt" />
      <LoopNumField label="Lệch X" value={frame.offsetX} min={-2000} max={2000} onChange={(v) => set({ offsetX: v })} title="Dời tâm ngang để chống rung giật" />
      <LoopNumField label="Lệch Y" value={frame.offsetY} min={-2000} max={2000} onChange={(v) => set({ offsetY: v })} title="Dời tâm dọc để chống rung giật" />
      <LoopNumField label="Giữ" unit="×" value={frame.durationRatio} min={0.25} max={8} step={0.25} onChange={(v) => set({ durationRatio: v })} title="Hệ số thời lượng hiển thị frame (2× = giữ lâu gấp đôi)" />
    </div>
  )
}

export function LoopAnimatorFrameStrip({ sourceCanvasRef }: Props): React.ReactElement {
  const frames = useLoopAnimator((s) => s.frames)
  const hasSource = useLoopAnimator((s) => Boolean(s.sourceImageUrl))
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
  const autoCenterFrames = useLoopAnimator((s) => s.autoCenterFrames)

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const activeCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (activeCardRef.current && !isPlaying) activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selectedFrameIndex, isPlaying])

  const selectedFrame = frames[selectedFrameIndex]
  const enabledCount = frames.filter((f) => f.enabled).length
  const noFrames = frames.length === 0

  return (
    <div className="loop-frame-strip" data-mcp-region="loop_animator_frames">
      <div className="loop-strip-header">
        <div className="loop-pane-heading">
          <span className="loop-step">3</span>
          <span>Dải khung hình</span>
          <span className="loop-strip-count">
            <b>{enabledCount}</b>/{frames.length} đang bật
          </span>
        </div>
        {selectedFrame && <FrameInspector frame={selectedFrame} index={selectedFrameIndex} />}
        <div className="loop-strip-actions">
          <button type="button" className="la-btn la-btn--outline la-btn--sm" disabled={noFrames} onClick={() => autoCenterFrames(sourceCanvasRef.current)} title="Tự căn tâm tất cả frame để khử rung giật">
            <IconAim width={12} height={12} />
            <span>Căn tâm</span>
          </button>
          <button type="button" className="la-btn la-btn--outline la-btn--sm" disabled={frames.length < 2} onClick={reverseFrames} title="Đảo ngược thứ tự toàn bộ frame">
            <IconRefresh width={12} height={12} />
            <span>Đảo thứ tự</span>
          </button>
          <button type="button" className="la-btn la-btn--outline la-btn--sm" disabled={noFrames} onClick={() => duplicateFrame(selectedFrameIndex)} title="Nhân đôi frame đang chọn (giữ nhịp lâu hơn)">
            <IconCopy width={12} height={12} />
            <span>Nhân đôi</span>
          </button>
          <button type="button" className="la-btn la-btn--outline la-btn--sm" disabled={!hasSource} onClick={addManualFrame} title="Thêm 1 khung cắt thủ công">
            <IconPlus width={12} height={12} />
            <span>Thêm frame</span>
          </button>
          <button type="button" className="la-btn la-btn--danger-outline la-btn--sm" disabled={frames.length <= 1} onClick={() => deleteFrame(selectedFrameIndex)} title="Xoá frame đang chọn">
            <IconTrash width={12} height={12} />
            <span>Xoá</span>
          </button>
        </div>
      </div>

      {noFrames ? (
        <div className="loop-strip-empty">
          <IconFilm width={16} height={16} />
          <span>{hasSource ? 'Chưa có khung hình — chọn chế độ cắt ở bước 1.' : 'Tải ảnh sprite sheet để tự động tách khung hình.'}</span>
        </div>
      ) : (
        <div className="loop-strip-cards">
          {frames.map((frame, idx) => {
            const isSelected = idx === selectedFrameIndex
            const cls = [
              'loop-frame-card',
              isSelected && 'selected',
              isPlaying && idx === playingFrameIndex && 'playing-now',
              !frame.enabled && 'disabled',
              idx === dragOver && 'drag-over'
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div
                key={frame.id}
                ref={isSelected ? activeCardRef : undefined}
                className={cls}
                draggable
                onClick={() => selectFrame(idx)}
                onDragStart={() => setDragFrom(idx)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(idx)
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (dragFrom !== null && dragFrom !== idx) reorderFrame(dragFrom, idx)
                  setDragFrom(null)
                  setDragOver(null)
                }}
                title="Kéo thả để đổi thứ tự"
              >
                <div className="loop-frame-card-top">
                  <span className="loop-frame-number">#{idx + 1}</span>
                  <button
                    type="button"
                    className={`loop-frame-toggle${frame.enabled ? ' on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFrameEnabled(idx)
                    }}
                    title={frame.enabled ? 'Bỏ qua frame này khi phát' : 'Bật lại frame này'}
                    aria-label={frame.enabled ? 'Tắt frame' : 'Bật frame'}
                  >
                    {frame.enabled && <IconCheck width={11} height={11} />}
                  </button>
                </div>
                <div className="loop-frame-thumb-wrap">
                  <FrameThumbCanvas sourceCanvasRef={sourceCanvasRef} sourceVersion={sourceVersion} frame={frame} />
                </div>
                <div className="loop-frame-card-meta">
                  <span>
                    {frame.width}×{frame.height}
                  </span>
                  {frame.durationRatio !== 1 && <span className="loop-frame-hold">{frame.durationRatio}×</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
