import React, { useEffect, useRef, useState } from 'react'
import { toast } from '../../actions'
import '../../styles/loopAnimator.css'
import { Menu } from '../controls/Menu'
import {
  IconFilm,
  IconFlame,
  IconFolder,
  IconFolderOpen,
  IconGrid,
  IconLightning,
  IconLoopAnimate,
  IconPlay,
  IconPlus,
  IconSave,
  IconSparkles,
  IconTree,
  IconUpload,
  IconX
} from '../icons'
import { LoopAnimatorFrameStrip } from './LoopAnimatorFrameStrip'
import { LoopAnimatorPlayer } from './LoopAnimatorPlayer'
import { LoopAnimatorSourcePane } from './LoopAnimatorSourcePane'
import { applyLoopAnimationToProject } from './loopAnimationExporter'
import { LOOP_IMAGE_ACCEPT, loadLoopImageFile } from './loopAnimatorLauncher'
import { LOOP_STORAGE_UPDATED_EVENT, getAllLoopTemplates } from './loopAnimatorStorage'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationTemplate } from './types'

interface Props {
  isOpen?: boolean
  onClose: () => void
  initialImageUrl?: string | null
}

type MobileTab = 'source' | 'player' | 'frames'

const CATEGORIES: { id: LoopAnimationTemplate['category']; label: string; icon: React.ReactElement }[] = [
  { id: 'fire', label: 'Lửa', icon: <IconFlame width={12} height={12} /> },
  { id: 'magic', label: 'Phép', icon: <IconSparkles width={12} height={12} /> },
  { id: 'nature', label: 'Tự nhiên', icon: <IconTree width={12} height={12} /> },
  { id: 'electric', label: 'Điện', icon: <IconLightning width={12} height={12} /> },
  { id: 'custom', label: 'Khác', icon: <IconFolder width={12} height={12} /> }
]

const LOOP_MODE_LABEL: Record<string, string> = {
  loop: 'Lặp vòng',
  'ping-pong': 'Đảo chiều',
  once: '1 lần',
  random: 'Ngẫu nhiên'
}

function useLoopTemplates(isOpen: boolean): LoopAnimationTemplate[] {
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  useEffect(() => {
    if (!isOpen) return
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    refresh()
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
  }, [isOpen])
  return templates
}

export function LoopAnimatorDialog({ isOpen = true, onClose, initialImageUrl }: Props): React.ReactElement | null {
  const activePresetId = useLoopAnimator((s) => s.activePresetId)
  const layerName = useLoopAnimator((s) => s.layerName)
  const category = useLoopAnimator((s) => s.category)
  const frames = useLoopAnimator((s) => s.frames)
  const playback = useLoopAnimator((s) => s.playback)
  const hasSource = useLoopAnimator((s) => Boolean(s.sourceImageUrl))
  const loadPreset = useLoopAnimator((s) => s.loadPreset)
  const loadCustomImage = useLoopAnimator((s) => s.loadCustomImage)
  const startBlank = useLoopAnimator((s) => s.startBlank)
  const setLayerName = useLoopAnimator((s) => s.setLayerName)
  const setCategory = useLoopAnimator((s) => s.setCategory)
  const saveCurrentToLibrary = useLoopAnimator((s) => s.saveCurrentToLibrary)

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('source')
  const templates = useLoopTemplates(isOpen)

  useEffect(() => {
    if (isOpen && initialImageUrl) loadCustomImage(initialImageUrl)
  }, [isOpen, initialImageUrl, loadCustomImage])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Esc đóng menu/picker đang mở trước, chỉ đóng xưởng khi không còn popup nào
      if (e.key !== 'Escape' || document.querySelector('.menu[role="menu"], .loop-del-dialog')) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const enabledCount = frames.filter((f) => f.enabled).length
  const canExport = hasSource && enabledCount > 0
  const requestUpload = (): void => fileInputRef.current?.click()

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
    if (saved) toast(`💾 Đã lưu "${saved.name}" (${saved.frameCount} frame) vào kho Loop Animate`)
  }

  return (
    <div className="loop-animator-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="loop-animator-modal" data-mcp-region="loop_animator" data-mcp-dialog="loop_animator">
        <input
          ref={fileInputRef}
          type="file"
          accept={LOOP_IMAGE_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file && !loadLoopImageFile(file)) toast('⚠ Tệp không phải ảnh hợp lệ')
            e.target.value = ''
          }}
        />

        <header className="loop-animator-header" data-mcp-region="loop_animator_header">
          <div className="loop-brand">
            <span className="loop-brand-icon">
              <IconLoopAnimate width={18} height={18} />
            </span>
            <div className="loop-brand-text">
              <h2>Xưởng Tách Hoạt Ảnh Loop</h2>
              <p>Cắt khung · Tách nền · Ghép nhịp phát lặp</p>
            </div>
          </div>

          <label className="loop-header-name">
            <span className="la-label">Tên hoạt ảnh</span>
            <input
              type="text"
              className="la-input"
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              placeholder="Nhập tên hoạt ảnh Loop…"
            />
          </label>

          <div className="loop-header-actions" data-mcp-region="loop_animator_presets">
            <Menu portal align="right" label="Mẫu" icon={<IconFolderOpen width={13} height={13} />} btnClassName="loop-menu-btn" title="Bắt đầu phiên trống hoặc mở mẫu trong kho">
              <div className="menu-label">Bắt đầu</div>
              <button type="button" className="menu-item" onClick={startBlank}>
                <IconPlus width={12} height={12} /> Phiên trống mới
              </button>
              <div className="menu-label">Mở mẫu trong kho ({templates.length})</div>
              {templates.map((t) => (
                <button key={t.id} type="button" className={`menu-item${activePresetId === t.id ? ' active' : ''}`} onClick={() => loadPreset(t.id)}>
                  <IconLoopAnimate width={12} height={12} /> {t.name}
                  <span className="hint">{t.frameCount}F</span>
                </button>
              ))}
            </Menu>
            <button type="button" className="la-btn la-btn--outline" onClick={requestUpload} title="Tải ảnh sprite sheet từ máy tính">
              <IconUpload width={13} height={13} />
              <span>Tải ảnh</span>
            </button>
            <button type="button" className="la-icon-btn la-icon-btn--bordered loop-close-btn" onClick={onClose} title="Đóng xưởng (Esc)" aria-label="Đóng xưởng">
              <IconX width={14} height={14} />
            </button>
          </div>
        </header>

        <nav className="loop-mobile-view-tabs la-seg" aria-label="Chuyển khu vực làm việc">
          {(
            [
              { id: 'source', label: 'Cắt khung', icon: <IconGrid width={13} height={13} /> },
              { id: 'player', label: 'Xem & Nhịp', icon: <IconPlay width={13} height={13} /> },
              { id: 'frames', label: `Dải frame (${enabledCount})`, icon: <IconFilm width={13} height={13} /> }
            ] as const
          ).map((t) => (
            <button key={t.id} type="button" className={`la-seg-btn${mobileTab === t.id ? ' active' : ''}`} onClick={() => setMobileTab(t.id)}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className={`loop-animator-body loop-view-${mobileTab}`}>
          <div className="loop-source-column">
            <LoopAnimatorSourcePane sourceCanvasRef={sourceCanvasRef} onRequestUpload={requestUpload} templates={templates} />
          </div>
          <div className="loop-player-column">
            <LoopAnimatorPlayer sourceCanvasRef={sourceCanvasRef} />
          </div>
        </div>

        <div className={`loop-frame-strip-wrap${mobileTab === 'frames' ? ' mobile-visible-frames' : ''}`}>
          <LoopAnimatorFrameStrip sourceCanvasRef={sourceCanvasRef} />
        </div>

        <footer className="loop-animator-footer" data-mcp-region="loop_animator_footer">
          <div className="loop-footer-meta">
            <div className="loop-footer-field">
              <span className="la-label">Nhóm</span>
              <div className="la-seg" role="radiogroup" aria-label="Nhóm hoạt ảnh">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={category === c.id} className={`la-seg-btn${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)} title={c.label}>
                    {c.icon}
                    <span className="loop-cat-text">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="loop-footer-stats" aria-live="polite">
              <span className="la-stat"><b>{enabledCount}</b>/{frames.length} frame</span>
              <span className="la-stat"><b>{playback.fps}</b> FPS × {playback.speed}</span>
              <span className="la-stat">{LOOP_MODE_LABEL[playback.loopMode] ?? playback.loopMode}</span>
            </div>
          </div>

          <div className="loop-footer-actions">
            <button type="button" className="la-btn la-btn--ghost la-btn--lg" onClick={onClose}>
              Đóng
            </button>
            <button type="button" className="la-btn la-btn--success la-btn--lg" disabled={!canExport} onClick={handleSaveToLibrary} title="Lưu vào kho Loop Animate (dùng lại ở màn hình chính và Xưởng Layer 2.5D)">
              <IconSave width={14} height={14} />
              <span>Lưu vào kho</span>
            </button>
            <button type="button" className="la-btn la-btn--primary la-btn--lg" disabled={!canExport || isExporting} onClick={() => void handleApplyToScene()} title="Lưu vào kho và tạo layer hoạt ảnh lặp trong cảnh hiện tại">
              <IconFilm width={14} height={14} />
              <span>{isExporting ? 'Đang đóng gói…' : 'Đưa vào cảnh'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
