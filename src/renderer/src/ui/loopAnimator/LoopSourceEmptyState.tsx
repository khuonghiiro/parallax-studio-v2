import React, { useState } from 'react'
import { toast } from '../../actions'
import { IconImage, IconLoopAnimate, IconUpload } from '../icons'
import { LoopCardPreviewCanvas } from './LoopCardPreviewCanvas'
import { appendLoopImageFilesAsGroups } from './loopAnimatorLauncher'
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
        if (files.length > 0) {
          void appendLoopImageFilesAsGroups(files).then((added) => {
            if (added > 1) toast(`✨ Đã thêm ${added} nhóm hiệu ứng nối tiếp`)
            else if (added === 1) toast('✨ Đã nạp ảnh hoạt ảnh mới')
            else toast('⚠ Hãy thả tệp ảnh PNG / JPG / WebP / GIF')
          })
        }
      }}
    >
      <div className="loop-dropzone">
        <span className="loop-dropzone-icon">
          <IconImage width={26} height={26} />
        </span>
        <h3>Bắt đầu hoạt ảnh Loop mới</h3>
        <p>Kéo thả 1 hoặc nhiều ảnh sprite sheet vào đây — mỗi ảnh tạo thành 1 nhóm hiệu ứng nối tiếp có thể sắp xếp thứ tự, chỉnh thời gian chờ và kết hợp frame.</p>
        <button type="button" className="la-btn la-btn--danger la-btn--lg" onClick={onRequestUpload}>
          <IconUpload width={14} height={14} />
          <span>Tải ảnh từ máy</span>
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
