import React, { useRef, useEffect } from 'react'
import {
  IconTrash,
  IconCopy,
  IconStepBack,
  IconStepFwd,
  IconEye,
  IconEyeOff,
  IconRefresh
} from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import { extractFrameDataUrl } from './loopFrameExtractor'

export interface LoopAnimatorFrameStripProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function LoopAnimatorFrameStrip({ sourceCanvasRef }: LoopAnimatorFrameStripProps) {
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const updateFrame = useLoopAnimator((s) => s.updateFrame)
  const reorderFrames = useLoopAnimator((s) => s.reorderFrames)
  const reverseFrames = useLoopAnimator((s) => s.reverseFrames)
  const expandPingPong = useLoopAnimator((s) => s.expandPingPong)
  const duplicateFrame = useLoopAnimator((s) => s.duplicateFrame)
  const deleteFrame = useLoopAnimator((s) => s.deleteFrame)

  const activeCardRef = useRef<HTMLDivElement | null>(null)

  // Cuộn tới frame đang chọn khi playback chạy
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }, [selectedFrameIndex])

  return (
    <div className="loop-frame-strip-panel" data-mcp-region="loop_animator_frames">
      {/* Header thanh cuộn frame */}
      <div className="loop-strip-header">
        <span className="loop-strip-title">
          🎞️ Dãy Khung Hình Diễn Hoạt ({frames.length} frames)
        </span>
        <div className="loop-strip-actions">
          <button
            type="button"
            className="btn sm ghost"
            title="Đảo ngược thứ tự từ cuối lên đầu"
            onClick={reverseFrames}
          >
            <IconRefresh width={13} height={13} />
            <span>Đảo chiều</span>
          </button>
          <button
            type="button"
            className="btn sm ghost"
            title="Nhân bản chuỗi frame quay lui tạo chu kỳ mượt mà"
            onClick={expandPingPong}
          >
            <span>Mở rộng Ping-Pong</span>
          </button>
        </div>
      </div>

      {/* Danh sách các thẻ Card Khung hình */}
      <div className="loop-strip-scroll">
        {frames.map((frame, idx) => {
          const isSelected = frame.index === selectedFrameIndex
          const thumbUrl = sourceCanvasRef.current
            ? extractFrameDataUrl(sourceCanvasRef.current, frame)
            : ''

          return (
            <div
              key={frame.id}
              ref={isSelected ? activeCardRef : null}
              className={`loop-frame-card${isSelected ? ' is-selected' : ''}${!frame.enabled ? ' is-disabled' : ''}`}
              onClick={() => selectFrame(frame.index)}
            >
              {/* Đầu thẻ Card: Số thứ tự & Nút ẩn/hiện */}
              <div className="loop-card-top">
                <span className="loop-card-badge">#{idx + 1}</span>
                <button
                  type="button"
                  className="btn icon sm ghost"
                  title={frame.enabled ? 'Tắt frame này khỏi chuỗi' : 'Bật lại frame này'}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateFrame(frame.index, { enabled: !frame.enabled })
                  }}
                >
                  {frame.enabled ? (
                    <IconEye width={12} height={12} />
                  ) : (
                    <IconEyeOff width={12} height={12} />
                  )}
                </button>
              </div>

              {/* Vùng xem trước Thumbnail */}
              <div className="loop-card-thumb-wrap">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`Frame ${idx + 1}`}
                    className="loop-card-thumb"
                  />
                ) : (
                  <div className="loop-card-thumb-placeholder">
                    {frame.width}×{frame.height}
                  </div>
                )}
              </div>

              {/* Tùy chỉnh Thời lượng (Hold Duration) */}
              <div className="loop-card-params" onClick={(e) => e.stopPropagation()}>
                <span className="loop-param-mini-label">Thời lượng:</span>
                <div className="loop-duration-pills">
                  {[1, 1.5, 2, 3].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      className={`loop-dur-pill${(frame.durationMultiplier || 1) === dur ? ' active' : ''}`}
                      onClick={() => updateFrame(frame.index, { durationMultiplier: dur })}
                    >
                      {dur}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Thanh thao tác: Dời trái/phải, nhân bản, xóa */}
              <div className="loop-card-footer" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn icon sm ghost"
                  disabled={idx === 0}
                  title="Dời sang trái"
                  onClick={() => reorderFrames(idx, idx - 1)}
                >
                  <IconStepBack width={11} height={11} />
                </button>
                <button
                  type="button"
                  className="btn icon sm ghost"
                  disabled={idx === frames.length - 1}
                  title="Dời sang phải"
                  onClick={() => reorderFrames(idx, idx + 1)}
                >
                  <IconStepFwd width={11} height={11} />
                </button>
                <button
                  type="button"
                  className="btn icon sm ghost"
                  title="Nhân bản frame"
                  onClick={() => duplicateFrame(frame.index)}
                >
                  <IconCopy width={11} height={11} />
                </button>
                <button
                  type="button"
                  className="btn icon sm ghost danger"
                  title="Xóa frame"
                  onClick={() => deleteFrame(frame.index)}
                >
                  <IconTrash width={11} height={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
