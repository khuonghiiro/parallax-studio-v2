import { useState, useId, useEffect } from 'react'
import type { AnimationClip, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { ProceduralMotionPreset } from './workshopRigPresets'
import { MOTION_PRESETS, createClipFromPreset } from './workshopRigPresets'
import {
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildMixamoClipForBones,
  buildStarterPresetClipsForBones,
  createScaledLandmarks,
  extractLandmarksFromBones,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoMannequinPreview } from './MixamoMannequinPreview'
import { MixamoLandmarkPlacer } from './MixamoLandmarkPlacer'
import { IconX } from '../icons'

export interface WorkshopNewMotionModalProps {
  isOpen: boolean
  onClose: () => void
  bones: LayerBone[]
  composite?: LayerComposite
  onCreated: (clip: AnimationClip) => void
  onApplyMixamoRigMotion?: (payload: {
    bones: LayerBone[]
    clip?: AnimationClip
    clips?: AnimationClip[]
    replaceClips?: boolean
    autoBindSoft?: boolean
  }) => void
}

export const VIEW_ANGLES: Array<{
  id: MotionViewAngle
  label: string
  sub: string
  icon: string
  degrees: string
}> = [
  { id: 'front', label: 'Chính diện', sub: 'Nhìn thẳng', icon: '🧭', degrees: '0°' },
  { id: 'diagonal', label: 'Góc chéo', sub: 'Nghiêng 3/4', icon: '📐', degrees: '45°' },
  { id: 'side', label: 'Góc ngang', sub: 'Nhìn bên', icon: '↔️', degrees: '90°' },
  { id: 'back', label: 'Sau lưng', sub: 'Quay lưng', icon: '🔄', degrees: '180°' }
]

export function WorkshopNewMotionModal({
  isOpen,
  onClose,
  bones,
  composite,
  onCreated,
  onApplyMixamoRigMotion
}: WorkshopNewMotionModalProps) {
  const [selectedAngle, setSelectedAngle] = useState<MotionViewAngle>('front')
  const [selectedPreset, setSelectedPreset] = useState<ProceduralMotionPreset | 'blank'>('walk')
  const [duration, setDuration] = useState<number>(1.6)
  const [isLoop, setIsLoop] = useState<boolean>(true)
  const [name, setName] = useState<string>('Bước đi [0° Chính diện]')
  const [isCustomName, setIsCustomName] = useState<boolean>(false)
  const [autoBindSoft, setAutoBindSoft] = useState<boolean>(true)
  const [landmarks, setLandmarks] = useState<MixamoLandmarks>(() =>
    composite
      ? autoDetectLandmarksFromComposite(composite)
      : extractLandmarksFromBones(bones) ?? createScaledLandmarks(1)
  )

  useEffect(() => {
    if (isOpen) {
      if (composite && composite.layers.length > 0) {
        setLandmarks(autoDetectLandmarksFromComposite(composite))
      } else {
        const fromBones = extractLandmarksFromBones(bones)
        setLandmarks(fromBones ?? createScaledLandmarks(1))
      }
    }
  }, [isOpen, bones, composite])

  const nameInputId = useId()
  const durationInputId = useId()
  const loopInputId = useId()
  const bindInputId = useId()

  if (!isOpen) return null

  const getAutoName = (preset: ProceduralMotionPreset | 'blank', angle: MotionViewAngle): string => {
    const angleLabel =
      angle === 'front'
        ? '0° Chính diện'
        : angle === 'side'
          ? '90° Góc ngang'
          : angle === 'diagonal'
            ? '45° Góc chéo'
            : '180° Sau lưng'
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

  /** Chỉ thêm clip vào bộ xương hiện có (không đổi xương) */
  const handleCreateClipOnly = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    const activeBones = bones.length > 0 ? bones : buildHumanoidBonesFromLandmarks(landmarks)
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
      clip = createClipFromPreset(selectedPreset, activeBones, finalName, selectedAngle)
      clip.duration = Math.max(0.2, Number(duration) || clip.duration)
      clip.loop = isLoop
      clip.viewAngle = selectedAngle
    }

    onCreated(clip)
    onClose()
  }

  /** Gắn xương mới theo tọa độ điểm nhấn Mixamo + tự động co giãn động tác theo kích thước xương */
  const handleApplyMixamoRigAndMotion = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    const generatedBones = buildHumanoidBonesFromLandmarks(landmarks)
    const clip = buildMixamoClipForBones({
      preset: selectedPreset,
      bones: generatedBones,
      name: finalName,
      viewAngle: selectedAngle,
      duration: Math.max(0.2, Number(duration) || 1.6),
      loop: isLoop
    })

    if (onApplyMixamoRigMotion) {
      onApplyMixamoRigMotion({
        bones: generatedBones,
        clip,
        autoBindSoft
      })
      onClose()
    } else {
      onCreated(clip)
      onClose()
    }
  }

  /** Gắn 15 xương theo 8 vòng tròn Mixamo + nạp sẵn trọn bộ 7 động tác mẫu theo góc đang chọn */
  const handleApplyMixamoStarterPack = () => {
    const generatedBones = buildHumanoidBonesFromLandmarks(landmarks)
    const starterClips = buildStarterPresetClipsForBones(generatedBones, selectedAngle)
    if (onApplyMixamoRigMotion) {
      onApplyMixamoRigMotion({
        bones: generatedBones,
        clips: starterClips,
        replaceClips: true,
        autoBindSoft
      })
      onClose()
    } else if (starterClips[0]) {
      onCreated(starterClips[0])
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tạo động tác mới & Gắn điểm xương Mixamo"
      className="lw-mixamo-motion-modal lw-new-motion-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(3px)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '960px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: '10px',
          boxShadow: '0 18px 42px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🎬</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                Thư Viện Động Tác Mẫu & Gắn Điểm Khung Xương (Mixamo Auto-Rig)
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                Xem mẫu người với xương chuyển động sẵn, đặt điểm khớp theo kích cỡ nhân vật để tự động nhận xương và gắn động tác
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng hộp thoại"
            style={{ width: '24px', height: '24px' }}
          >
            <IconX width={12} height={12} />
          </button>
        </div>

        {/* Body 2-column grid */}
        <div
          style={{
            padding: '14px 16px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }}
        >
          {/* CỘT TRÁI: Demo Người & Xương + Chọn Góc Nhìn + Chọn Mẫu Động Tác */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MixamoMannequinPreview
              preset={selectedPreset}
              viewAngle={selectedAngle}
              duration={duration}
            />

            {/* 1. Chọn Góc nhìn nhân vật */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  1. Chọn Góc nhìn nhân vật
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  Biên độ vung chân tay theo góc
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
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
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-1))' : 'var(--bg-2)',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{ang.icon}</span>
                      <strong style={{ fontSize: '10.5px', marginTop: '2px' }}>{ang.label}</strong>
                      <span style={{ fontSize: '9px', opacity: 0.75 }}>{ang.degrees}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Chọn Mẫu chuyển động */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  2. Chọn Mẫu động tác có sẵn
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {MOTION_PRESETS.length} mẫu chuẩn
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  maxHeight: '175px',
                  overflowY: 'auto',
                  paddingRight: '2px'
                }}
              >
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
                        gap: '6px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))' : 'var(--bg-2)',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{p.icon}</span>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {p.name.split(' (')[0]}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
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
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: `1px dashed ${selectedPreset === 'blank' ? 'var(--accent)' : 'var(--line)'}`,
                    backgroundColor: selectedPreset === 'blank' ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))' : 'var(--bg-2)',
                    color: selectedPreset === 'blank' ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>➕</span>
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600 }}>Tạo trống</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Tự diễn hoạt</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Gắn Điểm Nhấn Mixamo Trên Nhân Vật + Cấu Hình */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MixamoLandmarkPlacer
              composite={composite}
              landmarks={landmarks}
              onChange={setLandmarks}
            />

            {/* 3. Cấu hình tên, thời lượng & tự động gắn lưới */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-0)',
                borderRadius: '8px',
                border: '1px solid var(--line-soft)'
              }}
            >
              <div>
                <label htmlFor={nameInputId} style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '3px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                <div>
                  <label htmlFor={durationInputId} style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '3px' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '14px' }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                <input
                  id={bindInputId}
                  type="checkbox"
                  checked={autoBindSoft}
                  onChange={(e) => setAutoBindSoft(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: '14px', height: '14px' }}
                />
                <label htmlFor={bindInputId} style={{ fontSize: '10.5px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  🔗 Tự động gắn lưới Uốn mềm (Mesh 2D) của nhân vật vào khung xương mới
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
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-2)'
          }}
        >
          <button type="button" className="btn sm" onClick={onClose}>
            Hủy bỏ
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {bones.length > 0 && onApplyMixamoRigMotion && (
              <button
                type="button"
                className="btn sm"
                onClick={handleCreateClipOnly}
                title="Chỉ thêm động tác vào danh sách và giữ nguyên vị trí xương hiện có"
              >
                ➕ Chỉ thêm động tác (Giữ xương cũ)
              </button>
            )}
            {onApplyMixamoRigMotion && (
              <button
                type="button"
                className="btn sm"
                onClick={handleApplyMixamoStarterPack}
                title="Tạo 15 khớp xương từ 8 vòng tròn Mixamo và nạp sẵn trọn bộ 7 động tác chuẩn (Đi bộ, Đứng thở, Chạy, Vẫy tay, Nhảy, Vung đòn, Cúi chào)"
              >
                📦 Gắn Xương & Nạp Trọn Bộ 7 Động Tác
              </button>
            )}
            <button
              type="button"
              className="btn sm primary"
              onClick={onApplyMixamoRigMotion ? handleApplyMixamoRigAndMotion : handleCreateClipOnly}
              title="Tự động tạo 15 xương khớp theo 8 vòng tròn Mixamo đã đặt và gắn động tác vừa chọn lên nhân vật"
            >
              <span>✨ Gắn Xương Theo 8 Điểm & Áp Động Tác</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
