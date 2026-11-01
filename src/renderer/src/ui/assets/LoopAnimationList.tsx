import { useEffect, useState } from 'react'
import {
  IconPlus,
  IconFlame,
  IconTrash,
  IconPen,
  IconLoopAnimate
} from '../icons'
import { useView } from '../../store/view'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import {
  getStoredLoopTemplates,
  deleteLoopTemplate
} from '../loopAnimator/loopAnimatorStorage'
import { BUILTIN_LOOP_PRESETS, resolveLoopAssetUrl } from '../loopAnimator/sampleLoops'
import type { LoopAnimationTemplate } from '../loopAnimator/types'

function LoopCardImage({ src, alt }: { src: string; alt: string }) {
  const [resolved, setResolved] = useState(src)

  useEffect(() => {
    let active = true
    let blobUrl: string | null = null

    async function load() {
      try {
        const url = await resolveLoopAssetUrl(src)
        if (active && url) {
          setResolved(url)
          if (url.startsWith('blob:')) blobUrl = url
        }
      } catch {
        /* ignore */
      }
    }

    load()

    return () => {
      active = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [src])

  return <img src={resolved} alt={alt} className="loop-card-img" />
}

export function LoopAnimationList() {
  const [userTemplates, setUserTemplates] = useState<LoopAnimationTemplate[]>(() =>
    getStoredLoopTemplates()
  )
  const openDialog = useView((s) => s.openDialog)
  const openAnimator = useLoopAnimator((s) => s.open)

  useEffect(() => {
    const handleUpdate = () => setUserTemplates(getStoredLoopTemplates())
    window.addEventListener('loopAnimations:changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('loopAnimations:changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const handleOpenNew = () => {
    openAnimator()
    openDialog('loop_animator')
  }

  const handleOpenPreset = (presetId: string) => {
    openAnimator(presetId)
    openDialog('loop_animator')
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Bạn có chắc muốn xóa mẫu hoạt ảnh lặp này?')) {
      deleteLoopTemplate(id)
    }
  }

  return (
    <div className="panel-body loop-assets-container" data-mcp-region="assets_loop">
      {/* Banner giới thiệu & Nút tạo mới */}
      <div className="loop-assets-hero">
        <div className="loop-hero-info">
          <div className="loop-hero-title-row">
            <IconLoopAnimate width={18} height={18} />
            <span className="loop-hero-title">Xưởng Hoạt Ảnh Lặp (Loop Sprite)</span>
          </div>
          <p className="loop-hero-desc">
            Phân tách sprite sheet / chuỗi frame tuần hoàn từ ảnh gốc, tách nền trong suốt tự động và phát hoạt họa thời gian thực trong không gian 2.5D.
          </p>
        </div>
        <button
          type="button"
          className="btn sm primary loop-hero-create-btn"
          onClick={handleOpenNew}
          title="Mở Xưởng Tách Hoạt Ảnh Lặp để phân tách ảnh thành frame"
        >
          <IconPlus width={13} height={13} />
          <span>Tạo Loop Animate</span>
        </button>
      </div>

      {/* Danh sách Mẫu có sẵn (Built-in Presets) */}
      <div className="loop-section-title">Mẫu tích hợp sẵn kiểm thử (2.5D Loop):</div>
      <div className="loop-cards-grid">
        {BUILTIN_LOOP_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className="loop-asset-card builtin"
            onClick={() => handleOpenPreset(preset.id)}
          >
            <div className="loop-card-preview-box">
              <LoopCardImage
                src={preset.imageUrl}
                alt={preset.name}
              />
              <span className="loop-card-tag">{preset.defaultGrid.rows}×{preset.defaultGrid.cols} (16 frames)</span>
            </div>
            <div className="loop-card-meta">
              <span className="loop-card-name">
                <IconFlame width={13} height={13} />
                <span>{preset.name}</span>
              </span>
              <span className="loop-card-sub">{preset.description}</span>
            </div>
            <div className="loop-card-btn-bar">
              <button
                type="button"
                className="btn sm accent"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenPreset(preset.id)
                }}
              >
                <IconPen width={12} height={12} />
                <span>Mở trong Xưởng</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Danh sách Mẫu do người dùng đã lưu */}
      {userTemplates.length > 0 && (
        <>
          <div className="loop-section-title" style={{ marginTop: 16 }}>
            Mẫu đã lưu ({userTemplates.length}):
          </div>
          <div className="loop-cards-grid">
            {userTemplates.map((item) => (
              <div
                key={item.id}
                className="loop-asset-card custom"
                onClick={() => {
                  openAnimator(item.imageUrl)
                  openDialog('loop_animator')
                }}
              >
                <div className="loop-card-preview-box">
                  {item.thumbUrl || item.imageUrl ? (
                    <LoopCardImage
                      src={item.thumbUrl || item.imageUrl}
                      alt={item.name}
                    />
                  ) : (
                    <IconLoopAnimate width={24} height={24} />
                  )}
                  <span className="loop-card-tag">{item.frameCount} frames • {item.fps} FPS</span>
                </div>
                <div className="loop-card-meta">
                  <span className="loop-card-name">{item.name}</span>
                  <span className="loop-card-sub">
                    {item.width}×{item.height}px • {item.loopMode}
                  </span>
                </div>
                <div className="loop-card-btn-bar">
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAnimator(item.imageUrl)
                      openDialog('loop_animator')
                    }}
                  >
                    <IconPen width={12} height={12} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    className="btn icon sm ghost danger"
                    title="Xóa mẫu"
                    onClick={(e) => handleDelete(e, item.id)}
                  >
                    <IconTrash width={12} height={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
