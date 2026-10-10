import { useState, useId } from 'react'
import type { AnimationClip, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import { MOTION_PRESETS, createClipFromPreset } from './workshopRigPresets'
import { IconX } from '../icons'

export interface WorkshopNewMotionModalProps {
  isOpen: boolean
  onClose: () => void
  bones: LayerBone[]
  onCreated: (clip: AnimationClip) => void
}

export const VIEW_ANGLES: Array<{
  id: MotionViewAngle
  label: string
  sub: string
  icon: string
  degrees: string
}> = [
  { id: 'front', label: 'Chính diện', sub: 'Nhìn thẳng camera', icon: '🧭', degrees: '0°' },
  { id: 'diagonal', label: 'Góc chéo', sub: 'Nghiêng 3/4', icon: '📐', degrees: '45°' },
  { id: 'side', label: 'Góc ngang', sub: 'Nhìn nghiêng bên', icon: '↔️', degrees: '90°' },
  { id: 'back', label: 'Sau lưng', sub: 'Quay lưng lại', icon: '🔄', degrees: '180°' }
]

export function WorkshopNewMotionModal({
  isOpen,
  onClose,
  bones,
  onCreated
}: WorkshopNewMotionModalProps) {
  const [selectedAngle, setSelectedAngle] = useState<MotionViewAngle>('front')
  const [selectedPreset, setSelectedPreset] = useState<ProceduralMotionPreset | 'blank'>('walk')
  const [duration, setDuration] = useState<number>(1.6)
  const [isLoop, setIsLoop] = useState<boolean>(true)
  const [name, setName] = useState<string>('Bước đi [0° Chính diện]')
  const [isCustomName, setIsCustomName] = useState<boolean>(false)

  const nameInputId = useId()
  const durationInputId = useId()
  const loopInputId = useId()

  if (!isOpen) return null

  const getAutoName = (preset: ProceduralMotionPreset | 'blank', angle: MotionViewAngle): string => {
    const angleLabel = angle === 'front' ? '0° Chính diện' : angle === 'side' ? '90° Góc ngang' : angle === 'diagonal' ? '45° Góc chéo' : '180° Sau lưng'
    if (preset === 'blank') return `Động tác mới [${angleLabel}]`
    const pMeta = MOTION_PRESETS.find((p) => p.id === preset)
    const baseName = pMeta ? pMeta.name.split(' (')[0] : 'Động tác'
    return `${baseName} [${angleLabel}]`
  }

  const handleAngleSelect = (angle: MotionViewAngle) => {
    setSelectedAngle(angle)
    if (!isCustomName) {
      setName(getAutoName(selectedPreset, angle))
    }
  }

  const handlePresetSelect = (preset: ProceduralMotionPreset | 'blank') => {
    setSelectedPreset(preset)
    if (preset !== 'blank') {
      const pMeta = MOTION_PRESETS.find((p) => p.id === preset)
      if (pMeta) setDuration(pMeta.duration)
    }
    if (!isCustomName) {
      setName(getAutoName(preset, selectedAngle))
    }
  }

  const handleCreate = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    let clip: AnimationClip

    if (selectedPreset === 'blank') {
      const newId = `clip-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      clip = {
        id: newId,
        name: finalName,
        duration: Math.max(0.2, Number(duration) || 2.0),
        loop: isLoop,
        tracks: {},
        viewAngle: selectedAngle,
        description: `Động tác tự do theo góc nhìn ${selectedAngle}`
      }
    } else {
      clip = createClipFromPreset(selectedPreset, bones, finalName, selectedAngle)
      clip.duration = Math.max(0.2, Number(duration) || clip.duration)
      clip.loop = isLoop
      clip.viewAngle = selectedAngle
    }

    onCreated(clip)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tạo động tác mới"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: '10px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🎬</span>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
              Tạo Động Tác Hoạt Ảnh Mới
            </span>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng hộp thoại"
            style={{ width: '22px', height: '22px' }}
          >
            <IconX width={12} height={12} />
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Section 1: Góc nhìn nhân vật */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
                1. Chọn Góc nhìn / Hướng nhân vật
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                Quyết định biên độ vung chân tay phù hợp góc ảnh
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {VIEW_ANGLES.map((ang) => {
                const isSelected = selectedAngle === ang.id
                return (
                  <button
                    key={ang.id}
                    type="button"
                    onClick={() => handleAngleSelect(ang.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                      backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-1))' : 'var(--bg-2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '18px', marginBottom: '4px' }}>{ang.icon}</span>
                    <strong style={{ fontSize: '11.5px' }}>{ang.label}</strong>
                    <span style={{ fontSize: '9.5px', opacity: 0.75, marginTop: '2px' }}>{ang.degrees}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-faint)', marginTop: '2px', textAlign: 'center', lineHeight: 1.2 }}>
                      {ang.sub}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Mẫu chuyển động */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
                2. Chọn Mẫu chuyển động khởi tạo
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                Tự động tính góc xương theo {selectedAngle === 'front' ? '0° Chính diện' : selectedAngle === 'side' ? '90° Góc ngang' : 'góc nhìn đã chọn'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {MOTION_PRESETS.map((p) => {
                const isSelected = selectedPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                      backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))' : 'var(--bg-2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s'
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>{p.icon}</span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {p.name.split(' (')[0]}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-dim)' }}>
                        {p.duration}s
                      </div>
                    </div>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => handlePresetSelect('blank')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px dashed ${selectedPreset === 'blank' ? 'var(--accent)' : 'var(--line)'}`,
                  backgroundColor: selectedPreset === 'blank' ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))' : 'var(--bg-2)',
                  color: selectedPreset === 'blank' ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s'
                }}
              >
                <span style={{ fontSize: '15px' }}>➕</span>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600 }}>Tạo trống</div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-dim)' }}>Tự tạo dáng từ đầu</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 3: Cấu hình tên & thời lượng */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'var(--bg-0)',
              borderRadius: '6px',
              border: '1px solid var(--line-soft)'
            }}
          >
            <div>
              <label htmlFor={nameInputId} style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                Tên động tác:
              </label>
              <input
                id={nameInputId}
                type="text"
                className="input-text sm"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setIsCustomName(true)
                }}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <label htmlFor={durationInputId} style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  Thời lượng chu kỳ (giây):
                </label>
                <input
                  id={durationInputId}
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="60"
                  className="input-text sm"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
                <input
                  id={loopInputId}
                  type="checkbox"
                  checked={isLoop}
                  onChange={(e) => setIsLoop(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: '14px', height: '14px' }}
                />
                <label htmlFor={loopInputId} style={{ fontSize: '11px', color: 'var(--text)', cursor: 'pointer' }}>
                  Lặp chu kỳ chuyển động
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            background: 'var(--bg-2)'
          }}
        >
          <button type="button" className="btn sm" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="button" className="btn sm primary" onClick={handleCreate}>
            <span>Tạo động tác</span>
          </button>
        </div>
      </div>
    </div>
  )
}
