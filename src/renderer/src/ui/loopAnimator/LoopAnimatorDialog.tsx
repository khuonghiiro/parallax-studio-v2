import React, { useRef, useState, useEffect } from 'react'
import {
  IconX,
  IconLoopAnimate,
  IconPlus,
  IconFlame,
  IconFolder,
  IconCheck
} from '../icons'
import { SegmentedTabs, useResponsiveViewport } from '../primitives'
import { useLoopAnimator } from './loopAnimatorState'
import { LoopAnimatorSourcePane } from './LoopAnimatorSourcePane'
import { LoopAnimatorPlayer } from './LoopAnimatorPlayer'
import { LoopAnimatorFrameStrip } from './LoopAnimatorFrameStrip'
import { applyLoopAnimationToProject } from './loopAnimationExporter'
import { saveLoopTemplate } from './loopAnimatorStorage'
import { BUILTIN_LOOP_PRESETS } from './sampleLoops'
import '../../styles/loopAnimator.css'

export interface LoopAnimatorDialogProps {
  onClose: () => void
  initialImageUrl?: string | null
}

type ResponsiveTab = 'source' | 'player' | 'frames'

export function LoopAnimatorDialog({ onClose, initialImageUrl }: LoopAnimatorDialogProps) {
  const isOpen = useLoopAnimator((s) => s.isOpen)
  const open = useLoopAnimator((s) => s.open)
  const close = useLoopAnimator((s) => s.close)
  const name = useLoopAnimator((s) => s.name)
  const setName = useLoopAnimator((s) => s.setName)
  const frames = useLoopAnimator((s) => s.frames)
  const playback = useLoopAnimator((s) => s.playback)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const chromaConfig = useLoopAnimator((s) => s.chromaConfig)
  const imageUrl = useLoopAnimator((s) => s.imageUrl)
  const activePresetId = useLoopAnimator((s) => s.activePresetId)

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<ResponsiveTab>('source')
  const [isApplying, setIsApplying] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const { width } = useResponsiveViewport()
  const isMobile = width <= 768
  const isTablet = width > 768 && width <= 1120

  useEffect(() => {
    if (initialImageUrl) {
      open(initialImageUrl)
    } else {
      open()
    }
  }, [initialImageUrl, open])

  // Xử lý nạp ảnh từ máy tính
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      open(dataUrl)
      setName(file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Đưa hoạt ảnh vào dự án hiện tại
  const handleApplyToProject = async () => {
    const sourceCanvas = sourceCanvasRef.current
    if (!sourceCanvas) return

    setIsApplying(true)
    try {
      const res = await applyLoopAnimationToProject({
        name,
        sourceCanvas,
        frames,
        playback
      })
      if (res) {
        handleClose()
      }
    } finally {
      setIsApplying(false)
    }
  }

  // Lưu cấu hình vào kho mẫu cá nhân
  const handleSaveToLibrary = () => {
    const firstFrame = frames[0]
    saveLoopTemplate({
      id: `loop_${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      frameCount: frames.filter((f) => f.enabled).length,
      fps: playback.fps,
      loopMode: playback.loopMode,
      width: firstFrame?.width || 256,
      height: firstFrame?.height || 256,
      imageUrl,
      gridConfig,
      chromaConfig,
      frames
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const handleClose = () => {
    close()
    onClose()
  }

  const enabledCount = frames.filter((f) => f.enabled).length
  const totalDuration = (enabledCount / Math.max(1, playback.fps)).toFixed(2)

  return (
    <div
      className="loop-animator-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Xưởng Tách Hoạt Ảnh Lặp"
    >
      <div
        className={`loop-animator-dialog${isMobile ? ' is-mobile' : isTablet ? ' is-tablet' : ''}`}
        data-mcp-region="loop_animator"
        data-mcp-dialog
      >
        {/* Header thanh công cụ trên cùng */}
        <div className="loop-dialog-header">
          <div className="loop-dialog-title-wrap">
            <IconLoopAnimate width={20} height={20} className="loop-title-icon" />
            <div className="loop-title-text-group">
              <span className="loop-dialog-title">Xưởng Tách Hoạt Ảnh Lặp</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="loop-title-input"
                placeholder="Đặt tên hoạt ảnh lặp…"
              />
            </div>
          </div>

          {/* Cụm nút chọn mẫu thử sẵn & nạp tệp */}
          <div className="loop-presets-bar">
            {BUILTIN_LOOP_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn sm ghost${activePresetId === p.id ? ' active' : ''}`}
                onClick={() => open(p)}
                title={p.description}
              >
                <IconFlame width={13} height={13} />
                <span>{p.name.toLowerCase().includes('trong suốt') ? 'Lửa trại (Trong suốt)' : 'Lửa trại (Nền hồng)'}</span>
              </button>
            ))}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadFile}
            />

            <button
              type="button"
              className="btn sm ghost"
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh sprite sheet từ máy tính để phân tách"
            >
              <IconFolder width={13} height={13} />
              <span>Tải ảnh khác…</span>
            </button>
          </div>

          <button
            type="button"
            className="btn icon sm ghost loop-close-btn"
            title="Đóng (Esc)"
            onClick={handleClose}
          >
            <IconX width={16} height={16} />
          </button>
        </div>

        {/* Thanh chuyển tab trên thiết bị nhỏ (Mobile / Tablet) */}
        {(isMobile || isTablet) && (
          <div className="loop-mobile-tabs-wrap">
            <SegmentedTabs<ResponsiveTab>
              variant="segmented"
              size="sm"
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { id: 'source', label: 'Tách Khung & Nền' },
                { id: 'player', label: 'Xem Trước & Tốc Độ' },
                { id: 'frames', label: `Dãy Frame (${frames.length})` }
              ]}
            />
          </div>
        )}

        {/* Nội dung chính chia cột */}
        <div className="loop-dialog-body">
          {/* Cột trái: Ảnh gốc & Công cụ tách lưới / Chroma Key */}
          {(!isMobile && !isTablet) || activeTab === 'source' ? (
            <div className="loop-col-source">
              <LoopAnimatorSourcePane sourceCanvasRef={sourceCanvasRef} />
            </div>
          ) : null}

          {/* Cột phải: Trình phát Xem trước thời gian thực */}
          {(!isMobile && !isTablet) || activeTab === 'player' ? (
            <div className="loop-col-player">
              <LoopAnimatorPlayer sourceCanvasRef={sourceCanvasRef} />
            </div>
          ) : null}

          {/* Dải Filmstrip: Danh sách thẻ Card frame */}
          {(!isMobile && !isTablet) || activeTab === 'frames' ? (
            <div className="loop-col-frames">
              <LoopAnimatorFrameStrip sourceCanvasRef={sourceCanvasRef} />
            </div>
          ) : null}
        </div>

        {/* Footer hành động: Thông số chu kỳ & Nút đưa vào cảnh */}
        <div className="loop-dialog-footer">
          <div className="loop-footer-summary">
            <span className="loop-summary-chip">
              {enabledCount}/{frames.length} frames
            </span>
            <span className="loop-summary-chip">{playback.fps} FPS</span>
            <span className="loop-summary-chip">Chu kỳ {totalDuration}s</span>
          </div>

          <div className="loop-footer-buttons">
            <button
              type="button"
              className="btn sm ghost"
              onClick={handleSaveToLibrary}
              title="Lưu mẫu cấu hình hoạt ảnh vào kho cá nhân"
            >
              {savedSuccess ? (
                <>
                  <IconCheck width={14} height={14} />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <span>Lưu vào Kho Loop</span>
              )}
            </button>

            <button
              type="button"
              className="btn sm primary loop-apply-cta"
              disabled={isApplying}
              onClick={handleApplyToProject}
              title="Đưa trực tiếp hoạt ảnh lặp này vào mốc thời gian của Dự án hiện tại"
            >
              <IconPlus width={14} height={14} />
              <span>{isApplying ? 'Đang tạo layer…' : 'Đưa vào Dự án'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
