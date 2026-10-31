import { useState } from 'react'
import type { AnimationClip, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { IconCopy, IconPen, IconPlus, IconTrash } from '../icons'
import { WorkshopNewMotionModal } from './WorkshopNewMotionModal'

export interface WorkshopClipBarProps {
  rig: LayerRig
  activeClip: AnimationClip
  composite?: LayerComposite
  run: (action: RigAction) => void
  onOpenRetarget: () => void
}

export function WorkshopClipBar({
  rig,
  activeClip,
  composite,
  run,
  onOpenRetarget
}: WorkshopClipBarProps) {
  const clips = rig.clips ?? [activeClip]
  const [isNewMotionModalOpen, setIsNewMotionModalOpen] = useState(false)
  const [angleFilter, setAngleFilter] = useState<MotionViewAngle | 'all'>('all')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(activeClip.name)

  const handleSelectClip = (clipId: string) => {
    if (clipId === activeClip.id) return
    run({ action: 'switch-clip', clipId })
    setIsRenaming(false)
  }

  const handleCreatedClip = (clip: AnimationClip) => {
    run({ action: 'add-clip', clip })
  }

  const handleDuplicateCurrent = () => {
    run({ action: 'duplicate-clip', clipId: activeClip.id })
  }

  const handleStartRename = () => {
    setRenameValue(activeClip.name)
    setIsRenaming(true)
  }

  const handleSaveRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== activeClip.name) {
      run({ action: 'rename-clip', clipId: activeClip.id, name: trimmed })
    }
    setIsRenaming(false)
  }

  const handleDelete = () => {
    run({ action: 'delete-clip', clipId: activeClip.id })
    setIsRenaming(false)
  }

  const handleDeleteAll = () => {
    run({ action: 'delete-all-clips' })
    setIsRenaming(false)
  }

  const hasAnyKeyframes = clips.length > 1 || Object.keys(activeClip.tracks || {}).length > 0

  const filteredClips = clips.filter((c) => {
    if (angleFilter === 'all') return true
    if (c.viewAngle) return c.viewAngle === angleFilter
    if (angleFilter === 'side') return c.name.includes('90°') || c.name.includes('Ngang')
    if (angleFilter === 'diagonal') return c.name.includes('45°') || c.name.includes('Chéo')
    if (angleFilter === 'back') return c.name.includes('180°') || c.name.includes('Sau lưng')
    if (angleFilter === 'front') return c.name.includes('Chính diện') || /(?:^|[^\d])0°/.test(c.name)
    return true
  })

  const getAngleBadge = (clip: AnimationClip): { text: string; tone: 'front' | 'diagonal' | 'side' | 'back' } | null => {
    const ang = clip.viewAngle
    if (ang === 'side') return { text: '90°', tone: 'side' }
    if (ang === 'diagonal') return { text: '45°', tone: 'diagonal' }
    if (ang === 'back') return { text: '180°', tone: 'back' }
    if (ang === 'front') return { text: '0°', tone: 'front' }
    if (clip.name.includes('90°') || clip.name.includes('Ngang')) return { text: '90°', tone: 'side' }
    if (clip.name.includes('45°') || clip.name.includes('Chéo')) return { text: '45°', tone: 'diagonal' }
    if (clip.name.includes('180°') || clip.name.includes('Sau lưng')) return { text: '180°', tone: 'back' }
    if (clip.name.includes('Chính diện') || /(?:^|[^\d])0°/.test(clip.name)) return { text: '0°', tone: 'front' }
    return null
  }

  return (
    <div className="lw-card-section lw-clip-section">
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>Danh sách Clips</span>
          <span className="lw-card-badge">{clips.length}</span>
        </span>
        <div className="lw-clip-head-actions">
          {hasAnyKeyframes && (
            <button
              type="button"
              className="btn xs lw-muted-danger-btn"
              onClick={handleDeleteAll}
              title="Xoá hết toàn bộ các động tác hoạt ảnh để đưa nhân vật về tư thế tĩnh (Ctrl+Z để hoàn tác)"
            >
              <IconTrash width={10} height={10} />
              <span>Xoá hết</span>
            </button>
          )}
          <button
            type="button"
            className="btn xs primary"
            onClick={() => setIsNewMotionModalOpen(true)}
            title="Mở Studio Mixamo để gắn điểm khớp và tạo bộ động tác mới"
          >
            <IconPlus width={10} height={10} />
            <span>Studio Mixamo</span>
          </button>
        </div>
      </div>

      {/* Thanh lọc nhanh theo góc nhìn */}
      <div className="lw-angle-seg-bar compact" role="group" aria-label="Lọc clip theo góc nhìn">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'front', label: '0° Chính diện' },
          { id: 'diagonal', label: '45° Chéo' },
          { id: 'side', label: '90° Ngang' }
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`lw-angle-seg-btn${angleFilter === f.id ? ' active' : ''}`}
            onClick={() => setAngleFilter(f.id as MotionViewAngle | 'all')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Dãy nút chọn Clips động tác */}
      <div className="lw-clip-list">
        {filteredClips.map((clip) => {
          const isActive = clip.id === activeClip.id
          const badge = getAngleBadge(clip)
          return (
            <button
              key={clip.id}
              type="button"
              className={`lw-clip-chip${isActive ? ' active' : ''}`}
              onClick={() => handleSelectClip(clip.id)}
              title={`${clip.name} · ${clip.duration.toFixed(2)}s`}
            >
              {badge && <span className={`lw-clip-angle-tag tone-${badge.tone}`}>{badge.text}</span>}
              <span className="lw-clip-chip-name">{clip.name}</span>
              <small className="lw-clip-chip-dur">{clip.duration.toFixed(1)}s</small>
            </button>
          )
        })}
        {filteredClips.length === 0 && (
          <div className="lw-key-empty-hint">
            Chưa có động tác thuộc góc này. Chọn mẫu động tác bên dưới hoặc mở &ldquo;Studio Mixamo&rdquo;.
          </div>
        )}
      </div>

      <WorkshopNewMotionModal
        isOpen={isNewMotionModalOpen}
        onClose={() => setIsNewMotionModalOpen(false)}
        bones={rig.bones}
        composite={composite}
        onCreated={handleCreatedClip}
        onApplyMixamoRigMotion={(payload) =>
          run({
            action: 'apply-mixamo-rig-motion',
            bones: payload.bones,
            clip: payload.clip,
            clips: payload.clips,
            replaceClips: payload.replaceClips,
            autoBindSoft: payload.autoBindSoft
          })
        }
      />

      {/* Thanh công cụ quản lý clip đang active */}
      <div className="lw-clip-toolbar">
        {isRenaming ? (
          <div className="lw-clip-rename-row">
            <input
              type="text"
              className="lw-field-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              autoFocus
            />
            <button type="button" className="btn xs primary" onClick={handleSaveRename}>
              Lưu
            </button>
            <button type="button" className="btn xs" onClick={() => setIsRenaming(false)}>
              Hủy
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn xs" onClick={handleStartRename} title="Đổi tên động tác này">
              <IconPen width={10} height={10} />
              <span>Đổi tên</span>
            </button>
            <button type="button" className="btn xs" onClick={handleDuplicateCurrent} title="Nhân bản động tác này">
              <IconCopy width={10} height={10} />
              <span>Nhân bản</span>
            </button>
            <button
              type="button"
              className="btn xs lw-muted-danger-btn"
              onClick={handleDelete}
              title="Xóa động tác đang chọn"
            >
              <IconTrash width={10} height={10} />
              <span>Xoá</span>
            </button>
            <button
              type="button"
              className="btn xs lw-retarget-cta-btn"
              onClick={onOpenRetarget}
              title="Kế thừa góc xoay và vị trí chuyển động từ nhân vật/mẫu khác"
            >
              <span>⇄ Kế thừa</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
