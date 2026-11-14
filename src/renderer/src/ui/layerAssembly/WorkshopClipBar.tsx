import { memo, useState } from 'react'
import type { AnimationClip, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import type { MotionMeshExportSection, ParsedWindData } from './workshopClipJson'
import {
  inferDescriptiveClipName,
  isGenericClipName,
  normalizeAndFixBiomechanicalTracks
} from './workshopClipBiomechanics'
import { toast } from '../../actions'
import { IconCode, IconCopy, IconPen, IconPlus, IconSparkles, IconTrash } from '../icons'
import { WorkshopNewMotionModal } from './WorkshopNewMotionModal'
import { WorkshopClipJsonModal } from './WorkshopClipJsonModal'

export interface WorkshopClipBarProps {
  rig: LayerRig
  activeClip: AnimationClip
  composite?: LayerComposite
  run: (action: RigAction) => void
  onOpenRetarget: () => void
}

export const WorkshopClipBar = memo(function WorkshopClipBar({
  rig,
  activeClip,
  composite,
  run,
  onOpenRetarget
}: WorkshopClipBarProps) {
  const clips = rig.clips ?? [activeClip]
  const [isNewMotionModalOpen, setIsNewMotionModalOpen] = useState(false)
  const [isClipJsonModalOpen, setIsClipJsonModalOpen] = useState(false)
  const [angleFilter, setAngleFilter] = useState<MotionViewAngle | 'all'>('all')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(activeClip.name)

  const handleSelectClip = (clipId: string) => {
    if (clipId === activeClip.id) return
    run({ action: 'switch-clip', clipId })
    setIsRenaming(false)
  }

  const handleImportClip = (
    clip: AnimationClip,
    mode: 'new' | 'replace',
    wind?: ParsedWindData,
    mesh?: Partial<MotionMeshExportSection>
  ) => {
    if (mode === 'new') {
      run({ action: 'add-clip', clip, ...(wind ? { wind } : {}), ...(mesh ? { mesh } : {}) })
    } else {
      run({
        action: 'replace-clip',
        clipId: activeClip.id,
        clip,
        ...(wind ? { wind } : {}),
        ...(mesh ? { mesh } : {})
      })
    }
  }

  const handleNormalizeCurrentClip = () => {
    const { tracks, fixesApplied } = normalizeAndFixBiomechanicalTracks(
      activeClip.tracks || {},
      rig.bones,
      activeClip.viewAngle ?? 'front'
    )
    const nextName = isGenericClipName(activeClip.name)
      ? inferDescriptiveClipName(tracks, rig.bones, composite?.plantSpines?.length ?? 0)
      : activeClip.name
    const nextClip: AnimationClip = {
      ...activeClip,
      name: nextName,
      tracks
    }
    run({
      action: 'replace-clip',
      clipId: activeClip.id,
      clip: nextClip,
      mesh: { enabled: true, meshEnvelope: true }
    })
    if (fixesApplied.length > 0 || nextName !== activeClip.name) {
      toast(`✓ Đã chuẩn hoá 2.5D cho "${nextName}" (${fixesApplied.length} hiệu chỉnh cơ học)!`)
    } else {
      toast(`✓ Động tác "${nextName}" đã đạt chuẩn cơ học 2.5D!`)
    }
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

  const handleCreateBlankClip = () => {
    const newClip: AnimationClip = {
      id: `clip-custom-${Date.now().toString(36)}`,
      name: `Động tác mới ${clips.length + 1}`,
      duration: 2.0,
      fps: rig.fps,
      loop: true,
      tracks: {}
    }
    run({ action: 'add-clip', clip: newClip })
    setRenameValue(newClip.name)
    setIsRenaming(true)
  }

  return (
    <div className="lw-card-section lw-clip-section">
      <div className="lw-card-header lw-clip-card-header">
        <span className="lw-card-title">
          <span>Clips</span>
          <span className="lw-card-badge">{clips.length}</span>
        </span>
        <div className="lw-clip-head-actions">
          <button
            type="button"
            className="btn xs primary lw-clip-new-btn"
            onClick={handleCreateBlankClip}
            title="Tạo ngay một động tác trống mới từ dáng gốc để tự đặt Keyframe"
          >
            <IconPlus width={10} height={10} />
            <span>Mới</span>
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => setIsNewMotionModalOpen(true)}
            title="Mở Studio Mixamo để gắn điểm khớp tự động và tạo bộ mẫu động tác"
          >
            <span>Mixamo</span>
          </button>
          <button
            type="button"
            className="btn xs lw-clip-json-btn lw-clip-json-highlight-btn"
            onClick={() => setIsClipJsonModalOpen(true)}
            title="Xuất / Nhập JSON động tác (kèm quy chuẩn 2.5D & Gió) hoặc sao chép Prompt cho AI khác"
          >
            <IconCode width={11} height={11} />
            <span>JSON</span>
            <span className="lw-json-badge-sparkle">✨</span>
          </button>
          {hasAnyKeyframes && (
            <button
              type="button"
              className="btn xs icon lw-muted-danger-btn"
              onClick={handleDeleteAll}
              title="Xoá hết toàn bộ các động tác hoạt ảnh để đưa nhân vật về tư thế tĩnh (Ctrl+Z để hoàn tác)"
            >
              <IconTrash width={10} height={10} />
            </button>
          )}
        </div>
      </div>

      {/* Thanh lọc nhanh theo góc nhìn */}
      <div className="lw-angle-seg-bar compact" role="group" aria-label="Lọc clip theo góc nhìn">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'front', label: '0° Mặt' },
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

      <WorkshopClipJsonModal
        isOpen={isClipJsonModalOpen}
        onClose={() => setIsClipJsonModalOpen(false)}
        clip={activeClip}
        bones={rig.bones}
        composite={composite}
        onImportClip={handleImportClip}
      />

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
            <div className="lw-clip-tools-row">
              <button type="button" className="btn xs" onClick={handleStartRename} title="Đổi tên động tác này">
                <IconPen width={10} height={10} />
                <span>Đổi tên</span>
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={handleNormalizeCurrentClip}
                title="Tự động chuẩn hoá cơ học 2.5D (sửa tay đan chéo bụng, chân chữ X, tự đặt tên mô tả)"
              >
                <IconSparkles width={10} height={10} />
                <span>Chuẩn 2.5D</span>
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
            </div>
            <div className="lw-clip-tools-row">
              <button
                type="button"
                className="btn xs lw-retarget-cta-btn" style={{ width: '100%' }}
                onClick={onOpenRetarget}
                title="Kế thừa góc xoay và vị trí chuyển động từ nhân vật/mẫu khác"
              >
                <span>⇄ Kế thừa động tác</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
})
