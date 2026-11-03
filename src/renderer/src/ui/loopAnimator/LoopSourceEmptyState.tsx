import React, { useState } from 'react'
import { toast } from '../../actions'
import { IconImage, IconLoopAnimate, IconUpload } from '../icons'
import { LoopCardPreviewCanvas } from './LoopCardPreviewCanvas'
import { loadLoopImageFile, loadLoopImageFiles } from './loopAnimatorLauncher'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationTemplate } from './types'

interface Props {
  onRequestUpload: () => void
  templates: LoopAnimationTemplate[]
}

/**
 * Màn hình bắt đầu của phiên trống: kéo thả / chọn ảnh sprite sheet từ máy,
 * hoặc mở nhanh 1 mẫu trong kho để chỉnh sửa.
 */
export function LoopSourceEmptyState({ onRequestUpload, templates }: Props): React.ReactElement {
  const loadPreset = useLoopAnimator((s) => s.loadPreset)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`loop-empty-state${dragOver ? ' drag-over' : ''}`}
      data-mcp-region="loop_animator_empty"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files ?? []).filter(
          (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
        )
        if (files.length === 1) {
          if (!loadLoopImageFile(files[0])) toast('⚠ Hãy thả tệp ảnh PNG / JPG / WebP / GIF')
        } else if (files.length > 1) {
          void loadLoopImageFiles(files).then((ok) => {
            if (ok) toast(`✨ Đã nạp ${files.length} frame theo thứ tự hoạt ảnh`)
            else toast('⚠ Không thể đọc ảnh hợp lệ')
          })
        }
      }}
    >
      <div className="loop-dropzone">
        <span className="loop-dropzone-icon">
          <IconImage width={26} height={26} />
        </span>
        <h3>Bắt đầu hoạt ảnh Loop mới</h3>
        <p>Kéo thả ảnh sprite sheet hoặc nhiều frame ảnh vào đây — tự động nhận diện và ghép thứ tự frame. Hỗ trợ ảnh đã tách nền hoặc nền màu.</p>
        <button type="button" className="la-btn la-btn--primary la-btn--lg" onClick={onRequestUpload}>
          <IconUpload width={14} height={14} />
          <span>Chọn ảnh từ máy</span>
        </button>
        <small>PNG · JPG · WebP · GIF</small>
      </div>

      {templates.length > 0 && (
        <div className="loop-empty-templates">
          <div className="loop-empty-templates-head">
            <IconLoopAnimate width={13} height={13} />
            <span>Hoặc mở mẫu trong kho để chỉnh sửa</span>
          </div>
          <div className="loop-empty-templates-grid">
            {templates.slice(0, 4).map((t) => (
              <button key={t.id} type="button" className="loop-empty-tpl" onClick={() => loadPreset(t.id)} title={`Mở "${t.name}"`}>
                <LoopCardPreviewCanvas template={t} isPlaying={false} width={120} height={84} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
