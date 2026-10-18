import { useState, useId, useEffect, useMemo } from 'react'
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
    extractLandmarksFromBones(bones) ??
    (composite ? autoDetectLandmarksFromComposite(composite) : createScaledLandmarks(1))
  )

  useEffect(() => {
    if (isOpen) {
      const fromBones = extractLandmarksFromBones(bones)
      if (fromBones) {
        setLandmarks(fromBones)
      } else if (composite && composite.layers.length > 0) {
        setLandmarks(autoDetectLandmarksFromComposite(composite))
      } else {
        setLandmarks(createScaledLandmarks(1))
      }
    }
  }, [isOpen, bones, composite])

  const previewBones = useMemo(() => buildHumanoidBonesFromLandmarks(landmarks), [landmarks])

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
    const activeBones = bones.length > 0 ? bones : previewBones
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

  /** Gắn xương mới theo tọa độ 12 điểm giải phẫu Mixamo + tự động co giãn động tác theo kích thước xương */
  const handleApplyMixamoRigAndMotion = () => {
    const finalName = name.trim() || getAutoName(selectedPreset, selectedAngle)
    const generatedBones = previewBones
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

  /** Gắn 15 xương theo 12 vòng tròn giải phẫu Mixamo + nạp sẵn trọn bộ 7 động tác mẫu theo góc đang chọn */
  const handleApplyMixamoStarterPack = () => {
    const generatedBones = previewBones
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
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '1220px',
          maxWidth: '96vw',
          height: '86vh',
          maxHeight: '840px',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: '10px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55)',
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
            background: 'var(--bg-2)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🎬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Studio Mixamo 2.5D — Gắn 12 Điểm Giải Phẫu & Thư Viện Động Tác Mẫu</span>
                <span className="lw-card-badge" style={{ fontSize: '10px' }}>
                  Cằm · 2 Vai · 2 Khuỷu · 2 Cổ tay · Háng · 2 Gối · 2 Cổ chân
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '1px' }}>
                Đặt 12 vòng tròn theo đúng vai, tay, háng, đầu gối và cổ chân của nhân vật (trái) — Xem thử chuyển động & chọn mẫu (phải)
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng Studio Mixamo"
            style={{ width: '26px', height: '26px' }}
          >
            <IconX width={13} height={13} />
          </button>
        </div>

        {/* Body 2-pane Studio Layout: [Sân Khấu Đặt 12 Điểm Khớp Lớn (58%)] | [Bảng Xem Thử & Chọn Động Tác (42%)] */}
        <div
          style={{
            padding: '12px 14px',
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '1.38fr 1fr',
            gap: '14px',
            overflow: 'hidden'
          }}
        >
          {/* CỘT TRÁI (RỘNG): Sân khấu đặt 12 vòng tròn giải phẫu trên nhân vật (Full Height, Có Zoom/Pan, Không đè chữ) */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
            <MixamoLandmarkPlacer
              composite={composite}
              landmarks={landmarks}
              onChange={setLandmarks}
              fullHeight
            />
          </div>

          {/* CỘT PHẢI: Xem Thử Khung Xương Động Tác + Chọn Góc Nhìn + 12 Mẫu Chuyển Động + Thông Số */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              minHeight: 0,
              height: '100%',
              overflowY: 'auto',
              paddingRight: '2px'
            }}
          >
            <MixamoMannequinPreview
              preset={selectedPreset}
              viewAngle={selectedAngle}
              duration={duration}
              customBones={previewBones}
              height={175}
            />

            {/* 1. Chọn Góc nhìn nhân vật */}
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--bg-0)',
                border: '1px solid var(--line-soft)',
                borderRadius: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  1. Chọn Góc nhìn nhân vật
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  Tự động đổi biên độ sải tay & chân
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
                        padding: '5px 4px',
                        borderRadius: '6px',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-1))' : 'var(--bg-2)',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{ang.icon}</span>
                      <strong style={{ fontSize: '10px', marginTop: '1px' }}>{ang.label}</strong>
                      <span style={{ fontSize: '9px', opacity: 0.75 }}>{ang.degrees}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Chọn Mẫu chuyển động */}
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--bg-0)',
                border: '1px solid var(--line-soft)',
                borderRadius: '8px',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  2. Chọn Mẫu động tác có sẵn
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                  {MOTION_PRESETS.length} mẫu chuẩn Mixamo
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '5px',
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
                        padding: '5px 7px',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-1))' : 'var(--bg-2)',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{p.icon}</span>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {p.name.split(' (')[0]}
                        </div>
                        <div style={{ fontSize: '8.5px', color: 'var(--text-dim)' }}>
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
                    padding: '5px 7px',
                    borderRadius: '6px',
                    border: `1px dashed ${selectedPreset === 'blank' ? 'var(--accent)' : 'var(--line)'}`,
                    backgroundColor: selectedPreset === 'blank' ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-1))' : 'var(--bg-2)',
                    color: selectedPreset === 'blank' ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '13px' }}>➕</span>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600 }}>Tạo trống</div>
                    <div style={{ fontSize: '8.5px', color: 'var(--text-dim)' }}>Tự diễn hoạt</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Cấu hình tên, thời lượng & tự động gắn lưới */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-0)',
                borderRadius: '8px',
                border: '1px solid var(--line-soft)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr', gap: '8px', alignItems: 'center' }}>
                <div>
                  <label htmlFor={nameInputId} style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>
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
                    style={{ width: '100%', boxSizing: 'border-box', height: '25px', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <label htmlFor={durationInputId} style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>
                    Thời lượng (giây):
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
                    style={{ width: '100%', boxSizing: 'border-box', height: '25px', fontSize: '11px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <label htmlFor={loopInputId} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--text)', cursor: 'pointer' }}>
                  <input
                    id={loopInputId}
                    type="checkbox"
                    checked={isLoop}
                    onChange={(e) => setIsLoop(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span>🔄 Lặp chu kỳ</span>
                </label>

                <label htmlFor={bindInputId} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <input
                    id={bindInputId}
                    type="checkbox"
                    checked={autoBindSoft}
                    onChange={(e) => setAutoBindSoft(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span>🔗 Tự gắn lưới Uốn mềm (Mesh 2D)</span>
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
            background: 'var(--bg-2)',
            flexShrink: 0
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
                title="Tạo 15 khớp xương từ 12 vòng tròn giải phẫu và nạp sẵn trọn bộ 7 động tác chuẩn (Đi bộ, Đứng thở, Chạy, Vẫy tay, Nhảy, Vung đòn, Cúi chào)"
              >
                📦 Gắn Xương & Nạp Trọn Bộ 7 Động Tác
              </button>
            )}
            <button
              type="button"
              className="btn sm primary"
              onClick={onApplyMixamoRigMotion ? handleApplyMixamoRigAndMotion : handleCreateClipOnly}
              title="Tự động tạo 15 xương khớp theo 12 điểm giải phẫu đã đặt và gắn động tác vừa chọn lên nhân vật"
            >
              <span>✨ Gắn Xương Theo 12 Điểm & Áp Động Tác</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

