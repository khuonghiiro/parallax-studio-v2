import { useState } from 'react'
import type { AnimationClip, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import { IconCopy, IconPen, IconPlus, IconTrash } from '../icons'
import { WorkshopNewMotionModal } from './WorkshopNewMotionModal'

export interface WorkshopClipBarProps {
  rig: LayerRig
  activeClip: AnimationClip
  run: (action: RigAction) => void
  onOpenRetarget: () => void
}

export function WorkshopClipBar({ rig, activeClip, run, onOpenRetarget }: WorkshopClipBarProps) {
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
    if (clips.length <= 1) return
    if (window.confirm(`Bạn có chắc muốn xóa động tác "${activeClip.name}" không?`)) {
      run({ action: 'delete-clip', clipId: activeClip.id })
      setIsRenaming(false)
    }
  }

  const filteredClips = clips.filter((c) => {
    if (angleFilter === 'all') return true
    if (c.viewAngle) return c.viewAngle === angleFilter
    // Heuristic dựa theo tên nếu chưa có field viewAngle (kiểm tra 90°/180°/45° trước 0°)
    if (angleFilter === 'side') return c.name.includes('90°') || c.name.includes('Ngang')
    if (angleFilter === 'diagonal') return c.name.includes('45°') || c.name.includes('Chéo')
    if (angleFilter === 'back') return c.name.includes('180°') || c.name.includes('Sau lưng')
    if (angleFilter === 'front') return c.name.includes('Chính diện') || /(?:^|[^\d])0°/.test(c.name)
    return true
  })

  const getAngleBadge = (clip: AnimationClip) => {
    const ang = clip.viewAngle
    if (ang === 'side') return { text: '90°', color: 'var(--key)' }
    if (ang === 'diagonal') return { text: '45°', color: 'var(--accent-cyan)' }
    if (ang === 'back') return { text: '180°', color: '#c084fc' }
    if (ang === 'front') return { text: '0°', color: 'var(--accent)' }
    // Fallback nếu không có trường viewAngle
    if (clip.name.includes('90°') || clip.name.includes('Ngang')) return { text: '90°', color: 'var(--key)' }
    if (clip.name.includes('45°') || clip.name.includes('Chéo')) return { text: '45°', color: 'var(--accent-cyan)' }
    if (clip.name.includes('180°') || clip.name.includes('Sau lưng')) return { text: '180°', color: '#c084fc' }
    if (clip.name.includes('Chính diện') || /(?:^|[^\d])0°/.test(clip.name)) return { text: '0°', color: 'var(--accent)' }
    return null
  }


  return (
    <div className="lw-clip-section">
      <div className="lw-clip-header">
        <span>🎬 Động tác hoạt ảnh ({clips.length})</span>
        <button
          type="button"
          className="btn xs primary"
          onClick={() => setIsNewMotionModalOpen(true)}
          title="Tạo động tác mới kèm lựa chọn hướng nhìn nhân vật (0° chính diện, 45° chéo, 90° ngang)"
          style={{ fontSize: '11px', padding: '3px 8px' }}
        >
          <IconPlus width={10} height={10} /> Thêm động tác
        </button>
      </div>

      {/* Thanh lọc nhanh theo góc nhìn */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'front', label: '🧭 0°' },
          { id: 'diagonal', label: '📐 45°' },
          { id: 'side', label: '↔️ 90°' }
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn xs ${angleFilter === f.id ? 'primary' : 'ghost'}`}
            style={{ fontSize: '9.5px', padding: '1px 6px', height: '19px' }}
            onClick={() => setAngleFilter(f.id as any)}
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
              className={`lw-clip-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectClip(clip.id)}
              title={`${clip.name} (Thời lượng: ${clip.duration}s)`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {badge && (
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '0 3px',
                    borderRadius: '2px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    color: badge.color
                  }}
                >
                  {badge.text}
                </span>
              )}
              <span>{clip.name}</span>
            </button>
          )
        })}
        {filteredClips.length === 0 && (
          <div style={{ fontSize: '10.5px', color: 'var(--text-faint)', padding: '6px 0' }}>
            Không có động tác nào thuộc góc này. Bấm &ldquo;+ Thêm động tác&rdquo; để tạo.
          </div>
        )}
      </div>

      {/* Modal Tạo động tác mới */}
      <WorkshopNewMotionModal
        isOpen={isNewMotionModalOpen}
        onClose={() => setIsNewMotionModalOpen(false)}
        bones={rig.bones}
        onCreated={handleCreatedClip}
      />

      {/* Thanh công cụ quản lý clip đang active */}
      <div className="lw-clip-toolbar">
        {isRenaming ? (
          <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
            <input
              type="text"
              className="input-text xs"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              style={{ flex: 1, fontSize: '11px', padding: '2px 6px' }}
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
            <button
              type="button"
              className="btn xs"
              onClick={handleStartRename}
              title="Đổi tên động tác này"
              style={{ fontSize: '10.5px', padding: '2px 6px' }}
            >
              <IconPen width={10} height={10} /> Đổi tên
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={handleDuplicateCurrent}
              title="Nhân bản động tác này"
              style={{ fontSize: '10.5px', padding: '2px 6px' }}
            >
              <IconCopy width={10} height={10} /> Nhân bản
            </button>
            {clips.length > 1 && (
              <button
                type="button"
                className="btn xs icon"
                onClick={handleDelete}
                title="Xóa động tác này"
                style={{ width: '22px', height: '22px', color: 'var(--text-faint)' }}
              >
                <IconTrash width={10} height={10} />
              </button>
            )}
            <button
              type="button"
              className="btn xs secondary"
              onClick={onOpenRetarget}
              title="Kế thừa góc xoay và vị trí chuyển động từ nhân vật/mẫu khác"
              style={{ fontSize: '10.5px', padding: '2px 7px', marginLeft: 'auto', color: 'var(--accent)' }}
            >
              🔄 Kế thừa động tác
            </button>
          </>
        )}
      </div>
    </div>
  )
}


