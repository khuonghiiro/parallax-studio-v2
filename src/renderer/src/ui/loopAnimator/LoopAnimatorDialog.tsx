import React, { useEffect, useRef, useState } from 'react'
import { toast } from '../../actions'
import '../../styles/loopAnimator.css'
import { requestOpenLayerAssembly } from '../layerAssembly/layerAssemblyBridge'
import { LoopAnimatorFrameStrip } from './LoopAnimatorFrameStrip'
import { LoopAnimatorPlayer } from './LoopAnimatorPlayer'
import { LoopAnimatorSourcePane } from './LoopAnimatorSourcePane'
import { applyLoopAnimationToProject } from './loopAnimationExporter'
import { getAllLoopTemplates } from './loopAnimatorStorage'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationTemplate } from './types'

interface Props {
  isOpen?: boolean
  onClose: () => void
  initialImageUrl?: string | null
}

export const PENDING_WORKSHOP_LOOP_TEMPLATE_KEY = 'parallax_pending_workshop_loop_template'

export function LoopAnimatorDialog({
  isOpen = true,
  onClose,
  initialImageUrl
}: Props): React.ReactElement | null {
  const activePresetId = useLoopAnimator((s) => s.activePresetId)
  const layerName = useLoopAnimator((s) => s.layerName)
  const category = useLoopAnimator((s) => s.category)
  const frames = useLoopAnimator((s) => s.frames)
  const playback = useLoopAnimator((s) => s.playback)
  const loadPreset = useLoopAnimator((s) => s.loadPreset)
  const loadCustomImage = useLoopAnimator((s) => s.loadCustomImage)
  const setLayerName = useLoopAnimator((s) => s.setLayerName)
  const setCategory = useLoopAnimator((s) => s.setCategory)
  const togglePlaying = useLoopAnimator((s) => s.togglePlaying)
  const saveCurrentToLibrary = useLoopAnimator((s) => s.saveCurrentToLibrary)

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())

  useEffect(() => {
    if (isOpen) {
      setTemplates(getAllLoopTemplates())
      if (initialImageUrl) {
        loadCustomImage(initialImageUrl)
      }
    }
  }, [isOpen, initialImageUrl, loadCustomImage])

  if (!isOpen) return null

  const enabledCount = frames.filter((f) => f.enabled).length

  async function handleApplyToScene(): Promise<void> {
    if (!sourceCanvasRef.current || isExporting) return
    setIsExporting(true)
    try {
      const saved = saveCurrentToLibrary(sourceCanvasRef.current)
      const res = await applyLoopAnimationToProject({
        layerName,
        sourceCanvas: sourceCanvasRef.current,
        frames,
        fps: playback.fps,
        speed: playback.speed,
        loopMode: playback.loopMode,
        templateId: saved?.id ?? activePresetId ?? undefined,
        rhythm: playback.rhythm
      })
      toast(`✨ Đã tạo layer hoạt ảnh lặp "${layerName}" (${res.frameCount} frames @ ${playback.fps} FPS)`)
      onClose()
    } catch (err) {
      toast(`Lỗi xuất hoạt ảnh lặp: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsExporting(false)
    }
  }

  function handleSaveToLibrary(): void {
    const saved = saveCurrentToLibrary(sourceCanvasRef.current)
    if (saved) {
      setTemplates(getAllLoopTemplates())
      toast(`💾 Đã lưu "${saved.name}" (${saved.frameCount}F • Frame #1 preview) vào Kho Hoạt Ảnh Lặp!`)
    }
  }

  function handleSendToWorkshop25D(): void {
    const saved = saveCurrentToLibrary(sourceCanvasRef.current)
    if (!saved) return
    try {
      sessionStorage.setItem(PENDING_WORKSHOP_LOOP_TEMPLATE_KEY, saved.id)
    } catch {
      // ignore storage errors
    }
    toast(`🧩 Đã lưu và chuyển "${saved.name}" sang Xưởng Lắp Ráp 2.5D!`)
    onClose()
    requestOpenLayerAssembly()
  }

  return (
    <div
      className="loop-animator-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="loop-animator-modal"
        data-mcp-region="loop_animator"
        data-mcp-dialog="loop_animator"
      >
        {/* Top Header */}
        <div className="loop-animator-header">
          <div className="loop-animator-brand">
            <span className="loop-brand-icon">🎞</span>
            <div>
              <h2>Xưởng Tách Hoạt Ảnh Loop (Sprite &amp; Loop Studio)</h2>
              <p>Cắt khung Grid / Dò viền Contour • Tách nền Chroma Key • Cấu hình Nhịp &amp; Nháy 2.5D</p>
            </div>
          </div>

          <div className="loop-header-presets" data-mcp-region="loop_animator_presets">
            {templates.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`loop-preset-chip ${activePresetId === p.id ? 'active' : ''}`}
                onClick={() => loadPreset(p.id)}
                title={p.description}
              >
                <span>{p.badge}</span>
                <span className="loop-preset-chip-name">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="loop-header-right-actions">
            <button
              type="button"
              className={`btn ${playback.isPlaying ? 'secondary' : 'primary'} sm loop-header-play-btn`}
              onClick={togglePlaying}
              title={playback.isPlaying ? 'Tạm dừng xem trước hoạt ảnh' : 'Chạy xem trước hoạt ảnh'}
            >
              {playback.isPlaying ? '⏸ Tạm dừng' : '▶ Chạy thử'}
            </button>
            <button
              type="button"
              className="loop-close-btn"
              onClick={onClose}
              title="Đóng xưởng (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Workspace Split */}
        <div className="loop-animator-body">
          <LoopAnimatorSourcePane sourceCanvasRef={sourceCanvasRef} />
          <LoopAnimatorPlayer sourceCanvasRef={sourceCanvasRef} />
        </div>

        {/* Bottom Frame Strip */}
        <LoopAnimatorFrameStrip sourceCanvasRef={sourceCanvasRef} />

        {/* Footer Action Bar */}
        <div className="loop-animator-footer">
          <div className="loop-footer-left">
            <label className="loop-name-field">
              <span>Tên hoạt ảnh:</span>
              <input
                type="text"
                value={layerName}
                onChange={(e) => setLayerName(e.target.value)}
                placeholder="Nhập tên hoạt ảnh Loop..."
              />
            </label>
            <label className="loop-name-field">
              <span>Nhóm:</span>
              <div className="loop-cat-pills">
                {(
                  [
                    { id: 'fire', label: '🔥 Lửa' },
                    { id: 'magic', label: '✨ Phép' },
                    { id: 'nature', label: '🦋 Tự nhiên' },
                    { id: 'electric', label: '⚡ Điện' },
                    { id: 'custom', label: '🎞 Khác' }
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`loop-mode-pill ${category === cat.id ? 'active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </label>
            <span className="loop-footer-stats">
              Sẵn sàng xuất <strong>{enabledCount}</strong> frames @ <strong>{playback.fps} FPS</strong> ({playback.speed}x • {playback.loopMode})
            </span>
          </div>

          <div className="loop-footer-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={enabledCount === 0}
              onClick={handleSaveToLibrary}
              title="Lưu vào Kho Loop Animate (hiển thị Frame #1 làm ảnh đại diện)"
            >
              💾 Lưu vào Kho Loop
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={enabledCount === 0}
              onClick={handleSendToWorkshop25D}
              title="Lưu và đưa hoạt ảnh này vào Xưởng Lắp Ráp 2.5D"
            >
              🧩 Đưa vào Xưởng 2.5D
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={enabledCount === 0 || isExporting}
              onClick={() => void handleApplyToScene()}
            >
              {isExporting ? '⏳ Đang đóng gói...' : '🎬 Đưa vào Cảnh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
