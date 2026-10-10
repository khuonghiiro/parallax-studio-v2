import { useState } from 'react'
import type { AnimationClip, LayerRig } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import { MOTION_PRESETS, type ProceduralMotionPreset } from './workshopRigPresets'
import { IconCopy, IconPen, IconPlus, IconTrash } from '../icons'

export interface WorkshopClipBarProps {
  rig: LayerRig
  activeClip: AnimationClip
  run: (action: RigAction) => void
  onOpenRetarget: () => void
}

export function WorkshopClipBar({ rig, activeClip, run, onOpenRetarget }: WorkshopClipBarProps) {
  const clips = rig.clips ?? [activeClip]
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(activeClip.name)

  const handleSelectClip = (clipId: string) => {
    if (clipId === activeClip.id) return
    run({ action: 'switch-clip', clipId })
    setIsRenaming(false)
  }

  const handleAddPreset = (preset: ProceduralMotionPreset) => {
    run({ action: 'apply-preset-animation', preset, asNewClip: true })
    setIsMenuOpen(false)
  }

  const handleAddBlank = () => {
    const newId = `clip-custom-${Date.now().toString(36)}`
    run({
      action: 'add-clip',
      clip: {
        id: newId,
        name: `Động tác ${clips.length + 1}`,
        duration: 2.0,
        loop: true,
        tracks: {}
      }
    })
    setIsMenuOpen(false)
  }

  const handleDuplicateCurrent = () => {
    run({ action: 'duplicate-clip', clipId: activeClip.id })
    setIsMenuOpen(false)
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

  return (
    <div className="lw-clip-section">
      <div className="lw-clip-header">
        <span>🎬 Động tác hoạt ảnh ({clips.length})</span>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn xs primary"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{ fontSize: '11px', padding: '3px 8px' }}
          >
            <IconPlus width={10} height={10} /> Thêm động tác
          </button>

          {isMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                width: '210px',
                background: 'var(--bg-1)',
                border: '1px solid var(--line-focus)',
                borderRadius: '6px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                zIndex: 55000,
                padding: '5px 0'
              }}
            >
              <div style={{ padding: '4px 10px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                MẪU CHUYỂN ĐỘNG CÓ SẴN
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {MOTION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '5px 10px',
                      background: 'transparent',
                      border: 0,
                      color: 'var(--text)',
                      fontSize: '11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => handleAddPreset(p.id)}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              <div style={{ height: '1px', background: 'var(--line-soft)', margin: '4px 0' }} />

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={handleAddBlank}
              >
                <span>➕</span>
                <span>Tạo động tác trống mới</span>
              </button>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={handleDuplicateCurrent}
              >
                <IconCopy width={11} height={11} />
                <span>Nhân bản động tác hiện tại</span>
              </button>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--accent)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  setIsMenuOpen(false)
                  onOpenRetarget()
                }}
              >
                <span>🔄</span>
                <span>Kế thừa từ chi tiết khác...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dãy nút chọn Clips động tác */}
      <div className="lw-clip-list">
        {clips.map((clip) => {
          const isActive = clip.id === activeClip.id
          return (
            <button
              key={clip.id}
              type="button"
              className={`lw-clip-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectClip(clip.id)}
              title={`${clip.name} (Thời lượng: ${clip.duration}s)`}
            >
              <span>{clip.name}</span>
            </button>
          )
        })}
      </div>

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
