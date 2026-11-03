import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../actions'
import '../../styles/loopControls.css'
import '../../styles/loopAnimatorPanes.css'
import '../../styles/loopAnimatorStrip.css'
import '../../styles/loopAlignStudio.css'
import '../../styles/loopAnimator.css'
import { getActiveCategoriesForModule, useAssetManifestStore } from '../../store/assetManifest'
import { renderCategoryIcon } from '../assets/categoryIcons'
import { Menu } from '../controls/Menu'
import {
  IconFilm,
  IconFolderOpen,
  IconGrid,
  IconLoopAnimate,
  IconPlay,
  IconPlus,
  IconReplace,
  IconSave,
  IconUpload,
  IconX
} from '../icons'
import { LoopAnimatorFrameStrip } from './LoopAnimatorFrameStrip'
import { LoopAnimatorPlayer } from './LoopAnimatorPlayer'
import { LoopAnimatorSourcePane } from './LoopAnimatorSourcePane'
import { LoopGroupAlignmentModal } from './LoopGroupAlignmentModal'
import { LoopGroupSliderBar } from './LoopGroupSliderBar'
import {
  applyLoopAnimationToProject,
  syncSceneAndCompositesWithLoopTemplate
} from './loopAnimationExporter'
import { saveLoopAnimationAsPackage } from './loopPackageSaver'
import {
  LOOP_IMAGE_ACCEPT,
  loadLoopImageFiles,
  readFileAsDataUrl,
  upgradeLoopImageFilesKeepMesh
} from './loopAnimatorLauncher'
import { LOOP_STORAGE_UPDATED_EVENT, getAllLoopTemplates } from './loopAnimatorStorage'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationTemplate } from './types'

interface Props {
  isOpen?: boolean
  onClose: () => void
  initialImageUrl?: string | null
}

type MobileTab = 'source' | 'player' | 'frames'

const LOOP_MODE_LABEL: Record<string, string> = {
  loop: 'Lặp vòng',
  'ping-pong': 'Đảo chiều',
  once: '1 lần',
  random: 'Ngẫu nhiên'
}

function useLoopTemplates(isOpen: boolean, manifestRevision: number): LoopAnimationTemplate[] {
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  useEffect(() => {
    if (!isOpen) return
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    refresh()
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    window.addEventListener('parallax:manifest-updated', refresh)
    return () => {
      window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
      window.removeEventListener('parallax:manifest-updated', refresh)
    }
  }, [isOpen, manifestRevision])
  return templates
}

export function LoopAnimatorDialog({ isOpen = true, onClose, initialImageUrl }: Props): React.ReactElement | null {
  const activePresetId = useLoopAnimator((s) => s.activePresetId)
  const layerName = useLoopAnimator((s) => s.layerName)
  const category = useLoopAnimator((s) => s.category)
  const frames = useLoopAnimator((s) => s.frames)
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const playback = useLoopAnimator((s) => s.playback)
  const hasSource = useLoopAnimator((s) => Boolean(s.sourceImageUrl))
  const loadPreset = useLoopAnimator((s) => s.loadPreset)
  const appendPresetAsGroup = useLoopAnimator((s) => s.appendPresetAsGroup)
  const loadCustomImage = useLoopAnimator((s) => s.loadCustomImage)
  const startBlank = useLoopAnimator((s) => s.startBlank)
  const setLayerName = useLoopAnimator((s) => s.setLayerName)
  const setCategory = useLoopAnimator((s) => s.setCategory)
  const saveCurrentToLibrary = useLoopAnimator((s) => s.saveCurrentToLibrary)
  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const contourConfig = useLoopAnimator((s) => s.contourConfig)
  const baseMeshWidth = useLoopAnimator((s) => s.baseMeshWidth)
  const baseMeshHeight = useLoopAnimator((s) => s.baseMeshHeight)

  const manifestModules = useAssetManifestStore((s) => s.modules)
  const manifestRevision = useAssetManifestStore((s) => s.revision)

  const dynamicCategories = useMemo(() => {
    const cats = getActiveCategoriesForModule(manifestModules, 'loop_animator').filter((c) => c.id !== 'all')
    return cats.map((c) => ({
      id: c.id,
      label: c.shortTitle || c.title,
      fullTitle: c.title,
      icon: renderCategoryIcon(c.icon || c.id, 12, 12, c.id, {
        iconUrl: c.iconUrl,
        iconText: c.iconText
      })
    }))
  }, [manifestModules])

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const upgradeFileInputRef = useRef<HTMLInputElement | null>(null)
  const actionLockRef = useRef(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgressText, setSaveProgressText] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('source')
  const templates = useLoopTemplates(isOpen, manifestRevision)

  useEffect(() => {
    if (isOpen && initialImageUrl) loadCustomImage(initialImageUrl)
  }, [isOpen, initialImageUrl, loadCustomImage])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || document.querySelector('.menu[role="menu"], .loop-del-dialog')) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const enabledCount = frames.filter((f) => f.enabled).length
  const totalGroupsEnabledCount =
    groups.length > 1
      ? groups.reduce((acc, g, idx) => acc + (idx === activeGroupIndex ? enabledCount : g.frames.filter((f) => f.enabled).length), 0)
      : enabledCount
  const canExport = hasSource && totalGroupsEnabledCount > 0
  const isBusy = isSaving || isExporting
  const requestUpload = (): void => fileInputRef.current?.click()
  const requestUpgradeMesh = (): void => upgradeFileInputRef.current?.click()

  async function handleApplyToScene(): Promise<void> {
    if (!sourceCanvasRef.current || actionLockRef.current || isSaving || isExporting) return
    actionLockRef.current = true
    setIsExporting(true)
    const syncedGroups = useLoopAnimator.getState().getSyncedGroups()
    const curActiveIdx = useLoopAnimator.getState().activeGroupIndex
    setSaveProgressText(`Đang chuẩn bị tách 1/${totalGroupsEnabledCount} frame…`)
    try {
      let saved: LoopAnimationTemplate | null = null
      let pkgRelPath: string | undefined
      let preExtractedCanvases: HTMLCanvasElement[] | undefined
      let groupFrameCanvases: HTMLCanvasElement[][] | undefined
      try {
        const pkgRes = await saveLoopAnimationAsPackage({
          name: layerName,
          sourceCanvas: sourceCanvasRef.current,
          frames,
          fps: playback.fps,
          speed: playback.speed,
          loopMode: playback.loopMode,
          category,
          rhythm: playback.rhythm,
          baseMeshWidth,
          baseMeshHeight,
          thumbnailFrameIndex: useLoopAnimator.getState().focusedFrameIndex ?? 0,
          sourceConfig: {
            slicerMode,
            gridConfig,
            chromaKey,
            contourConfig
          },
          sequenceGroups: syncedGroups,
          activeGroupIndex: curActiveIdx,
          onProgress: (info) => setSaveProgressText(info.message)
        })
        if (pkgRes.ok) {
          pkgRelPath = pkgRes.jsonRelPath
          saved = pkgRes.template
          preExtractedCanvases = pkgRes.frameCanvases
          groupFrameCanvases = pkgRes.groupFrameCanvases
          useLoopAnimator.setState({ activePresetId: pkgRes.slug })
        }
      } catch (pkgErr) {
        console.warn('[LoopAnimator] Package save warning:', pkgErr)
      }
      if (!saved) {
        saved = saveCurrentToLibrary(sourceCanvasRef.current)
      }
      if (saved) void syncSceneAndCompositesWithLoopTemplate(saved)
      setSaveProgressText('Đang chèn hoạt ảnh vào cảnh…')
      const res = await applyLoopAnimationToProject({
        layerName,
        sourceCanvas: sourceCanvasRef.current,
        frames,
        fps: playback.fps,
        speed: playback.speed,
        loopMode: playback.loopMode,
        templateId: saved?.id ?? activePresetId ?? undefined,
        loopJsonPath: pkgRelPath,
        rhythm: playback.rhythm,
        baseMeshWidth: saved?.baseMeshWidth,
        baseMeshHeight: saved?.baseMeshHeight,
        preExtractedCanvases,
        sequenceGroups: syncedGroups,
        groupFrameCanvases
      })
      if (syncedGroups.length > 1) {
        toast(
          `✨ Đã tạo tổ hợp "${layerName}" (${syncedGroups.length} nhóm hiệu ứng · ${res.frameCount} frames + ${syncedGroups.length} Node Animation Loop)`
        )
      } else {
        toast(`✨ Đã tạo layer hoạt ảnh lặp "${layerName}" (${res.frameCount} frames @ ${playback.fps} FPS)`)
      }
      onClose()
    } catch (err) {
      toast(`Lỗi xuất hoạt ảnh lặp: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      actionLockRef.current = false
      setIsExporting(false)
      setSaveProgressText(null)
    }
  }

  async function handleSaveToLibrary(): Promise<void> {
    if (!sourceCanvasRef.current || actionLockRef.current || isSaving || isExporting) return
    actionLockRef.current = true
    setIsSaving(true)
    const syncedGroups = useLoopAnimator.getState().getSyncedGroups()
    const curActiveIdx = useLoopAnimator.getState().activeGroupIndex
    setSaveProgressText(`Đang chuẩn bị lưu 1/${totalGroupsEnabledCount} frame…`)
    try {
      const pkgRes = await saveLoopAnimationAsPackage({
        name: layerName,
        sourceCanvas: sourceCanvasRef.current,
        frames,
        fps: playback.fps,
        speed: playback.speed,
        loopMode: playback.loopMode,
        category,
        rhythm: playback.rhythm,
        baseMeshWidth,
        baseMeshHeight,
        thumbnailFrameIndex: useLoopAnimator.getState().focusedFrameIndex ?? 0,
        sourceConfig: {
          slicerMode,
          gridConfig,
          chromaKey,
          contourConfig
        },
        sequenceGroups: syncedGroups,
        activeGroupIndex: curActiveIdx,
        onProgress: (info) => setSaveProgressText(info.message)
      })
      const saved = pkgRes.template || saveCurrentToLibrary(sourceCanvasRef.current)
      if (saved) {
        useLoopAnimator.setState({ activePresetId: saved.id })
        setSaveProgressText('Đang đồng bộ kho tài nguyên…')
        const syncedCount = await syncSceneAndCompositesWithLoopTemplate(saved)
        const groupInfo = syncedGroups.length > 1 ? ` · ${syncedGroups.length} nhóm` : ''
        if (syncedCount > 0) {
          toast(
            `💾 Đã lưu "${saved.name}" (${pkgRes.packageJson.frameCount} frame${groupInfo} + animation.json) vào loop_animations/${pkgRes.slug}/ và đồng bộ ${syncedCount} layer`
          )
        } else {
          toast(
            `💾 Đã lưu "${saved.name}" (${pkgRes.packageJson.frameCount} frame${groupInfo} + animation.json) vào thư mục loop_animations/${pkgRes.slug}/`
          )
        }
      }
    } catch (err) {
      toast(`Lỗi lưu gói hoạt ảnh: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      actionLockRef.current = false
      setIsSaving(false)
      setSaveProgressText(null)
    }
  }

  return (
    <div className="loop-animator-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="loop-animator-modal" data-mcp-region="loop_animator" data-mcp-dialog="loop_animator">
        <input
          ref={fileInputRef}
          type="file"
          accept={LOOP_IMAGE_ACCEPT}
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length === 1) {
              try {
                const dataUrl = await readFileAsDataUrl(files[0])
                loadCustomImage(dataUrl, files[0].name)
                toast('✨ Đã nạp ảnh mới (ghi đè nhóm cũ)')
              } catch {
                toast('⚠ Tệp không phải ảnh hợp lệ')
              }
            } else if (files.length > 1) {
              const ok = await loadLoopImageFiles(files, true)
              if (ok) {
                toast(`✨ Đã ghép ${files.length} frame thành hoạt ảnh mới (ghi đè nhóm cũ)`)
              } else {
                toast('⚠ Không thể nạp các tệp ảnh')
              }
            }
            e.target.value = ''
          }}
        />
        <input
          ref={upgradeFileInputRef}
          type="file"
          accept={LOOP_IMAGE_ACCEPT}
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) {
              const ok = await upgradeLoopImageFilesKeepMesh(files, sourceCanvasRef.current)
              if (ok) {
                toast(
                  files.length > 1
                    ? `✨ Đã nâng cấp ảnh 2K/4K (${files.length} frame) và đồng bộ khung cắt theo tỉ lệ Mesh`
                    : '✨ Đã nâng cấp ảnh 2K/4K và đồng bộ khung cắt theo tỉ lệ Mesh'
                )
              } else {
                toast('⚠ Tệp không phải ảnh hợp lệ')
              }
            }
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
              <p>Cắt khung · Tách nền · Chuỗi hiệu ứng nối tiếp & kết hợp frame</p>
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
            <Menu
              portal
              align="right"
              label="Mẫu"
              icon={<IconFolderOpen width={13} height={13} />}
              btnClassName="loop-menu-btn"
              title="Bắt đầu phiên trống hoặc mở mẫu trong kho"
            >
              <div className="menu-label">Bắt đầu</div>
              <button type="button" className="menu-item" onClick={startBlank}>
                <IconPlus width={12} height={12} /> Phiên trống mới
              </button>
              <div className="menu-label">Mở mẫu trong kho ({templates.length})</div>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`menu-item${activePresetId === t.id ? ' active' : ''}`}
                  onClick={() => loadPreset(t.id)}
                >
                  <IconLoopAnimate width={12} height={12} /> {t.name}
                  <span className="hint">{t.frameCount}F</span>
                </button>
              ))}
              {hasSource && (
                <>
                  <div className="menu-label">➕ Ghép nối tiếp mẫu vào chuỗi</div>
                  {templates.map((t) => (
                    <button
                      key={`append_${t.id}`}
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        appendPresetAsGroup(t.id)
                        toast(`✨ Đã ghép nối tiếp "${t.name}" vào chuỗi nhóm`)
                      }}
                    >
                      <IconPlus width={12} height={12} /> {t.name}
                      <span className="hint">{t.frameCount}F</span>
                    </button>
                  ))}
                </>
              )}
            </Menu>
            <button
              type="button"
              className="la-btn la-btn--danger loop-upload-red-btn"
              onClick={requestUpload}
              title="Tải ảnh mới từ máy tính (Ghi đè: xoá chuỗi nhóm cũ và nạp ảnh mới)"
            >
              <IconUpload width={13} height={13} />
              <span>Tải ảnh</span>
            </button>
            {hasSource && (
              <button
                type="button"
                className="la-btn la-btn--outline"
                onClick={requestUpgradeMesh}
                title="Thay ảnh Sprite Sheet chất lượng cao (2K/4K) nhưng giữ nguyên tỉ lệ Mesh, cấu hình cắt và khớp khung hình"
              >
                <IconReplace width={13} height={13} />
                <span>Đổi 2K/4K (Giữ Mesh)</span>
              </button>
            )}
            <button
              type="button"
              className="la-icon-btn la-icon-btn--bordered loop-close-btn"
              onClick={onClose}
              title="Đóng xưởng (Esc)"
              aria-label="Đóng xưởng"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        </header>

        {hasSource && <LoopGroupSliderBar />}

        <nav className="loop-mobile-view-tabs la-seg" aria-label="Chuyển khu vực làm việc">
          {(
            [
              { id: 'source', label: 'Cắt khung', icon: <IconGrid width={13} height={13} /> },
              { id: 'player', label: 'Xem & Nhịp', icon: <IconPlay width={13} height={13} /> },
              { id: 'frames', label: `Dải frame (${enabledCount})`, icon: <IconFilm width={13} height={13} /> }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`la-seg-btn${mobileTab === t.id ? ' active' : ''}`}
              onClick={() => setMobileTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className={`loop-animator-body loop-view-${mobileTab}`}>
          <div className="loop-source-column">
            <LoopAnimatorSourcePane
              sourceCanvasRef={sourceCanvasRef}
              onRequestUpload={requestUpload}
              templates={templates}
            />
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
                {dynamicCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={category === c.id}
                    className={`la-seg-btn${category === c.id ? ' active' : ''}`}
                    onClick={() => setCategory(c.id)}
                    title={c.fullTitle}
                  >
                    {c.icon}
                    <span className="loop-cat-text">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="loop-footer-stats" aria-live="polite">
              {groups.length > 1 && (
                <span className="la-stat">
                  <b>{groups.length}</b> nhóm
                </span>
              )}
              <span className="la-stat">
                <b>{totalGroupsEnabledCount}</b> frame
              </span>
              <span className="la-stat">
                <b>{playback.fps}</b> FPS × {playback.speed}
              </span>
              <span className="la-stat">{LOOP_MODE_LABEL[playback.loopMode] ?? playback.loopMode}</span>
              {saveProgressText && (
                <span className="la-stat" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  ⏳ {saveProgressText}
                </span>
              )}
            </div>
          </div>

          <div className="loop-footer-actions">
            <button type="button" className="la-btn la-btn--ghost la-btn--lg" disabled={isBusy} onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              className="la-btn la-btn--success la-btn--lg"
              disabled={!canExport || isBusy}
              onClick={() => void handleSaveToLibrary()}
              title="Lưu thành gói thư mục gồm các frame ảnh đã tách nền + animation.json xác nhận nhóm của từng frame"
            >
              <IconSave width={14} height={14} />
              <span>{isSaving ? saveProgressText || 'Đang lưu gói…' : 'Lưu vào kho'}</span>
            </button>
            <button
              type="button"
              className="la-btn la-btn--primary la-btn--lg"
              disabled={!canExport || isBusy}
              onClick={() => void handleApplyToScene()}
              title="Lưu vào kho và tạo chuỗi Layer + Node Animation Loop trong cảnh hiện tại"
            >
              <IconFilm width={14} height={14} />
              <span>{isExporting ? saveProgressText || 'Đang đóng gói…' : 'Đưa vào cảnh'}</span>
            </button>
          </div>
        </footer>
        <LoopGroupAlignmentModal />
      </div>
    </div>
  )
}
